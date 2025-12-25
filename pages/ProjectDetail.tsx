import React, { useRef, useState, useEffect } from 'react';
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
  
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});
  // ESTADO NUEVO: Para saber qué versión estamos viendo (por defecto null = la última)
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const project = projects.find(p => p.id === projectId);

  // LÓGICA DE VERSIONES
  // 1. Ordenamos las versiones por número (1, 2, 3...)
  const sortedVersions = project?.versions.sort((a, b) => a.versionNumber - b.versionNumber) || [];
  // 2. Decidimos cuál mostrar: la seleccionada o la última disponible
  const currentVersion = selectedVersionId 
    ? sortedVersions.find(v => v.id === selectedVersionId) 
    : sortedVersions[sortedVersions.length - 1];
    
  const pages = currentVersion?.pages || [];

  // EFECTO: Cargar correcciones cada vez que cambian las páginas (al cambiar de versión)
  useEffect(() => {
    if (pages.length > 0) {
       const pageIds = pages.map(p => p.id);
       fetchPendingCounts(pageIds);
    }
  }, [pages]);

  const fetchPendingCounts = async (ids: string[]) => {
      const { data } = await supabase
        .from('comments')
        .select('page_id')
        .eq('resolved', false)
        .in('page_id', ids);

      if (data) {
          const counts: Record<string, number> = {};
          ids.forEach(id => counts[id] = 0);
          data.forEach((c: any) => {
              if (counts[c.page_id] !== undefined) counts[c.page_id]++;
          });
          setPendingCounts(counts);
      }
  };

  const handleNewVersionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!project || !e.target.files?.length) return;
    setIsUploading(true);
    const files = Array.from(e.target.files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    try {
        const nextVersionNum = project.versions.length + 1;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileName = `v${nextVersionNum}-${Date.now()}-${i}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            await supabase.storage.from('brochures').upload(fileName, file);
            const { data: urlData } = supabase.storage.from('brochures').getPublicUrl(fileName);

            await supabase.from('pages').insert([{
                project_id: project.id, image_url: urlData.publicUrl, page_number: i + 1, version: nextVersionNum, status: '1ª corrección'
            }]);
        }
        window.location.reload();
    } catch (error: any) {
        alert("Error: " + error.message);
        setIsUploading(false);
    }
  };

  if (!project) return <div className="p-8 text-center text-slate-400">Proyecto no encontrado</div>;

  return (
    <div className="p-8 min-h-full bg-slate-50 font-sans">
      <input type="file" ref={fileInputRef} hidden multiple accept="image/*" onChange={handleNewVersionUpload} />

      {/* CABECERA */}
      <div className="flex justify-between items-end mb-8 border-b border-slate-200 pb-6">
        <div>
            <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-800 text-sm font-bold mb-2 flex items-center gap-1">← Volver</button>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-3">{project.name}</h2>
            
            {/* SELECTOR DE VERSIONES (AQUÍ ESTÁ LA MAGIA) */}
            <div className="flex items-center gap-3">
                <div className="relative">
                    <select 
                        value={currentVersion?.id} 
                        onChange={(e) => setSelectedVersionId(e.target.value)}
                        className="appearance-none bg-slate-800 text-white pl-4 pr-10 py-2 rounded-lg font-bold text-sm cursor-pointer hover:bg-slate-700 transition shadow-lg shadow-slate-200 outline-none focus:ring-2 focus:ring-rose-500"
                    >
                        {sortedVersions.map(v => (
                            <option key={v.id} value={v.id}>Versión {v.versionNumber}</option>
                        ))}
                    </select>
                    {/* Flechita personalizada para el select */}
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-white">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                </div>

                <span className="bg-amber-100 text-amber-700 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide border border-amber-200">
                    {pages.length} Páginas
                </span>
            </div>
        </div>
        
        <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="px-6 py-3 bg-rose-600 text-white font-bold rounded-xl text-sm shadow-lg shadow-rose-200 hover:bg-rose-700 hover:-translate-y-0.5 transition flex items-center gap-2">
            {isUploading ? 'Subiendo...' : '📂 Subir Nueva Versión'}
        </button>
      </div>

      {/* TABLA DE PÁGINAS */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-12 gap-4 p-4 bg-slate-50 border-b border-slate-100 text-xs font-black text-slate-400 uppercase tracking-wider text-center md:text-left">
            <div className="col-span-1 text-center">Vista</div>
            <div className="col-span-4">Nombre de Página</div>
            <div className="col-span-2 text-center">Correcciones</div>
            <div className="col-span-2 text-center">Estado</div>
            <div className="col-span-3 text-right">Acciones</div>
        </div>

        <div className="divide-y divide-slate-50">
            {pages.map((page) => {
                const pending = pendingCounts[page.id] || 0;
                return (
                    <div 
                        key={page.id} 
                        onClick={() => navigate(`/project/${project.id}/version/${currentVersion?.id}/page/${page.id}`)}
                        className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                        <div className="col-span-1 flex justify-center">
                            <div className="w-10 h-14 bg-slate-200 rounded shadow-sm overflow-hidden border border-slate-200 relative">
                                <img src={page.imageUrl} className="w-full h-full object-cover" alt="" />
                                {pending > 0 && <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border border-white"></div>}
                            </div>
                        </div>

                        <div className="col-span-4">
                            <p className="font-bold text-slate-800 text-sm truncate">Página {page.pageNumber}</p>
                            <p className="text-xs text-slate-400">Versión {page.version}</p>
                        </div>

                        <div className="col-span-2 flex justify-center">
                            {pending > 0 ? (
                                <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs font-bold border border-red-200 flex items-center gap-1">
                                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                                    {pending} Pendientes
                                </span>
                            ) : (
                                <span className="text-emerald-500 text-xs font-bold flex items-center gap-1">✓ Ok</span>
                            )}
                        </div>

                        <div className="col-span-2 flex justify-center">
                            <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border border-yellow-200 text-center">
                                {page.status || 'En curso'}
                            </span>
                        </div>

                        <div className="col-span-3 text-right">
                            <button className="text-rose-600 font-bold text-xs hover:bg-rose-50 px-4 py-2 rounded-lg transition-colors group-hover:bg-white group-hover:shadow-sm border border-transparent group-hover:border-slate-100">
                                Revisar ➔
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
        {pages.length === 0 && <div className="p-10 text-center text-slate-400 italic">No hay páginas en esta versión.</div>}
      </div>
    </div>
  );
};

export default ProjectDetail;
