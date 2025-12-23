
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Project, ReviewerRole, Comment, CorrectionStatus, CommentStatus, AppNotification } from '../types';

interface PageReviewProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  addNotification?: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
}

type SidebarTab = "current" | "history";

interface PendingComment {
  x: number;
  y: number;
}

const PageReview: React.FC<PageReviewProps> = ({ projects, setProjects, addNotification }) => {
  const { projectId, versionId, pageId } = useParams<{ projectId: string, versionId: string, pageId: string }>();
  const navigate = useNavigate();
  const [activeRole, setActiveRole] = useState<ReviewerRole>("Publicidad");
  const [activeTab, setActiveTab] = useState<SidebarTab>("current");
  const [pendingComment, setPendingComment] = useState<PendingComment | null>(null);
  const [newCommentText, setNewCommentText] = useState("");
  const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Drawing & Interaction States
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [isPanMode, setIsPanMode] = useState(false);
  const [drawColor, setDrawColor] = useState("#ef4444");
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Zoom & Pan Offset States
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  // Comparison States
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);

  const project = projects.find(p => p.id === projectId);
  const version = project?.versions.find(v => v.id === versionId);
  const page = version?.pages.find(pg => pg.id === pageId);

  const handleDownload = (format: 'jpg' | 'pdf') => {
    if (!page) return;
    const extension = format === 'pdf' ? 'pdf' : 'jpg';
    const link = document.createElement('a');
    link.href = page.imageUrl;
    link.download = `${project?.name}_Pag_${page.pageNumber}_Revision.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowDownloadMenu(false);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const pageHistory = useMemo(() => {
    return project?.versions.map(v => {
      const p = v.pages.find(pg => pg.pageNumber === (page?.pageNumber || 0));
      return {
        versionId: v.id,
        versionNumber: v.versionNumber,
        versionDate: v.createdAt,
        comments: p?.comments || []
      };
    }).reverse() || [];
  }, [project, page?.pageNumber]);

  // Flattened history comments for searching
  const allHistoryComments = useMemo(() => {
    return pageHistory.flatMap(h => h.comments.map(c => ({
      ...c,
      versionNumber: h.versionNumber,
      versionId: h.versionId,
      versionDate: h.versionDate
    })));
  }, [pageHistory]);

  const filteredHistoryComments = useMemo(() => {
    if (!historySearchQuery.trim()) return [];
    const q = historySearchQuery.toLowerCase();
    return allHistoryComments.filter(c => 
      c.text.toLowerCase().includes(q) || 
      c.role.toLowerCase().includes(q) ||
      c.author.toLowerCase().includes(q)
    );
  }, [allHistoryComments, historySearchQuery]);

  const isPeriodRestricted = () => {
    if (!project?.correctionPeriod) return false;
    const now = new Date();
    const start = new Date(project.correctionPeriod.startDateTime);
    const end = new Date(project.correctionPeriod.endDateTime);
    return now < start || now > end;
  };

  const restricted = isPeriodRestricted();

  const handleZoom = useCallback((delta: number) => {
    setScale(prev => {
      const next = prev * delta;
      return Math.min(Math.max(0.1, next), 10);
    });
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const fitToScreen = useCallback(() => {
    if (imgRef.current && viewportRef.current) {
      const vWidth = viewportRef.current.clientWidth - 100;
      const vHeight = viewportRef.current.clientHeight - 100;
      const iWidth = imgRef.current.naturalWidth || imgRef.current.clientWidth;
      const iHeight = imgRef.current.naturalHeight || imgRef.current.clientHeight;
      
      const scaleW = vWidth / iWidth;
      const scaleH = vHeight / iHeight;
      setScale(Math.min(scaleW, scaleH));
      setOffset({ x: 0, y: 0 });
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey)) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          handleZoom(1.2);
        } else if (e.key === '-') {
          e.preventDefault();
          handleZoom(0.8);
        } else if (e.key === '0') {
          e.preventDefault();
          resetZoom();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoom, resetZoom]);

  const drawAnnotations = useCallback(() => {
    if (page && canvasRef.current && imgRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const img = imgRef.current;
      
      canvas.width = img.naturalWidth || 800;
      canvas.height = img.naturalHeight || 1200;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (page.annotationsLayer) {
        const annImg = new Image();
        annImg.onload = () => ctx.drawImage(annImg, 0, 0, canvas.width, canvas.height);
        annImg.src = page.annotationsLayer;
      }
    }
  }, [page?.id, page?.annotationsLayer]);

  useEffect(() => {
    const img = imgRef.current;
    if (img) {
      if (img.complete) drawAnnotations();
      else img.onload = drawAnnotations;
    }
  }, [drawAnnotations, isCompareMode]);

  useEffect(() => {
    if (pendingComment && inputRef.current) {
      inputRef.current.focus();
    }
  }, [pendingComment]);

  if (!project || !version || !page) return <div className="p-8 text-center text-slate-500 font-bold">Página no encontrada</div>;

  const roles: ReviewerRole[] = ["Publicidad", "Dirección de producto"];
  const previousVersions = project.versions.filter(v => v.versionNumber < version.versionNumber);
  
  useEffect(() => {
    if (previousVersions.length > 0 && !compareVersionId) {
      setCompareVersionId(previousVersions[previousVersions.length - 1].id);
    }
  }, [previousVersions, compareVersionId]);

  const compareVersion = project.versions.find(v => v.id === compareVersionId);
  const comparePage = compareVersion?.pages.find(pg => pg.pageNumber === page.pageNumber);

  const saveCanvasState = (dataUrl: string | null) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        versions: p.versions.map(v => {
          if (v.id !== versionId) return v;
          return {
            ...v,
            pages: v.pages.map(pg => pg.id === pageId ? { ...pg, annotationsLayer: dataUrl || undefined } : pg)
          };
        })
      };
    }));
  };

  const clearCanvas = () => {
    if (restricted) return;
    if (!window.confirm("¿Estás seguro de que deseas borrar TODOS los dibujos de esta página? Esta acción no se puede deshacer.")) return;
    
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    saveCanvasState(null);
  };

  const startInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    const isTouch = 'touches' in e;
    const clientX = isTouch ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = isTouch ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    if (isPanMode || e.shiftKey) {
      setIsPanning(true);
      setStartPan({ x: clientX - offset.x, y: clientY - offset.y });
      return;
    }

    if (restricted) return;

    if (isDrawMode && canvasRef.current) {
      setIsDrawing(true);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left) * (canvas.width / rect.width);
      const y = (clientY - rect.top) * (canvas.height / rect.height);

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  };

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    const isTouch = 'touches' in e;
    const clientX = isTouch ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = isTouch ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    if (isPanning) {
      setOffset({
        x: clientX - startPan.x,
        y: clientY - startPan.y
      });
      return;
    }

    if (isDrawing && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left) * (canvas.width / rect.width);
      const y = (clientY - rect.top) * (canvas.height / rect.height);

      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopInteraction = () => {
    if (isPanning) setIsPanning(false);
    if (isDrawing && canvasRef.current) {
      setIsDrawing(false);
      saveCanvasState(canvasRef.current.toDataURL());
    }
  };

  const addComment = (text: string, x: number = -1, y: number = -1, roleOverride?: ReviewerRole) => {
    if (!text.trim() || restricted) return;
    
    const role = roleOverride || activeRole;
    const newComment: Comment = {
      id: `c-${Date.now()}`,
      author: `Revisor ${role}`,
      role: role,
      text,
      timestamp: new Date(),
      x,
      y,
      status: 'pending'
    };

    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        versions: p.versions.map(v => {
          if (v.id !== versionId) return v;
          return {
            ...v,
            pages: v.pages.map(pg => pg.id === pageId ? { 
              ...pg, 
              comments: [...pg.comments, newComment],
              approvals: {
                ...pg.approvals,
                [role]: { ...pg.approvals[role], approved: false, pending: false }
              }
            } : pg)
          };
        })
      };
    }));

    // Trigger Notification
    if (addNotification) {
      addNotification({
        type: 'comment',
        title: `Nuevo Comentario - Pág ${page.pageNumber}`,
        message: `${role}: "${text.length > 30 ? text.substring(0, 30) + '...' : text}"`,
        link: `/project/${projectId}/version/${versionId}/page/${pageId}`
      });
    }

    // SIMULATED SYSTEM INTERACTION
    if (role === "Publicidad") {
      setTimeout(() => {
        if (addNotification) {
          addNotification({
            type: 'comment',
            title: `Respuesta de Dirección - Pág ${page.pageNumber}`,
            message: `Dir. Producto: "Revisado y conforme con el cambio propuesto."`,
            link: `/project/${projectId}/version/${versionId}/page/${pageId}`
          });
        }
      }, 3000);
    }
  };

  const deleteComment = (e: React.MouseEvent, commentId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (restricted) return;
    if (!window.confirm("¿Estás seguro de que deseas eliminar este comentario?")) return;

    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        versions: p.versions.map(v => {
          if (v.id !== versionId) return v;
          return {
            ...v,
            pages: v.pages.map(pg => pg.id === pageId ? {
              ...pg,
              comments: pg.comments.filter(c => c.id !== commentId)
            } : pg)
          };
        })
      };
    }));
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (restricted || isCompareMode || isDrawMode || isPanMode || isPanning) return;
    if ((e.target as HTMLElement).closest('.comment-marker')) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setPendingComment({ x, y });
    setNewCommentText("");
  };

  const savePendingComment = () => {
    if (pendingComment && newCommentText.trim()) {
      addComment(newCommentText, pendingComment.x, pendingComment.y);
      setPendingComment(null);
      setNewCommentText("");
    }
  };

  const updateCommentStatus = (commentId: string, status: CommentStatus) => {
    if (restricted && status !== 'resolved') return;
    
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        versions: p.versions.map(v => {
          if (v.id !== versionId) return v;
          return {
            ...v,
            pages: v.pages.map(pg => pg.id === pageId ? {
              ...pg,
              comments: pg.comments.map(c => c.id === commentId ? { ...c, status } : c)
            } : pg)
          };
        })
      };
    }));

    if (status === 'resolved' && addNotification) {
      addNotification({
        type: 'approval',
        title: 'Comentario Resuelto',
        message: `Se ha marcado como resuelta una corrección en la página ${page.pageNumber}`,
      });
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 overflow-hidden select-none">
      {/* Top Warning Banner if period is restricted */}
      {restricted && (
        <div className="bg-rose-600 text-white text-[10px] font-black uppercase tracking-[0.2em] py-2 text-center animate-in fade-in slide-in-from-top duration-500">
           ⚠️ Fuera del plazo de corrección establecido. Edición deshabilitada.
        </div>
      )}

      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(`/project/${projectId}`)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <h2 className="font-bold text-slate-900 truncate max-w-[200px]">{project.name}</h2>
            <p className="text-xs text-slate-500">V{version.versionNumber} • Pág {page.pageNumber}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
            {roles.map((role) => (
              <button
                key={role}
                onClick={() => setActiveRole(role)}
                className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${activeRole === role ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >{role}</button>
            ))}
          </div>
          <div className="h-8 w-px bg-slate-200"></div>
          
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            <button 
              onClick={() => { setIsPanMode(!isPanMode); setIsDrawMode(false); }} 
              className={`p-2 rounded-lg transition-all ${isPanMode ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-indigo-600'}`}
              title="Pan (Shift + Arrastrar)"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0V12m-3-2.5l-3 1.5m3-1.5v-6a1.5 1.5 0 013 0V11m-3 0v-6a1.5 1.5 0 013 0v6m-3-6a1.5 1.5 0 013 0v6" /></svg>
            </button>
            <button 
              onClick={() => { 
                if (restricted) return;
                setIsDrawMode(!isDrawMode); setIsPanMode(false); setIsCompareMode(false); 
              }} 
              disabled={restricted}
              className={`p-2 rounded-lg transition-all ${restricted ? 'opacity-30 cursor-not-allowed' : ''} ${isDrawMode ? 'bg-rose-600 text-white shadow-md' : 'text-slate-500 hover:text-rose-600'}`}
              title="Dibujar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
            <button 
              onClick={() => { setIsCompareMode(!isCompareMode); setIsDrawMode(false); setIsPanMode(false); }} 
              className={`p-2 rounded-lg transition-all ${isCompareMode ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-indigo-600'}`}
              title="Comparar Versiones"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
           <button 
            onClick={handleShare}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${shareCopied ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            title="Compartir enlace de esta página"
           >
             {shareCopied ? (
               <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ¡Enlace Copiado!
               </>
             ) : (
               <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                Compartir
               </>
             )}
           </button>

           <div className="relative">
             <button 
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${showDownloadMenu ? 'bg-indigo-600 text-white shadow-md' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
              title="Opciones de descarga"
             >
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
               Descargar
               <svg className={`w-3 h-3 transition-transform ${showDownloadMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
             </button>
             
             {showDownloadMenu && (
               <>
                <div className="fixed inset-0 z-[10]" onClick={() => setShowDownloadMenu(false)}></div>
                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[20] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <button onClick={() => handleDownload('jpg')} className="w-full px-4 py-3 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Imagen (JPG)
                  </button>
                  <button onClick={() => handleDownload('pdf')} className="w-full px-4 py-3 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-t border-slate-100">
                    <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    Documento (PDF)
                  </button>
                </div>
               </>
             )}
           </div>

           {page.annotationsLayer && !restricted && (
             <button 
              onClick={clearCanvas} 
              className="px-4 py-2 rounded-lg bg-rose-50 text-rose-600 font-bold text-sm hover:bg-rose-100 transition-colors flex items-center gap-2"
             >
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
               Borrar Dibujos
             </button>
           )}
           <button onClick={() => navigate(`/project/${projectId}`)} className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors">Finalizar</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Zoom Control Bar */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[60] flex items-center bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-slate-200/50 p-1.5 animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-1">
            <button onClick={() => handleZoom(0.8)} className="p-2.5 hover:bg-slate-100 text-slate-600 rounded-xl transition-all" title="Alejar (Ctrl -)">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" /></svg>
            </button>
            <button onClick={resetZoom} className="px-4 py-2 min-w-[85px] text-center text-xs font-black text-slate-800 hover:bg-slate-100 rounded-xl transition-all border border-slate-100" title="Reiniciar Zoom (Ctrl 0)">
              {Math.round(scale * 100)}%
            </button>
            <button onClick={() => handleZoom(1.2)} className="p-2.5 hover:bg-slate-100 text-slate-600 rounded-xl transition-all" title="Acercar (Ctrl +)">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
            </button>
            <div className="w-px h-6 bg-slate-200 mx-1"></div>
            <button onClick={fitToScreen} className="p-2.5 hover:bg-slate-100 text-indigo-600 rounded-xl transition-all" title="Ajustar a pantalla">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" /></svg>
            </button>
          </div>
        </div>

        {/* Main Canvas Area */}
        <div 
          ref={viewportRef}
          className={`flex-1 overflow-hidden bg-slate-800 relative flex flex-col items-center justify-center ${
            isPanMode ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : isDrawMode ? 'cursor-none' : (restricted ? 'cursor-not-allowed' : 'cursor-crosshair')
          }`}
          onMouseDown={startInteraction}
          onMouseMove={handleInteraction}
          onMouseUp={stopInteraction}
          onMouseLeave={stopInteraction}
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              handleZoom(e.deltaY < 0 ? 1.1 : 0.9);
            }
          }}
        >
          {isDrawMode && !restricted && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl p-2 flex items-center gap-2 z-50 animate-in slide-in-from-top">
               <div className="flex items-center gap-1 px-2">
                 {["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#000000"].map(c => (
                   <button key={c} onClick={() => setDrawColor(c)} className={`w-6 h-6 rounded-full transition-all ${drawColor === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`} style={{ backgroundColor: c }} />
                 ))}
               </div>
               <div className="w-px h-6 bg-slate-200 mx-1"></div>
               <button 
                onClick={clearCanvas} 
                className="flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest"
                title="Borrar todos los dibujos"
               >
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                 Borrar Todo
               </button>
               <button onClick={() => setIsDrawMode(false)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">Listo</button>
            </div>
          )}

          <div 
            className="transition-transform duration-150 ease-out will-change-transform flex items-center justify-center p-8"
            style={{ 
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transformOrigin: 'center center'
            }}
          >
            {isCompareMode ? (
              <div className="flex items-center gap-12 min-w-max">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between px-2 text-white">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-slate-700 px-3 py-1 rounded-full">Anterior</span>
                    <select value={compareVersionId || ''} onChange={(e) => setCompareVersionId(e.target.value)} className="bg-slate-700 text-[10px] font-bold px-2 py-1 rounded border-none outline-none">
                      {previousVersions.map(v => (<option key={v.id} value={v.id}>V{v.versionNumber}</option>))}
                    </select>
                  </div>
                  <div className="relative inline-block shadow-2xl bg-white h-fit rounded border-4 border-slate-700 overflow-hidden">
                    {comparePage && <img src={comparePage.imageUrl} className="max-h-[70vh] w-auto opacity-70 grayscale-[0.3]" />}
                    {comparePage?.comments.map(c => (
                      <div key={c.id} className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white/50 bg-slate-400/50 grayscale" style={{ left: `${c.x}%`, top: `${c.y}%` }}>{c.role[0]}</div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="px-2">
                    <span className="text-white text-[10px] font-black uppercase tracking-[0.2em] bg-indigo-600 px-3 py-1 rounded-full">Actual (V{version.versionNumber})</span>
                  </div>
                  <div className="relative inline-block shadow-2xl bg-white h-fit rounded border-4 border-indigo-600 overflow-hidden">
                    <img src={page.imageUrl} className="max-h-[70vh] w-auto" />
                    {page.comments.map((c) => {
                      const existsInPrevious = comparePage?.comments.some(pc => Math.abs(pc.x - c.x) < 1 && Math.abs(pc.y - c.y) < 1);
                      return (
                        <div key={c.id} className={`absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white shadow-xl transition-all ${existsInPrevious ? 'opacity-50' : 'animate-pulse ring-4 ring-indigo-500/30'} ${c.status === 'resolved' ? 'bg-green-500 opacity-40' : c.status === 'pending' ? 'bg-rose-500' : c.role === "Publicidad" ? "bg-blue-500" : "bg-amber-500"}`} style={{ left: `${c.x}%`, top: `${c.y}%` }}>
                          {c.role[0]}
                          {!existsInPrevious && <span className="absolute -top-3 -right-3 bg-indigo-600 text-[6px] px-1 rounded-sm">NUEVO</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className={`relative inline-block shadow-2xl bg-white group h-fit`} onClick={handleImageClick}>
                <img ref={imgRef} src={page.imageUrl} className="max-h-[85vh] w-auto select-none pointer-events-none block" />
                <canvas ref={canvasRef} className={`absolute top-0 left-0 w-full h-full z-20 ${isDrawMode ? 'pointer-events-auto' : 'pointer-events-none'}`} />
                {page.comments.filter(c => c.x !== -1).map((c) => (
                  <div key={c.id} onMouseEnter={() => setHoveredCommentId(c.id)} onMouseLeave={() => setHoveredCommentId(null)} className={`comment-marker absolute w-6 h-6 -ml-3 -mt-3 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg border-2 border-white hover:scale-125 transition-all z-30 ${c.status === 'resolved' ? 'bg-green-500 opacity-40 grayscale' : 'opacity-100'} ${c.status === 'pending' ? 'bg-rose-500' : c.role === "Publicidad" ? "bg-blue-500" : "bg-amber-500"}`} style={{ left: `${c.x}%`, top: `${c.y}%` }}>
                    {c.status === 'resolved' ? '✓' : c.role[0]}
                    {hoveredCommentId === c.id && (
                      <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-48 bg-white text-slate-900 p-3 rounded-xl shadow-2xl border border-slate-100 z-[100] pointer-events-none animate-in fade-in zoom-in duration-200" style={{ transform: `translateX(-50%) scale(${1/scale})`, transformOrigin: 'bottom center' }}>
                        <div className="flex items-center gap-2 mb-1.5">
                           <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'resolved' ? 'bg-green-500' : c.status === 'pending' ? 'bg-rose-500' : c.role === "Publicidad" ? "bg-blue-500" : "bg-amber-500"}`}></span>
                           <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{c.role}</span>
                        </div>
                        <p className="text-[10px] font-medium leading-relaxed">{c.text}</p>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-r border-b border-slate-100 rotate-45 -mt-1"></div>
                      </div>
                    )}
                  </div>
                ))}
                {pendingComment && !restricted && (
                  <div className="absolute z-50 flex flex-col items-start gap-2 animate-in fade-in zoom-in" style={{ left: `${pendingComment.x}%`, top: `${pendingComment.y}%` }} onClick={(e) => e.stopPropagation()}>
                    <div className="bg-white p-4 rounded-2xl shadow-2xl border border-slate-200 min-w-[280px] mt-2 -ml-6" style={{ transform: `scale(${1/scale})`, transformOrigin: 'top left' }}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Nuevo comentario • {activeRole}</p>
                      <input ref={inputRef} type="text" value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && savePendingComment()} placeholder="Descripción del cambio..." className="w-full text-xs p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 mb-4" />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setPendingComment(null)} className="px-4 py-2 text-[10px] font-bold text-slate-500 hover:bg-slate-50 rounded-lg">CANCELAR</button>
                        <button onClick={savePendingComment} className="px-5 py-2 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">AÑADIR</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-white border-l border-slate-200 flex flex-col shadow-xl z-50">
          <div className="flex border-b border-slate-200">
            {["current", "history"].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab as SidebarTab)} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2 ${activeTab === tab ? "border-indigo-600 text-indigo-600 bg-white" : "border-transparent text-slate-400 bg-slate-50/50"}`}>{tab === "current" ? "Correcciones" : "Historial"}</button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            {activeTab === "current" ? (
              <>
                {page.annotationsLayer && !restricted && (
                  <button 
                    onClick={clearCanvas}
                    className="w-full flex items-center justify-center gap-2 py-3 mb-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl border border-rose-100 transition-all font-black text-[10px] uppercase tracking-widest"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Limpiar Anotaciones
                  </button>
                )}

                {roles.map((role) => {
                  const roleComments = page.comments.filter(c => c.role === role);
                  if (roleComments.length === 0) return null;
                  return (
                    <div key={role} className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{role} ({roleComments.length})</h4>
                      </div>
                      <div className="space-y-2">
                        {roleComments.map((c) => (
                          <div key={c.id} className={`group relative p-3 rounded-2xl border transition-all ${
                            c.status === 'resolved' ? 'bg-green-50 border-green-200 opacity-80' : 
                            c.status === 'in-progress' ? 'bg-amber-50 border-amber-200' : 
                            c.status === 'pending' ? 'bg-rose-50 border-rose-200 shadow-sm' :
                            'bg-white border-slate-200 shadow-sm'
                          }`}>
                            <div className="flex items-start justify-between mb-2">
                               <div className="flex items-center gap-2">
                                 <span className={`w-2 h-2 rounded-full ${c.status === 'resolved' ? 'bg-green-500' : c.status === 'pending' ? 'bg-rose-500' : c.role === "Publicidad" ? "bg-blue-500" : "bg-amber-500"}`}></span>
                                 <span className="text-[8px] font-black text-slate-400 uppercase">{new Date(c.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                               </div>
                               <div className="flex items-center gap-1.5">
                                 <select 
                                  value={c.status} 
                                  disabled={restricted && c.status === 'resolved'}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => updateCommentStatus(c.id, e.target.value as CommentStatus)}
                                  className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border-none outline-none cursor-pointer ${
                                    c.status === 'resolved' ? 'bg-green-100 text-green-700' : 
                                    c.status === 'in-progress' ? 'bg-amber-100 text-amber-700' : 
                                    c.status === 'pending' ? 'bg-rose-100 text-rose-700' :
                                    'bg-slate-100 text-slate-500'
                                  }`}
                                 >
                                   <option value="pending">Pendiente</option>
                                   <option value="in-progress">En proceso</option>
                                   <option value="resolved">Resuelto</option>
                                 </select>
                                 
                                 {!restricted && (
                                   <button 
                                     onClick={(e) => deleteComment(e, c.id)}
                                     className="p-1 text-slate-300 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                                     title="Eliminar este comentario"
                                   >
                                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                   </button>
                                 )}
                               </div>
                            </div>
                            <p className={`text-xs leading-relaxed ${c.status === 'resolved' ? 'text-green-700 line-through decoration-green-300' : 'text-slate-700'} ${c.status === 'pending' ? 'text-rose-700' : ''}`}>{c.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="space-y-4">
                {/* History Search Bar */}
                <div className="relative mb-4">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Buscar correcciones pasadas..." 
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-[10px] font-bold text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>

                {historySearchQuery.trim() ? (
                  <div className="space-y-3">
                    <h4 className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Resultados ({filteredHistoryComments.length})</h4>
                    {filteredHistoryComments.length === 0 ? (
                      <div className="py-10 text-center">
                         <p className="text-[10px] font-black text-slate-300 uppercase">Sin resultados</p>
                      </div>
                    ) : (
                      filteredHistoryComments.map((c) => (
                        <div 
                          key={`${c.versionId}-${c.id}`} 
                          onClick={() => { setCompareVersionId(c.versionId); setIsCompareMode(true); }}
                          className="p-3 bg-white border border-slate-200 rounded-2xl hover:border-indigo-600 cursor-pointer transition-all hover:shadow-md group"
                        >
                           <div className="flex justify-between items-center mb-1.5">
                              <span className="text-[8px] font-black bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-md uppercase tracking-tighter">V{c.versionNumber}</span>
                              <span className="text-[8px] font-bold text-slate-400">{new Date(c.timestamp).toLocaleDateString()}</span>
                           </div>
                           <div className="flex items-center gap-1.5 mb-1.5">
                             <span className={`w-1.5 h-1.5 rounded-full ${c.role === "Publicidad" ? "bg-blue-500" : "bg-amber-500"}`}></span>
                             <span className="text-[9px] font-black text-slate-500 uppercase">{c.role}</span>
                           </div>
                           <p className="text-[10px] text-slate-700 leading-relaxed font-medium line-clamp-2">{c.text}</p>
                           <div className="mt-2 flex justify-end">
                              <span className="text-[8px] font-black text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">COMPARAR VERSIÓN →</span>
                           </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <h4 className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Versiones Anteriores</h4>
                    {pageHistory.map((h, i) => (
                      <div key={i} className="border-l-2 border-slate-100 pl-4 relative group cursor-pointer" onClick={() => { setCompareVersionId(h.versionId); setIsCompareMode(true); }}>
                        <div className="absolute w-2 h-2 bg-indigo-600 rounded-full -left-[5px] top-1 group-hover:scale-125 transition-transform"></div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black text-indigo-600">VERSIÓN {h.versionNumber}</span>
                          <span className="text-[9px] text-slate-400 font-bold">{new Date(h.versionDate).toLocaleDateString()}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium">{h.comments.length} correcciones</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

const PageReviewWrapper: React.FC<PageReviewProps> = (props) => <PageReview {...props} />;
export default PageReviewWrapper;
