import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Project, AppNotification } from '../types';
import { supabase } from '../supabase';

interface ProjectDetailProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  addNotification?: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ projects, setProjects }) => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeVersionNumber, setActiveVersionNumber] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const project = projects.find(p => p.id === projectId);

  useEffect(() => {
    if (project && activeVersionNumber === null && project.versions.length > 0) {
      setActiveVersionNumber(Math.max(...project.versions.map(v => v.versionNumber)));
    }
  }, [project, activeVersionNumber]);

  const activeVersion = project?.versions.find(v => v.versionNumber === activeVersionNumber);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !project) return;
    setIsUploading(true);
    
    try {
        const nextVer = Math.max(...project.versions.map(v => v.versionNumber), 0) + 1;
        const files = Array.from(e.target.files).sort((a,b) => a.name.localeCompare(b.name, undefined, {numeric:true}));
        
        for (let i = 0; i < files.length; i++) {
            const name = `v${nextVer}-${Date.now()}-${i}`;
            const { error } = await supabase.storage.from('brochures').upload(name, files[i]);
            if(error) throw error;
            const { data } = supabase.storage.from('brochures').getPublicUrl(name);
            await supabase.from('pages').insert([{project_id: project.id, image_url: data.publicUrl, page_number: i+1, version: nextVer, status: `${nextVer}ª corrección`}]);
        }
        setTimeout(() => window.location.reload(), 500);
    } catch(err) {
        alert("Error al subir");
        setIsUploading(false);
    }
  };

  if (!project) return <div>Cargando...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <input type="file" ref={fileInputRef} hidden multiple onChange={handleUpload} />
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
             <button onClick={() => navigate(-1)} className="text-2xl">🔙</button>
             <h1 className="text-2xl font-black">{project.name}</h1>
        </div>
        <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="bg-rose-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-rose-700">
            {isUploading ? 'Subiendo...' : 'Añadir Versión'}
        </button>
      </div>
      
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
         {project.versions.sort((a,b)=>a.versionNumber-b.versionNumber).map(v => (
             <button key={v.id} onClick={() => setActiveVersionNumber(v.versionNumber)} className={`px-4 py-2 rounded-lg font-bold border ${activeVersionNumber === v.versionNumber ? 'bg-slate-900 text-white' : 'bg-white text-slate-500'}`}>Versión {v.versionNumber}</button>
         ))}
      </div>

      <div className="bg-white rounded-2xl border shadow-sm p-6">
         {activeVersion ? (
             <div className="grid grid-cols-4 gap-6">
                {activeVersion.pages.map(page => (
                    <div key={page.id} onClick={() => navigate(`/project/${project.id}/version/${activeVersion.id}/page/${page.id}`)} className="cursor-pointer group hover:shadow-lg transition-all p-2 rounded-xl border border-transparent hover:border-slate-200">
                        <img src={page.imageUrl} className="rounded-lg shadow-sm mb-2 bg-slate-100 object-contain aspect-[3/4] w-full" />
                        <p className="text-center font-bold text-sm">Página {page.pageNumber}</p>
                        <p className="text-center text-xs text-slate-500 uppercase bg-slate-100 rounded py-1 mt-1">{page.status}</p>
                    </div>
                ))}
             </div>
         ) : <p className="text-center text-slate-400 py-10">No hay páginas en esta versión</p>}
      </div>
    </div>
  );
};

export default ProjectDetail;
