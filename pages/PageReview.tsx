import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Project, AppNotification } from '../types';
import { supabase } from '../supabase';

interface PageReviewProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  addNotification?: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
}

const PageReview: React.FC<PageReviewProps> = ({ projects, setProjects }) => {
  const { projectId, versionId, pageId } = useParams<{ projectId: string; versionId: string; pageId: string }>();
  const navigate = useNavigate();
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  
  // HERRAMIENTAS BÁSICAS
  const [scale, setScale] = useState(1);
  const [showResolved, setShowResolved] = useState(true);
  
  // COMENTARIOS
  const [comment, setComment] = useState("");
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [isPinMode, setIsPinMode] = useState(false);
  const [tempPin, setTempPin] = useState<{x: number, y: number} | null>(null);

  // COMPARADOR
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareVersionId, setCompareVersionId] = useState<string>("");
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  const project = projects.find(p => p.id === projectId);
  
  // Encontrar datos
  let version: any = null;
  let page: any = null;
  if (project) {
    version = project.versions.find(v => v.id === versionId);
    if (version) page = version.pages.find((p: any) => p.id === pageId);
  }

  // Lógica Comparación
  const hasHistory = project && project.versions.length > 1;
  const getCompareImage = () => {
      if (!project || !compareVersionId) return null;
      const otherVersion = project.versions.find(v => v.id === compareVersionId);
      const otherPage = otherVersion?.pages.find((p: any) => p.pageNumber === page?.pageNumber);
      return otherPage?.imageUrl || null;
  };
  const compareImageUrl = getCompareImage();

  useEffect(() => { if (pageId) fetchComments(); }, [pageId]);

  const fetchComments = async () => {
    const { data } = await supabase.from('comments').select('*').eq('page_id', pageId).order('created_at', { ascending: false });
    if (data) setCommentsList(data);
  };

  const handleSavePin = async () => {
    if (!comment || !pageId) return;
    const { data } = await supabase.from('comments').insert([{ content: comment, page_id: pageId, x: tempPin?.x, y: tempPin?.y, resolved: false }]).select();
    if (data) {
        setCommentsList(prev => [data[0], ...prev]);
        setComment(""); setTempPin(null);
    }
  };

  const toggleResolved = async (id: string, currentStatus: boolean) => {
    await supabase.from('comments').update({ resolved: !currentStatus }).eq('id', id);
    setCommentsList(prev => prev.map(c => c.id === id ? { ...c, resolved: !currentStatus } : c));
  };

  // MANEJO DEL SLIDER
  const handleSliderMove = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDraggingSlider || !sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      let clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      setSliderPosition((x / rect.width) * 100);
  };

  if (!project || !page) return <div className="p-10 text-white">Cargando...</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden"
         onMouseMove={isDraggingSlider ? (e) => handleSliderMove(e) : undefined}
         onMouseUp={() => setIsDraggingSlider(false)}
    >
      {/* HEADER */}
      <header className="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6 z-50 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white">← Volver</button>
            <h1 className="font-bold">{project.name} / Pág {page.pageNumber}</h1>
            {/* ETIQUETA DE PRUEBA - SI NO VES ESTO, NO SE HA GUARDADO */}
            <span className="bg-red-600 text-white px-2 py-1 text-xs font-black rounded animate-pulse">VERSIÓN NUEVA</span>
          </div>

          <div className="flex items-center gap-4">
             {/* BOTÓN COMPARAR - OBLIGATORIO */}
             {isCompareMode && (
                <select className="bg-slate-900 border border-blue-500 rounded px-2 py-1 text-xs" onChange={(e) => setCompareVersionId(e.target.value)} value={compareVersionId}>
                    <option value="">Comparar con...</option>
                    {project.versions.filter(v => v.id !== versionId).map(v => <option key={v.id} value={v.id}>v{v.versionNumber}</option>)}
                </select>
             )}
             
             <button 
                disabled={!hasHistory}
                onClick={() => { setIsCompareMode(!isCompareMode); setIsPinMode(false); }}
                className={`px-4 py-2 rounded font-bold text-sm border ${isCompareMode ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'}`}
             >
                {isCompareMode ? 'Salir' : 'Comparar ↔'}
             </button>

             {!isCompareMode && (
                 <button onClick={() => setIsPinMode(!isPinMode)} className={`px-4 py-2 rounded font-bold text-sm ${isPinMode ? 'bg-white text-black' : 'bg-rose-600 text-white'}`}>
                    {isPinMode ? 'Tocame la imagen' : 'Añadir Nota'}
                 </button>
             )}
          </div>
      </header>

      {/* BODY */}
      <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 relative flex items-center justify-center bg-slate-950" onWheel={(e) => { if(e.ctrlKey) setScale(s => s + e.deltaY * -0.01) }}>
            
            {/* MODO NORMAL */}
            {!isCompareMode && (
                <div ref={imageContainerRef} onClick={(e) => {
                    if(!isPinMode || !imageContainerRef.current) return;
                    const r = imageContainerRef.current.getBoundingClientRect();
                    setTempPin({ x: ((e.clientX - r.left)/r.width)*100, y: ((e.clientY - r.top)/r.height)*100 });
                    setIsPinMode(false);
                }} style={{ transform: `scale(${scale})` }} className="relative shadow-2xl transition-transform">
                    <img src={page.imageUrl} className="max-h-[85vh]" />
                    {commentsList.filter(c => showResolved || !c.resolved).map((c, i) => (
                        <div key={c.id} className="absolute w-6 h-6 bg-rose-600 rounded-full flex items-center justify-center text-xs font-bold -ml-3 -mt-3" style={{ left: `${c.x}%`, top: `${c.y}%` }}>{i+1}</div>
                    ))}
                    {tempPin && <div className="absolute w-6 h-6 bg-yellow-400 rounded-full animate-bounce -ml-3 -mt-3" style={{ left: `${tempPin.x}%`, top: `${tempPin.y}%` }}></div>}
                </div>
            )}

            {/* MODO COMPARAR */}
            {isCompareMode && (
                <div ref={sliderRef} className="relative max-h-[85vh]" style={{ transform: `scale(${scale})` }}>
                     <img src={page.imageUrl} className="max-h-[85vh] pointer-events-none" />
                     {compareImageUrl && (
                        <div className="absolute top-0 left-0 h-full overflow-hidden border-r-2 border-white bg-slate-900" style={{ width: `${sliderPosition}%` }}>
                             <img src={compareImageUrl} className="max-h-[85vh]" style={{ width: sliderRef.current?.offsetWidth, maxWidth: 'none' }} />
                        </div>
                     )}
                     {compareImageUrl && (
                        <div className="absolute top-0 bottom-0 w-8 -ml-4 cursor-ew-resize flex items-center justify-center bg-transparent z-50" style={{ left: `${sliderPosition}%` }} onMouseDown={() => setIsDraggingSlider(true)}>
                            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-black font-bold shadow-xl">↔</div>
                        </div>
                     )}
                </div>
            )}
          </div>

          {/* SIDEBAR */}
          <div className="w-80 bg-slate-900 border-l border-slate-800 p-4">
             <h3 className="font-bold mb-4">Comentarios</h3>
             {commentsList.map((c, i) => (
                 <div key={c.id} className="p-2 mb-2 bg-slate-800 rounded flex justify-between">
                     <span><span className="font-bold text-rose-500 mr-2">{i+1}</span>{c.content}</span>
                     <button onClick={() => toggleResolved(c.id, c.resolved)}>{c.resolved ? '✅' : '⭕'}</button>
                 </div>
             ))}
          </div>
      </div>

      {tempPin && (
        <div className="absolute top-20 right-96 bg-white p-4 rounded text-black z-50">
            <input autoFocus className="border p-2 w-full mb-2" placeholder="Nota..." value={comment} onChange={e => setComment(e.target.value)} />
            <button onClick={handleSavePin} className="bg-rose-600 text-white px-4 py-2 rounded w-full">Guardar</button>
        </div>
      )}
    </div>
  );
};

export default PageReview;
