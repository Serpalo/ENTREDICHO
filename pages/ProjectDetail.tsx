import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Project } from '../types';
import { supabase } from '../supabase';

const ProjectDetail: React.FC<{ projects: Project[], setProjects: React.Dispatch<React.SetStateAction<Project[]>> }> = ({ projects, setProjects }) => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const [activeVersionNum, setActiveVersionNum] = useState<number | null>(null);
  const [pageCommentsCount, setPageCommentsCount] = useState<Record<string, {total: number, resolved: number}>>({});

  const project = projects.find(p => p.id === projectId);

  // --- CARGAR CONTEO DE COMENTARIOS ---
  useEffect(() => {
    const fetchCommentStats = async () => {
      if (!project) return;
      const { data } = await supabase.from('comments').select('page_id, resolved');
      if (data) {
        const stats: Record<string, {total: number, resolved: number}> = {};
        data.forEach(c => {
          if (!stats[c.page_id]) stats[c.page_id] = { total: 0, resolved: 0 };
          stats[c.page_id].total++;
          if (c.resolved) stats[c.page_id].resolved++;
        });
        setPageCommentsCount(stats);
      }
    };
    fetchCommentStats();
  }, [project]);

  if (!project) return <div className="p-8 font-bold text-slate-400">Cargando proyecto...</div>;

  const sortedVersions = [...project.versions].sort((a, b) => b.versionNumber - a.versionNumber);
  const currentVersion = activeVersionNum 
    ? project.versions.find(v => v.versionNumber === activeVersionNum) 
    : sortedVersions[0];

  const getVersionStatusText = (num: number) => {
    return project.status === 'APROBADO' ? 'APROBADO' : `${num}ª CORRECCIÓN`;
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

      setIsUploading(true);
      const nextVersion = project.versions.length + 1;

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const fileName = `v${nextVersion}-${Date.now()}-${i}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          await supabase.storage.from('brochures').upload(fileName, file);
          const { data: urlData } = supabase.storage.from('brochures').getPublicUrl(fileName);
          await supabase.from('pages').insert([{
            project_id: project.id, image_url: urlData.publicUrl, page_number: i + 1, version: nextVersion, status: `${nextVersion}ª corrección`
          }]);
        }
        window.location.reload();
      } catch (err: any) {
        alert("Error: " + err.message);
        setIsUploading(false);
      }
    };
    input.click();
  };

  return (
    <div className="p-8 bg-slate-50 min-h-full font-sans">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-600 font-bold">← Volver</button>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight">{project.name}</h1>
        </div>
        <button 
          onClick={handleUploadNewVersion}
          disabled={isUploading}
          className={`${isUploading ? 'bg-slate-400' : 'bg-rose-600 hover:bg-rose-700'} text-white px-6 py-3 rounded-2xl font-bold shadow-lg flex items-center gap-2`}
        >
          {isUploading ? 'Subiendo...' : '📂 Subir Nueva Versión'}
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          {[...project.versions].sort((a, b) => a.versionNumber - b.versionNumber).map((v) => (
            <button
              key={v.id}
              onClick={() => setActiveVersionNum(v.versionNumber)}
              className={`px-5 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all border ${
                currentVersion?.versionNumber === v.versionNumber ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-400 border-slate-200'
              }`}
            >
              Versión {v.versionNumber}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="px-8 py-4 text-left w-24">Vista</th>
                <th className="px-8 py-4 text-left">Página</th>
                {/* COLUMNA RECUPERADA */}
                <th className="px-8 py-4 text-center">Correcciones</th>
                <th className="px-8 py-4 text-center">Estado</th>
                <th className="px-8 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {currentVersion?.pages.map((page) => {
                const stats = pageCommentsCount[page.id] || { total: 0, resolved: 0 };
                const pending = stats.total - stats.resolved;
                const isOk = stats.total > 0 && pending === 0;

                return (
                  <tr key={page.id} className="group hover:bg-slate-50/50 transition-all cursor-pointer">
                    <td className="px-8 py-4" onClick={() => navigate(`/project/${project.id}/version/${currentVersion.versionNumber}/page/${page.id}`)}>
                      <div className="w-12 h-16 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shadow-sm">
                        <img src={page.imageUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    </td>
                    <td className="px-8 py-4" onClick={() => navigate(`/project/${project.id}/version/${currentVersion.versionNumber}/page/${page.id}`)}>
                      <div className="font-bold text-slate-700">Página {page.pageNumber}</div>
                      <div className="text-[10px] text-slate-400 font-medium tracking-tight uppercase">v{currentVersion.versionNumber}</div>
                    </td>
                    {/* CELDA DE CORRECCIONES RECUPERADA */}
                    <td className="px-8 py-4 text-center">
                      {stats.total === 0 ? (
                        <span className="text-slate-300 text-[10px] font-bold uppercase italic">Sin notas</span>
                      ) : isOk ? (
                        <span className="text-emerald-500 text-xs font-black flex items-center justify-center gap-1">✓ OK</span>
                      ) : (
                        <span className="bg-rose-100 text-rose-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase shadow-sm border border-rose-200">
                          {pending} Pendientes
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-4 text-center">
                      <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-100">
                        {getVersionStatusText(currentVersion.versionNumber)}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <Link to={`/project/${project.id}/version/${currentVersion.versionNumber}/page/${page.id}`} className="text-rose-600 font-black text-xs">Revisar →</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
