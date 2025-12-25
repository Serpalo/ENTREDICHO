import React, { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Project, AppNotification } from '../types';
import { supabase } from '../supabase';

interface ProjectDetailProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  addNotification?: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ projects, setProjects, addNotification }) => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const project = projects.find(p => p.id === projectId);

  if (!project) return <div className="p-8 text-center text-slate-400">Proyecto no encontrado</div>;

  // Tomamos la última versión disponible (o la única)
  const currentVersion = project.versions[project.versions.length - 1];
  const pages = currentVersion?.pages || [];

  // --- FUNCIÓN PARA SUBIR NUEVA VERSIÓN (Mantenemos la lógica que ya funcionaba) ---
  const handleNewVersionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setIsUploading(true);
    const files = Array.from(e.target.files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    try {
        const nextVersionNum = project.versions.length + 1;
        
        // Subimos las nuevas páginas
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileName = `v${nextVersionNum}-${Date.now()}-${i}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            await supabase.storage.from('brochures').upload(fileName, file);
            const { data: urlData } = supabase.storage.from('brochures').getPublicUrl(fileName);

            await supabase.from('pages').insert([{
                project_id: project.id,
                image_url: urlData.publicUrl,
                page_number: i + 1,
                version: nextVersionNum,
                status: '1ª corrección'
            }]);
        }
        window.location.reload();
    } catch (error: any) {
        alert("Error: " + error.message);
        setIsUploading(false);
    }
  };

  return (
    <div className="p-8 min-h-full bg-slate-50 font-sans">
      <input type="file" ref={fileInputRef} hidden multiple accept="image/*" onChange={handleNewVersionUpload} />

      {/* CABECERA DEL PROYECTO */}
      <div className="flex justify-between items-end mb-8 border-b border-slate-200 pb-6">
        <div>
            <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-800 text-sm font-bold mb-2 flex items-center gap-1">
                ← Volver
            </button>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">{project.name}</h2>
            <div className="flex gap-2 mt-2">
                <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border border-slate-200">
                    Versión {currentVersion?.versionNumber || 1}
                </span>
                <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border border-amber-200">
                    {pages.length} Páginas
                </span>
            </div>
        </div>
        <button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={isUploading}
            className="px-6 py-3 bg-rose-600 text-white font-bold rounded-xl text-sm shadow-lg shadow-rose-200 hover:bg-rose-700 hover:-translate-y-0.5 transition flex items-center gap-2"
        >
            {isUploading ? 'Subiendo...' : '📂 Subir Nueva Versión'}
        </button>
      </div>

      {/* --- AQUÍ ESTÁ EL CAMBIO: VISTA DE LISTA --- */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Encabezado de la tabla */}
        <div className="grid grid-cols-12 gap-4 p-4 bg-slate-50 border-b border-slate-100 text-xs font-black text-slate-400 uppercase tracking-wider">
            <div className="col-span-1 text-center">Vista</div>
            <div className="col-span-5">Nombre de Página</div>
            <div className="col-span-3">Estado</div>
            <div className="col-span-3 text-right">Acciones</div>
        </div>

        {/* Filas de la lista */}
        <div className="divide-y divide-slate-50">
            {pages.map((page) => (
                <div 
                    key={page.id} 
                    onClick={() => navigate(`/project/${project.id}/version/${currentVersion.id}/page/${page.id}`)}
                    className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                    {/* Miniatura */}
                    <div className="col-span-1 flex justify-center">
                        <div className="w-10 h-14 bg-slate-200 rounded shadow-sm overflow-hidden border border-slate-200">
                            <img src={page.imageUrl} className="w-full h-full object-cover" alt="" />
                        </div>
                    </div>

                    {/* Nombre */}
                    <div className="col-span-5">
                        <p className="font-bold text-slate-800 text-sm">Página {page.pageNumber}</p>
                        <p className="text-xs text-slate-400">Versión {page.version}</p>
                    </div>

                    {/* Estado */}
                    <div className="col-span-3">
                        <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border border-yellow-200">
                            {page.status || 'Pendiente'}
                        </span>
                    </div>

                    {/* Botón Acción */}
                    <div className="col-span-3 text-right">
                        <button className="text-rose-600 font-bold text-xs hover:bg-rose-50 px-4 py-2 rounded-lg transition-colors group-hover:bg-white group-hover:shadow-sm border border-transparent group-hover:border-slate-100">
                            Revisar ➔
                        </button>
                    </div>
                </div>
            ))}
        </div>

        {pages.length === 0 && (
            <div className="p-10 text-center text-slate-400 italic">
                No hay páginas en esta versión.
            </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDetail;
