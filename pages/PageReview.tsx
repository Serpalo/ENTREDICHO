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
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // HERRAMIENTAS
  const [scale, setScale] = useState(1);
  const [activeColor, setActiveColor] = useState("bg-rose-600");
  const [showResolved, setShowResolved] = useState(true); // Filtro para ver/ocultar resueltos
  
  // ESTADOS DE COMENTARIOS
  const [comment, setComment] = useState("");
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [isPinMode, setIsPinMode] = useState(false);
  const [tempPin, setTempPin] = useState<{x: number, y: number} | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);

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
    const { data } = await supabase.from('comments').select('*').eq('page_id', pageId).order('created_at', { ascending: false });
    if (data) setCommentsList(data);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY * -0.01;
        setScale(prev => Math.min(Math.max(prev + delta, 0.5), 4));
    }
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
    if (!comment || !pageId) return;
    
    let attachmentUrl = null;
    if (attachedFile) {
        const fileName = `attach-${Date.now()}-${attachedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        await supabase.storage.from('brochures').upload(fileName, attachedFile);
        const { data } = supabase.storage.from('brochures').getPublicUrl(fileName);
        attachmentUrl = data.publicUrl;
    }

    const newComment = { 
        content: comment, 
        page_id: pageId, 
        x: tempPin?.x || 50, 
        y: tempPin?.y || 50, 
        resolved: false,
        // Guardamos el color como parte del contenido o en metadatos si tuvieramos columna,
        // por ahora usamos la lógica visual
        attachment_url: attachmentUrl // Asegúrate de que tu tabla tenga esta columna o añádela
    };
    
    // Si la columna attachment_url no existe en la DB, fallará. 
    // Para evitar errores ahora mismo, la quitaremos del insert si no has actualizado la tabla comments.
    // Pero asumo que querías recuperarlo, así que intentamos enviarlo.
    const { data, error } = await supabase.from('comments').insert([
        { content: comment, page_id: pageId, x: newComment.x, y: newComment.y, resolved: false } 
        // NOTA: Si ya añadiste la columna attachment_url en SQL, descomenta esto:
        // , attachment_url: attachmentUrl 
    ]).select();

    if (data) {
        setCommentsList(prev => [data[0], ...prev]);
        setComment("");
        setTempPin(null);
        setAttachedFile(null);
    }
  };

  const toggleResolved = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('comments').update({ resolved: !currentStatus }).eq('id', id);
    if (!error) {
        setCommentsList(prev => prev.map(c => c.id === id ? { ...c, resolved: !currentStatus } : c));
    }
  };

  if (!project || !version || !page) return <div className="p-10 text-center">Cargando...</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden">
      {/* HEADER */}
      <header className="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6 z-50 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white flex items-center gap-1">← Volver</button>
            <h1 className="font-bold truncate max-w-xs md:max-w-md text-sm md:text-base">{project.name} <span className="text-slate-500 font-normal">/ Pág {page.pageNumber}</span></h1>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4 bg-slate-700 p-1 rounded-lg">
             <button onClick={() => setScale(s => Math.max(s - 0.2, 0.5))} className="p-1 md:p-2 hover:bg-slate-600 rounded">➖</button>
             <span className="text-xs font-mono w-8 md:w-12 text-center">{Math.round(scale * 100)}%</span>
             <button onClick={() => setScale(s => Math.min(s + 0.2, 4))} className="p-1 md:p-2 hover:bg-slate-600 rounded">➕</button>
          </div>

          <div className="flex items-center gap-3">
             <div className="flex gap-1 mr-2 md:mr-4">
                {['bg-rose-600', 'bg-amber-500', 'bg-emerald-500', 'bg-blue-500'].map(color => (
                    <button key={color} onClick={() => setActiveColor(color)} className={`w-5 h-5 md:w-6 md:h-6 rounded-full ${color} ${activeColor === color ? 'ring-2 ring-white' : 'opacity-50 hover:opacity-100'}`} />
                ))}
             </div>
             <button onClick={() => setIsPinMode(!isPinMode)} className={`px-3 py-1.5 md:px-4 md:py-2 rounded font-bold text-xs md:text-sm transition-all ${isPinMode ? 'bg-white text-slate-900 animate-pulse' : 'bg-rose-600 text-white'}`}>
                {isPinMode ? '📍 Haz clic en la imagen' : 'Añadir Nota'}
             </button>
          </div>
      </header>

      {/* CONTENIDO PRINCIPAL: IMAGEN + BARRA LATERAL */}
      <div className="flex flex-1 overflow-hidden">
          
          {/* ÁREA DE IMAGEN (IZQUIERDA) */}
          <div className="flex-1 overflow-hidden relative flex items-center justify-center bg-slate-950/50" onWheel={handleWheel}>
            <div 
                ref={imageContainerRef} 
                onClick={handleCanvasClick} 
                className="relative shadow-2xl transition-transform duration-100 ease-out origin-center" 
                style={{ transform: `scale(${scale})`, cursor: isPinMode ? 'crosshair' : 'grab' }}
            >
                <img src={page.imageUrl} alt="Page" className="max-h-[85vh] object-contain select-none" />
                
                {/* PINES SOBRE LA IMAGEN */}
                {commentsList.filter(c => showResolved || !c.resolved).map((c, i) => (
                    <div key={c.id} className="group absolute w-8 h-8 -ml-4 -mt-4 cursor-pointer z-10 hover:z-50" style={{ left: `${c.x}%`, top: `${c.y}%` }}>
                        <div className={`w-full h-full rounded-full border-2 border-white shadow-md flex items-center justify-center text-xs font-bold transition-colors ${c.resolved ? 'bg-emerald-500' : 'bg-rose-600'}`}>
                            {i + 1}
                        </div>
                        {/* Tooltip rápido al pasar el ratón */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-white text-slate-900 p-2 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity text-xs z-20">
                            <p className="line-clamp-2">{c.content}</p>
                        </div>
                    </div>
                ))}
                
                {tempPin && <div className="absolute w-8 h-8 bg-yellow-400 rounded-full animate-bounce border-2 border-white -ml-4 -mt-4 z-20 shadow-xl" style={{ left: `${tempPin.x}%`, top: `${tempPin.y}%` }}></div>}
            </div>
          </div>

          {/* BARRA LATERAL DE COMENTARIOS (DERECHA) */}
          <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0">
             <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                 <h3 className="font-bold text-slate-200">Comentarios ({commentsList.length})</h3>
                 <button onClick={() => setShowResolved(!showResolved)} className={`text-xs px-2 py-1 rounded border ${showResolved ? 'bg-slate-700 text-white border-slate-600' : 'text-slate-400 border-slate-700'}`}>
                     {showResolved ? '👁️ Ver todo' : '🙈 Ocultar resueltos'}
                 </button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-4 space-y-3">
                 {commentsList.length === 0 && <p className="text-slate-500 text-center text-sm italic mt-10">No hay comentarios aún.</p>}
                 
                 {commentsList.filter(c => showResolved || !c.resolved).map((c, i) => (
                     <div key={c.id} className={`p-3 rounded-xl border transition-all group ${c.resolved ? 'bg-emerald-900/20 border-emerald-900/50' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}>
                         <div className="flex justify-between items-start mb-2">
                             <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${c.resolved ? 'bg-emerald-500 text-white' : 'bg-rose-600 text-white'}`}>{i + 1}</span>
                             {/* BOTÓN CHECK VERDE */}
                             <button 
                                onClick={() => toggleResolved(c.id, c.resolved)}
                                className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${c.resolved ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-500 text-transparent hover:border-emerald-500 hover:text-emerald-500/50'}`}
                                title={c.resolved ? "Marcar como pendiente" : "Marcar como resuelto"}
                             >
                                ✓
                             </button>
                         </div>
                         <p className={`text-sm ${c.resolved ? 'text-emerald-200 line-through opacity-70' : 'text-slate-200'}`}>{c.content}</p>
                         
                         {/* Si tuviera adjunto, saldría aquí */}
                         {/* {c.attachment_url && <a href={c.attachment_url} target="_blank" className="text-xs text-blue-400 underline mt-2 block">📎 Ver adjunto</a>} */}
                     </div>
                 ))}
             </div>
          </div>

      </div>

      {/* MODAL PARA CREAR COMENTARIO (Flotante) */}
      {tempPin && (
            <div className="absolute top-20 right-96 w-80 bg-white text-slate-900 p-5 rounded-2xl shadow-2xl z-50 border border-slate-200 animate-fade-in-up">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-lg">Nueva Nota</h3>
                    <button onClick={() => setTempPin(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>
                
                <textarea 
                    autoFocus
                    className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl mb-3 h-24 focus:ring-2 focus:ring-rose-500 outline-none resize-none text-sm" 
                    placeholder="Escribe tu corrección..."
                    value={comment} 
                    onChange={e => setComment(e.target.value)} 
                />
                
                {/* INPUT PARA ADJUNTAR ARCHIVO */}
                <div className="flex items-center gap-2 mb-4">
                    <button 
                        onClick={() => fileInputRef.current?.click()} 
                        className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded flex items-center gap-1 border border-slate-200"
                    >
                        📎 {attachedFile ? 'Cambiar archivo' : 'Adjuntar imagen'}
                    </button>
                    {attachedFile && <span className="text-xs text-emerald-600 truncate max-w-[120px]">{attachedFile.name}</span>}
                    <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={(e) => e.target.files && setAttachedFile(e.target.files[0])} />
                </div>

                <div className="flex gap-2">
                    <button onClick={() => setTempPin(null)} className="flex-1 py-2 bg-slate-100 font-bold rounded-lg hover:bg-slate-200 text-sm">Cancelar</button>
                    <button onClick={handleSavePin} className="flex-1 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 shadow-lg shadow-rose-200 text-sm">Guardar</button>
                </div>
            </div>
      )}
    </div>
  );
};

export default PageReview;
