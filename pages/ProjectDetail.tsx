import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Project, AppNotification } from '../types';
import { supabase } from '../supabase';

interface ProjectDetailProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  addNotification?: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
}

// Opciones de colores
const STATUS_COLORS: Record<string, string> = {
  '1ª corrección': 'bg-amber-100 text-amber-700 border-amber-200',
  '2ª corrección': 'bg-orange-100 text-orange-700 border-orange-200',
  '3ª corrección': 'bg-rose-100 text-rose-700 border-rose-200',
  '4ª corrección': 'bg-purple-100 text-purple-700 border-purple-200',
  '5ª corrección': 'bg-violet-100 text-violet-700 border-violet-200',
  'Imprenta': 'bg-emerald-100 text-emerald-700 border-emerald-200'
};

const ProjectDetail: React.FC<ProjectDetailProps> = ({ projects, setProjects }) => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [activeVersionNumber, setActiveVersionNumber] = useState<number | null>(null);
  const [commentsCount, setCommentsCount] = useState<Record<string, number>>({});
  
  // Estados de carga e interfaz
  const [isUploadingVersion, setIsUploadingVersion] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState("Preparando...");
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
    
    // INICIO DE CARGA
    setIsUploadingVersion(true);
    setUploadStatusText("Iniciando carga...");

    try {
        // 1. Actualizar fecha si existe
        if (deadline) {
            setUploadStatusText("Actualizando fecha...");
            const { error: deadlineError } = await supabase.from('projects').update({ review_deadline: deadline }).eq('id', project.id);
            if (deadlineError) throw new Error("Error en fecha: " + deadlineError.message);
        }

        const maxV = Math.max(...project.versions.map(v => v.versionNumber), 0);
        const nextVersionNum = maxV + 1;
        const automaticStatus = `${nextVersionNum}ª corrección`; // Generamos el string "2ª corrección", etc.

        const files = Array.from(e.target.files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

        // 2. Bucle de subida de archivos
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setUploadStatusText(`Subiendo página ${i + 1} de ${files.length}...`);
            
            const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const fileName = `v${nextVersionNum}-${Date.now()}-${i}-${cleanFileName}`;
            
            // A) Subir al Storage
            const { error: uploadError } = await supabase.storage.from('brochures').upload(fileName, file);
            if (uploadError) throw new Error("Fallo al subir imagen: " + uploadError.message);
            
            const { data: { publicUrl } } = supabase.storage.from('brochures').getPublicUrl(fileName);
            
            // B) Insertar en Base de Datos (TABLA PAGES)
            const { error: dbError } = await supabase.from('pages').insert([{ 
                project_id: project.id, 
                image_url: publicUrl, 
                page_number: i + 1, 
                version: nextVersionNum, 
                status: automaticStatus 
            }]);

            if (dbError) {
                console.error("Error BD insertando página:", dbError);
                throw new Error("Error BD: " + dbError.message);
            }
        }
        
        setUploadStatusText("¡Listo! Recargando...");
        setTimeout(() => window.location.reload(), 500);

    } catch (err: any) {
        console.error(err);
        alert("🛑 Error durante la subida:\n" + (err.message || JSON.stringify(err)));
        
        setIsUploadingVersion(false);
        setUploadStatusText("Error");
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

  const getStatusColor = (status: string) => {
      return STATUS_COLORS[status] || 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const triggerFileInput = () => {
      if (fileInputRef.current) {
          fileInputRef.current.value = ''; 
          fileInputRef.current.click();
      }
  };

  if (!project) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-400">Cargando...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans relative">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleNewVersionUpload} />
      
      {/* --- CORRECCIÓN AQUÍ: CAMBIADO 'absolute' POR 'fixed' y Z-INDEX ALTO --- */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-black text-slate-800 mb-2">Subir Versión {Math.max(...project.versions.map(v => v.versionNumber)) + 1}</h3>
                <p className="text-sm text-slate-500 mb-4">Se asignará automáticamente: <span className="font-bold text-rose-600">{Math.max(...project.versions.map(v => v.versionNumber)) + 1}ª corrección</span></p>
                
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nueva fecha límite (Opcional)</label>
                <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-rose-500 mb-6" />
                
                <div className="flex gap-3">
                    <button onClick={() => setShowUploadModal(false)} disabled={isUploadingVersion} className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-xl hover:bg-slate-200 disabled:opacity-50">Cancelar</button>
                    <button 
                        onClick={triggerFileInput} 
                        disabled={isUploadingVersion}
                        className={`flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all flex justify-center items-center gap-2 ${isUploadingVersion ? 'opacity-70 cursor-wait' : ''}`}
                    >
                        {isUploadingVersion ? (
                            <>
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                {uploadStatusText}
                            </>
                        ) : 'Seleccionar Archivos'}
                    </button>
                </div>
            </div>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 px-8 py-6 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate(-1)} className="p-2.5 hover:bg-slate-50 rounded-2xl text-slate-400"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{project.name}</h1>
