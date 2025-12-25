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

  const [isCompareMode, setIsCompareMode] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [compareVersionId, setCompareVersionId] = useState("");
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  // BUSQUEDA BLINDADA
  const project = projects.find(p => p.id === projectId);
  let page: any = null;

  if (project) {
    project.versions.forEach(v => {
      const found = v.pages.find(p => p.id === pageId);
      if (found) page = found;
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

  if (!project || !page) return <div className="p-10 text-slate-400 bg-slate-50 h-screen flex items-center justify-center font-bold">Cargando datos...</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-100 text-slate-800 overflow-hidden font-sans"
         onMouseMove={isDraggingSlider ? (e) => {
            const rect = sliderRef.current?.getBoundingClientRect();
            if (rect) setSliderPosition(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
         } : undefined}
         onMouseUp={() => setIsDraggingSlider(false)}
    >
      {/* HEADER CLARO */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm z-50">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-600 font-bold transition-colors text-sm flex items-center gap-1">
                <span className="text-lg">←</span> Volver
            </button>
            <h1 className="font-black text-slate-800 tracking-tight">{project.name} <span className="text-slate-400 font-medium">/ Pág {page.pageNumber}</span></h1>
          </div>
          <div className="flex items-center gap-4">
             {hasHistory && (
                 <div className="flex items-center gap-2">
                    {isCompareMode && (
                        <select className="bg-white border border-slate-200 text-slate-600 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" onChange={(e) => setCompareVersionId(e.target.value)} value={compareVersionId}>
                            <option value="">Comparar con...</option>
                            {project.versions.filter(v => v.id !== versionId).map(v => <option key={v.id} value={v.id}>v{v.versionNumber}</option>)}
                        </select>
                    )}
                    <button onClick={() => setIsCompareMode(!isCompareMode)} className={`px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-wider border transition-all ${isCompareMode ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`}>{isCompareMode ? 'Salir' : 'Comparar'}</button>
                 </div>
             )}
             <button onClick={() => setIsPinMode(!isPinMode)} className={`px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border ${isPinMode ? 'bg-slate-800 text-white border-slate-800 animate-pulse shadow-md' : 'bg-rose-600 text-white border-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-100'}`}>{isPinMode ? '📍 Clic en imagen' : 'Añadir Nota'}</button>
          </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
          {/* AREA DE IMAGEN CLARA */}
          <div className="flex-1 relative flex items-center justify-center bg-slate-50" onWheel={(e) => { if(e.ctrlKey) setScale(s => Math.min(Math.max(s + e.deltaY * -0.01, 0.5), 4)) }}>
            {!isCompareMode ? (
                <div ref={imageContainerRef} onClick={(e) => {
                    if(!isPinMode || !imageContainerRef.current) return;
                    const r = imageContainerRef.current.getBoundingClientRect();
                    setTempPin({ x: ((e.clientX - r.left)/r.width)*100, y: ((e.clientY - r.top)/r.height)*100 });
                    setIsPinMode(false);
                }} style={{ transform: `scale(${scale})` }} className="relative shadow-xl transition-transform duration-100 ease-out border border-slate-200 bg-white">
                    <img src={page.imageUrl} className="max-h-[82vh] select-none block" alt="" />
                    {commentsList.map((c, i) => (
                        <div key={c.id} className={`absolute w-7 h-7 rounded-full flex items-center justify-center text-xs font-black -ml-3.5 -mt-3.5 border-2 border-white shadow-lg transition-transform hover:scale-110 cursor-pointer ${c.resolved ? 'bg-emerald-500 text-white' : 'bg-rose-600 text-white'}`} style={{ left: `${c.x}%`, top: `${c.y}%` }}>{i+1}</div>
                    ))}
                    {tempPin && <div className="absolute w-7 h-7 bg-amber-400 rounded-full animate-bounce -ml-3.5 -mt-3.5 border-2 border-white shadow-xl" style={{ left: `${tempPin.x}%`, top: `${tempPin.y}%` }}></div>}
                </div>
            ) : (
                <div ref={sliderRef} className="relative max-h-[82vh] shadow-2xl transition-transform duration-100 ease-out border border-slate-200 bg-white" style={{ transform: `scale(${scale})` }}>
                     <img src={page.imageUrl} className="max-h-[82vh] pointer-events-none block" alt="" />
                     {compareImageUrl && (
                        <div className="absolute top-0 left-0 h-full overflow-hidden border-r-2 border-white" style={{ width: `${sliderPosition}%` }}>
                             <img src={compareImageUrl} className="max-h-[82vh]" style={{ width: sliderRef.current?.offsetWidth, maxWidth: 'none', height: '100%' }} alt="" />
                             <div className="absolute top-4 left-4 bg-slate-800/80 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded font-black border border-white/20">ANTES</div>
                        </div>
                     )}
                     <div className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-50 shadow-[0_0_15px_rgba(0,0,0,0.1)]" style={{ left: `${sliderPosition}%` }} onMouseDown={() => setIsDraggingSlider(true)}>
                        <div className="absolute top-1/2 -mt-5 -ml-5 w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-800 font-black shadow-2xl border border-slate-100 transition-transform hover:scale-110">↔</div>
                     </div>
                </div>
            )}
          </div>

          {/* SIDEBAR COMENTARIOS CLARO */}
          <div className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0 shadow-[-10px_0_15px_rgba(0,0,0,0.02)]">
             <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                 <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Notas ({commentsList.length})</h3>
                 <button onClick={() => toggleResolved} className="text-[10px] font-bold text-slate-400 hover:text-rose-600 uppercase transition-colors">Resolver Todo</button>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-3">
                 {commentsList.length === 0 && (
                     <div className="flex flex-col items-center justify-center h-40 text-slate-300">
                         <span className="text-4xl mb-2">💬</span>
                         <p className="text-xs font-bold italic">No hay notas aún</p>
                     </div>
                 )}
                 {commentsList.map((c, i) => (
                     <div key={c.id} className={`p-4 rounded-2xl border transition-all ${c.resolved ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-white border-slate-100 shadow-sm hover:border-rose-100 hover:shadow-md'}`}>
                         <div className="flex justify-between items-start mb-2">
                            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black border-2 border-white shadow-sm ${c.resolved ? 'bg-emerald-500 text-white' : 'bg-rose-600 text-white'}`}>{i+1}</span>
                            <button 
                                onClick={() => toggleResolved(c.id, c.resolved)}
                                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${c.resolved ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600'}`}
                            >
                                {c.resolved ? '✓' : '○'}
                            </button>
                         </div>
                         <p className={`text-sm font-medium leading-relaxed ${c.resolved ? 'opacity-60 line-through' : 'text-slate-700'}`}>{c.content}</p>
                     </div>
                 ))}
             </div>
          </div>
      </div>

      {tempPin && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white p-8 rounded-[2rem] shadow-2xl text-slate-900 w-full max-w-sm border border-slate-100 scale-in-center">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 text-xl font-bold">📍</div>
                    <div>
                        <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Nueva Nota</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Página {page.pageNumber}</p>
                    </div>
                </div>
                <textarea 
                    autoFocus
                    id="new-comment-text" 
                    className="w-full border-2 border-slate-100 bg-slate-50 rounded-2xl p-4 mb-6 h-32 outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-600 transition-all font-medium text-slate-700 resize-none" 
                    placeholder="Escribe la corrección aquí..."
                ></textarea>
                <div className="flex gap-3">
                    <button onClick={() => setTempPin(null)} className="flex-1 py-4 font-black text-slate-400 hover:text-slate-600 transition-colors uppercase text-[10px] tracking-widest">Cancelar</button>
                    <button onClick={() => {
                        const txt = (document.getElementById('new-comment-text') as HTMLTextAreaElement).value;
                        handleSavePin(txt);
                    }} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black shadow-xl shadow-rose-200 hover:bg-rose-700 transition-all uppercase text-[10px] tracking-widest">Guardar Nota</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Revision;
