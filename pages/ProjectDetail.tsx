import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Project, AppNotification } from '../types';
import { supabase } from '../supabase';

interface ProjectDetailProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  addNotification?: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
}

type ViewMode = 'grid' | 'list';

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
  
  const [viewMode, setViewMode] = useState<ViewMode>('list'); 
  const [activeVersionNumber, setActiveVersionNumber] = useState<number | null>(null);
  const [commentsCount, setCommentsCount] = useState<Record<string, number>>({});
  const [isUploadingVersion, setIsUploadingVersion] = useState(false);

  const project = projects.find(p => p.id === projectId);

  // Seleccionar la versión más RECIENTE por defecto (la última de la lista)
  useEffect(() => {
    if (project && activeVersionNumber === null && project.versions.length > 0) {
      const lastVersion = project.versions[project.versions.length - 1].versionNumber;
      setActiveVersionNumber(lastVersion);
    }
  }, [project, activeVersionNumber]);

  const activeVersion = project?.versions.find(v => v.versionNumber === activeVersionNumber);

  useEffect(() => {
    if (activeVersion) fetchCommentsCount();
  }, [activeVersion]);

  const fetchCommentsCount = async () => {
    const pageIds = activeVersion?.pages.map(p => p.id) || [];
    if (pageIds.length === 0) { setCommentsCount({}); return; }

    const { data } = await supabase
      .from('comments')
      .select('page_id')
      .in('page_id', pageIds)
      .eq('resolved', false);

    if (data) {
      const counts: Record<string, number> = {};
      data.forEach((c: any) => { counts[c.page_id] = (counts[c.page_id] || 0) + 1; });
      setCommentsCount(counts);
    }
  };

  const handleNewVersionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !project) return;
    setIsUploadingVersion(true);

    // Calculamos la siguiente versión basándonos en la más alta que exista
    const maxV = Math.max(...project.versions.map(v => v.versionNumber), 0);
    const nextVersionNum = maxV + 1;
    
    const files = Array.from(e.target.files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    const uploadedPages = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `v${nextVersionNum}-${Date.now()}-${i}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        
        const { error: uploadError } = await supabase.storage.from('brochures').upload(fileName, file);
        if (uploadError) console.error(uploadError);
        const { data: { publicUrl } } = supabase.storage.from('brochures').getPublicUrl(fileName);

        const { data: pageData } = await supabase
          .from('pages')
          .insert([{ project_id: project.id, image_url: publicUrl, page_number: i + 1, version: nextVersionNum, status: '1ª corrección' }])
          .select();

        if (pageData) {
           uploadedPages.push({ id: pageData[0].id.toString(), pageNumber: i + 1, imageUrl: publicUrl, status: '1ª corrección', approvals: {}, comments: [] });
        }
      }

      const newVersionObj = {
          id: `v${nextVersionNum}-${project.id}`,
          versionNumber: nextVersionNum,
          createdAt: new Date(),
          isActive: true,
          pages: uploadedPages as any
      };

      setProjects(prev => prev.map(p => {
          if (p.id !== project.id) return p;
          // AÑADIMOS AL FINAL DE LA LISTA
          return { ...p, versions: [...p.versions, newVersionObj] };
      }));

      setActiveVersionNumber(nextVersionNum);
      setIsUploadingVersion(false);
      alert(`¡Versión ${nextVersionNum} creada!`);

    } catch (err) {
      console.error(err);
      setIsUploadingVersion(false);
    }
  };

  const handleStatusChange = async (pageId: string, newStatus: string) => {
    const { error } = await supabase.from('pages').update({ status: newStatus }).eq('id', pageId);
    if (!error) {
      setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        const updatedVersions = p.versions.map(v => ({
            ...v, pages: v.pages.map(pg => pg.id === pageId ? { ...pg, status: newStatus as any } : pg)
        }));
        return { ...p, versions: updatedVersions };
      }));
    }
  };

  const handleDeletePage = async (pageId: string) => {
    if (!window.confirm("¿Seguro?")) return;
    const { error } = await supabase.from('pages').delete().eq('id', pageId);
    if (!error) {
      setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        const updatedVersions = p.versions.map(v => ({ ...v, pages: v.pages.filter(pg => pg.id !== pageId) }));
        return { ...p, versions: updatedVersions };
      }));
    }
  };

  if (!project) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-400">Cargando proyecto...</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,image/*" multiple onChange={handleNewVersionUpload} />
      
      <header className="bg-white border-b border-slate-200 px-8 py-5 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              </button>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{project.name}</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Historial de versiones</p>
              </div>
            </div>

            <button 
               onClick={() => !isUploadingVersion && fileInputRef.current?.click()}
               className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg transition-all ${isUploadingVersion ? 'bg-slate-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'}`}
            >
               {isUploadingVersion ? 'Subiendo...' : `Añadir Versión ${Math.max(...project.versions.map(v => v.versionNumber), 0) + 1}`}
               {!isUploadingVersion && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}
            </button>
        </div>

        {/* PESTAÑAS: AHORA EN ORDEN 1, 2, 3... */}
        <div className="flex items-center justify-between">
            <div className="flex gap-1 overflow-x-auto pb-1 custom-scrollbar">
                {project.versions.map(v => (
                    <button 
                        key={v.id}
                        onClick={() => setActiveVersionNumber(v.versionNumber)}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeVersionNumber === v.versionNumber ? 'bg-slate-900 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                    >
                        Versión {v.versionNumber}
                    </button>
                ))}
            </div>
            
            <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-1">
                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow' : 'text-slate-400'}`}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg></button>
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow' : 'text-slate-400'}`}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
            </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-10">
        {activeVersion && activeVersion.pages.length > 0 ? (
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
             {/* ... el resto de la tabla/grid se mantiene igual ... */}
             <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-20 text-center">Orden</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Vista Previa</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Correcciones</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Estado</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {activeVersion.pages.map((page, index) => {
                      const count = commentsCount[page.id] || 0;
                      return (
                        <tr key={page.id} onClick={() => navigate(`/project/${project.id}/version/${activeVersion.id}/page/${page.id}`)} className="group hover:bg-slate-50 cursor-pointer transition-colors">
                          <td className="px-6 py-4 text-center font-bold text-slate-400">#{index + 1}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                                <img src={page.imageUrl} className="w-full h-full object-cover" />
                              </div>
                              <span className="text-sm font-bold text-slate-700 truncate max-w-xs">Página {page.pageNumber}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                             {count > 0 ? <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-600 px-3 py-1 rounded-full text-xs font-bold border border-rose-100"><span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>{count} pendientes</span> : <span className="text-slate-300 text-xs font-bold">-</span>}
                          </td>
                          <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                             <select value={page.status || '1ª corrección'} onChange={(e) => handleStatusChange(page.id, e.target.value)} className={`text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wide border cursor-pointer outline-none transition-all appearance-none ${STATUS_OPTIONS[page.status as keyof typeof STATUS_OPTIONS] || 'bg-slate-100'}`}>
                               {Object.keys(STATUS_OPTIONS).map(status => <option key={status} value={status}>{status}</option>)}
                             </select>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100">Abrir</button>
                              <button onClick={(e) => { e.stopPropagation(); handleDeletePage(page.id); }} className="text-xs font-bold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg hover:bg-rose-100">Borrar</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
          </div>
        ) : (
          <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl"><p className="text-slate-400 font-medium">No hay páginas en la Versión {activeVersionNumber}</p></div>
        )}
      </main>
    </div>
  );
};

export default ProjectDetail;
