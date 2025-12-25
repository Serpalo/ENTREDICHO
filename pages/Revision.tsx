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
  
  const [scale, setScale] = useState(1);
  const [showResolved, setShowResolved] = useState(true);
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [isPinMode, setIsPinMode] = useState(false);
  const [tempPin, setTempPin] = useState<{x: number, y: number} | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const project = projects.find(p => p.id === projectId);
  let page: any = null;
  let allPages: any[] = [];

  if (project) {
    project.versions.forEach(v => {
      const found = v.pages.find(p => p.id === pageId);
      if (found) {
        page = found;
        allPages = v.pages;
      }
    });
  }

  const currentIndex = allPages.findIndex(p => p.id === pageId);
  const prevPage = allPages[currentIndex - 1];
  const nextPage = allPages[currentIndex + 1];

  useEffect(() => {
    if(pageId) fetchComments();
  }, [pageId]);

  const fetchComments = async () => {
    const { data } = await supabase.from('comments').select('*').eq('page_id', pageId).order('created_at', { ascending: false });
    if (data) setCommentsList(data);
  };

  // --- FUNCIÓN DE GUARDADO REPARADA ---
  const handleSaveFullNote = async () => {
    const textElement = document.getElementById('new-comment-text') as HTMLTextAreaElement;
    const content = textElement?.value;

    if (!content || !pageId || !tempPin) return;

    setIsUploading(true);
    let finalImageUrl = null;

    try {
      // 1. Si hay archivo, lo subimos primero
      if (pendingFile) {
        const fileName = `ref-${Date.now()}-${pendingFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error: uploadError } = await supabase.storage.from('brochures').upload(fileName, pendingFile);
        
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('brochures').getPublicUrl(fileName);
        finalImageUrl = urlData.publicUrl;
      }

      // 2. Guardamos la nota en la tabla
      const { data, error: insertError } = await supabase.from('comments').insert([{ 
        content: content,
        page_id: pageId,
        x: tempPin.x,
        y: tempPin.y,
        resolved: false,
        image_url: finalImageUrl // Asegúrate de haber creado esta columna en Supabase
      }]).select();

      if (insertError) throw insertError;

      if (data) {
        setCommentsList(prev => [data[0], ...prev]);
        setTempPin(null);
        setPendingFile(null);
      }
    } catch (err: any) {
      alert("Error al guardar: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const toggleResolved = async (id: string, currentStatus: boolean) => {
    await supabase.from('comments').update({ resolved: !currentStatus }).eq('id', id);
    setCommentsList(prev => prev.map(c => c.id === id ? { ...c, resolved: !currentStatus } : c));
  };

  if (!project || !page) return <div className="p-10 bg-slate-50 h-screen flex items-center justify-center font-bold">Cargando...</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-100 text-slate-800 overflow-hidden font-sans">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm z-50">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="text-slate-400 font-bold hover:text-rose-600 transition-colors">← Volver</button>
            <h1 className="font-black text-slate-800 tracking-tight">{project.name} <span className="text-slate-300 font-medium">/ Pág {page.pageNumber}</span></h1>
          </div>

          <button onClick={() => setIsPinMode(!isPinMode)} className={`px-5 py-2 rounded-xl font-black text-[10px] uppercase transition-all shadow-lg ${isPinMode ? 'bg-slate-800 text-white animate-pulse' : 'bg-rose-600 text-white hover:bg-rose-700'}`}>
            {isPinMode ? '📍 TOCA LA IMAGEN' : 'MARCAR CORRECCIÓN'}
          </button>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
          {/* NAVEGACIÓN */}
          {prevPage && <button onClick={() => navigate(`/project/${projectId}/version/${versionId}/page/${prevPage.id}`)} className="absolute left-6 top-1/2 -translate-y-1/2 z-40 w-12 h-12 bg-white/90 hover:bg-white text-slate-400 rounded-full shadow-2xl border flex items-center justify-center font-black transition-all">←</button>}
          {nextPage && <button onClick={() => navigate(`/project/${projectId}/version/${versionId}/page/${nextPage.id}`)} className="absolute right-[340px] top-1/2 -translate-y-1/2 z-40 w-12 h-12 bg-white/90 hover:bg-white text-slate-400 rounded-full shadow-2xl border flex items-center justify-center font-black transition-all">→</button>}

          <div className="flex-1 relative flex items-center justify-center bg-slate-50 overflow-hidden">
                <div ref={imageContainerRef} onClick={(e) => {
                    if(!isPinMode || !imageContainerRef.current) return;
                    const r = imageContainerRef.current.getBoundingClientRect();
                    setTempPin({ x: ((e.clientX - r.left)/r.width)*100, y: ((e.clientY - r.top)/r.height)*100 });
                    setIsPinMode(false);
                }} className="relative shadow-2xl border bg-white cursor-crosshair">
                    <img src={page.imageUrl} className="max-h-[82vh] select-none block" alt="" />
                    {commentsList.map((c, i) => (
                        <div key={c.id} className={`absolute w-7 h-7 rounded-full flex items-center justify-center text-xs font-black -ml-3.5 -mt-3.5 border-2 border-white shadow-lg ${c.resolved ? 'bg-emerald-500 text-white' : 'bg-rose-600 text-white'}`} style={{ left: `${c.x}%`, top: `${c.y}%` }}>{i+1}</div>
                    ))}
                    {tempPin && <div className="absolute w-7 h-7 bg-amber-400 rounded-full animate-bounce -ml-3.5 -mt-3.5 border-2 border-white shadow-xl" style={{ left: `${tempPin.x}%`, top: `${tempPin.y}%` }}></div>}
                </div>
          </div>

          <div className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0">
             <div className="p-5 border-b flex justify-between items-center bg-slate-50/50">
                 <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-widest">Notas ({commentsList.length})</h3>
                 <button onClick={() => setShowResolved(!showResolved)} className="text-[10px] font-bold text-slate-400 uppercase">{showResolved ? 'Ocultar' : 'Ver todo'}</button>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-3">
                 {commentsList.filter(c => showResolved || !c.resolved).map((c, i) => (
                     <div key={c.id} className={`p-4 rounded-2xl border transition-all shadow-sm ${c.resolved ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                         <div className="flex justify-between items-start mb-2">
                            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black border-2 border-white shadow-sm ${c.resolved ? 'bg-emerald-500 text-white' : 'bg-rose-600 text-white'}`}>{i+1}</span>
                            <button onClick={() => toggleResolved(c.id, c.resolved)} className="w-8 h-8 rounded-xl bg-white border flex items-center justify-center font-bold">{c.resolved ? '✓' : '○'}</button>
                         </div>
                         <p className={`text-sm font-bold leading-relaxed mb-3 ${c.resolved ? 'text-emerald-700 line-through opacity-60' : 'text-rose-700'}`}>{c.content}</p>
                         {c.image_url && (
                             <a href={c.image_url} target="_blank" download className="block w-full py-2 bg-white/50 border border-slate-200 rounded-xl text-center text-[9px] font-black uppercase text-slate-500 hover:bg-white transition-all">📥 Descargar Referencia</a>
                         )}
                     </div>
                 ))}
             </div>
          </div>
      </div>

      {/* CUADRO DE NOTA REPARADO */}
      {tempPin && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl text-slate-900 w-full max-w-md border">
                <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-widest mb-6 text-center">Nueva Corrección</h3>
                <textarea autoFocus id="new-comment-text" className="w-full border-2 border-slate-100 bg-slate-50 rounded-2xl p-4 mb-4 h-32 outline-none focus:border-rose-600 font-bold text-slate-700 resize-none shadow-inner" placeholder="Escribe aquí..."></textarea>
                
                <div className="mb-6">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Adjuntar imagen (opcional)</label>
                    <div className="flex items-center gap-3">
                        <input 
                            type="file" 
                            id="comment-file"
                            accept="image/*" 
                            className="hidden"
                            onChange={(e) => setPendingFile(e.target.files?.[0] || null)}
                        />
                        <button onClick={() => document.getElementById('comment-file')?.click()} className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl font-black text-[10px] uppercase border border-rose-100">
                            {pendingFile ? 'Cambiar Archivo' : 'Seleccionar Archivo'}
                        </button>
                        {pendingFile && <span className="text-[10px] font-bold text-slate-400 truncate max-w-[150px]">{pendingFile.name}</span>}
                    </div>
                </div>

                <div className="flex gap-3">
                    <button onClick={() => { setTempPin(null); setPendingFile(null); }} className="flex-1 py-4 font-black text-slate-400 uppercase text-[10px]">Cancelar</button>
                    <button 
                        disabled={isUploading}
                        onClick={handleSaveFullNote} 
                        className={`flex-1 py-4 rounded-2xl font-black shadow-xl text-[10px] uppercase transition-all ${isUploading ? 'bg-slate-400' : 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-200'}`}
                    >
                        {isUploading ? 'GUARDANDO...' : 'GUARDAR NOTA'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Revision;
