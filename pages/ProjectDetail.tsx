import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Project, AppNotification } from '../types';
import { supabase } from '../supabase';

interface ProjectDetailProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  addNotification?: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
}

type ViewMode = 'grid' | 'list';

const ProjectDetail: React.FC<ProjectDetailProps> = ({ projects, setProjects }) => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // 1. Buscar el proyecto
  const project = projects.find(p => p.id === projectId);

  // 2. Estado de Carga
  if (!project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 font-bold animate-pulse">Cargando proyecto...</p>
      </div>
    );
  }

  // Tomamos la versión actual
  const currentVersion = project.versions[0];

  // Función para borrar una página individual
  const handleDeletePage = async (pageId: string) => {
    if (!window.confirm("¿Seguro que quieres eliminar esta página?")) return;

    // 1. Borrar de Supabase
    const { error } = await supabase.from('pages').delete().eq('id', pageId);

    if (error) {
      alert("Error al borrar: " + error.message);
    } else {
      // 2. Actualizar estado local
      setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        const updatedVersions = p.versions.map(v => {
          if (v.id !== currentVersion.id) return v;
          return { ...v, pages: v.pages.filter(pg => pg.id !== pageId) };
        });
        return { ...p, versions: updatedVersions };
      }));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-all">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight truncate max-w-xl">{project.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded uppercase tracking-widest">En Proceso</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">• {currentVersion?.pages.length || 0} archivos</span>
            </div>
          </div>
        </div>

        {/* BOTONES DE VISTA (GRID / LISTA) */}
        <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-1 shadow-inner">
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Vista Cuadrícula">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            </button>
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Vista Lista">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-10">
        
        {currentVersion && currentVersion.pages.length > 0 ? (
          <>
            {viewMode === 'grid' ? (
              /* VISTA CUADRÍCULA */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {currentVersion.pages.map((page, index) => {
                  const isPdf = page.imageUrl.toLowerCase().includes('.pdf');
                  return (
                    <div 
                      key={page.id} 
                      onClick={() => navigate(`/project/${project.id}/version/${currentVersion.id}/page/${page.id}`)}
                      className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all cursor-pointer overflow-hidden relative aspect-[3/4]"
                    >
                      <div className="absolute inset-0 bg-slate-50 flex items-center justify-center p-4">
                        {isPdf ? (
                          <div className="flex flex-col items-center justify-center text-rose-500">
                            <svg className="w-16 h-16 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                            <span className="font-black text-[10px] uppercase tracking-widest text-slate-400">PDF Document</span>
                          </div>
                        ) : (
                          <img src={page.imageUrl} alt={`Página ${page.pageNumber}`} className="w-full h-full object-contain shadow-lg" />
                        )}
                      </div>
                      
                      <div className="absolute top-3 left-3 bg-white/90 backdrop-blur text-slate-700 text-[10px] font-black px-2 py-1 rounded border border-slate-100 shadow-sm">
                        #{index + 1}
                      </div>

                      <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-white via-white to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-center pt-8">
                         <span className="text-indigo-600 font-bold text-xs uppercase tracking-wider bg-white px-3 py-1 rounded-full shadow-md">Revisar</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* VISTA LISTA (TABLA) */
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-20 text-center">Orden</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Vista Previa</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {currentVersion.pages.map((page, index) => {
                      const isPdf = page.imageUrl.toLowerCase().includes('.pdf');
                      return (
                        <tr key={page.id} onClick={() => navigate(`/project/${project.id}/version/${currentVersion.id}/page/${page.id}`)} className="group hover:bg-slate-50 cursor-pointer transition-colors">
                          <td className="px-6 py-4 text-center font-bold text-slate-400">#{index + 1}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {isPdf ? (
                                  <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                ) : (
                                  <img src={page.imageUrl} className="w-full h-full object-cover" />
                                )}
                              </div>
                              <span className="text-sm font-bold text-slate-700 truncate max-w-xs">Página {page.pageNumber}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                             <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide ${isPdf ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                               {isPdf ? 'PDF' : 'IMAGEN'}
                             </span>
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
          <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl">
            <p className="text-slate-400 font-medium">Este proyecto no tiene páginas visibles.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default ProjectDetail;
