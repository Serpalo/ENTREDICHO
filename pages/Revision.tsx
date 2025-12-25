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
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [isPinMode, setIsPinMode] = useState(false);
  const [tempPin, setTempPin] = useState<{x: number, y: number} | null>(null);

  // COMPARADOR
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [compareVersionId, setCompareVersionId] = useState("");
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  // BUSQUEDA DIRECTA DE DATOS
  const project = projects.find(p => p.id === projectId);
  
  // Buscamos la página en cualquier versión del proyecto para que no falle
  let page: any = null;
  let currentVersion: any = null;

  if (project) {
    project.versions.forEach(v => {
      const found = v.pages.find(p => p.id === pageId);
      if (found) {
        page = found;
        currentVersion = v;
      }
    });
  }

  const hasHistory = project && project.versions.length > 1;

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

  // Si después de buscar no hay página, mostramos error específico para saber qué falta
  if (!project) return <div className="p-10 text-white bg-slate-900 h-screen flex items-center justify-center">Error: No se encuentra el Proyecto (ID: {projectId})</div>;
  if (!page) return <div className="p-10 text-white bg-slate-900 h-screen flex items-center justify-center">Error: No se encuentra la Página (ID: {pageId})</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden"
         onMouseMove={isDraggingSlider ? (e) => {
            const rect = sliderRef.current?.getBoundingClientRect();
            if (rect) setSliderPosition(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
         } : undefined}
         onMouseUp={() => setIsDraggingSlider(false)}
    >
      <header className="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white">← Volver</button>
            <h1 className="font-bold">{project.name} / Pág {page.pageNumber}</h1>
          </div>
          
          <div className="flex items-center gap-4">
             {hasHistory && (
                 <button 
                    onClick={() => setIsCompareMode(!isCompareMode)}
                    className={`px-4 py-2 rounded-lg font-bold text-sm border ${isCompareMode ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'}`}
                 >
                    {isCompareMode ? 'Salir' : 'Comparar'}
                 </button>
             )}

             <button onClick={() => setIsPinMode(!isPinMode)} className={`px-4 py-2 rounded-lg font-bold text-sm ${isPinMode ? 'bg-white text-slate-900' : 'bg-rose-600 text-white'}`}>
                {isPinMode ? '📍 Haz clic en la imagen' : 'Añadir Nota'}
             </button>
          </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 relative flex items-center justify-center bg-slate-950" 
               onWheel={(e) => { if(e.ctrlKey) setScale(s => Math.min(Math.max(s + e.deltaY * -0.01, 0.5), 4)) }}>
            
            {!isCompareMode ? (
                <div ref={imageContainerRef} onClick={(e) => {
                    if(!isPinMode || !imageContainerRef.current) return;
                    const r = imageContainerRef.current.getBoundingClientRect();
                    setTempPin({ x: ((e.clientX - r.left)/r.width)*100, y: ((e.clientY - r.top)/r.height)*100 });
                    setIsPinMode(false);
                }} style={{ transform: `scale(${scale})` }} className="relative shadow-2xl transition-transform">
                    <img src={page.imageUrl} className="max-h-[85vh] select-none" alt="" />
                    {commentsList.map((c, i) => (
                        <div key={c.id} className={`absolute w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold -ml-3 -mt-3 border border-white ${c.resolved ? 'bg-emerald-500' : 'bg-rose-600'}`} style={{ left: `${c.x}%`, top: `${c.y}%` }}>{i+1}</div>
                    ))}
                    {tempPin && <div className="absolute w-6 h-6 bg-yellow-400 rounded-full animate-bounce -ml-3 -mt-3 border border-white" style={{ left: `${tempPin.x}%`, top: `${tempPin.y}%` }}></div>}
                </div>
            ) : (
                <div ref={sliderRef} className="relative max-h-[85vh] shadow-2xl" style={{ transform: `scale(${scale})` }}>
                     <img src={page.imageUrl} className="max-h-[85vh] pointer-events-none" alt="" />
                     {compareImageUrl && (
                        <div className="absolute top-0 left-0 h-full overflow-hidden border-r-2 border-white" style={{ width: `${sliderPosition}%` }}>
                             <img src={compareImageUrl} className="max-h-[85vh]" style={{ width: sliderRef.current?.offsetWidth, maxWidth: 'none' }} alt="" />
                        </div>
                     )}
                     <div className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-50" style={{ left: `${sliderPosition}%` }} onMouseDown={() => setIsDraggingSlider(true)}>
                        <div className="absolute top-1/2 -mt-4 -ml-4 w-8 h-8 bg-white rounded-full flex items-center justify-center text-black font-bold shadow-xl">↔</div>
                     </div>
                </div>
            )}
          </div>

          <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col p-4 overflow-y-auto">
             <h3 className="font-bold text-slate-200 mb-4 border-b border-slate-800 pb-2">Comentarios</h3>
             {commentsList.map((c, i) => (
                 <div key={c.id} className={`p-3 rounded-lg mb-2 border ${c.resolved ? 'bg-emerald-900/20 border-emerald-800 text-emerald-500' : 'bg-slate-800 border-slate-700'}`}>
                     <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-xs uppercase">Nota #{i+1}</span>
                        <button onClick={() => toggleResolved(c.id, c.resolved)}>{c.resolved ? '✅' : '⭕'}</button>
                     </div>
                     <p className="text-sm">{c.content}</p>
                 </div>
             ))}
          </div>
      </div>

      {tempPin && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-2xl shadow-2xl text-slate-900 w-80 z-50">
            <h3 className="font-black mb-4 uppercase text-xs tracking-widest text-slate-400">Nuevo Comentario</h3>
            <textarea id="new-comment-text" className="w-full border border-slate-200 rounded-xl p-3 mb-4 h-24 outline-none focus:ring-2 focus:ring-rose-500" placeholder="Escribe aquí..."></textarea>
            <div className="flex gap-2">
                <button onClick={() => setTempPin(null)} className="flex-1 py-2 font-bold text-slate-400">Cancelar</button>
                <button onClick={() => {
                    const txt = (document.getElementById('new-comment-text') as HTMLTextAreaElement).value;
                    handleSavePin(txt);
                }} className="flex-1 py-2 bg-rose-600 text-white rounded-xl font-bold">Guardar</button>
            </div>
        </div>
      )}
    </div>
  );
};

export default Revision;
