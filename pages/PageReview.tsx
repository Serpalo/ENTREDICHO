import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Project, AppNotification } from '../types';
import { supabase } from '../supabase';

interface PageReviewProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  addNotification?: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  page_id: string;
  x?: number;
  y?: number;
  resolved?: boolean;
  attachment_url?: string | null;
}

const PageReview: React.FC<PageReviewProps> = ({ projects, setProjects, addNotification }) => {
  const { projectId, versionId, pageId } = useParams<{ projectId: string; versionId: string; pageId: string }>();
  const navigate = useNavigate();
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  
  const [comment, setComment] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  const [commentsList, setCommentsList] = useState<Comment[]>([]);
  const [isPinMode, setIsPinMode] = useState(false);
  const [tempPin, setTempPin] = useState<{x: number, y: number} | null>(null);
  const [activePinId, setActivePinId] = useState<string | null>(null);

  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [previousPageUrl, setPreviousPageUrl] = useState<string | null>(null);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  const project = projects.find(p => p.id === projectId);
  
  const isReviewLocked = project && (project as any).review_deadline 
    ? new Date() > new Date((project as any).review_deadline) 
    : false;

  let version: any = null;
  let page: any = null;
  if (project) {
    version = project.versions.find(v => v.id === versionId);
    if (version) page = version.pages.find((p: any) => p.id === pageId);
  }

  useEffect(() => {
    if (pageId) fetchComments();
    if (page) fetchPreviousVersion();
  }, [pageId, page]);

  const fetchComments = async () => {
    const { data } = await supabase.from('comments').select('*').eq('page_id', pageId).order('created_at', { ascending: false });
    if (data) setCommentsList(data);
  };

  const fetchPreviousVersion = async () => {
    if (!page || !page.version || page.version <= 1) return;
    const { data } = await supabase.from('pages').select('image_url').eq('project_id', projectId).eq('page_number', page.pageNumber).lt('version', page.version).order('version', { ascending: false }).limit(1).single();
    if (data) setPreviousPageUrl(data.image_url);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (tempPin) return;
    e.preventDefault();
    const scaleAmount = -e.deltaY * 0.001;
    const newScale = Math.min(Math.max(0.5, transform.scale + scaleAmount), 5);
    setTransform(prev => ({ ...prev, scale: newScale }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isPinMode || isCompareMode) return; 
    setIsDragging(true);
    setStartPan({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingSlider && imageContainerRef.current) {
        const rect = imageContainerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percent = (x / rect.width) * 100;
        setSliderPosition(percent);
        return;
    }
    if (!isDragging || isPinMode || isCompareMode) return;
    e.preventDefault();
    setTransform(prev => ({ ...prev, x: e.clientX - startPan.x, y: e.clientY - startPan.y }));
  };

  const handleMouseUp = () => { setIsDragging(false); setIsDraggingSlider(false); };
  const resetView = () => setTransform({ scale: 1, x: 0, y: 0 });

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isReviewLocked || !isPinMode || !imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setTempPin({ x, y });
    setIsPinMode(false);
  };

  const handleSavePin = async () => {
    if (!comment.trim() || !pageId) return;
    setIsUploadingAttachment(true);

    let uploadedUrl = null;
    if (attachment) {
        const fileName = `${projectId}-${Date.now()}-${attachment.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error: uploadError } = await supabase.storage.from('comment-attachments').upload(fileName, attachment);
        if (uploadError) {
            console.error(uploadError);
            alert("Error al subir imagen (revisa permisos en Supabase).");
            setIsUploadingAttachment(false);
            return;
        }
        const { data: { publicUrl } } = supabase.storage.from('comment-attachments').getPublicUrl(fileName);
        uploadedUrl = publicUrl;
    }

    const newComment = { 
        content: comment, 
        page_id: pageId, 
        x: tempPin?.x || 50, 
        y: tempPin?.y || 50, 
        resolved: false,
        attachment_url: uploadedUrl 
    };

    const { data, error } = await supabase.from('comments').insert([newComment]).select();
    setIsUploadingAttachment(false);

    if (error) {
      alert('Error: ' + error.message);
    } else if (data) {
      setCommentsList(prev => [data[0], ...prev]);
      setComment("");
      setAttachment(null);
      setTempPin(null);
      if (addNotification) addNotification({ type: 'system', title: 'Nota añadida', message: 'Corrección fijada.', link: '#' });
    }
  };

  const handleDeleteComment = async (id: string) => {
    if (isReviewLocked) return;
    if (!window.confirm("¿Borrar corrección?")) return;
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (!error) { setCommentsList(prev => prev.filter(c => c.id !== id)); if (activePinId === id) setActivePinId(null); }
  };

  const handleToggleResolve = async
