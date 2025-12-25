import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Project, AppNotification } from '../types';
import { supabase } from '../supabase';

interface ProjectDetailProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  addNotification?: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
}

const STATUS_COLORS: Record<string, string> = {
  '1ª corrección': 'bg-amber-100 text-amber-700 border-amber-200',
  '2ª corrección': 'bg-orange-100 text-orange-700 border-orange-200',
  '3ª corrección': 'bg-rose-100 text-rose-700 border-rose-200',
  '4ª corrección': 'bg-purple-100 text-purple-700 border-purple-200',
  '5ª corrección': 'bg-violet-100 text-violet-700 border-violet-200',
  'Imprenta': 'bg-emerald-100 text-emerald-700 border-emerald-200'
};

const ProjectDetail: React.FC<ProjectDetailProps> = ({ projects, setProjects }) => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [activeVersionNumber, setActiveVersionNumber] = useState<number | null>(null);
  const [isUploadingVersion, setIsUploadingVersion] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState("Preparando...");
  const [showUploadModal, setShowUploadModal] = useState(false);

  const project = projects.find(p => p.id === projectId);

  useEffect(() => {
    if (project && activeVersionNumber === null && project.versions.length > 0) {
      setActiveVersionNumber(Math.max(...project.versions.map(v => v.versionNumber)));
    }
  }, [project, activeVersionNumber]);

  const activeVersion = project?.versions.find(v => v.versionNumber === activeVersionNumber);

  const handleNewVersionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !project) return;
    setIsUploadingVersion(true);
    setUploadStatusText("Iniciando carga...");

    try {
        const maxV = Math.max(...project.versions.map(v => v.versionNumber), 0);
        const nextVersionNum = maxV + 1;
        const automaticStatus = `${nextVersionNum}ª corrección`;
        const files = Array.from(e.target.files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setUploadStatusText(`Subiendo ${i + 1}/${files.length}...`);
            const fileName = `v${nextVersionNum}-${Date.now()}-${i}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            const { error: uploadError } = await supabase.storage.from('brochures').upload(fileName, file);
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from('brochures').getPublicUrl(fileName);
            await supabase.from('pages').insert([{ project_id: project.id, image_url: publicUrl, page_number: i + 1, version: nextVersionNum, status: automaticStatus }]);
        }
        setUploadStatusText("¡Listo!");
        setTimeout(() => window.location.reload(), 500);
    } catch (err) {
        alert("Error subiendo");
        setIsUploadingVersion(false);
    } 
  };

  const getStatusColor = (status: string) => STATUS_COLORS[status] || 'bg-slate-100 text-slate-600 border-slate-200';

  if (!project) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-400">Cargando...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans relative">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleNewVersionUpload} />
      
      {showUploadModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
                <h3 className="text-lg font-black text-slate-800 mb-4">Nueva Versión</h3>
                <div className="flex gap-3">
                    <button onClick={() => setShowUploadModal(false)} className="flex-1 py-3 bg-slate-100 font-bold rounded-xl">Cancelar</button>
                    <button onClick={() => fileInputRef.current?.click()} disabled={isUploadingVersion} className="flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl shadow-lg hover:bg-rose-700">
                        {isUploadingVersion ? uploadStatusText : 'Seleccionar Archivos'}
                    </button>
                </div>
            </div>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 px-8 py-6 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate(-1)} className="p-2.5 hover:bg-slate-50 rounded-2xl text-slate-400">🔙</button>
              <div><h1 className="text-2xl font-black text-slate-900 tracking-tight">{project.name}</h1></div>
            </div>
            <button onClick={() => setShowUploadModal(true)} className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-xl bg-rose-600 hover:bg-rose-700">Añadir Versión</button>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[...project.versions].sort((a, b) => a.versionNumber - b.versionNumber).map(v => (
                <button key={v.id} onClick={() => setActiveVersionNumber(v.versionNumber)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 ${activeVersionNumber === v.versionNumber ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-100 text-slate-400'}`}>Versión {v.versionNumber}</button>
            ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-10">
        {activeVersion && activeVersion.pages.length > 0 ? (
             <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                 <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50/50 border-b border-slate-100">
                        <tr><th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Orden</th><th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Vista Previa</th><th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Estado</th><th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 text-right">Acciones</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {activeVersion.pages.map((page, index) => (
                            <tr key={page.id} onClick={() => navigate(`/project/${project.id}/version/${activeVersion.id}/page/${page.id}`)} className="cursor-pointer hover:bg-slate-50">
                              <td className="px-8 py-6 text-center font-black text-slate-300">#{index + 1}</td>
                              <td className="px-8 py-6"><div className="flex items-center gap-5"><img src={page.imageUrl} className="w-12 h-12 rounded-xl object-cover bg-slate-100" /><span className="text-sm font-black text-slate-700">Página {page.pageNumber}</span></div></td>
                              <td className="px-8 py-6"><span className={`text-[10px] font-black px-3 py-1 rounded uppercase ${getStatusColor(page.status)}`}>{page.status}</span></td>
                              <td className="px-8 py-6 text-right"><button className="bg-rose-50 text-rose-600 px-5 py-2 rounded-xl font-black text-[10px] uppercase hover:bg-rose-600 hover:text-white transition-all">Revisar</button></td>
                            </tr>
                        ))}
                      </tbody>
                 </table>
             </div>
        ) : <div className="py-20 text-center"><p className="text-slate-400">Sin páginas</p></div>}
      </main>
    </div>
  );
};

export default ProjectDetail;
