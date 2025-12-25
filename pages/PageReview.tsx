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
  
  const [comment, setComment] = useState("");
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [isPinMode, setIsPinMode] = useState(false);
  const [tempPin, setTempPin] = useState<{x: number, y: number} | null>(null);
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });

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
    const newComment = { content: comment, page_id: pageId, x: tempPin?.x || 50, y: tempPin?.y || 50, resolved: false };
    const { data } = await supabase.from('comments').insert([newComment]).select();
    if (data) {
        setCommentsList(prev => [data[0], ...prev]);
        setComment("");
        setTempPin(null);
    }
  };

  if (!project || !version || !page) return <div className="p-10 text-center">Cargando...</div>;

  return (
    <div className="min-h-screen bg-slate-800 flex flex-col h-screen overflow-hidden">
      <header className="h-16 bg-white flex items-center justify-between px-6 z-50">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="font-bold text-slate-500">Volver</button>
            <h1 className="font-bold">{project.name}</h1>
          </div>
          <button onClick={() => setIsPinMode(!isPinMode)} className="bg-rose-600 text-white px-4 py-2 rounded font-bold">
            {isPinMode ? 'Cancelar' : 'Añadir Nota'}
          </button>
      </header>
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 overflow-hidden flex items-center justify-center bg-slate-900">
          <div ref={imageContainerRef} onClick={handleCanvasClick} className="relative shadow-2xl transition-transform" style={{ transform: `scale(${transform.scale})` }}>
            <img src={page.imageUrl} alt="Page" style={{ maxHeight: '90vh' }} />
            {commentsList.map((c) => (
                <div key={c.id} className="absolute w-6 h-6 bg-rose-600 rounded-full border-2 border-white cursor-pointer" style={{ left: `${c.x}%`, top: `${c.y}%` }} title={c.content}></div>
            ))}
            {tempPin && <div className="absolute w-6 h-6 bg-yellow-400 rounded-full animate-bounce" style={{ left: `${tempPin.x}%`, top: `${tempPin.y}%` }}></div>}
          </div>
        </div>
        {tempPin && (
            <div className="absolute top-20 right-10 w-80 bg-white p-4 border rounded shadow-xl z-50">
                <h3 className="font-bold mb-2">Nueva Nota</h3>
                <textarea className="w-full border p-2 mt-2 rounded" value={comment} onChange={e => setComment(e.target.value)} />
                <button onClick={handleSavePin} className="bg-rose-600 text-white w-full py-2 mt-2 rounded font-bold">Guardar</button>
            </div>
        )}
      </div>
    </div>
  );
};

export default PageReview;
