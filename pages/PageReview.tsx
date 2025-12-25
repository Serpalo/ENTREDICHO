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
  const [activeColor, setActiveColor] = useState("bg-rose-600");
  const [showResolved, setShowResolved] = useState(true);
  
  // ESTADOS DE COMENTARIOS
  const [comment, setComment] = useState("");
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [isPinMode, setIsPinMode] = useState(false);
  const [tempPin, setTempPin] = useState<{x: number, y: number} | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);

  // --- NUEVO: ESTADOS PARA EL COMPARADOR ---
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareVersionId, setCompareVersionId] = useState<string>("");
  const [sliderPosition, setSliderPosition] = useState(50); // % de la pantalla
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

  // Encontrar la imagen de la versión anterior para comparar
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

  // --- LÓGICA DEL SLIDER ---
  const handleSliderMove = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDraggingSlider || !sliderRef.current) return;
      
      const rect = sliderRef.current.getBoundingClientRect();
      let clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const percentage = (x / rect.width) * 100;
      setSliderPosition(percentage);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isCompareMode) return; // En modo comparar no ponemos pines
    if (!isPinMode || !imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setTempPin({ x, y });
    setIsPinMode(false);
  };

  const handleSavePin = async () => {
    if (!comment || !pageId) return;
    
    let attachmentUrl = null;
    if (attachedFile) {
        const fileName = `attach-${Date.now()}-${attachedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        await supabase.storage.from('brochures').upload(fileName, attachedFile);
        const { data } = supabase.storage.from('brochures').getPublicUrl(fileName);
        attachmentUrl = data.publicUrl;
    }

    const { data } = await supabase.from('comments').insert([
        { content: comment, page_id: pageId, x: tempPin?.x || 50, y: tempPin?.y || 50, resolved: false } 
        //, attachment_url: attachmentUrl 
    ]).select();

    if (data) {
        setCommentsList(prev => [data[0], ...prev]);
        setComment("");
        setTempPin(null);
        setAttachedFile(null);
    }
  };

  const toggleResolved = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('comments').update({ resolved: !currentStatus }).eq('id', id);
    if (!error) {
        setCommentsList(prev => prev.map(c => c.id === id ? { ...c, resolved: !currentStatus } : c));
    }
  };

  if (!project || !version || !page) return <div className="p-10 text-center">Cargando...</div>;

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
            <h1 className="font-bold truncate max-w-xs text-sm md:text-base">{project.name} <span className="text-slate-500 font-normal">/ Pág {page.pageNumber}</span></h1>
          </div>
          
          {/* CONTROLES CENTRALES (Zoom + Comparador) */}
          <div className="flex items-center gap-4">
             {/* BOTÓN MODO COMPARAR */}
             <button 
                onClick={() => { setIsCompareMode(!isCompareMode); setIsPinMode(false); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-sm font-bold ${isCompareMode ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}
             >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                {isCompareMode ? 'Salir de Comparar' : 'Comparar'}
             </button>

             {/* Si estamos comparando, mostrar selector de versión */}
             {isCompareMode && (
                 <select 
                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs"
                    onChange={(e) => setCompareVersionId(e.target.value)}
                    value={compareVersionId}
                 >
                     <option value="">Selecciona versión...</option>
                     {project.versions.filter(v => v.id !== versionId).map(v => (
                         <option key={v.id} value={v.id}>Versión {v.versionNumber}</option>
                     ))}
                 </select>
             )}

             {!isCompareMode && (
                <div className="flex items-center gap-2 bg-slate-700 p-1 rounded-lg">
                    <button onClick={() => setScale(s => Math.max(s - 0.2, 0.5))} className="p-1 hover:bg-slate-600 rounded">➖</button>
                    <span className="text-xs font-mono w-8 text-center">{Math.round(scale * 100)}%</span>
                    <button onClick={() => setScale(s => Math.min(s + 0.2, 4))} className="p-1 hover:bg-slate-600 rounded">➕</button>
                </div>
             )}
          </div>

          <div className="flex items-center gap-3">
             {!isCompareMode && (
                 <>
                    <div className="flex gap-1 mr-2">
                        {['bg-rose-600', 'bg-amber-500', 'bg-emerald-500', 'bg-blue-500'].map(color => (
                            <button key={color} onClick={() => setActiveColor(color)} className={`w-5 h-5 rounded-full ${color} ${activeColor === color ? 'ring-2 ring-white' : 'opacity-50 hover:opacity-100'}`} />
                        ))}
                    </div>
                    <button onClick={() => setIsPinMode(!isPinMode)} className={`px-3 py-1.5 rounded font-bold text-xs transition-all ${isPinMode ? 'bg-white text-slate-900 animate-pulse' : 'bg-rose-600 text-white'}`}>
                        {isPinMode ? '📍 Clic en imagen' : 'Añadir Nota'}
                    </button>
                 </>
             )}
          </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex flex-1 overflow-hidden">
          
          {/* ÁREA DE IMAGEN */}
          <div className="flex-1 overflow-hidden relative flex items-center justify-center bg-slate-950/50" onWheel={handleWheel}>
            
            {/* MODO NORMAL (PINES) */}
            {!isCompareMode && (
                <div 
                    ref={imageContainerRef} 
                    onClick={handleCanvasClick} 
                    className="relative shadow-2xl transition-transform duration-100 ease-out origin-center" 
                    style={{ transform: `scale(${scale})`, cursor: isPinMode ? 'crosshair' : 'grab' }}
                >
                    <img src={page.imageUrl} alt="Page" className="max-h-[85vh] object-contain select-none" />
                    
                    {commentsList.filter(c => showResolved || !c.resolved).map((c, i) => (
                        <div key={c.id} className="group absolute w-8 h-8 -ml-4 -mt-4 cursor-pointer z-10 hover:z-50" style={{ left: `${c.x}%`, top: `${c.y}%` }}>
                            <div className={`w-full h-full rounded-full border-2 border-white shadow-md flex items-center justify-center text-xs font-bold transition-colors ${c.resolved ? 'bg-emerald-500' : 'bg-rose-600'}`}>
                                {i + 1}
                            </div>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-white text-slate-900 p-2 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity text-xs z-20">
                                <p className="line-clamp-2">{c.content}</p>
                            </div>
                        </div>
                    ))}
                    {tempPin && <div className="absolute w-8 h-8 bg-yellow-400 rounded-full animate-bounce border-2 border-white -ml-4 -mt-4 z-20 shadow-xl" style={{ left: `${tempPin.x}%`, top: `${tempPin.y}%` }}></div>}
                </div>
            )}

            {/* MODO COMPARACIÓN (SLIDER) */}
            {isCompareMode && (
                <div 
                    ref={sliderRef}
                    className="relative max-h-[85vh] select-none shadow-2xl"
                    style={{ transform: `scale(${scale})` }}
                >
                     {/* IMAGEN DE FONDO (Versión ACTUAL) */}
                     <img src={page.imageUrl} alt="Current" className="max-h-[85vh] object-contain pointer-events-none" />

                     {/* IMAGEN SUPERPUESTA (Versión ANTERIOR) - CLIPEADA */}
                     {compareImageUrl ? (
                        <div 
                            className="absolute top-0 left-0 h-full w-full overflow-hidden border-r-2 border-white bg-slate-900"
                            style={{ width: `${sliderPosition}%` }}
                        >
                             <img src={compareImageUrl} alt="Old" className="max-h-[85vh] object-contain" style={{ width: sliderRef.current?.offsetWidth, maxWidth: 'none' }} />
                             
                             {/* ETIQUETA 'ANTES' */}
                             <div className="absolute top-4 left-4 bg-black/70 text-white text-xs px-2 py-1 rounded font-bold">ANTES (v{project.versions.find(v=>v.id===compareVersionId)?.versionNumber})</div>
                        </div>
                     ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white font-bold">Selecciona una versión antigua arriba ⬆</div>
                     )}

                     {/* MANILLAR DEL SLIDER */}
                     {compareImageUrl && (
                        <div 
                            className="absolute top-0 bottom-0 w-8 -ml-4 cursor-ew-resize z-20 flex items-center justify-center group"
                            style={{ left: `${sliderPosition}%` }}
                            onMouseDown={() => setIsDraggingSlider(true)}
                            onTouchStart={() => setIsDraggingSlider(true)}
                        >
                            <div className="w-1 h-full bg-white shadow-lg group-hover:bg-amber-400 transition-colors"></div>
                            <div className="w-8 h-8 bg-white rounded-full absolute shadow-xl flex items-center justify-center text-slate-900 font-bold text-xs group-hover:scale-110 transition-transform">
                                ↔
                            </div>
                        </div>
                     )}
                     
                     {/* ETIQUETA 'DESPUÉS' (Fija a la derecha) */}
                     <div className="absolute top-4 right-4 bg-rose-600/90 text-white text-xs px-2 py-1 rounded font-bold shadow-sm">AHORA (v{version.versionNumber})</div>
                </div>
            )}
          </div>

          {/* BARRA LATERAL (Solo visible en modo normal o si quieres ver comentarios mientras comparas) */}
          <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0">
             <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                 <h3 className="font-bold text-slate-200">Comentarios ({commentsList.length})</h3>
                 <button onClick={() => setShowResolved(!showResolved)} className={`text-xs px-2 py-1 rounded border ${showResolved ? 'bg-slate-700 text-white border-slate-600' : 'text-slate-400 border-slate-700'}`}>
                     {showResolved ? '👁️ Ver todo' : '🙈 Ocultar resueltos'}
                 </button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-4 space-y-3">
                 {commentsList.length === 0 && <p className="text-slate-500 text-center text-sm italic mt-10">No hay comentarios aún.</p>}
                 {commentsList.filter(c => showResolved || !c.resolved).map((c, i) => (
                     <div key={c.id} className={`p-3 rounded-xl border transition-all group ${c.resolved ? 'bg-emerald-900/20 border-emerald-900/50' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}>
                         <div className="flex justify-between items-start mb-2">
                             <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${c.resolved ? 'bg-emerald-500 text-white' : 'bg-rose-600 text-white'}`}>{i + 1}</span>
                             <button onClick={() => toggleResolved(c.id, c.resolved)} className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${c.resolved ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-500 text-transparent hover:border-emerald-500 hover:text-emerald-500/50'}`}>✓</button>
                         </div>
                         <p className={`text-sm ${c.resolved ? 'text-emerald-200 line-through opacity-70' : 'text-slate-200'}`}>{c.content}</p>
                     </div>
                 ))}
             </div>
          </div>
      </div>

      {/* MODAL COMENTARIO */}
      {tempPin && (
            <div className="absolute top-20 right-96 w-80 bg-white text-slate-900 p-5 rounded-2xl shadow-2xl z-50 border border-slate-200 animate-fade-in-up">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-lg">Nueva Nota</h3>
                    <button onClick={() => setTempPin(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>
                <textarea autoFocus className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl mb-3 h-24 focus:ring-2 focus:ring-rose-500 outline-none resize-none text-sm" placeholder="Corrección..." value={comment} onChange={e => setComment(e.target.value)} />
                <div className="flex items-center gap-2 mb-4">
                    <button onClick={() => fileInputRef.current?.click()} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded flex items-center gap-1 border border-slate-200">📎 {attachedFile ? 'Cambiar' : 'Adjuntar'}</button>
                    {attachedFile && <span className="text-xs text-emerald-600 truncate max-w-[120px]">{attachedFile.name}</span>}
                    <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={(e) => e.target.files && setAttachedFile(e.target.files[0])} />
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setTempPin(null)} className="flex-1 py-2 bg-slate-100 font-bold rounded-lg hover:bg-slate-200 text-sm">Cancelar</button>
                    <button onClick={handleSavePin} className="flex-1 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 shadow-lg shadow-rose-200 text-sm">Guardar</button>
                </div>
            </div>
      )}
    </div>
  );
};

export default PageReview;
