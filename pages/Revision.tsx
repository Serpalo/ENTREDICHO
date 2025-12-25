import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase'; 
import { Project } from '../types';

interface PageReviewProps {
  projects: Project[];
}

const Revision: React.FC<PageReviewProps> = ({ projects }) => {
  const { projectId, versionId, pageId } = useParams();
  const navigate = useNavigate();
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  
  const [scale, setScale] = useState(1);
  const [showResolved, setShowResolved] = useState(true);
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [isPinMode, setIsPinMode] = useState(false);
  const [tempPin, setTempPin] = useState<{x: number, y: number} | null>(null);

  const [isCompareMode, setIsCompareMode] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [compareVersionId, setCompareVersionId] = useState("");
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  // 1. BUSQUEDA DEL PROYECTO
  const project = projects.find(p => p.id === projectId);
  
  // 2. BUSQUEDA DE LA PÁGINA ACTUAL Y SU VERSIÓN
  let page: any = null;
  let allPagesInCurrentVersion: any[] = [];
  let currentVersionObj: any = null;

  if (project) {
    project.versions.forEach(v => {
      const found = v.pages.find(p => p.id === pageId);
      if (found) {
        page = found;
        allPagesInCurrentVersion = v.pages;
        currentVersionObj = v;
      }
    });
  }

  // 3. LÓGICA DE COMPARACIÓN (CORREGIDA)
  // Buscamos si existen otras versiones en el proyecto
  const otherVersions = project ? project.versions.filter(v => v.versionNumber !== currentVersionObj?.versionNumber) : [];
  const hasHistory = otherVersions.length > 0;

  // Encontrar la imagen correspondiente en la versión a comparar (misma página)
  const compareImageUrl = compareVersionId 
    ? project?.versions.find(v => v.id === compareVersionId)?.pages.find((p:any) => p.pageNumber === page?.pageNumber)?.imageUrl 
    : null;

  // 4. LÓGICA DE NAVEGACIÓN
  const currentIndex = allPagesInCurrentVersion.findIndex(p => p.id === pageId);
  const prevPage = allPagesInCurrentVersion[currentIndex - 1];
  const nextPage = allPagesInCurrentVersion[currentIndex + 1];

  const goToPage = (id: string) => {
    if (!id) return;
    navigate(`/project/${projectId}/version/${versionId}/page/${id}`);
  };

  useEffect(() => {
    if(pageId) fetchComments();
    setScale(1); 
    // Si cambiamos de página, reseteamos el comparador para evitar errores visuales
    setIsCompareMode(false);
    setCompareVersionId("");
  }, [pageId]);

  const fetchComments = async () => {
    const { data } = await supabase.from('comments').select('*').eq('page_id', pageId).order('created_at', { ascending: false });
    if (data) setCommentsList(data);
  };

  const handleSavePin = async (content: string) => {
    if (!content || !pageId) return;
    const { data } = await supabase.from('comments').insert([{ content, page_id: pageId, x: tempPin?.x, y: tempPin?.y, resolved: false }]).select();
    if (data) {
        setCommentsList(prev => [data[0], ...prev]);
        setTempPin(null);
    }
  };

  const toggleResolved = async (id: string, currentStatus: boolean) => {
    await supabase.from('comments').update({ resolved: !currentStatus }).eq('id', id);
    setCommentsList(prev => prev.map(c => c.id === id ? { ...c, resolved: !currentStatus } : c));
  };

  if (!project || !page) return <div className="p-10 text-slate-400 bg-slate-50 h-screen flex items-center justify-center font-bold">Cargando...</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-100 text-slate-800 overflow-hidden"
         onMouseMove={isDraggingSlider ? (e) => {
            const rect = sliderRef.current?.getBoundingClientRect();
            if (rect) setSliderPosition(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
         } : undefined}
         onMouseUp={() => setIsDraggingSlider(false)}
    >
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm z-50">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-600 font-bold flex items-center gap-1">← Volver</button>
            <h1 className="font-black text-slate-800 tracking-tight">{project.name}</h1>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
             <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Página {page.pageNumber} de {allPagesInCurrentVersion.length}</span>
             <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded uppercase">Versión {currentVersionObj?.versionNumber}</span>
          </div>

          <div className="flex items-center gap-4">
             {hasHistory && (
                 <div className="flex items-center gap-2">
                    {isCompareMode && (
                        <select 
                            className="bg-slate-50 border border-slate-200 text-slate-600 rounded-xl px-3 py-1.5 text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500" 
                            onChange={(e) => setCompareVersionId(e.target.value)} 
                            value={compareVersionId}
                        >
                            <option value="">¿Con qué versión?</option>
                            {otherVersions.map(v => (
                                <option key={v.id} value={v.id}>Versión {v.versionNumber}</option>
                            ))}
                        </select>
                    )}
                    <button 
                        onClick={() => setIsCompareMode(!isCompareMode)} 
                        className={`px-4 py-2 rounded-xl font-bold text-[10px] uppercase border transition-all ${isCompareMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-600 border-blue-100 hover:bg-blue-50'}`}
                    >
                        {isCompareMode ? 'Cerrar Comparador' : 'Comparar'}
                    </button>
                 </div>
             )}
             <button onClick={() => setIsPinMode(!isPinMode)} className={`px-4 py-2 rounded-xl font-bold text-[10px] uppercase transition-all ${isPinMode ? 'bg-slate-800 text-white animate-pulse' : 'bg-rose-600 text-white hover:bg-rose-700'}`}>
                {isPinMode ? '📍 Toca la imagen' : 'Nueva Nota'}
             </button>
          </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
          {/* NAVEGACIÓN IZQUIERDA */}
          {prevPage && (
            <button onClick={() => goToPage(prevPage.id)} className="absolute left-6 top-1/2 -translate-y-1/2 z-40 w-12 h-12 bg-white/90 hover:bg-white text-slate-400 hover:text-rose-600 rounded-full shadow-2xl border border-slate-100 flex items-center justify-center transition-all hover:scale-110 active:scale-90 font-black text-xl">←</button>
          )}

          {/* NAVEGACIÓN DERECHA (Teniendo en cuenta el ancho del panel lateral) */}
          {nextPage && (
            <button onClick={() => goToPage(nextPage.id)} className="absolute right-[340px] top-1/2 -translate-y-1/2 z-40 w-12 h-12 bg-white/90 hover:bg-white text-slate-400 hover:text-rose-600 rounded-full shadow-2xl border border-slate-100 flex items-center justify-center transition-all hover:scale-110 active:scale-90 font-black text-xl">→</button>
          )}

          <div className="flex-1 relative flex items-center justify-center bg-slate-50 overflow-hidden" 
               onWheel={(e) => { if(e.ctrlKey) setScale(s => Math.min(Math.max(s + e.deltaY * -0.01, 0.5), 4)) }}>
            
            {!isCompareMode ? (
                <div ref={imageContainerRef} onClick={(e) => {
                    if(!isPinMode || !imageContainerRef.current) return;
                    const r = imageContainerRef.current.getBoundingClientRect();
                    setTempPin({ x: ((e.clientX - r.left)/r.width)*100, y: ((e.clientY - r.top)/r.height)*100 });
                    setIsPinMode(false);
                }} style={{ transform: `scale(${scale})` }} className="relative shadow-2xl transition-transform duration-150 ease-out border border-slate-200 bg-white">
                    <img src={page.imageUrl} className="max-h-[82vh] select-none block" alt="" />
                    {commentsList.map((c, i) => (
                        <div key={c.id} className={`absolute w-7 h-7 rounded-full flex items-center justify-center text-xs font-black -ml-3.5 -mt-3.5 border-2 border-white shadow-lg ${c.resolved ? 'bg-emerald-500 text-white' : 'bg-rose-600 text-white'}`} style={{ left: `${c.x}%`, top: `${c.y}%` }}>{i+1}</div>
                    ))}
                    {tempPin && <div className="absolute w-7 h-7 bg-amber-400 rounded-full animate-bounce -ml-3.5 -mt-3.5 border-2 border-white shadow-xl" style={{ left: `${tempPin.x}%`, top: `${tempPin.y}%` }}></div>}
                </div>
            ) : (
                <div ref={sliderRef} className="relative max-h-[82vh] border border-slate-200 bg-white shadow-2xl" style={{ transform: `scale(${scale})` }}>
                     <img src={page.imageUrl} className="max-h-[82vh] pointer-events-none block" alt="" />
                     {compareImageUrl && (
                        <div className="absolute top-0 left-0 h-full overflow-hidden border-r-2 border-white" style={{ width: `${sliderPosition}%` }}>
                             <img src={compareImageUrl} className="max-h-[82vh]" style={{ width: sliderRef.current?.offsetWidth, maxWidth: 'none', height: '100%' }} alt="" />
                             <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded font-black border border-white/20">VERSIÓN ANTERIOR</div>
                        </div>
                     )}
                     <div className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-50 shadow-xl" style={{ left: `${sliderPosition}%` }} onMouseDown={() => setIsDraggingSlider(true)}>
                        <div className="absolute top-1/2 -mt-5 -ml-5 w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-800 font-black shadow-2xl border border-slate-100 transition-transform hover:scale-110">↔</div>
                     </div>
                </div>
            )}
          </div>

          {/* PANEL LATERAL DE NOTAS */}
          <div className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0 shadow-[-10px_0_15px_rgba(0,0,0,0.02)]">
             <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                 <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.2em]">Notas ({commentsList.length})</h3>
                 <button onClick={() => setShowResolved(!showResolved)} className="text-[10px] font-bold text-slate-400 uppercase hover:text-rose-600 transition-colors">{showResolved ? 'Ocultar Hechas' : 'Ver Todo'}</button>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-3">
                 {commentsList.filter(c => showResolved || !c.resolved).map((c, i) => (
                     <div key={c.id} className={`p-4 rounded-2xl border transition-all shadow-sm ${c.resolved ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                         <div className="flex justify-between items-start mb-2">
                            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black border-2 border-white shadow-sm ${c.resolved ? 'bg-emerald-500 text-white' : 'bg-rose-600 text-white'}`}>{i+1}</span>
                            <button onClick={() => toggleResolved(c.id, c.resolved)} className="w-8 h-8 rounded-xl bg-white border flex items-center justify-center shadow-sm hover:scale-110 active:scale-90 transition-all font-bold">
                                {c.resolved ? '✓' : '○'}
                            </button>
                         </div>
                         <p className={`text-sm font-bold leading-relaxed ${c.resolved ? 'text-emerald-700 opacity-60 line-through' : 'text-rose-700'}`}>{c.content}</p>
                     </div>
                 ))}
             </div>
          </div>
      </div>

      {tempPin && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-[2rem] shadow-2xl text-slate-900 w-full max-w-sm border border-slate-100">
                <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-widest mb-4">Nueva Corrección</h3>
                <textarea autoFocus id="new-comment-text" className="w-full border-2 border-slate-100 bg-slate-50 rounded-2xl p-4 mb-6 h-32 outline-none focus:border-rose-600 font-bold text-slate-700 resize-none shadow-inner" placeholder="Escribe aquí..."></textarea>
                <div className="flex gap-3">
                    <button onClick={() => setTempPin(null)} className="flex-1 py-4 font-black text-slate-400 uppercase text-[10px]">Cancelar</button>
                    <button onClick={() => {
                        const txt = (document.getElementById('new-comment-text') as HTMLTextAreaElement).value;
                        handleSavePin(txt);
                    }} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black shadow-xl shadow-rose-200 text-[10px] uppercase hover:bg-rose-700 transition-all">Guardar Nota</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Revision;
