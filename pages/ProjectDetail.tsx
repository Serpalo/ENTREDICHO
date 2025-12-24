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

    // ACTUALIZAMOS EL PLAZO DEL PROYECTO
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
      
      {/* MODAL NUEVA VERSIÓN */}
      {showUploadModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-in zoom-in duration-200">
                <h3 className="text-lg font-black text-slate-800 mb-2">Subir Versión {Math.max(...project.versions.map(v => v.versionNumber)) + 1}</h3>
                <p className="text-sm text-slate-500 mb-4">Define el nuevo plazo para revisar esta versión.</p>
                
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nueva fecha límite (Opcional)</label>
                <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-rose-500 mb-6" />

                <div className="flex gap-3">
                    <button onClick={() => setShowUploadModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-xl hover:bg-slate-200">Cancelar</button>
                    <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl shadow-lg shadow-rose-200 hover:bg-rose-700">Seleccionar Archivos</button>
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
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Historial de versiones</p>
              </div>
            </div>

            <div className="flex gap-3">
                 <button onClick={handleGenerateReport} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> Generar Informe</button>
                 <button onClick={() => !isUploadingVersion && setShowUploadModal(true)} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-xl transition-all ${isUploadingVersion ? 'bg-slate-400' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-100'}`}>
                    {isUploadingVersion ? 'Subiendo...' : 'Añadir Nueva Versión'}
                    {!isUploadingVersion && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>}
                 </button>
            </div>
        </div>

        <div className="flex items-center justify-between">
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                {[...project.versions].sort((a, b) => a.versionNumber - b.versionNumber).map(v => (
                    <button key={v.id} onClick={() => setActiveVersionNumber(v.versionNumber)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-2 ${activeVersionNumber === v.versionNumber ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}>Versión {v.versionNumber}</button>
                ))}
            </div>
            <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-1">
                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'bg-white text-rose-600 shadow' : 'text-slate-400'}`}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg></button>
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-white text-rose-600 shadow' : 'text-slate-400'}`}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
            </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-10">
        {activeVersion && activeVersion.pages.length > 0 ? (
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
             {viewMode === 'list' ? (
                 <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50/50 border-b border-slate-100">
                        <tr><th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 w-24 text-center">Orden</th><th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Vista Previa</th><th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Correcciones</th><th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Estado</th><th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Acciones</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {activeVersion.pages.map((page, index) => {
                          const count = commentsCount[page.id] || 0;
                          return (
                            <tr key={page.id} onClick={() => navigate(`/project/${project.id}/version/${activeVersion.id}/page/${page.id}`)} className="group hover:bg-slate-50/50 cursor-pointer transition-colors">
                              <td className="px-8 py-6 text-center font-black text-slate-300">#{index + 1}</td>
                              <td className="px-8 py-6"><div className="flex items-center gap-5"><div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm"><img src={page.imageUrl} className="w-full h-full object-cover" /></div><span className="text-sm font-black text-slate-700">Página {page.pageNumber}</span></div></td>
                              <td className="px-8 py-6 text-center">{count > 0 ? <div className="inline-flex items-center gap-2 bg-rose-50 text-rose-600 px-4 py-1.5 rounded-full text-[10px] font-black border border-rose-100 shadow-sm shadow-rose-50"><span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>{count} PENDIENTES</div> : <span className="text-slate-200 text-[10px] font-black uppercase tracking-widest">Limpia</span>}</td>
                              <td className="px-8 py-6" onClick={(e) => e.stopPropagation()}><select value={page.status || '1ª corrección'} onChange={(e) => handleStatusChange(page.id, e.target.value)} className={`text-[10px] font-black px-4 py-2 rounded-xl uppercase tracking-widest border-2 cursor-pointer outline-none transition-all appearance-none shadow-sm ${STATUS_OPTIONS[page.status as keyof typeof STATUS_OPTIONS] || 'bg-slate-100'}`}>{Object.keys(STATUS_OPTIONS).map(status => <option key={status} value={status}>{status}</option>)}</select></td>
                              <td className="px-8 py-6 text-right"><button className="bg-rose-50 text-rose-600 px-5 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all">Revisar</button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                 </table>
             ) : (
                 <div className="p-8 grid grid-cols-4 gap-6">
                    {activeVersion.pages.map((page, index) => {
                        const count = commentsCount[page.id] || 0;
                        return (
                            <div key={page.id} onClick={() => navigate(`/project/${project.id}/version/${activeVersion.id}/page/${page.id}`)} className="bg-white border border-slate-200 rounded-2xl p-4 cursor-pointer hover:shadow-lg transition-all relative group">
                                {count > 0 && <div className="absolute top-2 right-2 bg-rose-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-lg z-10">{count}</div>}
                                <img src={page.imageUrl} className="w-full aspect-[3/4] object-contain bg-slate-50 rounded-xl mb-3" />
                                <div className="flex justify-between items-center"><span className="font-bold text-sm">Página {page.pageNumber}</span><span className={`text-[9px] font-bold px-2 py-1 rounded uppercase ${STATUS_OPTIONS[page.status as keyof typeof STATUS_OPTIONS]}`}>{page.status}</span></div>
                            </div>
                        )
                    })}
                 </div>
             )}
          </div>
        ) : (
          <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-[3rem] bg-white"><p className="text-slate-400 font-black text-xs uppercase tracking-widest">No hay páginas en esta versión</p></div>
        )}
      </main>
    </div>
  );
};

export default ProjectDetail;
