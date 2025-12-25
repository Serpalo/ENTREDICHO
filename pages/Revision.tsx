import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase'; 
import { Project } from '../types';

const Revision: React.FC<{ projects: Project[] }> = ({ projects }) => {
  const { projectId, versionId, pageId } = useParams();
  const navigate = useNavigate();
  const imageContainerRef = useRef<HTMLDivElement>(null);
  
  const [scale, setScale] = useState(1);
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [isPinMode, setIsPinMode] = useState(false);
  const [tempPin, setTempPin] = useState<{x: number, y: number} | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);

  // Lógica de búsqueda robusta para evitar errores de carga
  const project = projects.find(p => p.id === projectId);
  let page: any = null;
  if (project) {
    for (const v of project.versions) {
      const found = v.pages.find(p => p.id === pageId);
      if (found) { page = found; break; }
    }
  }

  useEffect(() => { if(pageId) fetchComments(); }, [pageId]);

  const fetchComments = async () => {
    const { data } = await supabase.from('comments').select('*').eq('page_id', pageId).order('created_at', { ascending: true });
    if (data) setCommentsList(data);
  };

  const handleSave = async () => {
    const text = (document.getElementById('note-text') as HTMLTextAreaElement)?.value;
    if (!text || !tempPin || !pageId) return;
    setIsSaving(true);
    let finalUrl = null;
    try {
      if (fileToUpload) {
        const name = `ref-${Date.now()}-${fileToUpload.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        await supabase.storage.from('brochures').upload(name, fileToUpload);
        finalUrl = supabase.storage.from('brochures').getPublicUrl(name).data.publicUrl;
      }
      const { error } = await supabase.from('comments').insert([{
        content: text, page_id: pageId, x: tempPin.x, y: tempPin.y, resolved: false, image_url: finalUrl
      }]);
      if (error) throw error;
      setTempPin(null);
      setFileToUpload(null);
      fetchComments();
    } catch (err: any) { alert("Error: " + err.message); } finally { setIsSaving(false); }
  };

  // NUEVA FUNCIÓN: BORRAR NOTA
  const deleteComment = async (id: string) => {
    if (!window.confirm("¿Estás seguro de que quieres borrar esta nota?")) return;
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (error) alert("Error al borrar");
    else fetchComments();
  };

  if (!page) return <div className="h-screen flex items-center justify-center font-black text-slate-400 animate-pulse">CARGANDO...</div>;

  return (
    <div className="h-screen bg-slate-100 flex flex-col font-sans overflow-hidden">
      <header className="h-16 bg-white border-b flex items-center justify-between px-6 shrink-0 z-50">
          <button onClick={() => navigate(-1)} className="text-slate-400 font-bold hover:text-rose-600 transition-colors uppercase text-[10px] tracking-widest">← Volver</button>
          <h1 className="font-black text-slate-800 text-sm tracking-tight hidden md:block">REVISIÓN: {project?.name} / Pág {page.pageNumber}</h1>
          <button 
            onClick={() => setIsPinMode(!isPinMode)} 
            className={`px-8 py-2 rounded-xl font-black text-[10px] uppercase shadow-lg transition-all ${isPinMode ? 'bg-slate-800 text-white animate-pulse' : 'bg-rose-600 text-white hover:bg-rose-700'}`}
          >
            {isPinMode ? 'CANCELAR' : 'MARCAR CORRECCIÓN'}
          </button>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 relative flex items-center justify-center bg-slate-50 overflow-hidden" onWheel={(e) => { if(e.ctrlKey) setScale(s => Math.min(Math.max(s + e.deltaY * -0.01, 0.5), 4)) }}>
              <div 
                ref={imageContainerRef} 
                onClick={(e) => {
                    if(!isPinMode || !imageContainerRef.current) return;
                    const r = imageContainerRef.current.getBoundingClientRect();
                    setTempPin({ x: ((e.clientX - r.left)/r.width)*100, y: ((e.clientY - r.top)/r.height)*100 });
                    setIsPinMode(false);
                }} 
                style={{ transform: `scale(${scale})` }} 
                className={`relative shadow-2xl border bg-white transition-all ${isPinMode ? 'cursor-crosshair ring-4 ring-rose-500/30' : 'cursor-default'}`}
              >
                  <img src={page.imageUrl} className="max-h-[82vh] block select-none" alt="" />
                  {commentsList.map((c, i) => (
                      <div key={c.id} className={`absolute w-7 h-7 rounded-full flex items-center justify-center text-xs font-black -ml-3.5 -mt-3.5 border-2 border-white shadow-lg ${c.resolved ? 'bg-emerald-500' : 'bg-rose-600'} text-white`} style={{ left: `${c.x}%`, top: `${c.y}%` }}>{i+1}</div>
                  ))}
                  {tempPin && <div className="absolute w-7 h-7 bg-amber-400 rounded-full animate-bounce -ml-3.5 -mt-3.5 border-2 border-white shadow-xl" style={{ left: `${tempPin.x}%`, top: `${tempPin.y}%` }}></div>}
              </div>
          </div>

          <aside className="w-80 bg-white border-l flex flex-col shrink-0 shadow-[-10px_0_15px_rgba(0,0,0,0.02)]">
              <div className="p-5 border-b font-black text-[10px] uppercase text-slate-400 tracking-widest bg-slate-50/50">
                  Correcciones ({commentsList.length})
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {commentsList.map((c, i) => (
                      <div key={c.id} className={`p-4 rounded-2xl border transition-all shadow-sm ${c.resolved ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100 hover:border-rose-200'}`}>
                          <div className="flex justify-between items-start mb-2">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white shadow-sm ${c.resolved ? 'bg-emerald-500 text-white' : 'bg-rose-600 text-white'}`}>{i+1}</span>
                              <div className="flex gap-1">
                                  {/* BOTÓN RESOLVER */}
                                  <button onClick={async () => { await supabase.from('comments').update({resolved: !c.resolved}).eq('id', c.id); fetchComments(); }} className="w-8 h-8 rounded-xl bg-slate-50 border flex items-center justify-center shadow-sm text-xs transition-colors hover:bg-emerald-500 hover:text-white">{c.resolved ? '✓' : '○'}</button>
                                  {/* BOTÓN BORRAR NOTA */}
                                  <button onClick={() => deleteComment(c.id)} className="w-8 h-8 rounded-xl bg-slate-50 border flex items-center justify-center shadow-sm text-xs text-slate-400 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all">✕</button>
                              </div>
                          </div>
                          <p className={`text-sm font-bold leading-relaxed ${c.resolved ? 'text-emerald-700 opacity-60 line-through' : 'text-slate-700'}`}>{c.content}</p>
                          {c.image_url && <a href={c.image_url} target="_blank" rel="noreferrer" className="mt-3 block w-full py-2 bg-slate-50 border rounded-xl text-center text-[9px] font-black uppercase text-slate-500 hover:bg-white shadow-sm">📥 Referencia</a>}
                      </div>
                  ))}
              </div>
          </aside>
      </div>

      {tempPin && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-sm border text-center">
                <h3 className="font-black text-[10px] uppercase tracking-widest mb-6 text-slate-400">Nueva Nota</h3>
                <textarea autoFocus id="note-text" className="w-full border-2 bg-slate-50 rounded-2xl p-4 mb-4 h-32 outline-none focus:border-rose-600 font-bold text-slate-700 resize-none shadow-inner" placeholder="Escribe aquí..."></textarea>
                <div className="mb-6">
                    <input type="file" onChange={(e) => setFileToUpload(e.target.files?.[0] || null)} className="text-[10px] block w-full border rounded-xl p-2 bg-slate-50" />
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { setTempPin(null); setFileToUpload(null); }} className="flex-1 py-4 font-black text-slate-400 text-[10px]">CANCELAR</button>
                    <button onClick={handleSave} disabled={isSaving} className={`flex-1 py-4 rounded-2xl font-black text-[10px] shadow-xl transition-all ${isSaving ? 'bg-slate-400' : 'bg-rose-600 text-white hover:bg-rose-700 uppercase'}`}>
                        {isSaving ? 'GUARDANDO...' : 'GUARDAR NOTA'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Revision;
