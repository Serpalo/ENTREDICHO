import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Project } from '../types';
import { supabase } from '../supabase';

interface ProjectDetailProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  addNotification?: (n: any) => void;
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ projects, setProjects }) => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const project = projects.find(p => p.id === projectId);

  if (!project) return <div className="p-8">Cargando proyecto...</div>;

  // --- FUNCIÓN PARA GENERAR EL TEXTO DE CORRECCIÓN DINÁMICO ---
  const getVersionStatusText = (versionNumber: number) => {
    if (project.status === 'APROBADO') return 'APROBADO';
    return `${versionNumber}ª CORRECCIÓN`;
  };

  const handleUploadNewVersion = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*';
    
    input.onchange = async (e: any) => {
      const files = Array.from(e.target.files as FileList).sort((a, b) => 
        a.name.localeCompare(b.name, undefined, { numeric: true })
      );
      if (!files.length) return;

      const nextVersion = project.versions.length + 1;
      const status = `${nextVersion}ª corrección`;

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const fileName = `v${nextVersion}-${Date.now()}-${i}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          await supabase.storage.from('brochures').upload(fileName, file);
          const { data: urlData } = supabase.storage.from('brochures').getPublicUrl(fileName);
          
          await supabase.from('pages').insert([{
            project_id: project.id,
            image_url: urlData.publicUrl,
            page_number: i + 1,
            version: nextVersion,
            status: status
          }]);
        }
        window.location.reload();
      } catch (err) {
        alert("Error al subir nueva versión");
      }
    };
    input.click();
  };

  return (
    <div className="p-8 bg-slate-50 min-h-full">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-600">← Volver</button>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight">{project.name}</h1>
        </div>
        <button 
          onClick={handleUploadNewVersion}
          className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg transition-all flex items-center gap-2"
        >
          📂 Subir Nueva Versión
        </button>
      </div>

      <div className="space-y-12">
        {[...project.versions].sort((a, b) => b.versionNumber - a.versionNumber).map((version) => (
          <div key={version.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-8 py-5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <span className="bg-slate-800 text-white px-4 py-1.5 rounded-xl font-black text-sm uppercase tracking-wider">
                  Versión {version.versionNumber}
                </span>
                <span className="text-slate-400 font-bold px-3 py-1 border border-slate-200 rounded-lg text-xs">
                  {version.pages.length} PÁGINAS
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                    <th className="px-8 py-4 text-left w-24">Vista</th>
                    <th className="px-8 py-4 text-left">Nombre de página</th>
                    <th className="px-8 py-4 text-left">Estado</th>
                    <th className="px-8 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {version.pages.map((page) => (
                    <tr key={page.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-4">
                        <div className="w-12 h-16 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shadow-sm">
                          <img src={page.imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <div className="font-bold text-slate-700">Página {page.pageNumber}</div>
                        <div className="text-[10px] text-slate-400 font-medium">Versión {version.versionNumber}</div>
                      </td>
                      <td className="px-8 py-4">
                        {/* ETIQUETA DINÁMICA: 1ª CORRECCIÓN, 2ª CORRECCIÓN, etc. */}
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm border
                          ${project.status === 'APROBADO' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                          {getVersionStatusText(version.versionNumber)}
                        </span>
                      </td>
                      <td className="px-8 py-4 text-right">
                        <Link 
                          to={`/project/${project.id}/version/${version.versionNumber}/page/${page.id}`}
                          className="inline-flex items-center gap-2 text-rose-600 font-black text-xs hover:gap-3 transition-all"
                        >
                          Revisar →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectDetail;
