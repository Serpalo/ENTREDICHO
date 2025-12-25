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
  const [showResolved, setShowResolved] = useState(true);
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [isPinMode, setIsPinMode] = useState(false);
  const [tempPin, setTempPin] = useState<{x: number, y: number} | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [isCompareMode, setIsCompareMode] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [compareVersionId, setCompareVersionId] = useState("");
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  // BUSQUEDA DE DATOS
  const project = projects.find(p => p.id === projectId);
  let page: any = null;
  let allPagesInVersion: any[] = [];
  let currentVersionObj: any = null;

  if (project) {
    project.versions.forEach(v => {
      const found = v.pages.find(p => p.id === pageId);
      if (found) {
        page = found;
        allPagesInVersion = v.pages;
        currentVersionObj = v;
      }
    });
  }

  // NAVEGACIÓN
  const currentIndex = allPagesInVersion.findIndex(p => p.id === pageId);
  const prevPage = allPagesInVersion[currentIndex - 1];
  const nextPage = allPagesInVersion[currentIndex + 1];

  // COMPARACIÓN
  const otherVersions = project ? project.versions.filter(v => v.id !== versionId) : [];
  const compareImageUrl = compareVersionId 
    ? project?.versions.find(v => v.id === compareVersionId)?.pages.find((p:any) => p.pageNumber === page?.pageNumber)?.imageUrl 
    : null;

  useEffect(() => {
    if(pageId) fetchComments();
    setScale(1);
  }, [pageId]);

  const fetchComments = async () => {
    const { data } = await supabase.from('comments').select('*').eq('page_id', pageId).order('created_at', { ascending: false });
    if (data) setCommentsList(data);
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    const fileName = `ref-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error } = await supabase.storage.from('brochures').upload(fileName, file);
    if (error) {
      alert("Error al subir imagen");
      setUploadingImage(false);
      return null;
    }
    const { data: urlData } = supabase.storage.from('brochures').getPublicUrl(fileName);
    setUploadingImage(false);
    return urlData.publicUrl;
  };

  const handleSavePin = async (content: string, imageUrl?: string) => {
    if (!content || !pageId) return;
    const { data } = await supabase.from('comments').insert([{ 
      content, page_id: pageId, x: tempPin?.x, y: tempPin?.y, resolved: false, image_url: imageUrl || null 
    }]).select();
    if (data) {
        setCommentsList(prev => [data[0], ...prev]);
        setTempPin(null);
    }
  };

  const toggleResolved = async (id: string, currentStatus: boolean) => {
    await supabase.from('comments').update({ resolved: !currentStatus }).eq('id', id);
    setCommentsList(prev => prev.map(c => c.id === id ? { ...c, resolved: !currentStatus } : c));
  };

  if (!project || !page) return <div className="p-10 bg-white h-screen flex items-center justify-center font-bold">Cargando revisión...</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-100 text-slate-800 overflow-hidden font-sans"
         onMouseMove={isDraggingSlider ? (e) => {
            const rect = sliderRef.current?.getBoundingClientRect();
            if (rect) setSliderPosition(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
         } : undefined}
         onMouseUp={() => setIsDraggingSlider(false)}
    >
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm z-50">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-rose-600 font-bold">← Volver</button>
            <h1 className="font-black text-slate-800 tracking-tight">{project.name} <span className="text-slate-300 font-medium">/ Pág {page.pageNumber}</span></h1>
          </div>

          <div className="flex items-center gap-4">
             {otherVersions.length > 0 && (
                 <div className="flex items-center gap-2">
                    {isCompareMode && (
                        <select className="bg-white border rounded-xl px-3 py-1.5 text-[10px] font-black uppercase outline-none" onChange={(e) => setCompareVersionId(e.target.value)} value={compareVersionId}>
                            <option value="">¿Versión?</option>
                            {otherVersions.map(v => <option key={v.id} value={v.id}>v{v.versionNumber}</option>)}
                        </select>
                    )}
                    <button onClick={() => setIsCompareMode(!isCompareMode)} className={`px-4 py-2 rounded-xl font-bold text-[10px] uppercase border transition-all ${isCompareMode ? 'bg-slate-800 text-white' : 'bg-white text-blue-600 border-blue-100'}`}>
                        {isCompareMode ? 'Salir' : 'Comparar'}
                    </button>
                 </div>
             )}
             <button onClick={() => setIsPinMode(!isPinMode)} className={`px-5 py-2 rounded-xl font-black text-[10px] uppercase transition-all shadow-lg ${isPinMode ? 'bg-slate-800 text-white animate-pulse' : 'bg-rose-600 text-white'}`}>
                {isPinMode ? '📍 Toca la imagen' : 'MARCAR CORRECCIÓN'}
             </button>
          </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
          {/* BOTONES NAVEGACIÓN */}
          {prevPage && <button onClick={() => navigate(`/project/${projectId}/version/${versionId}/page/${prevPage.id}`)} className="absolute left-6 top-1/2 -translate-y-1/2 z-40 w-12 h-12 bg-white/90 hover:bg-white text-slate-400 hover:text-rose-600 rounded-full shadow-2xl border flex items-center justify-center font-black transition-all hover:scale-110">←</button>}
          {nextPage && <button onClick={() => navigate(`/project/${projectId}/version/${versionId}/page/${nextPage.id}`)} className="absolute right-[340px] top-1/2 -translate-y-1/2 z-40 w-12 h-12 bg-white/90 hover:bg-white text-slate-400 hover:text-rose-600 rounded-full shadow-2xl border flex items-center justify-center font-black transition-all hover:scale-110">→</button>}

          <div className="flex-1 relative flex items-center justify-center bg-slate-50 overflow-hidden" onWheel={(e) => { if(e.ctrlKey) setScale(s => Math.min(Math.max(s + e.deltaY * -0.01, 0.5), 4)) }}>
            {!isCompareMode ? (
                <div ref={imageContainerRef} onClick={(e) => {
                    if(!isPinMode || !imageContainerRef.current) return;
                    const r = imageContainerRef.current.getBoundingClientRect();
                    setTempPin({ x: ((e.clientX - r.left)/r.width)*100, y: ((e.clientY - r.top)/r.height)*100 });
                    setIsPinMode(false);
                }} style={{ transform: `scale(${scale})` }} className="relative shadow-xl transition-transform border bg-white">
                    <img src={page.imageUrl} className="max-h-[82vh] select-none block" alt="" />
                    {commentsList.map((c, i) => (
                        <div key={c.id} className={`absolute w-7 h-7 rounded-full flex items-center justify-center text-xs font-black -ml-3.5 -mt-3.5 border-2 border-white shadow-lg ${c.resolved ? 'bg-emerald-500 text-white' : 'bg-rose-600 text-white'}`} style={{ left: `${c.x}%`, top: `${c.y}%` }}>{i+1}</div>
                    ))}
                    {tempPin && <div className="absolute w-7 h-7 bg-amber-400 rounded-full animate-bounce -ml-3.5 -mt-3.5 border-2 border-white shadow-xl" style={{ left: `${tempPin.x}%`, top: `${tempPin.y}%` }}></div>}
                </div>
            ) : (
                <div ref={sliderRef} className="relative max-h-[82vh] border bg-white shadow-2xl" style={{ transform: `scale(${scale})` }}>
                     <img src={page.imageUrl} className="max-h-[82vh] pointer-events-none block" alt="" />
                     {compareImageUrl && (
                        <div className="absolute top-0 left-0 h-full overflow-hidden border-r-2 border-white" style={{ width: `${sliderPosition}%` }}>
                             <img src={compareImageUrl} className="max-h-[82vh]" style={{ width: sliderRef.current?.offsetWidth, maxWidth: 'none', height: '100%' }} alt="" />
                        </div>
                     )}
                     <div className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-50 shadow-xl" style={{ left: `${sliderPosition}%` }} onMouseDown={() => setIsDraggingSlider(true)}>
                        <div className="absolute top-1/2 -mt-5 -ml-5 w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-800 font-black shadow-2xl border border-slate-100">↔</div>
                     </div>
                </div>
            )}
          </div>

          {/* BARRA LATERAL NOTAS */}
          <div className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0 shadow-[-10px_0_15px_rgba(0,0,0,0.02)]">
             <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                 <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-widest">Notas ({commentsList.length})</h3>
                 <button onClick={() => setShowResolved(!showResolved)} className="text-[10px] font-bold text-slate-400 uppercase">{showResolved ? 'Ocultar' : 'Ver todo'}</button>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-3">
                 {commentsList.filter(c => showResolved || !c.resolved).map((c, i) => (
                     <div key={c.id} className={`p-4 rounded-2xl border transition-all shadow-sm ${c.resolved ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                         <div className="flex justify-between items-start mb-2">
                            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black border-2 border-white shadow-sm ${c.resolved ? 'bg-emerald-500 text-white' : 'bg-rose-600 text-white'}`}>{i+1}</span>
                            <button onClick={() => toggleResolved(c.id, c.resolved)} className="w-8 h-8 rounded-xl bg-white border flex items-center justify-center shadow-sm hover:scale-110 active:scale-95 transition-all font-bold">
                                {c.resolved ? '✓' : '○'}
                            </button>
                         </div>
                         <p className={`text-sm font-bold leading-relaxed mb-3 ${c.resolved ? 'text-emerald-700 opacity-60 line-through' : 'text-rose-700'}`}>{c.content}</p>
                         
                         {/* BOTÓN DESCARGAR IMAGEN RECUPERADO */}
                         {c.image_url && (
                             <a 
                                href={c.image_url} 
                                target="_blank" 
                                download 
                                className="block w-full py-2 bg-white/50 border border-slate-200 rounded-xl text-center text-[9px] font-black uppercase text-slate-500 hover:bg-white transition-all shadow-sm"
                             >
                                📥 Descargar Imagen Adjunta
                             </a>
                         )}
                     </div>
                 ))}
             </div>
          </div>
      </div>

      {/* CUADRO DE NOTA RECUPERADO */}
      {tempPin && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl text-slate-900 w-full max-w-md border border-slate-100">
                <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-widest mb-4 text-center">Nueva Corrección</h3>
                <textarea autoFocus id="new-comment-text" className="w-full border-2 border-slate-100 bg-slate-50 rounded-2xl p-4 mb-4 h-32 outline-none focus:border-rose-600 font-bold text-slate-700 resize-none shadow-inner" placeholder="Escribe aquí el cambio..."></textarea>
                
                <div className="mb-6">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Adjuntar imagen (opcional)</label>
                    <input 
                        type="file" 
                        accept="image/*" 
                        className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100"
                        onChange={(e) => (window as any).pendingFile = e.target.files?.[0]}
                    />
                </div>

                <div className="flex gap-3">
                    <button onClick={() => setTempPin(null)} className="flex-1 py-4 font-black text-slate-400 uppercase text-[10px]">Cancelar</button>
                    <button 
                        disabled={uploadingImage}
                        onClick={async () => {
                            const txt = (document.getElementById('new-comment-text') as HTMLTextAreaElement).value;
                            if (!txt) return;
                            let url = "";
                            if ((window as any).pendingFile) {
                                url = await handleImageUpload((window as any).pendingFile) || "";
                            }
                            handleSavePin(txt, url);
                            (window as any).pendingFile = null;
                        }} 
                        className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black shadow-xl shadow-rose-200 text-[10px] uppercase hover:bg-rose-700 transition-all"
                    >
                        {uploadingImage ? 'SUBIENDO...' : 'GUARDAR NOTA'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Revision;
