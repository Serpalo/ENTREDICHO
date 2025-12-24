import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Project, AppNotification } from '../types';

interface PageReviewProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  addNotification?: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
}

const PageReview: React.FC<PageReviewProps> = ({ projects, setProjects, addNotification }) => {
  const { projectId, versionId, pageId } = useParams<{ projectId: string; versionId: string; pageId: string }>();
  const navigate = useNavigate();
  const [comment, setComment] = useState("");
  
  // 1. Encontrar los datos
  const project = projects.find(p => p.id === projectId);
  
  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 font-bold animate-pulse">Cargando documento...</p>
        </div>
      </div>
    );
  }

  const version = project.versions.find(v => v.id === versionId);
  const page = version?.pages.find(p => p.id === pageId);

  if (!version || !page) return <div className="p-10 text-center">Documento no encontrado</div>;

  // Detectamos si es PDF o imagen
  const isPdf = page.imageUrl.toLowerCase().includes('.pdf');

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col h-screen overflow-hidden">
      {/* Header Simplificado */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <h1 className="font-black text-slate-800 text-lg leading-tight truncate max-w-md">{project.name}</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Visualizando archivo</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <a href={page.imageUrl} target="_blank" rel="noopener noreferrer" className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg text-xs font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors flex items-center gap-2">
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
             Descargar Original
           </a>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Área del Documento */}
        <div className="flex-1 bg-slate-800 overflow-hidden flex items-center justify-center relative">
          
          {isPdf ? (
            /* VISOR PDF (Usando iframe para máxima compatibilidad) */
            <iframe 
              src={page.imageUrl} 
              className="w-full h-full border-none"
              title="Visor PDF"
            />
          ) : (
            /* VISOR IMAGEN */
            <div className="w-full h-full overflow-auto flex items-center justify-center p-10">
               <img src={page.imageUrl} alt="Documento" className="max-w-full max-h-full object-contain shadow-2xl" />
            </div>
          )}

        </div>

        {/* Sidebar Comentarios (Derecha) */}
        <aside className="w-80 bg-white border-l border-slate-200 flex flex-col flex-shrink-0 shadow-xl z-10">
          <div className="p-5 border-b border-slate-100 bg-white">
            <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide mb-1">Notas</h3>
            <p className="text-xs text-slate-400 font-medium">Correcciones sobre este archivo</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
             <div className="text-center py-8 text-slate-400 text-xs italic">
               No hay comentarios aún.
             </div>
          </div>

          <div className="p-4 border-t border-slate-200 bg-white">
            <textarea 
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Escribe una corrección..." 
              className="w-full h-24 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
            <button className="w-full mt-3 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all">
              Añadir Comentario
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default PageReview;
