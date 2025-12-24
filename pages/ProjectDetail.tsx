import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Project, AppNotification } from '../types';
import { supabase } from '../supabase';

interface ProjectDetailProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  addNotification?: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
}

const STATUS_OPTIONS = {
  '1ª corrección': 'bg-amber-100 text-amber-700 border-amber-200',
  '2ª corrección': 'bg-orange-100 text-orange-700 border-orange-200',
  '3ª corrección': 'bg-rose-100 text-rose-700 border-rose-200',
  'Imprenta': 'bg-emerald-100 text-emerald-700 border-emerald-200'
};

const ProjectDetail: React.FC<ProjectDetailProps> = ({ projects, setProjects }) => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [activeVersionNumber, setActiveVersionNumber] = useState<number | null>(null);
  const [commentsCount, setCommentsCount] = useState<Record<string, number>>({});
  
  const [isUploadingVersion, setIsUploadingVersion] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [deadline, setDeadline] = useState("");

  const project = projects.find(p => p.id === projectId);

  useEffect(() => {
    if (project && activeVersionNumber === null && project.versions.length > 0) {
      const latest = Math.max(...project.versions.map(v => v.versionNumber));
      setActiveVersionNumber(latest);
    }
  }, [project, activeVersionNumber]);

  const activeVersion = project?.versions.find(v => v.versionNumber === activeVersionNumber);

  useEffect(() => {
    if (activeVersion) fetchCommentsCount();
  }, [activeVersion]);

  const fetchCommentsCount = async () => {
    const pageIds = activeVersion?.pages.map(p => p.id) || [];
    if (pageIds.length === 0) { setCommentsCount({}); return; }
    const { data } = await supabase.from('comments').select('page_id').in('page_id', pageIds).eq('resolved', false);
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach((c: any) => { counts[c.page_id] = (counts[c.page_id] || 0) + 1; });
      setCommentsCount(counts);
    }
  };

  const handleGenerateReport = async () => {
    if (!activeVersion || !activeVersion.pages || activeVersion.pages.length === 0) return;
    const pageIds = activeVersion.pages.map(p => p.id);
    const { data: comments, error } = await supabase.from('comments').select('content, created_at, page_id').in('page_id', pageIds).eq('resolved', false).order('created_at', { ascending: true });

    if (error || !comments || comments.length === 0) { alert("No hay correcciones pendientes para generar informe."); return; }

    const reportData = comments.map(c => {
      const pageInfo = activeVersion.pages.find(p => p.id === c.page_id);
      return { ...c, pageNumber: pageInfo ? pageInfo.pageNumber : '?' };
    });

    const reportWindow = window.open('', '_blank');
    if (reportWindow) {
      const html = `<html><head><title>Informe</title><style>body{font-family:sans-serif;padding:40px;}.item{margin-bottom:15px;padding:10px;border-bottom:1px solid #eee;}.badge{font-weight:bold;margin-right:10px;}</style></head><body><h1>Informe de Errores</h1>${reportData.map(c => `<div class="item"><span class="badge">Pág ${c.pageNumber}</span> ${c.content}</div>`).join('')}<script>window.print();</script></body></html>`;
      reportWindow.document.write(html);
      reportWindow.document.close();
    }
  };

  const handleNewVersionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !project) return;
    setIsUploadingVersion(true);
    setShowUploadModal(false);

    if (deadline) {
        await supabase.from('projects').update({ review_deadline: deadline }).eq('id', project.id);
    }

    const maxV = Math.max(...project.versions.map(v => v.versionNumber), 0);
    const nextVersionNum = maxV + 1;
    const files = Array.from(e.target.files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `v${nextVersionNum}-${Date.now()}-${i}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        await supabase.storage.from('brochures').upload(fileName, file);
        const { data: { publicUrl } } = supabase.storage.from('brochures').getPublicUrl(fileName);
        await supabase.from('pages').insert([{ project_id: project.id, image_url: publicUrl, page_number: i + 1, version: nextVersionNum, status: '1ª corrección' }]);
      }
      window.location.reload();
    } catch (err) {
      console.error(err);
      setIsUploadingVersion(false);
    }
  };

  const handleStatusChange = async (pageId: string, newStatus: string) => {
    const { error } = await supabase.from('pages').update({ status: newStatus }).eq('id', pageId);
    if (!error) setProjects(prev => prev.map(p => { if (p.id !== projectId) return p; return { ...p, versions: p.versions.map(v => ({ ...v, pages: v.pages.map(pg => pg.id === pageId ? { ...pg, status: newStatus as any } : pg) })) }; }));
  };

  const handleDeletePage = async (pageId: string) => {
    if (!window.confirm("¿Seguro?")) return;
    const { error } = await supabase.from('pages').delete().eq('id', pageId);
    if (!error) setProjects(prev => prev.map(p => { if (p.id !== projectId) return p; return { ...p, versions: p.versions.map(v => ({ ...v, pages: v.pages.filter(pg => pg.id !== pageId) })) }; }));
  };

  if (!project) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-400">Cargando...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans relative">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleNewVersionUpload} />
      
      {showUploadModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-in zoom-in duration-200">
                <h3 className="text-lg font-black text-slate-800 mb-2">Subir Versión {Math.max(...project.versions.map(v => v.versionNumber)) + 1}</h3>
                <p className="text-sm text-slate-500 mb-4">Define el nuevo plazo para revisar esta versión.</p>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nueva fecha límite (Opcional)</label>
                <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-
