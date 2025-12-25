import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Project, AppNotification } from '../types';
import { supabase } from '../supabase';

interface PageReviewProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  addNotification?: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
}

const PageReview: React.FC<PageReviewProps> = ({ projects, setProjects, addNotification }) => {
  const { projectId, versionId, pageId } = useParams<{ projectId: string; versionId: string; pageId: string }>();
  const navigate = useNavigate();
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  
  // HERRAMIENTAS
  const [scale, setScale] = useState(1);
  const [showResolved, setShowResolved] = useState(true);
  
  // ESTADOS DE COMENTARIOS
  const [comment, setComment] = useState("");
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [isPinMode, setIsPinMode] = useState(false);
  const [tempPin, setTempPin] = useState<{x: number, y: number} | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);

  // ESTADOS COMPARADOR
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareVersionId, setCompareVersionId] = useState<string>("");
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  const project = projects.find(p => p.id === projectId);
  
  let version: any = null;
  let page: any = null;

  if (project) {
    version = project.versions.find(v => v.id === versionId);
    if (version) {
        page = version.pages.find((p: any) => p.id === pageId);
    }
  }

  // Comprobar si hay historial (Más de 1 versión)
  const hasHistory = project && project.versions.length > 1;

  const getCompareImage = () => {
      if (!project || !compareVersionId) return null;
      const otherVersion = project.versions.find(v => v.id === compareVersionId);
      const otherPage = otherVersion?.pages.find((p: any) => p.pageNumber === page.pageNumber);
      return otherPage?.imageUrl || null;
  };

  const compareImageUrl = getCompareImage();

  useEffect(() => {
    if (pageId) fetchComments();
  }, [pageId]);

  const fetchComments = async () => {
    const { data } = await supabase.from('comments').select('*').eq('page_id', pageId).order('created_at', { ascending: false });
    if (data) setCommentsList(data);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY * -0.01;
        setScale(prev => Math.min(Math.max(prev + delta, 0.5), 4));
    }
  };

  const handleSliderMove = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDraggingSlider || !sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      let clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      setSliderPosition((x / rect.width) * 100);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isCompareMode) return;
    if (!isPinMode || !imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setTempPin({ x, y });
    setIsPinMode(false);
  };

  const handleSavePin = async () => {
    if (!comment || !pageId) return;
    const { data } = await supabase.from('comments').insert([
        { content: comment, page_id: pageId, x: tempPin?.x || 50, y: tempPin?.y || 50, resolved: false }
    ]).select();

    if (data) {
        setCommentsList(prev => [data[0], ...prev]);
        setComment(""); setTempPin(null); setAttachedFile(null);
    }
  };

  const toggleResolved = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('comments').update({ resolved: !currentStatus }).eq('id', id);
    if (!error) {
        setCommentsList(prev => prev.map(c => c.id === id ? { ...c, resolved: !currentStatus } : c));
    }
  };

  if (!project || !version || !page) return <div className="p-10 text-center text-white">Cargando...</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden" 
         onMouseMove={isDraggingSlider ? (e) => handleSliderMove(e) : undefined}
         onMouseUp={() => setIsDraggingSlider(false)}
         onTouchMove={isDraggingSlider ? (e) => handleSliderMove(e) : undefined}
         onTouchEnd={() => setIsDraggingSlider(false)}
    >
      {/* HEADER */}
      <header className="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6 z-50 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white flex items-center gap-1">← Volver</button>
            <h1 className="font-bold truncate max-w-xs text-sm md:text-base hidden md:block">{project.name} <span className="text-slate-500 font-normal">/ Pág {page.pageNumber}</span></h1>
          </div>
          
          {/* ZOOM SIEMPRE VISIBLE */}
          <div className="flex items-center gap-2 bg-slate-700 p-1 rounded-lg absolute left-1/2 -translate-x-1/2">
                <button onClick={() => setScale(s => Math.max(s - 0.2, 0.5))} className="p-1 px-2 hover:bg-slate-600 rounded">➖</button>
                <span className="text-xs font-mono w-10 text-center">{Math.round(scale * 100)}%</span>
                <button onClick={() => setScale(s => Math.min(s + 0.2, 4))} className="p-1 px-2 hover:bg-slate-600 rounded">➕</button>
          </div>

          {/* HERRAMIENTAS DERECHA: COMPARAR Y AÑADIR NOTA */}
          <div className="flex items-center gap-3">
             
             {/* 1. SELECTOR DE VERSIÓN (Solo visible si estamos comparando) */}
             {isCompareMode && (
                <select 
                    className="bg-slate-900 border border-indigo-500 rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                    onChange={(e) => setCompareVersionId(e.target.value)}
                    value={compareVersionId}
                >
                    <option value="">Elegir versión...</option>
                    {project.versions.filter(v => v.id !== versionId).map(v => (
                        <option key={v.id} value={v.id}>Versión {v.versionNumber}</option>
                    ))}
                </select>
             )}

             {/* 2. BOTÓN COMPARAR (SIEMPRE VISIBLE, PERO DESACTIVADO SI NO HAY HISTORIAL) */}
             <button 
                disabled={!hasHistory}
                onClick={() => { setIsCompareMode(!isCompareMode); setIsPinMode(false); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-bold text-sm transition-all
                    ${!hasHistory 
                        ? 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed' // Estilo Desactivado
                        : isCompareMode 
                            ? 'bg-indigo-600 border-indigo-500 text-white' // Estilo Activo
                            : 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500' // Estilo Normal
                    }`}
                title={!hasHistory ? "Sube otra versión para comparar" : "Comparar versiones"}
             >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                {isCompareMode ? 'Salir' : 'Comparar'}
             </button>

             {/* 3. BOTÓN AÑADIR NOTA */}
             {!isCompareMode && (
                 <button onClick={() => setIsPinMode(!isPinMode)} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all border border-transparent ${isPinMode ? 'bg-white text-slate-900 animate-pulse' : 'bg-rose-600 text-white hover:bg-rose-700'}`}>
                    {isPinMode ? '📍 Clic en imagen' : 'Añadir Nota'}
                 </button>
             )}
          </div>
      </header>

      {/* ÁREA DE TRABAJO */}
      <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden relative flex items-center justify-center bg-slate-950/50" onWheel={handleWheel}>
            
            {/* VISTA NORMAL */}
            {!isCompareMode && (
                <div 
                    ref={imageContainerRef} 
                    onClick={handleCanvasClick} 
                    className="relative shadow-2xl transition-transform duration-100 ease-out origin-center" 
                    style={{ transform: `scale(${scale})`, cursor: isPinMode ? 'crosshair' : 'grab' }}
                >
                    <img src={page.imageUrl} alt="Page" className="max-h-[85vh] object-contain select-none" />
                    {commentsList.filter(c => showResolved || !c.resolved).map((c, i) => (
                        <div key={c.id} className="group absolute w-8 h-8 -ml-4 -mt-4 cursor-pointer z-10" style={{ left: `${c.x}%`, top: `${c.y}%` }}>
                            <div className={`w-full h-full rounded-full border-2 border-white shadow-md flex items-center justify-center text-xs font-bold ${c.resolved ? 'bg-emerald-500' : 'bg-rose-600'}`}>{i + 1}</div>
                        </div>
                    ))}
                    {tempPin && <div className="absolute w-8 h-8 bg-yellow-400 rounded-full animate-bounce border-2 border-white -ml-4 -mt-4 z-20" style={{ left: `${tempPin.x}%`, top: `${tempPin.y}%` }}></div>}
                </div>
            )}

            {/* VISTA COMPARAR */}
            {isCompareMode && (
                <div ref={sliderRef} className="relative max-h-[85vh] select-none shadow-2xl" style={{ transform: `scale(${scale})` }}>
                     <img src={page.imageUrl} className="max-h-[85vh] object-contain pointer-events-none" />
                     {compareImageUrl ? (
                        <div className="absolute top-0 left-0 h-full w-full overflow-hidden border-r-2 border-white bg-slate-900" style={{ width: `${sliderPosition}%` }}>
                             <img src={compareImageUrl} className="max-h-[85vh] object-contain" style={{ width: sliderRef.current?.offsetWidth, maxWidth: 'none' }} />
                             <div className="absolute top-4 left-4 bg-black/70 text-white text-xs px-2 py-1 rounded font-bold">ANTES</div>
                        </div>
                     ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white font-bold p-4 rounded text-center">
                            ⬇ Selecciona una versión antigua arriba para comparar ⬇
                        </div>
                     )}
                     {compareImageUrl && (
                        <div className="absolute top-0 bottom-0 w-8 -ml-4 cursor-ew-resize z-20 flex items-center justify-center" style={{ left: `${sliderPosition}%` }} onMouseDown={() => setIsDraggingSlider(true)} onTouchStart={() => setIsDraggingSlider(true)}>
                            <div className="w-1 h-full bg-white shadow-lg"></div>
                            <div className="w-8 h-8 bg-white rounded-full absolute shadow-xl flex items-center justify-center text-slate-900 font-bold text-xs">↔</div>
                        </div>
                     )}
                </div>
            )}
          </div>

          {/* BARRA LATERAL DERECHA */}
          <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0">
             <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                 <h3 className="font-bold text-slate-200">Comentarios ({commentsList.length})</h3>
                 <button onClick={() => setShowResolved(!showResolved)} className="text-xs px-2 py-1 rounded border border-slate-700 text-slate-400">{showResolved ? 'Ver todo' : 'Ocultar resueltos'}</button>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-3">
                 {commentsList.filter(c => showResolved || !c.resolved).map((c, i) => (
                     <div key={c.id} className={`p-3 rounded-xl border transition-all ${c.resolved ? 'bg-emerald-900/20 border-emerald-900/50' : 'bg-slate-800 border-slate-700'}`}>
                         <div className="flex justify-between items-start mb-2">
                             <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${c.resolved ? 'bg-emerald-500' : 'bg-rose-600'}`}>{i + 1}</span>
                             <button onClick={() => toggleResolved(c.id, c.resolved)} className="text-slate-500 hover:text-emerald-500 text-lg leading-none">✓</button>
                         </div>
                         <p className={`text-sm ${c.resolved ? 'text-emerald-200 line-through' : 'text-slate-200'}`}>{c.content}</p>
                     </div>
                 ))}
             </div>
          </div>
      </div>

      {tempPin && (
            <div className="absolute top-20 right-96 w-80 bg-white text-slate-900 p-5 rounded-2xl shadow-2xl z-50 border border-slate-200">
                <h3 className="font-bold text-lg mb-3">Nueva Nota</h3>
                <textarea autoFocus className="w-full border p-3 rounded-xl mb-3 h-24 bg-slate-50 text-sm" placeholder="Corrección..." value={comment} onChange={e => setComment(e.target.value)} />
                <button onClick={handleSavePin} className="w-full py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 text-sm">Guardar</button>
            </div>
      )}
    </div>
  );
};

export default PageReview;
