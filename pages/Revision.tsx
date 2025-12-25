import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase'; 
import { Project } from '../types';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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

  // --- LÓGICA DE BÚSQUEDA ROBUSTA PARA EVITAR PANTALLA EN BLANCO ---
  const project = projects.find(p => p.id === projectId);
  
  let page: any = null;
  let currentVer: any = null;

  if (project) {
    // Buscamos la página en todas las versiones por si el versionId de la URL no coincide
    for (const v of project.versions) {
      const found = v.pages.find(p => p.id === pageId);
      if (found) {
        page = found;
        currentVer = v;
        break;
      }
    }
  }

  useEffect(() => {
    if (pageId) {
      fetchComments();
      const channel = supabase.channel(`live-${pageId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `page_id=eq.${pageId}` }, 
        () => fetchComments())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [pageId]);

  const fetchComments = async () => {
    const { data } = await supabase.from('comments').select('*').eq('page_id', pageId).order('created_at', { ascending: true });
    if (data) setCommentsList(data);
  };

  const exportToPDF = () => {
    const doc = new jsPDF() as any;
    doc.setFont("helvetica", "bold");
    doc.text(`REPORTE DE CORRECCIONES`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Proyecto: ${project?.name} | Pág: ${page?.pageNumber}`, 14, 28);
    const rows = commentsList.map((c, i) => [c.x === null || c.x < 0 ? 'Gral' : i + 1, c.content, c.resolved ? '✓' : '○']);
    doc.autoTable({ startY: 35, head: [['#', 'Comentario', 'Estado']], body: rows, headStyles: { fillColor: [71, 85, 105] } });
    doc.save(`Correcciones_${project?.name}_P${page?.pageNumber}.pdf`);
  };

  const handleSave = async () => {
    const text = (document.getElementById('note-text') as HTMLTextAreaElement)?.value;
    if (!text || !pageId) return;
    const pinCoords = tempPin || { x: null, y: null };
    setIsSaving(true);
    try {
      let finalUrl = null;
      if (fileToUpload) {
        const name = `${Date.now()}-${fileToUpload.name}`;
        await supabase.storage.from('brochures').upload(name, fileToUpload);
        finalUrl = supabase.storage.from('brochures').getPublicUrl(name).data.publicUrl;
      }
      await supabase.from('comments').insert([{ content: text, page_id: pageId, x: pinCoords.x, y: pinCoords.y, resolved: false, image_url: finalUrl }]);
      setTempPin(null);
      setFileToUpload(null);
      fetchComments();
    } catch (err: any) { alert(err.message); } finally { setIsSaving(false); }
  };

  // Si no hay datos, mostramos un estado de carga en lugar de blanco
  if (!project || !page) {
    return (
      <div className="h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-600 mx-auto mb-4"></div>
          <p className="font-black text-slate-400 uppercase text-[10px] tracking-widest">Cargando revisión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-100 flex flex-col font-sans overflow-hidden">
      <header className="h-20 bg-white border-b flex items-center justify-between px-8 shrink-0 z-50 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="text-slate-400 font-bold hover:text-rose-600 transition-colors uppercase text-[10px]">← Volver</button>
            <h1 className="font-black text-slate-800 text-sm uppercase tracking-tight">{project.name} <span className="text-slate-300">/ P{page.pageNumber}</span></h1>
          </div>

          <div className="flex items-center gap-3">
             {/* BOTONES CON LOS NUEVOS NOMBRES */}
             <button onClick={exportToPDF} className="bg-slate-900 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:bg-slate-800 transition-all">
                Descargar correcciones en PDF
             </button>

             <button onClick={() => setTempPin({ x: -1, y: -1 })} className="bg-white border-2 border-slate-100 text-slate-600 px-5 py-3 rounded-2xl font-black text-[10px] uppercase hover:border-slate-300 transition-all">
                Correcciones generales
             </button>

             <button onClick={() => setIsPinMode(!isPinMode)} className={`px-7 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg transition-all ${isPinMode ? 'bg-amber-500 text-white animate-pulse' : 'bg-rose-600 text-white hover:bg-rose-700'}`}>
                {isPinMode ? 'PINCHA EN LA IMAGEN' : 'MARCAR CORRECCIÓN'}
             </button>
          </div>
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
                  <img src={page.imageUrl} className="max-h-[82vh] block select-none pointer-events-none" alt="" />
                  {commentsList.map((c, i) => {
                      if (c.x === null || c.x < 0) return null;
                      return <div key={c.id} className={`absolute w-7 h-7 rounded-full flex items-center justify-center text-xs font-black -ml-3.5 -mt-3.5 border-2 border-white shadow-lg ${c.resolved ? 'bg-emerald-500' : 'bg-rose-600'} text-white`} style={{ left: `${c.x}%`, top: `${c.y}%` }}>{i+1}</div>;
                  })}
                  {tempPin && tempPin.x >= 0 && <div className="absolute w-7 h-7 bg-amber-400 rounded-full animate-bounce -ml-3.5 -mt-3.5 border-2 border-white shadow-xl" style={{ left: `${tempPin.x}%`, top: `${tempPin.y}%` }}></div>}
              </div>
          </div>

          <aside className="w-84 bg-white border-l flex flex-col shrink-0">
              <div className="p-6 border-b font-black text-[10px] uppercase text-slate-400 tracking-widest bg-slate-50/50">Lista de Correcciones</div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {commentsList.map((c, i) => {
                      const isGeneral = c.x === null || c.x < 0;
                      return (
                        <div key={c.id} className={`p-4 rounded-[1.5rem] border transition-all shadow-sm ${c.resolved ? 'bg-emerald-50 border-emerald-100' : isGeneral ? 'bg-blue-50 border-blue-100' : 'bg-white border-slate-100'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <span className={`w-6 h-6 rounded-full bg-white flex items-center justify-center text-[10px] font-black border-2 border-white shadow-sm ${c.resolved ? 'text-emerald-500' : isGeneral ? 'text-blue-600' : 'text-rose-600'}`}>{isGeneral ? '💬' : i+1}</span>
                                <div className="flex gap-1">
                                    <button onClick={async () => { await supabase.from('comments').update({resolved: !c.resolved}).eq('id', c.id); fetchComments(); }} className="w-8 h-8 rounded-xl bg-white border flex items-center justify-center font-bold transition-all hover:scale-110">{c.resolved ? '✓' : '○'}</button>
                                    <button onClick={async () => { await supabase.from('comments').delete().eq('id', c.id); fetchComments(); }} className="w-8 h-8 rounded-xl bg-white border flex items-center justify-center text-xs text-slate-400 hover:text-rose-600 transition-all">✕</button>
                                </div>
                            </div>
                            <p className={`text-sm font-bold leading-relaxed ${c.resolved ? 'text-emerald-700 opacity-40 line-through' : 'text-slate-700'}`}>{c.content}</p>
                        </div>
                      );
                  })}
              </div>
          </aside>
      </div>

      {tempPin && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-sm border text-center">
                <h3 className="font-black text-[10px] uppercase tracking-widest mb-6 text-slate-400">{tempPin.x < 0 ? '📝 CORR. GENERAL' : 'NUEVA NOTA'}</h3>
                <textarea autoFocus id="note-text" className="w-full border-2 bg-slate-50 rounded-2xl p-5 mb-4 h-32 outline-none focus:border-rose-600 font-bold text-slate-700 resize-none" placeholder="Escribe aquí..."></textarea>
                <div className="flex gap-2">
                    <button onClick={() => setTempPin(null)} className="flex-1 py-4 font-black text-slate-400 text-[10px]">CANCELAR</button>
                    <button onClick={handleSave} disabled={isSaving} className={`flex-1 py-4 rounded-2xl font-black text-[10px] shadow-xl transition-all ${isSaving ? 'bg-slate-400' : 'bg-rose-600 text-white hover:bg-rose-700 uppercase'}`}>{isSaving ? 'GUARDANDO...' : 'GUARDAR'}</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Revision;
