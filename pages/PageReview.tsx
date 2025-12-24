import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Project, AppNotification } from '../types';
import { supabase } from '../supabase';

interface PageReviewProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  addNotification?: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  page_id: string;
  x?: number;
  y?: number;
  resolved?: boolean;
}

const PageReview: React.FC<PageReviewProps> = ({ projects, setProjects, addNotification }) => {
  const { projectId, versionId, pageId } = useParams<{ projectId: string; versionId: string; pageId: string }>();
  const navigate = useNavigate();
  const imageContainerRef = useRef<HTMLDivElement>(null);
  
  const [comment, setComment] = useState("");
  const [commentsList, setCommentsList] = useState<Comment[]>([]);
  const [isPinMode, setIsPinMode] = useState(false);
  const [tempPin, setTempPin] = useState<{x: number, y: number} | null>(null);
  const [activePinId, setActivePinId] = useState<string | null>(null);

  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [previousPageUrl, setPreviousPageUrl] = useState<string | null>(null);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  const project = projects.find(p => p.id === projectId);
  let version: any = null;
  let page: any = null;
  if (project) {
    version = project.versions.find(v => v.id === versionId);
    if (version) page = version.pages.find((p: any) => p.id === pageId);
  }

  useEffect(() => {
    if (pageId) fetchComments();
    if (page) fetchPreviousVersion();
  }, [pageId, page]);

  const fetchComments = async () => {
    const { data } = await supabase.from('comments').select('*').eq('page_id', pageId).order('created_at', { ascending: false });
    if (data) setCommentsList(data);
  };

  const fetchPreviousVersion = async () => {
    if (!page || !page.version || page.version <= 1) return;
    const { data } = await supabase
      .from('pages')
      .select('image_url')
      .eq('project_id', projectId)
      .eq('page_number', page.pageNumber)
      .lt('version', page.version) 
      .order('version', { ascending: false }) 
      .limit(1)
      .single();

    if (data) setPreviousPageUrl(data.image_url);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (tempPin) return;
    e.preventDefault();
    const scaleAmount = -e.deltaY * 0.001;
    const newScale = Math.min(Math.max(0.5, transform.scale + scaleAmount), 5);
    setTransform(prev => ({ ...prev, scale: newScale }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isPinMode || isCompareMode) return; 
    setIsDragging(true);
    setStartPan({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingSlider && imageContainerRef.current) {
        const rect = imageContainerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percent = (x / rect.width) * 100;
        setSliderPosition(percent);
        return;
    }
    if (!isDragging || isPinMode || isCompareMode) return;
    e.preventDefault();
    setTransform(prev => ({ ...prev, x: e.clientX - startPan.x, y: e.clientY - startPan.y }));
  };

  const handleMouseUp = () => { setIsDragging(false); setIsDraggingSlider(false); };
  const resetView = () => setTransform({ scale: 1, x: 0, y: 0 });

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPinMode || !imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setTempPin({ x, y });
    setIsPinMode(false);
  };

  const handleSavePin = async () => {
    if (!comment.trim() || !pageId) return;
    const newComment = { content: comment, page_id: pageId, x: tempPin?.x || 50, y: tempPin?.y || 50, resolved: false };
    const { data, error } = await supabase.from('comments').insert([newComment]).select();
    if (error) alert('Error: ' + error.message);
    else if (data) { setCommentsList(prev => [data[0], ...prev]); setComment(""); setTempPin(null); if (addNotification) addNotification({ type: 'system', title: 'Nota añadida', message: 'Corrección fijada.', link: '#' }); }
  };

  const handleDeleteComment = async (id: string) => {
    if (!window.confirm("¿Borrar corrección?")) return;
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (!error) { setCommentsList(prev => prev.filter(c => c.id !== id)); if (activePinId === id) setActivePinId(null); }
  };

  const handleToggleResolve = async (id: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    setCommentsList(prev => prev.map(c => c.id === id ? { ...c, resolved: newStatus } : c));
    const { error } = await supabase.from('comments').update({ resolved: newStatus }).eq('id', id);
    if (error) setCommentsList(prev => prev.map(c => c.id === id ? { ...c, resolved: currentStatus } : c));
  };

  if (!project || !version || !page) return <div className="p-10 text-center">Cargando...</div>;

  return (
    <div className="min-h-screen bg-slate-800 flex flex-col h-screen overflow-hidden">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <h1 className="font-black text-slate-800 text-lg">{project.name}</h1>
            <div className="flex items-center gap-2">
                 <p className="text-[10px] font-bold text-slate-400 uppercase">Revisión v{version.versionNumber}</p>
                 {isCompareMode && <span className="bg-amber-100 text-amber-700 text-[9px] font-bold px-2 py-0.5 rounded border border-amber-200 animate-pulse">MODO COMPARADOR ACTIVO</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 rounded-lg p-1 mr-2">
                <button onClick={() => setTransform(t => ({...t, scale: t.scale - 0.2}))} className="p-2 hover:bg-white rounded shadow-sm text-slate-500"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg></button>
                <span className="px-2 flex items-center text-xs font-bold text-slate-500 w-12 justify-center">{Math.round(transform.scale * 100)}%</span>
                <button onClick={() => setTransform(t => ({...t, scale: t.scale + 0.2}))} className="p-2 hover:bg-white rounded shadow-sm text-slate-500"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></button>
                <button onClick={resetView} className="ml-1 p-2 hover:bg-white rounded shadow-sm text-rose-500 font-bold text-xs">1:1</button>
            </div>

            {previousPageUrl && (
                <button onClick={() => setIsCompareMode(!isCompareMode)} className={`flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-xs transition-all ${isCompareMode ? 'bg-amber-500 text-white shadow-lg ring-4 ring-amber-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
                    {isCompareMode ? 'Cerrar Comparador' : 'Comparar'}
                </button>
            )}

           {/* CAMBIO: bg-rose-600 y textos hover rojo */}
           <button onClick={() => { setIsPinMode(!isPinMode); setTempPin(null); setIsCompareMode(false); }} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ${isPinMode ? 'bg-rose-600 text-white shadow-lg ring-4 ring-rose-200' : 'bg-slate-100 text-slate-600 hover:bg-white hover:text-rose-600'}`}>
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
             {isPinMode ? 'Cancelar' : 'Poner Nota'}
           </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <div className={`flex-1 overflow-hidden flex items-center justify-center relative bg-slate-900 ${isDragging ? 'cursor-grabbing' : isCompareMode ? 'cursor-ew-resize' : 'cursor-grab'}`} onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
          <div ref={imageContainerRef} onClick={handleCanvasClick} className="relative shadow-2xl transition-transform duration-75 ease-out origin-center" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, minWidth: '600px', width: 'auto' }}>
            <img src={page.imageUrl} alt="Actual" className="max-w-none block select-none pointer-events-none" style={{ height: 'auto', width: 'auto', maxHeight: '90vh' }} />

            {isCompareMode && previousPageUrl && (
                <>
                    <div className="absolute inset-0 overflow-hidden select-none pointer-events-none border-r-2 border-amber-400 bg-slate-900" style={{ width: `${sliderPosition}%` }}>
                        <img src={previousPageUrl} alt="Anterior" className="max-w-none block" style={{ height: '100%', width: 'auto', maxWidth: 'none' }} />
                        <div className="absolute top-4 left-4 bg-amber-500 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-xl">VERSIÓN ANTERIOR</div>
                    </div>
                    <div className="absolute inset-y-0 w-8 -ml-4 cursor-ew-resize z-50 flex items-center justify-center group" style={{ left: `${sliderPosition}%` }} onMouseDown={(e) => { e.stopPropagation(); setIsDraggingSlider(true); }}>
                        <div className="w-0.5 h-full bg-amber-400 shadow-[0_0_10px_rgba(0,0,0,0.5)]"></div>
                        <div className="w-8 h-8 bg-white border-2 border-amber-400 rounded-full shadow-xl flex items-center justify-center absolute"><svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" transform="rotate(90 12 12)" /></svg></div>
                    </div>
                    <div className="absolute top-4 right-4 bg-rose-600 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-xl z-10">VERSIÓN ACTUAL</div>
                </>
            )}

            {!isCompareMode && (
                <>
                    {/* CAMBIO: bg-rose-500/10 y bordes rojos */}
                    {isPinMode && <div className="absolute inset-0 bg-rose-500/10 z-10 border-2 border-rose-500 animate-pulse cursor-crosshair"><div className="absolute top-4 left-1/2 -translate-x-1/2 bg-rose-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg transform -translate-y-full">Haz clic para marcar error</div></div>}
                    {commentsList.map((c) => (
                        <div key={c.id} onClick={(e) => { e.stopPropagation(); setActivePinId(activePinId === c.id ? null : c.id); }} className="absolute w-8 h-8 -ml-4 -mt-8 z-20 cursor-pointer group hover:z-30" style={{ left: `${c.x}%`, top: `${c.y}%` }}>
                            <svg className={`w-full h-full drop-shadow-md transition-colors ${c.resolved ? 'text-emerald-500' : 'text-rose-500'}`} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                        </div>
                    ))}
                    {tempPin && <div className="absolute w-8 h-8 -ml-4 -mt-8 z-30" style={{ left: `${tempPin.x}%`, top: `${tempPin.y}%` }}><svg className="w-full h-full text-rose-500 drop-shadow-xl animate-bounce" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg></div>}
                </>
            )}
          </div>
        </div>

        <aside className="w-96 bg-white border-l border-slate-200 flex flex-col flex-shrink-0 shadow-2xl z-40">
          {tempPin ? (
            // CAMBIO: bg-rose-50 y bordes rojos
            <div className="p-6 bg-rose-50 border-b border-rose-100 h-full flex flex-col">
              <div className="flex items-center gap-2 mb-4 text-rose-700 font-black uppercase text-xs tracking-widest">Nueva Nota</div>
              {/* CAMBIO: focus:ring-rose-200 */}
              <textarea autoFocus value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Escribe aquí tu corrección..." className="flex-1 w-full bg-white border border-rose-200 rounded-xl p-4 text-sm resize-none focus:ring-4 focus:ring-rose-200 outline-none transition-all shadow-inner mb-4" />
              <div className="flex gap-2">
                <button onClick={() => setTempPin(null)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all">Cancelar</button>
                {/* CAMBIO: bg-rose-600 y shadow-rose-200 */}
                <button onClick={handleSavePin} className="flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl shadow-lg shadow-rose-200 hover:-translate-y-1 transition-all">Guardar</button>
              </div>
            </div>
          ) : (
            <>
              <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">Notas ({commentsList.length})</h3>
                <button onClick={() => { setIsPinMode(true); setTempPin(null); setIsCompareMode(false); }} className="text-[10px] bg-rose-50 text-rose-600 px-3 py-1 rounded-full font-bold hover:bg-rose-100 transition-colors">+ Añadir</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                {commentsList.map((c) => (
                  <div key={c.id} onClick={() => setActivePinId(c.id)} className={`group relative p-4 rounded-xl border transition-all ${activePinId === c.id ? 'ring-2 ring-offset-1' : ''} ${c.resolved ? 'bg-emerald-50 border-emerald-200 ring-emerald-200' : 'bg-rose-50 border-rose-200 ring-rose-200'}`}>
                    <div className="flex items-start gap-3">
                      <div className="mt-1"><input type="checkbox" checked={c.resolved || false} onChange={(e) => { e.stopPropagation(); handleToggleResolve(c.id, c.resolved || false); }} className="w-5 h-5 rounded border-2 border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"/></div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium leading-relaxed ${c.resolved ? 'text-emerald-800 line-through opacity-70' : 'text-rose-900'}`}>{c.content}</p>
                        <p className="text-[10px] opacity-50 mt-2 font-bold">{new Date(c.created_at).toLocaleString()}</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteComment(c.id); }} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
};

export default PageReview;
