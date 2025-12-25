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
  const sliderRef = useRef<HTMLDivElement>(null);
  
  const [scale, setScale] = useState(1);
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [isPinMode, setIsPinMode] = useState(false);
  const [tempPin, setTempPin] = useState<{x: number, y: number} | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);

  // 1. COMPARADOR
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [compareVersionId, setCompareVersionId] = useState("");
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  // 2. BÚSQUEDA BLINDADA (EVITA PANTALLA EN BLANCO)
  const project = projects.find(p => p.id === projectId);
  let page: any = null;
  let currentVer: any = null;
  let allPagesInVersion: any[] = [];

  if (project) {
    for (const v of project.versions) {
      const found = v.pages.find(p => p.id === pageId);
      if (found) {
        page = found;
        currentVer = v;
        allPagesInVersion = v.pages;
        break;
      }
    }
  }

  // 3. NAVEGACIÓN
  const currentIndex = allPagesInVersion.findIndex(p => p.id === pageId);
  const prevPage = allPagesInVersion[currentIndex - 1];
  const nextPage = allPagesInVersion[currentIndex + 1];
  const otherVersions = project ? project.versions.filter(v => v.versionNumber !== currentVer?.versionNumber) : [];
  
  const compareImageUrl = compareVersionId 
    ? project?.versions.find(v => v.id === compareVersionId)?.pages.find((p:any) => p.pageNumber === page?.pageNumber)?.imageUrl 
    : null;

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

  // 4. EXPORTAR PDF (NOMBRE CORREGIDO)
  const exportToPDF = () => {
    const doc = new jsPDF() as any;
    doc.setFont("helvetica", "bold");
    doc.text(`REPORTE DE CORRECCIONES`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Proyecto: ${project?.name} | Pág: ${page?.pageNumber}`, 14, 28);
    const rows = commentsList.map((c, i) => [c.x === null || c.x < 0 ? 'Gral' : i + 1, c.content, c.resolved ? 'RESOLVIDO' : 'PENDIENTE']);
    doc.autoTable({ startY: 35, head: [['#', 'Comentario', 'Estado']], body: rows, headStyles: { fillColor: [71, 85, 105] } });
    doc.save(`Correcciones_${project?.name}_P${page?.pageNumber}.pdf`);
  };

  // 5. SUBIDA DE ARCHIVOS ADJUNTOS
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

  const deleteComment = async (id: string) => {
    if (!window.confirm("¿Borrar nota?")) return;
    await supabase.from('comments').delete().eq('id', id);
    fetchComments();
  };

  if (!project || !page) return <div className="h-screen flex items-center justify-center font-black text-slate-400 uppercase text-xs">Cargando revisión...</div>;

  return (
    <div className="h-screen bg-slate-100 flex flex-col font-sans overflow-hidden select-none"
         onMouseMove={isDraggingSlider ? (e) => {
            const rect = sliderRef.current?.getBoundingClientRect();
            if (rect) setSliderPosition(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
         } : undefined}
         onMouseUp={() => setIsDraggingSlider(false)}
    >
      <header className="h-20 bg-white border-b flex items-center justify-between px-6 shrink-0 z-50 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="text-slate-400 font-bold hover:text-rose-600 transition-colors uppercase text-[10px]">← Volver</button>
            <h1 className="font-black text-slate-800 text-sm uppercase tracking-tight">{project.name} <span className="text-slate-300">/ P{page.pageNumber}</span></h1>
          </div>

          <div className="flex items-center gap-2">
             <button onClick={exportToPDF} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-slate-800 transition-all">
                Descargar correcciones en PDF
             </button>

             <button onClick={() => setTempPin({ x: -1, y: -1 })} className="bg-white border-2 border-slate-100 text-slate-600 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase hover:border-slate-300 transition-all">
                Correcciones generales
             </button>

             <button onClick={() => setIsPinMode(!isPinMode)} className={`px-7 py-2.5 rounded-xl font-black text-[10px] uppercase shadow-lg transition-all ${isPinMode ? 'bg-amber-500 text-white animate-pulse' : 'bg-rose-600 text-white hover:bg-rose-700'}`}>
                {isPinMode ? 'PINCHA EN LA IMAGEN' : 'MARCAR CORRECCIÓN'}
             </button>

             {otherVersions.length > 0 && (
                <button onClick={() => setIsCompareMode(!isCompareMode)} className={`px-5 py-2.5 rounded-xl font-bold text-[10px] uppercase border transition-all ${isCompareMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-600 border-blue-100'}`}>
                    {isCompareMode ? 'Salir' : 'Comparar'}
                </button>
             )}
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
          {prevPage && <button onClick={() => navigate(`/project/${projectId}/version/${versionId}/page/${prevPage.id}`)} className="absolute left-6 top-1/2 -translate-y-1/2 z-40 w-12 h-12 bg-white rounded-full shadow-2xl border flex items-center justify-center font-black hover:scale-110 transition-all">←</button>}
          {nextPage && <button onClick={() => navigate(`/project/${projectId}/version/${versionId}/page/${nextPage.id}`)} className="absolute right-[340px] top-1/2 -translate-y-1/2 z-40 w-12 h-12 bg-white rounded-full shadow-2xl border flex items-center justify-center font-black hover:scale-110 transition-all">→</button>}

          <div className="flex-1 relative flex items-center justify-center bg-slate-50 overflow-hidden" onWheel={(e) => { if(e.ctrlKey) setScale(s => Math.min(Math.max(s + e.deltaY * -0.01, 0.5), 4)) }}>
            {!isCompareMode ? (
                <div ref={imageContainerRef} onClick={(e) => {
                    if(!isPinMode || !imageContainerRef.current) return;
                    const r = imageContainerRef.current.getBoundingClientRect();
                    setTempPin({ x: ((e.clientX - r.left)/r.width)*100, y: ((e.clientY - r.top)/r.height)*100 });
                    setIsPinMode(false);
                }} style={{ transform: `scale(${scale})` }} className={`relative shadow-2xl border bg-white transition-all ${isPinMode ? 'cursor-crosshair ring-4 ring-rose-500/30' : 'cursor-default'}`}>
                    <img src={page.imageUrl} className="max-h-[82vh] block select-none pointer-events-none" alt="" />
                    {commentsList.map((c, i) => {
                        if (c.x === null || c.x < 0) return null;
                        return <div key={c.id} className={`absolute w-7 h-7 rounded-full flex items-center justify-center text-xs font-black -ml-3.5 -mt-3.5 border-2 border-white shadow-lg ${c.resolved ? 'bg-emerald-500' : 'bg-rose-600'} text-white`} style={{ left: `${c.x}%`, top: `${c.y}%` }}>{i+1}</div>;
                    })}
                    {tempPin && tempPin.x >= 0 && <div className="absolute w-7 h-7 bg-amber-400 rounded-full animate-bounce -ml-3.5 -mt-3.5 border-2 border-white shadow-xl" style={{ left: `${tempPin.x}%`, top: `${tempPin.y}%` }}></div>}
                </div>
            ) : (
                <div ref={sliderRef} className="relative max-h-[82vh] border bg-white shadow-2xl transition-transform" style={{ transform: `scale(${scale})` }}>
                     <img src={page.imageUrl} className="max-h-[82vh] pointer-events-none block" alt="" />
                     {compareImageUrl && (
                        <div className="absolute top-0 left-0 h-full overflow-hidden border-r-2 border-white pointer-events-none" style={{ width: `${sliderPosition}%` }}>
                             <img src={compareImageUrl} className="max-h-[82vh]" style={{ width: sliderRef.current?.offsetWidth, maxWidth: 'none', height: '100%' }} alt="" />
                        </div>
                     )}
                     <div className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-50 shadow-xl" style={{ left: `${sliderPosition}%` }} onMouseDown={() => setIsDraggingSlider(true)}>
                        <div className="absolute top-1/2 -mt-5 -ml-5 w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-800 font-black shadow-2xl border border-slate-100">↔</div>
                     </div>
                </div>
            )}
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
                                    <button onClick={() => deleteComment(c.id)} className="w-8 h-8 rounded-xl bg-white border flex items-center justify-center text-xs text-slate-400 hover:text-rose-600 transition-all font-black">✕</button>
                                </div>
                            </div>
                            <p className={`text-sm font-bold leading-relaxed ${c.resolved ? 'text-emerald-700 opacity-40 line-through' : 'text-slate-700'}`}>{c.content}</p>
                            {/* 6. DESCARGA DE ADJUNTOS */}
                            {c.image_url && (
                              <a href={c.image_url} target="_blank" rel="noreferrer" download className="mt-3 block w-full py-2 bg-slate-50 border rounded-xl text-center text-[9px] font-black uppercase text-slate-500 hover:bg-white shadow-sm transition-all">
                                📥 Ver Adjunto
                              </a>
                            )}
                        </div>
                      );
                  })}
              </div>
          </aside>
      </div>

      {tempPin && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-sm border text-center">
                <h3 className="font-black text-[10px] uppercase tracking-widest mb-6 text-slate-400">{tempPin.x < 0 ? '📝 CORRECCIONES GENERALES' : 'NUEVA CORRECCIÓN'}</h3>
                <textarea autoFocus id="note-text" className="w-full border-2 bg-slate-50 rounded-2xl p-5 mb-4 h-32 outline-none focus:border-rose-600 font-bold text-slate-700 resize-none shadow-inner" placeholder="Escribe aquí..."></textarea>
                {/* 7. SUBIDA DE ARCHIVOS ADJUNTOS */}
                <div className="mb-6">
                  <label htmlFor="file-upload" className="text-[10px] block w-full py-3 bg-slate-50 border rounded-xl text-center font-black uppercase text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors">
                    {fileToUpload ? fileToUpload.name : '📎 Adjuntar Imagen'}
                  </label>
                  <input id="file-upload" type="file" onChange={(e) => setFileToUpload(e.target.files?.[0] || null)} className="hidden" accept="image/*" />
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { setTempPin(null); setFileToUpload(null); }} className="flex-1 py-4 font-black text-slate-400 text-[10px]">CANCELAR</button>
                    <button onClick={handleSave} disabled={isSaving} className={`flex-1 py-4 rounded-2xl font-black text-[10px] shadow-xl transition-all ${isSaving ? 'bg-slate-400' : 'bg-rose-600 text-white hover:bg-rose-700 uppercase'}`}>{isSaving ? 'GUARDANDO...' : 'GUARDAR'}</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Revision;
