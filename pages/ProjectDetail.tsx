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

  // Seleccionar la versión más reciente al cargar
  useEffect(() => {
    if (project && activeVersionNumber === null && project.versions.length > 0) {
      setActiveVersionNumber(project.versions[0].versionNumber);
    }
  }, [project, activeVersionNumber]);

  // Obtener la versión activa
  const activeVersion = project?.versions.find(v => v.versionNumber === activeVersionNumber) || project?.versions[0];

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

  // --- SUBIR NUEVA VERSIÓN ---
  const handleNewVersionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !project) return;
    setIsUploadingVersion(true);

    const nextVersionNum = (project.versions[0]?.versionNumber || 0) + 1;
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
          .insert([{ 
              project_id: project.id, 
              image_url: publicUrl, 
              page_number: i + 1,
              version: nextVersionNum, // AQUI GUARDAMOS LA VERSIÓN
              status: '1ª corrección'
          }])
          .select();

        if (pageData) {
           uploadedPages.push({
             id: pageData[0].id.toString(),
             pageNumber: i + 1,
             imageUrl: publicUrl,
             status: '1ª corrección',
             approvals: {},
             comments: []
           });
        }
      }

      // Actualizar estado local añadiendo la nueva versión al principio
      const newVersionObj = {
          id: `v${nextVersionNum}-${project.id}`,
          versionNumber: nextVersionNum,
          createdAt: new Date(),
          isActive: true,
          pages: uploadedPages as any
      };

      setProjects(prev => prev.map(p => {
          if (p.id !== project.id) return p;
          return { ...p, versions: [newVersionObj, ...p.versions] };
      }));

      setActiveVersionNumber(nextVersionNum); // Cambiar a la nueva versión
      setIsUploadingVersion(false);
      alert(`¡Versión ${nextVersionNum} creada con éxito!`);

    } catch (err) {
      console.error(err);
      setIsUploadingVersion(false);
      alert("Error al subir versión");
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

  if (!project) return <div className="min-h-screen flex items-center justify-center"><p>Cargando...</p></div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,image/*" multiple onChange={handleNewVersionUpload} />
      
      <header className="bg-white border-b border-slate-200 px-8 py-5 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              </button>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight truncate max-w-xl">{project.name}</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gestión de Versiones</p>
              </div>
            </div>

            <div className="flex gap-3">
                 <button 
                    onClick={() => !isUploadingVersion && fileInputRef.current?.click()}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg transition-all ${isUploadingVersion ? 'bg-slate-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 hover:-translate-y-0.5'}`}
                 >
                    {isUploadingVersion ? 'Subiendo...' : `Subir V${(project.versions[0]?.versionNumber || 0) + 1}`}
                    {!isUploadingVersion && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>}
                 </button>
            </div>
        </div>

        {/* PESTAÑAS DE VERSIONES */}
        <div className="flex items-center justify-between">
            <div className="flex gap-1 overflow-x-auto pb-1 custom-scrollbar">
                {project.versions.map(v => (
                    <button 
                        key={v.id}
                        onClick={() => setActiveVersionNumber(v.versionNumber)}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeVersionNumber === v.versionNumber ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
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
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {activeVersion.pages.map((page, index) => {
                  const isPdf = page.imageUrl.toLowerCase().includes('.pdf');
                  const count = commentsCount[page.id] || 0;
                  return (
                    <div key={page.id} onClick={() => navigate(`/project/${project.id}/version/${activeVersion.id}/page/${page.id}`)} className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all cursor-pointer overflow-hidden relative aspect-[3/4]">
                      {count > 0 && <div className="absolute top-3 right-3 z-10 bg-rose-500 text-white text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-full shadow-lg border-2 border-white animate-bounce">{count}</div>}
                      <div className="absolute inset-0 bg-slate-50 flex items-center justify-center p-4">
                        {isPdf ? <div className="flex flex-col items-center justify-center text-rose-500"><svg className="w-16 h-16 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg><span className="font-black text-[10px] uppercase tracking-widest text-slate-400">PDF</span></div> : <img src={page.imageUrl} className="w-full h-full object-contain shadow-lg" />}
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-white/95 border-t border-slate-100 p-2 flex justify-between items-center">
                         <span className="text-[10px] font-bold text-slate-500">Pág {page.pageNumber}</span>
                         <span className={`text-[8px] font-bold px-2 py-0.5 rounded uppercase ${STATUS_OPTIONS[page.status as keyof typeof STATUS_OPTIONS] || 'bg-slate-100'}`}>{page.status || '1ª corrección'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
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
                      const isPdf = page.imageUrl.toLowerCase().includes('.pdf');
                      const count = commentsCount[page.id] || 0;
                      return (
                        <tr key={page.id} onClick={() => navigate(`/project/${project.id}/version/${activeVersion.id}/page/${page.id}`)} className="group hover:bg-slate-50 cursor-pointer transition-colors">
                          <td className="px-6 py-4 text-center font-bold text-slate-400">#{index + 1}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {isPdf ? <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg> : <img src={page.imageUrl} className="w-full h-full object-cover" />}
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
            )}
          </>
        ) : (
          <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl"><p className="text-slate-400 font-medium">Este proyecto no tiene páginas visibles en la versión {activeVersionNumber}.</p></div>
        )}
      </main>
    </div>
  );
};

export default ProjectDetail;
