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
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  
  const [comment, setComment] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [commentsList, setCommentsList] = useState<any[]>([]); // Simplificado para evitar errores de tipo
  const [isPinMode, setIsPinMode] = useState(false);
  const [tempPin, setTempPin] = useState<{x: number, y: number} | null>(null);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [previousPageUrl, setPreviousPageUrl] = useState<string | null>(null);

  const project = projects.find(p => p.id === projectId);
  
  // Lógica segura para fecha límite
  const deadlineString = (project as any)?.review_deadline;
  const isReviewLocked = deadlineString ? new Date() > new Date(deadlineString) : false;

  let version: any = null;
  let page: any = null;

  if (project) {
    version = project.versions.find(v => v.id === versionId);
    if (version) {
        page = version.pages.find((p: any) => p.id === pageId);
    }
  }

  const fetchComments = async () => {
    if (!pageId) return;
    const { data } = await supabase.from('comments').select('*').eq('page_id', pageId).order('created_at', { ascending: false });
    if (data) setCommentsList(data);
  };

  const fetchPreviousVersion = async () => {
    if (!page || !page.version || page.version <= 1) { setPreviousPageUrl(null); return; }
    const { data } = await supabase.from('pages').select('image_url').eq('project_id', projectId).eq('page_number', page.pageNumber).lt('version', page.version).order('version', { ascending: false }).limit(1).single();
    if (data) setPreviousPageUrl(data.image_url); else setPreviousPageUrl(null);
  };

  useEffect(() => {
    if (pageId) {
        fetchComments();
        // Polling simple para evitar errores de conexión
        const interval = setInterval(fetchComments, 3000);
        return () => clearInterval(interval);
    } 
  }, [pageId]);

  useEffect(() => { if (page) fetchPreviousVersion(); }, [page, projectId]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isReviewLocked || !isPinMode || !imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setTempPin({ x, y });
    setIsPinMode(false);
  };

  const handleSavePin = async () => {
    if (isReviewLocked || !comment.trim() || !pageId) return;
    setIsUploadingAttachment(true);
    let uploadedUrl = null;
    if (attachment) {
        const fileName = `${projectId}-${Date.now()}-${attachment.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        await supabase.storage.from('comment-attachments').upload(fileName, attachment);
        const { data } = supabase.storage.from('comment-attachments').getPublicUrl(fileName);
        uploadedUrl = data.publicUrl;
    }
    const { data } = await supabase.from('comments').insert([{ 
        content: comment, 
        page_id: pageId, 
        x: tempPin?.x || 50, 
        y: tempPin?.y || 50, 
        resolved: false,
        attachment_url: uploadedUrl 
    }]).select();
    
    setIsUploadingAttachment(false);
    if (data) {
        setCommentsList(prev => [data[0], ...prev]);
        setComment("");
        setAttachment(null);
        setTempPin(null);
    }
  };

  if (!project || !version || !page) return <div className="p-10 text-center">Cargando...</div>;

  return (
    <div className="min-h-screen bg-slate-800 flex flex-col h-screen overflow-hidden">
      <header className="h-16 bg-white flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)}>🔙</button>
            <h1 className="font-bold">{project.name}</h1>
            {isReviewLocked && <span className="bg-red-600 text-white px-2 rounded text-xs">CERRADO</span>}
        </div>
        {!isReviewLocked && (
            <button onClick={() => setIsPinMode(!isPinMode)} className="bg-rose-600 text-white px-4 py-2 rounded">
                {isPinMode ? 'Cancelar' : 'Añadir Nota'}
            </button>
        )}
      </header>

      <div className="flex-1 flex overflow-hidden relative justify-center bg-slate-900">
          <div ref={imageContainerRef} onClick={handleCanvasClick} className="relative shadow-2xl transition-transform" style={{ transform: `scale(${transform.scale})` }}>
            <img src={page.imageUrl} alt="Page" style={{ maxHeight: '90vh' }} />
            {commentsList.map((c) => (
                <div key={c.id} className="absolute w-6 h-6 bg-rose-600 rounded-full border-2 border-white" style={{ left: `${c.x}%`, top: `${c.y}%` }} title={c.content}></div>
            ))}
            {tempPin && <div className="absolute w-6 h-6 bg-yellow-400 rounded-full animate-bounce" style={{ left: `${tempPin.x}%`, top: `${tempPin.y}%` }}></div>}
          </div>
          
          {tempPin && (
            <div className="absolute top-20 right-20 bg-white p-4 rounded shadow-xl w-80 z-50">
                <h3 className="font-bold mb-2">Nueva Nota</h3>
                <textarea className="w-full border p-2 mb-2" value={comment} onChange={e => setComment(e.target.value)} placeholder="Escribe aquí..." />
                <input type="file" onChange={e => setAttachment(e.target.files?.[0] || null)} className="mb-2 text-xs" />
                <div className="flex gap-2">
                    <button onClick={() => setTempPin(null)} className="flex-1 bg-gray-200 py-2 rounded">Cancelar</button>
                    <button onClick={handleSavePin} disabled={isUploadingAttachment} className="flex-1 bg-rose-600 text-white py-2 rounded">
                        {isUploadingAttachment ? '...' : 'Guardar'}
                    </button>
                </div>
            </div>
          )}
      </div>
    </div>
  );
};

export default PageReview;
