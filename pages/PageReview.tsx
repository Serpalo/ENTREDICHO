import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Project, AppNotification } from '../types';
import { supabase } from '../supabase';

interface PageReviewProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  addNotification?: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
}

const PageReview: React.FC<PageReviewProps> = ({ projects, setProjects, addNotification }) => {
  const { projectId, versionId, pageId } = useParams<{ projectId: string; versionId: string; pageId: string }>();
  const navigate = useNavigate();
  const imageContainerRef = useRef<HTMLDivElement>(null);
  
  // ESTADOS PARA HERRAMIENTAS (ZOOM, PINES, COLORES)
  const [scale, setScale] = useState(1); // Zoom
  const [position, setPosition] = useState({ x: 0, y: 0 }); // Pan
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [comment, setComment] = useState("");
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [isPinMode, setIsPinMode] = useState(false);
  const [tempPin, setTempPin] = useState<{x: number, y: number} | null>(null);
  const [activeColor, setActiveColor] = useState("bg-rose-600"); // Color por defecto

  const project = projects.find(p => p.id === projectId);
  
  let version: any = null;
  let page: any = null;

  if (project) {
    version = project.versions.find(v => v.id === versionId);
    if (version) {
        page = version.pages.find((p: any) => p.id === pageId);
    }
  }

  useEffect(() => {
    if (pageId) fetchComments();
  }, [pageId]);

  const fetchComments = async () => {
    const { data } = await supabase.from('comments').select('*').eq('page_id', pageId);
    if (data) setCommentsList(data);
  };

  // --- LÓGICA DE ZOOM Y ARRASTRE ---
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY * -0.01;
        setScale(prev => Math.min(Math.max(prev + delta, 0.5), 4));
    }
  };

  // --- LÓGICA DE PINES ---
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPinMode || !imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    // Calculamos posición relativa a la imagen (independiente del zoom)
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setTempPin({ x, y });
    setIsPinMode(false);
  };

  const handleSavePin = async () => {
    if (!comment || !pageId) return;
    const newComment = { 
        content: comment, 
        page_id: pageId, 
        x: tempPin?.x || 50, 
        y: tempPin?.y || 50, 
        resolved: false,
        // Guardamos información extra si quisieras (color, etc)
    };
    
    const { data, error } = await supabase.from('comments').insert([newComment]).select();
    if (data) {
        setCommentsList(prev => [data[0], ...prev]);
        setComment("");
        setTempPin(null);
        if(addNotification) addNotification({ type: 'system', title: 'Comentario añadido', message: 'Se ha guardado tu nota correctamente.' });
    }
  };

  if (!project || !version || !page) return <div className="p-10 text-center">Cargando...</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden">
      {/* BARRA SUPERIOR DE HERRAMIENTAS */}
      <header className="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6 z-50">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white">🔙 Volver</button>
            <h1 className="font-bold truncate max-w-md">{project.name} <span className="text-slate-500 font-normal">/ Pág {page.pageNumber}</span></h1>
          </div>
          
          <div className="flex items-center gap-4 bg-slate-700 p-1 rounded-lg">
             <button onClick={() => setScale(s => Math.max(s - 0.2, 0.5))} className="p-2 hover:bg-slate-600 rounded">➖</button>
             <span className="text-xs font-mono w-12 text-center">{Math.round(scale * 100)}%</span>
             <button onClick={() => setScale(s => Math.min(s + 0.2, 4))} className="p-2 hover:bg-slate-600 rounded">➕</button>
          </div>

          <div className="flex items-center gap-3">
             {/* SELECTOR DE COLORES */}
             <div className="flex gap-1 mr-4">
                {['bg-rose-600', 'bg-amber-500', 'bg-emerald-500', 'bg-blue-500'].map(color => (
                    <button key={color} onClick={() => setActiveColor(color)} className={`w-6 h-6 rounded-full ${color} ${activeColor === color ? 'ring-2 ring-white' : 'opacity-50 hover:opacity-100'}`} />
                ))}
             </div>
             <button onClick={() => setIsPinMode(!isPinMode)} className={`px-4 py-2 rounded font-bold transition-all ${isPinMode ? 'bg-white text-slate-900' : 'bg-rose-600 text-white'}`}>
                {isPinMode ? '📍 Haz clic en la imagen' : 'Añadir Comentario'}
             </button>
          </div>
      </header>

      {/* ÁREA DE TRABAJO (IMAGEN) */}
      <div className="flex-1 overflow-hidden relative flex items-center justify-center bg-slate-950/50" onWheel={handleWheel}>
        <div 
            ref={imageContainerRef} 
            onClick={handleCanvasClick} 
            className="relative shadow-2xl transition-transform duration-100 ease-out origin-center" 
            style={{ transform: `scale(${scale})`, cursor: isPinMode ? 'crosshair' : 'grab' }}
        >
            <img src={page.imageUrl} alt="Page" className="max-h-[85vh] object-contain select-none" />
            
            {/* PINES GUARDADOS */}
            {commentsList.map((c) => (
                <div key={c.id} className="group absolute w-8 h-8 -ml-4 -mt-4 cursor-pointer z-10" style={{ left: `${c.x}%`, top: `${c.y}%` }}>
                     <div className={`w-full h-full rounded-full border-2 border-white shadow-md flex items-center justify-center text-xs font-bold ${activeColor}`}>
                        💬
                     </div>
                     {/* TOOLTIP AL PASAR EL RATÓN */}
                     <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-white text-slate-900 p-3 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity text-xs z-20">
                        {c.content}
                     </div>
                </div>
            ))}

            {/* PIN TEMPORAL (CREANDO) */}
            {tempPin && <div className="absolute w-8 h-8 bg-yellow-400 rounded-full animate-bounce border-2 border-white -ml-4 -mt-4 z-20" style={{ left: `${tempPin.x}%`, top: `${tempPin.y}%` }}></div>}
        </div>
      </div>

      {/* MODAL PARA ESCRIBIR COMENTARIO */}
      {tempPin && (
            <div className="absolute top-20 right-10 w-80 bg-white text-slate-900 p-6 rounded-2xl shadow-2xl z-50 border border-slate-200 animate-fade-in">
                <h3 className="font-bold text-lg mb-4">Nueva Nota</h3>
                <textarea 
                    autoFocus
                    className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl mb-4 h-32 focus:ring-2 focus:ring-rose-500 outline-none resize-none" 
                    placeholder="Escribe tu corrección aquí..."
                    value={comment} 
                    onChange={e => setComment(e.target.value)} 
                />
                <div className="flex gap-2">
                    <button onClick={() => setTempPin(null)} className="flex-1 py-2 bg-slate-100 font-bold rounded-lg hover:bg-slate-200">Cancelar</button>
                    <button onClick={handleSavePin} className="flex-1 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 shadow-lg shadow-rose-200">Guardar</button>
                </div>
            </div>
      )}
    </div>
  );
};

export default PageReview;
