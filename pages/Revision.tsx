import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase'; 
import { Project } from '../types';

interface PageReviewProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
}

const Revision: React.FC<PageReviewProps> = ({ projects }) => {
  const { projectId, versionId, pageId } = useParams();
  const navigate = useNavigate();
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  
  // ESTADOS
  const [scale, setScale] = useState(1);
  const [showResolved, setShowResolved] = useState(true);
  const [comment, setComment] = useState("");
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [isPinMode, setIsPinMode] = useState(false);
  const [tempPin, setTempPin] = useState<{x: number, y: number} | null>(null);

  // COMPARADOR
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [compareVersionId, setCompareVersionId] = useState("");
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  const project = projects.find(p => p.id === projectId);
  const version = project?.versions.find(v => v.id === versionId);
  const page = version?.pages.find((p:any) => p.id === pageId);
  const hasHistory = project && project.versions.length > 1;

  // Imagen para comparar
  const compareImageUrl = compareVersionId 
    ? project?.versions.find(v => v.id === compareVersionId)?.pages.find((p:any) => p.pageNumber === page?.pageNumber)?.imageUrl 
    : null;

  useEffect(() => {
    if(pageId) fetchComments();
  }, [pageId]);

  const fetchComments = async () => {
    const { data } = await supabase.from('comments').select('*').eq('page_id', pageId).order('created_at', { ascending: false });
    if (data) setCommentsList(data);
  };

  const handleSavePin = async () => {
    if (!comment || !pageId) return;
    const { data } = await supabase.from('comments').insert([{ content: comment, page_id: pageId, x: tempPin?.x, y: tempPin?.y, resolved: false }]).select();
    if (data) {
        setCommentsList(prev => [data[0], ...prev]);
        setComment(""); setTempPin(null);
    }
  };

  const toggleResolved = async (id: string, currentStatus: boolean) => {
    await supabase.from('comments').update({ resolved: !currentStatus }).eq('id', id);
    setCommentsList(prev => prev.map(c => c.id === id ? { ...c, resolved: !currentStatus } : c));
  };

  const handleSliderMove = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDraggingSlider || !sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      let clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      setSliderPosition(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
  };

  if (!page) return <div className="p-10 text-white bg-slate-900 h-screen flex items-center justify-center">Cargando...</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden"
         onMouseMove={isDraggingSlider ? (e) => handleSliderMove(e) : undefined}
         onMouseUp={() => setIsDraggingSlider(false)}
         onTouchMove={isDraggingSlider ? (e) => handleSliderMove(e) : undefined}
         onTouchEnd={() => setIsDraggingSlider(false)}
    >
      <header className="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6 z-50 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white flex items-center gap-1">← Volver</button>
            <h1 className="font-bold hidden md:block">{project?.name} / Pág {page.pageNumber}</h1>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-700 p-1 rounded-lg absolute left-1/2 -translate-x-1/2">
                <button onClick={() => setScale(s => Math.max(s - 0.2, 0.5))} className="px-2 hover:bg-slate-600 rounded">➖</button>
                <span className="text-xs font-mono w-10 text-center">{Math.round(scale * 100)}%</span>
                <button onClick={() => setScale(s => Math.min(s + 0.2, 4))} className="px-2 hover:bg-slate-600 rounded">➕</button>
          </div>

          <div className="flex items-center gap-4">
             {isCompareMode && (
                <select className="bg-slate-900 border border-blue-500 rounded px-2 py-1 text-xs" onChange={(e) => setCompareVersionId(e.target.value)} value={compareVersionId}>
                    <option value="">Comparar con...</option>
                    {project?.versions.filter(v => v.id !== versionId).map(v => <option key={v.id} value={v.id}>v{v.versionNumber}</option>)}
                </select>
             )}
             
             <button 
                disabled={!hasHistory}
                onClick={() => { setIsCompareMode(!isCompareMode); setIsPinMode(false); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all border
                    ${!hasHistory ? 'bg-slate-800 text-slate-600 border-slate-700' : 
                      isCompareMode ? 'bg-white text-blue-600 border-white' : 'bg-blue-600 text-white border-blue-500 hover:bg-blue-500'}`}
             >
                {isCompareMode ? 'Salir' : 'Comparar'}
             </button>

             {!isCompareMode && (
                 <button onClick={() => setIsPinMode(!isPinMode)} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all border border-transparent ${isPinMode ? 'bg-white text-slate-900 animate-pulse' : 'bg-rose-600 text-white hover:bg-rose-700'}`}>
                    {isPinMode ? '📍 Clic en imagen' : 'Añadir Nota'}
                 </button>
             )}
          </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 relative flex items-center justify-center bg-slate-950" onWheel={(e) => { if(e.ctrlKey || e.metaKey) { e.preventDefault(); setScale(s => Math.min(Math.max(s + e.deltaY * -0.01, 0.5), 4)); }}}>
            
            {!isCompareMode && (
                <div ref={imageContainerRef} onClick={(e) => {
                    if(!isPinMode || !imageContainerRef.current) return;
                    const r = imageContainerRef.current.getBoundingClientRect();
                    setTempPin({ x: ((e.clientX - r.left)/r.width)*100, y: ((e.clientY - r.top)/r.height)*100 });
                    setIsPinMode(false);
                }} style={{ transform: `scale(${scale})`, cursor: isPinMode ? 'crosshair' : 'grab' }} className="relative shadow-2xl transition-transform duration-100 ease-out">
                    <img src={page.imageUrl} className="max-h-[85vh] select-none" />
                    {commentsList.filter(c => showResolved || !c.resolved).map((c, i) => (
                        <div key={c.id} className={`absolute w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold -ml-3 -mt-3 border border-white cursor-pointer ${c.resolved ? 'bg-emerald-500' : 'bg-rose-600'}`} style={{ left: `${c.x}%`, top: `${c.y}%` }}>{i+1}</div>
                    ))}
                    {tempPin && <div className="absolute w-6 h-6 bg-yellow-400 rounded-full animate-bounce -ml-3 -mt-3 border border-white" style={{ left: `${tempPin.x}%`, top: `${tempPin.y}%` }}></div>}
                </div>
            )}

            {isCompareMode && (
                <div ref={sliderRef} className="relative max-h-[85vh] select-none shadow-2xl" style={{ transform: `scale(${scale})` }}>
                     <img src={page.imageUrl} className="max-h-[85vh] pointer-events-none" />
                     {compareImageUrl ? (
                        <div className="absolute top-0 left-0 h-full w-full overflow-hidden border-r-2 border-white bg-slate-900" style={{ width: `${sliderPosition}%` }}>
                             <img src={compareImageUrl} className="max-h-[85vh]" style={{ width: sliderRef.current?.offsetWidth, maxWidth: 'none' }} />
                             <div className="absolute top-4 left-4 bg-black/70 text-white text-xs px-2 py-1 rounded font-bold border border-white/20">ANTES</div>
                        </div>
                     ) : <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white font-bold p-6 rounded-xl border border-white/10">⬇ Selecciona versión antigua arriba ⬇</div>}
                     
                     {compareImageUrl && (
                        <div className="absolute top-0 bottom-0 w-8 -ml-4 cursor-ew-resize z-20 flex items-center justify-center" style={{ left: `${sliderPosition}%` }} onMouseDown={() => setIsDraggingSlider(true)} onTouchStart={() => setIsDraggingSlider(true)}>
                            <div className="w-1 h-full bg-white shadow-lg"></div>
                            <div className="w-8 h-8 bg-white rounded-full absolute shadow-xl flex items-center justify-center text-slate-900 font-bold text-xs border border-slate-200">↔</div>
                        </div>
                     )}
                </div>
            )}
          </div>

          <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0">
             <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                 <h3 className="font-bold text-slate-200">Notas ({commentsList.length})</h3>
                 <button onClick={() => setShowResolved(!showResolved)} className="text-xs px-2 py-1 rounded border border-slate-700 text-slate-400">{showResolved ? 'Ocultar resueltos' : 'Ver todo'}</button>
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

export default Revision;
