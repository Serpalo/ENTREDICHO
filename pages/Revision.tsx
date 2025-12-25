import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase'; 
import { Project } from '../types';

const Revision: React.FC<{ projects: Project[] }> = ({ projects }) => {
  const { projectId, versionId, pageId } = useParams();
  const navigate = useNavigate();
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  
  const [scale, setScale] = useState(1);
  const [showResolved, setShowResolved] = useState(true);
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [isPinMode, setIsPinMode] = useState(false);
  const [tempPin, setTempPin] = useState<{x: number, y: number} | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);

  const [isCompareMode, setIsCompareMode] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [compareVersionId, setCompareVersionId] = useState("");
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  const project = projects.find(p => p.id === projectId);
  let page: any = null;
  let allPages: any[] = [];

  if (project) {
    project.versions.forEach(v => {
      const found = v.pages.find(p => p.id === pageId);
      if (found) { page = found; allPages = v.pages; }
    });
  }

  // --- ESCUCHA EN TIEMPO REAL PARA COLABORACIÓN ---
  useEffect(() => {
    if (!pageId) return;
    
    fetchComments();

    // Suscribirse a cambios: si alguien más borra, edita o crea una nota
    const channel = supabase.channel(`comments-${pageId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `page_id=eq.${pageId}` }, 
      () => fetchComments())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [pageId]);

  const fetchComments = async () => {
    const { data } = await supabase.from('comments').select('*').eq('page_id', pageId).order('created_at', { ascending: false });
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
    } catch (err: any) { alert("Error: " + err.message); } finally { setIsSaving(false); }
  };

  const toggleResolved = async (id: string, currentStatus: boolean) => {
    await supabase.from('comments').update({ resolved: !currentStatus }).eq('id', id);
    // No hace falta actualizar el estado aquí, el canal de tiempo real lo hará solo
  };

  if (!page) return <div className="p-10 bg-white h-screen flex items-center justify-center font-bold italic text-slate-400">Sincronizando...</div>;

  return (
    <div className="h-screen bg-slate-100 flex flex-col font-sans overflow-hidden"
         onMouseMove={isDraggingSlider ? (e) => {
            const rect = sliderRef.current?.getBoundingClientRect();
            if (rect) setSliderPosition(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
         } : undefined}
         onMouseUp={() => setIsDraggingSlider(false)}
    >
      <header className="h-16 bg-white border-b flex items-center justify-between px-6 shrink-0 shadow-sm z-50">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="text-slate-400 font-bold hover:text-rose-600 transition-colors">← VOLVER</button>
            <h1 className="font-black text-slate-800 tracking-tight">{project?.name} <span className="text-slate-300 font-medium">/ Pág {page.pageNumber}</span></h1>
          </div>
          <button onClick={() => setIsPinMode(!isPinMode)} className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase shadow-lg transition-all ${isPinMode ? 'bg-slate-800 text-white animate-pulse' : 'bg-rose-600 text-white hover:bg-rose-700'}`}>
            {isPinMode ? '📍 SELECCIONA EN IMAGEN' : 'MARCAR CORRECCIÓN'}
          </button>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
          {/* BOTONES NAVEGACIÓN */}
          {allPages[allPages.findIndex(p => p.id === pageId) - 1] && <button onClick={() => navigate(`/project/${projectId}/version/${versionId}/page/${allPages[allPages.findIndex(p => p.id === pageId) - 1].id}`)} className="absolute left-6 top-1/2 -translate-y-1/2 z-40 w-12 h-12 bg-white/90 rounded-full shadow-2xl border flex items-center justify-center font-black">←</button>}
          {allPages[allPages.findIndex(p => p.id === pageId) + 1] && <button onClick={() => navigate(`/project/${projectId}/version/${versionId}/page/${allPages[allPages.findIndex(p => p.id === pageId) + 1].id}`)} className="absolute right-[340px] top-1/2 -translate-y-1/2 z-40 w-12 h-12 bg-white/90 rounded-full shadow-2xl border flex items-center justify-center font-black">→</button>}

          <div className="flex-1 relative flex items-center justify-center bg-slate-50 overflow-hidden" onWheel={(e) => { if(e.ctrlKey) setScale(s => Math.min(Math.max(s + e.deltaY * -0.01, 0.5), 4)) }}>
            {!isCompareMode ? (
                <div ref={imageContainerRef} onClick={(e) => {
                    if(!isPinMode || !imageContainerRef.current) return;
                    const r = imageContainerRef.current.getBoundingClientRect();
                    setTempPin({ x: ((e.clientX - r.left)/r.width)*100, y: ((e.clientY - r.top)/r.height)*100 });
                    setIsPinMode(false);
                }} style={{ transform: `scale(${scale})` }} className="relative shadow-2xl border bg-white cursor-crosshair">
                    <img src={page.imageUrl} className="max-h-[82vh] block select-none" alt="" />
                    {commentsList.map((c, i) => (
                        <div key={c.id} className={`absolute w-7 h-7 rounded-full flex items-center justify-center text-xs font-black -ml-3.5 -mt-3.5 border-2 border-white shadow-lg ${c.resolved ? 'bg-emerald-500' : 'bg-rose-600'} text-white`} style={{ left: `${c.x}%`, top: `${c.y}%` }}>{i+1}</div>
                    ))}
                    {tempPin && <div className="absolute w-7 h-7 bg-amber-400 rounded-full animate-bounce -ml-3.5 -mt-3.5 border-2 border-white shadow-xl" style={{ left: `${tempPin.x}%`, top: `${tempPin.y}%` }}></div>}
                </div>
            ) : (
                <div ref={sliderRef} className="relative max-h-[82vh] border bg-white shadow-2xl transition-transform" style={{ transform: `scale(${scale})` }}>
                     <img src={page.imageUrl} className="max-h-[82vh] pointer-events-none block" alt="" />
                     {compareImageUrl && (
                        <div className="absolute top-0 left-0 h-full overflow-hidden border-r-2 border-white" style={{ width: `${sliderPosition}%` }}>
                             <img src={compareImageUrl} className="max-h-[82vh]" style={{ width: sliderRef.current?.offsetWidth, maxWidth: 'none', height: '100%' }} alt="" />
                        </div>
                     )}
                </div>
            )}
          </div>

          <aside className="w-80 bg-white border-l flex flex-col shrink-0 shadow-[-10px_0_15px_rgba(0,0,0,0.02)]">
              <div className="p-5 border-b flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-black text-[10px] uppercase text-slate-400 tracking-widest">Correcciones ({commentsList.length})</h3>
                  <button onClick={() => setShowResolved(!showResolved)} className="text-[10px] font-bold text-slate-400 uppercase">{showResolved ? 'Ocultar' : 'Ver todo'}</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {commentsList.filter(c => showResolved || !c.resolved).map((c, i) => (
                      <div key={c.id} className={`p-4 rounded-2xl border shadow-sm transition-all ${c.resolved ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                          <div className="flex justify-between mb-2">
                              <span className={`w-6 h-6 rounded-full bg-white flex items-center justify-center text-[10px] font-black border-2 border-white shadow-sm ${c.resolved ? 'text-emerald-500' : 'text-rose-600'}`}>{i+1}</span>
                              <button onClick={() => toggleResolved(c.id, c.resolved)} className="w-8 h-8 rounded-xl bg-white border flex items-center justify-center shadow-sm font-bold">{c.resolved ? '✓' : '○'}</button>
                          </div>
                          <p className={`text-sm font-bold leading-relaxed ${c.resolved ? 'text-emerald-700 opacity-60 line-through' : 'text-rose-700'}`}>{c.content}</p>
                          {c.image_url && <a href={c.image_url} target="_blank" download className="mt-3 block w-full py-2 bg-white/50 border rounded-xl text-center text-[9px] font-black uppercase text-slate-500 hover:bg-white shadow-sm">📥 Descargar Adjunto</a>}
                      </div>
                  ))}
              </div>
          </aside>
      </div>

      {tempPin && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl text-slate-900 w-full max-w-sm border text-center">
                <h3 className="font-black text-[10px] uppercase tracking-widest mb-6 text-slate-400 italic">Colaboración en tiempo real activa</h3>
                <textarea autoFocus id="note-text" className="w-full border-2 bg-slate-50 rounded-2xl p-4 mb-4 h-32 outline-none focus:border-rose-600 font-bold text-slate-700 resize-none shadow-inner" placeholder="Escribe aquí la corrección..."></textarea>
                <div className="mb-6">
                    <input type="file" onChange={(e) => setFileToUpload(e.target.files?.[0] || null)} className="text-[10px] block w-full border rounded-xl p-2 bg-slate-50" />
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { setTempPin(null); setFileToUpload(null); }} className="flex-1 py-4 font-black text-slate-400 text-[10px]">CANCELAR</button>
                    <button onClick={handleSave} disabled={isSaving} className={`flex-1 py-4 rounded-2xl font-black text-[10px] shadow-xl transition-all ${isSaving ? 'bg-slate-400' : 'bg-rose-600 text-white hover:bg-rose-700 uppercase'}`}>
                        {isSaving ? 'SINCRONIZANDO...' : 'GUARDAR CORRECCIÓN'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Revision;
