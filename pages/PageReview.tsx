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
  resolved?: boolean; // NUEVO CAMPO
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

  const project = projects.find(p => p.id === projectId);
  const version = project?.versions.find(v => v.id === versionId);
  const page = version?.pages.find(p => p.id === pageId);

  useEffect(() => {
    if (pageId) fetchComments();
  }, [pageId]);

  const fetchComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('page_id', pageId)
      .order('created_at', { ascending: false });
    if (data) setCommentsList(data);
  };

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
    const newComment = {
      content: comment,
      page_id: pageId,
      x: tempPin?.x || 50,
      y: tempPin?.y || 50,
      resolved: false // Por defecto pendiente
    };
    const { data, error } = await supabase.from('comments').insert([newComment]).select();
    if (error) {
      alert('Error: ' + error.message);
    } else if (data) {
      setCommentsList(prev => [data[0], ...prev]);
      setComment("");
      setTempPin(null);
      if (addNotification) addNotification({ type: 'system', title: 'Nota añadida', message: 'Corrección fijada.', link: '#' });
    }
  };

  const handleDeleteComment = async (id: string) => {
    if (!window.confirm("¿Borrar corrección?")) return;
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (!error) {
      setCommentsList(prev => prev.filter(c => c.id !== id));
      if (activePinId === id) setActivePinId(null);
    }
  };

  // --- NUEVA FUNCIÓN: MARCAR COMO RESUELTO ---
  const handleToggleResolve = async (id: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    
    // 1. Actualizar visualmente rápido (Optimistic UI)
    setCommentsList(prev => prev.map(c => c.id === id ? { ...c, resolved: newStatus } : c));

    // 2. Guardar en Base de Datos
    const { error } = await supabase
      .from('comments')
      .update({ resolved: newStatus })
      .eq('id', id);

    if (error) {
      alert("Error al actualizar");
      // Revertir si falla
      setCommentsList(prev => prev.map(c => c.id === id ? { ...c, resolved: currentStatus } : c));
    }
  };

  if (!project || !version || !page) return <div className="p-10 text-center">Cargando...</div>;
  const isPdf = page.imageUrl.toLowerCase().includes('.pdf');

  return (
    <div className="min-h-screen bg-slate-800 flex flex-col h-screen overflow-hidden">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <h1 className="font-black text-slate-800 text-lg">{project.name}</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Modo Revisión</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={() => { setIsPinMode(!isPinMode); setTempPin(null); }}
             className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ${isPinMode ? 'bg-rose-500 text-white shadow-lg ring-4 ring-rose-200' : 'bg-slate-100 text-slate-600 hover:bg-white hover:text-rose-500'}`}
           >
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
             {isPinMode ? 'Haz clic en el documento' : 'Añadir corrección'}
           </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 overflow-auto flex items-center justify-center relative bg-slate-900/50 cursor-move">
          <div 
            ref={imageContainerRef}
            onClick={handleCanvasClick}
            className={`relative shadow-2xl transition-all ${isPinMode ? 'cursor-crosshair ring-4 ring-rose-500/50' : ''}`}
            style={{ minWidth: '600px', minHeight: '800px', width: 'auto', height: '90%' }}
          >
            {isPdf ? (
              <iframe src={`${page.imageUrl}#toolbar=0`} className="w-full h-full border-none bg-white" title="Visor" />
            ) : (
              <img src={page.imageUrl} alt="Documento" className="w-full h-full object-contain bg-white" />
            )}

            {isPinMode && (
              <div className="absolute inset-0 bg-indigo-500/10 z-10">
                 <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-rose-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg animate-bounce">
                   Haz clic donde quieras comentar
                 </div>
              </div>
            )}

            {commentsList.map((c) => (
              <div 
                key={c.id}
                onClick={(e) => { e.stopPropagation(); setActivePinId(activePinId === c.id ? null : c.id); }}
                className="absolute w-8 h-8 -ml-4 -mt-8 z-20 cursor-pointer group"
                style={{ left: `${c.x}%`, top: `${c.y}%` }}
              >
                {/* EL PIN CAMBIA DE COLOR SI ESTÁ RESUELTO */}
                <svg className={`w-full h-full drop-shadow-md transform hover:scale-125 transition-transform ${c.resolved ? 'text-emerald-500' : 'text-rose-500'}`} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              </div>
            ))}

            {tempPin && (
              <div 
                className="absolute w-8 h-8 -ml-4 -mt-8 z-30"
                style={{ left: `${tempPin.x}%`, top: `${tempPin.y}%` }}
              >
                <svg className="w-full h-full text-indigo-500 drop-shadow-xl animate-bounce" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              </div>
            )}
          </div>
        </div>

        <aside className="w-96 bg-white border-l border-slate-200 flex flex-col flex-shrink-0 shadow-2xl z-40">
          {tempPin ? (
            <div className="p-6 bg-indigo-50 border-b border-indigo-100 h-full flex flex-col">
              <div className="flex items-center gap-2 mb-4 text-indigo-700 font-black uppercase text-xs tracking-widest">Nueva Nota</div>
              <textarea 
                autoFocus
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Escribe aquí tu corrección..." 
                className="flex-1 w-full bg-white border border-indigo-200 rounded-xl p-4 text-sm resize-none focus:ring-4 focus:ring-indigo-200 outline-none transition-all shadow-inner mb-4"
              />
              <div className="flex gap-2">
                <button onClick={() => setTempPin(null)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all">Cancelar</button>
                <button onClick={handleSavePin} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:-translate-y-1 transition-all">Guardar</button>
              </div>
            </div>
          ) : (
            <>
              <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">Notas ({commentsList.length})</h3>
                <button onClick={() => { setIsPinMode(true); setTempPin(null); }} className="text-[10px] bg-rose-50 text-rose-600 px-3 py-1 rounded-full font-bold hover:bg-rose-100 transition-colors">+ Añadir</button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                {commentsList.map((c) => (
                  <div 
                    key={c.id} 
                    onClick={() => setActivePinId(c.id)}
                    className={`group relative p-4 rounded-xl border transition-all ${activePinId === c.id ? 'ring-2 ring-offset-1' : ''} ${c.resolved ? 'bg-emerald-50 border-emerald-200 ring-emerald-200' : 'bg-rose-50 border-rose-200 ring-rose-200'}`}
                  >
                    <div className="flex items-start gap-3">
                      
                      {/* CHECKBOX PARA RESOLVER */}
                      <div className="mt-1">
                        <input 
                          type="checkbox" 
                          checked={c.resolved || false} 
                          onChange={(e) => { e.stopPropagation(); handleToggleResolve(c.id, c.resolved || false); }}
                          className="w-5 h-5 rounded border-2 border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </div>

                      <div className="flex-1">
                        <p className={`text-sm font-medium leading-relaxed ${c.resolved ? 'text-emerald-800 line-through opacity-70' : 'text-rose-900'}`}>{c.content}</p>
                        <p className="text-[10px] opacity-50 mt-2 font-bold">{new Date(c.created_at).toLocaleString()}</p>
                      </div>
                      
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteComment(c.id); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
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
