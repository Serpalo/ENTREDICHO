import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Project, AppNotification } from '../types';

interface ProjectDetailProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  addNotification?: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ projects }) => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // 1. Buscar el proyecto
  const project = projects.find(p => p.id === projectId);

  // 2. Estado de Carga (Evita la pantalla blanca si Supabase tarda un poco)
  if (!project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 font-bold animate-pulse">Cargando proyecto...</p>
      </div>
    );
  }

  // Tomamos la última versión (la primera de la lista en nuestra estructura actual)
  const currentVersion = project.versions[0];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-all">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{project.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded uppercase tracking-widest">En Proceso</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">• {currentVersion?.pages.length || 0} páginas</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-10">
        {/* Reviewers Section (Visual Only for now) */}
        <div className="mb-10">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Revisores Notificados</h2>
          <div className="flex flex-wrap gap-3">
            {[...(project.advertisingEmails || []), ...(project.productDirectionEmails || [])].length > 0 ? (
              [...(project.advertisingEmails || []), ...(project.productDirectionEmails || [])].map((email, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-white border border-slate-200 pl-2 pr-4 py-1.5 rounded-full shadow-sm">
                  <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-[10px] font-bold text-white uppercase">
                    {email.charAt(0)}
                  </div>
                  <span className="text-xs font-bold text-slate-600">{email}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400 italic">No hay revisores asignados todavía.</p>
            )}
          </div>
        </div>

        {/* Pages Grid */}
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Contenido del Folleto</h2>
        
        {currentVersion && currentVersion.pages.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {currentVersion.pages.map((page) => {
              // Detectar si es PDF para mostrar icono en lugar de imagen rota
              const isPdf = page.imageUrl.toLowerCase().includes('.pdf');

              return (
                <div 
                  key={page.id} 
                  onClick={() => navigate(`/project/${project.id}/version/${currentVersion.id}/page/${page.id}`)}
                  className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all cursor-pointer overflow-hidden relative aspect-[3/4]"
                >
                  <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
                    {isPdf ? (
                      <div className="flex flex-col items-center justify-center text-rose-500">
                        <svg className="w-16 h-16 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        <span className="font-black text-xs uppercase tracking-widest">Documento PDF</span>
                      </div>
                    ) : (
                      <img src={page.imageUrl} alt={`Página ${page.pageNumber}`} className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-500" />
                    )}
                  </div>
                  
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-indigo-900/0 group-hover:bg-indigo-900/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="bg-white text-indigo-700 px-4 py-2 rounded-xl font-bold text-xs shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all">
                      Abrir para revisar
                    </span>
                  </div>

                  <div className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded-lg">
                    Pág {page.pageNumber}
                  </div>
                </div>
              );
            })}
          </div>
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
