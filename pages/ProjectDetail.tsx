import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Project } from '../types';
import { supabase } from '../supabase';

interface ProjectDetailProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ projects, setProjects }) => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeVersionNumber, setActiveVersionNumber] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [statusText, setStatusText] = useState("");

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
    setStatusText("Iniciando...");
    
    try {
        const nextVer = Math.max(...project.versions.map(v => v.versionNumber), 0) + 1;
        const files = Array.from(e.target.files).sort((a,b) => a.name.localeCompare(b.name, undefined, {numeric:true}));
        
        for (let i = 0; i < files.length; i++) {
            setStatusText(`Subiendo ${i + 1} de ${files.length}...`);
            
            // Limpiamos el nombre del archivo para evitar caracteres raros
            const cleanName = files[i].name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const fileName = `v${nextVer}-${Date.now()}-${i}-${cleanName}`;
            
            // 1. Subir al Storage
            const { error: uploadError } = await supabase.storage.from('brochures').upload(fileName, files[i]);
            
            if(uploadError) {
                console.error("Error Upload:", uploadError);
                throw new Error("Fallo Storage: " + uploadError.message);
            }

            // 2. Obtener URL
            const { data } = supabase.storage.from('brochures').getPublicUrl(fileName);
            
            // 3. Guardar en Base de Datos
            const { error: dbError } = await supabase.from('pages').insert([{
                project_id: project.id, 
                image_url: data.publicUrl, 
                page_number: i+1, 
                version: nextVer, 
                status: `${nextVer}ª corrección`
            }]);

            if(dbError) {
                console.error("Error BD:", dbError);
                throw new Error("Fallo Base de Datos: " + dbError.message);
            }
        }
        setStatusText("¡Éxito! Recargando...");
        setTimeout(() => window.location.reload(), 500);
    } catch(err: any) {
        alert("🛑 ERROR: " + (err.message || JSON.stringify(err)));
        setIsUploading(false);
    }
  };

  const getStatusColor = (status: string) => {
      if(status.includes('1')) return 'bg-amber-100 text-amber-800';
      if(status.includes('2')) return 'bg-orange-100 text-orange-800';
      if(status.includes('3')) return 'bg-rose-100 text-rose-800';
      return 'bg-slate-100 text-slate-600';
  };

  if (!project) return <div className="p-10 font-bold text-slate-400">Cargando proyecto...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <input type="file" ref={fileInputRef} hidden multiple accept="image/*" onChange={handleUpload} />
      
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
             <button onClick={() => navigate(-1)} className="text-2xl hover:bg-white p-2 rounded-full transition">🔙</button>
             <h1 className="text-3xl font-black text-slate-800">{project.name}</h1>
        </div>
        <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className={`px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all ${isUploading ? 'bg-slate-400 cursor-wait' : 'bg-rose-600 hover:bg-rose-700 hover:scale-105'}`}>
            {isUploading ? statusText : 'Subir Nueva Versión 📤'}
        </button>
      </div>
      
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
         {project.versions.sort((a,b)=>a.versionNumber-b.versionNumber).map(v => (
             <button key={v.id} onClick={() => setActiveVersionNumber(v.versionNumber)} className={`px-5 py-2 rounded-xl font-bold border-2 transition-all ${activeVersionNumber === v.versionNumber ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-rose-300'}`}>Versión {v.versionNumber}</button>
         ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 min-h-[500px]">
         {activeVersion ? (
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
                {activeVersion.pages.map(page => (
                    <div key={page.id} onClick={() => navigate(`/project/${project.id}/version/${activeVersion.id}/page/${page.id}`)} className="cursor-pointer group hover:-translate-y-2 transition-transform duration-300">
                        <div className="rounded-2xl overflow-hidden shadow-sm group-hover:shadow-2xl border border-slate-100 bg-slate-50 aspect-[3/4] mb-4 relative">
                            <img src={page.imageUrl} className="w-full h-full object-contain" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                        </div>
                        <p className="text-center font-black text-slate-700">Página {page.pageNumber}</p>
                        <div className="flex justify-center mt-2">
                            <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${getStatusColor(page.status)}`}>{page.status}</span>
                        </div>
                    </div>
                ))}
             </div>
         ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 mt-20">
                <svg className="w-20 h-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <p className="font-bold">No hay páginas en esta versión</p>
            </div>
         )}
      </div>
    </div>
  );
};

export default ProjectDetail;
