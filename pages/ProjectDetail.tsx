import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';

const ProjectDetail: React.FC<any> = ({ projects }) => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const [activeVersionNum, setActiveVersionNum] = useState<number | null>(null);
  const [pageCommentsCount, setPageCommentsCount] = useState<Record<string, {total: number, resolved: number}>>({});

  const project = projects.find((p: any) => p.id === projectId);

  useEffect(() => {
    const fetchStats = async () => {
      if (!project) return;
      const { data } = await supabase.from('comments').select('page_id, resolved');
      if (data) {
        const stats: any = {};
        data.forEach((c: any) => {
          if (!stats[c.page_id]) stats[c.page_id] = { total: 0, resolved: 0 };
          stats[c.page_id].total++;
          if (c.resolved) stats[c.page_id].resolved++;
        });
        setPageCommentsCount(stats);
      }
    };
    fetchStats();
  }, [project]);

  if (!project) return <div className="p-8 font-black text-slate-400 italic">Sincronizando...</div>;

  const sortedVersions = [...project.versions].sort((a, b) => b.versionNumber - a.versionNumber);
  const currentVersion = activeVersionNum 
    ? project.versions.find((v: any) => v.versionNumber === activeVersionNum) 
    : sortedVersions[0];

  const handleUploadNewVersion = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e: any) => {
      const files = Array.from(e.target.files);
      setIsUploading(true);
      const nextVer = project.versions.length + 1;
      for (let i = 0; i < files.length; i++) {
        const file = files[i] as File;
        const fileName = `v${nextVer}-${Date.now()}-${file.name}`;
        await supabase.storage.from('brochures').upload(fileName, file);
        const { data: url } = supabase.storage.from('brochures').getPublicUrl(fileName);
        await supabase.from('pages').insert([{ project_id: project.id, image_url: url.publicUrl, page_number: i + 1, version: nextVer }]);
      }
      window.location.reload();
    };
    input.click();
  };

  return (
    <div className="p-8 bg-slate-50 min-h-full font-sans">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-600 font-bold uppercase text-[10px]">← Volver</button>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight">{project.name}</h1>
        </div>
        <button onClick={handleUploadNewVersion} disabled={isUploading} className="bg-rose-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg flex items-center gap-2">
          {isUploading ? 'Subiendo...' : '📂 Subir Nueva Versión'}
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          {project.versions.map((v: any) => (
            <button
              key={v.id}
              onClick={() => setActiveVersionNum(v.versionNumber)}
              className={`px-5 py-2 rounded-xl font-black text-xs uppercase transition-all border ${
                currentVersion?.versionNumber === v.versionNumber ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-400 border-slate-200'
              }`}
            >
              Versión {v.versionNumber}
            </button>
          ))}
        </div>

        <table className="w-full">
          <thead>
            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <th className="px-8 py-4 text-left w-24">Vista</th>
              <th className="px-8 py-4 text-left">Página</th>
              <th className="px-8 py-4 text-center">Correcciones</th>
              <th className="px-8 py-4 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {currentVersion?.pages.map((page: any) => {
              const stats = pageCommentsCount[page.id] || { total: 0, resolved: 0 };
              const pending = stats.total - stats.resolved;
              return (
                <tr key={page.id} className="group hover:bg-slate-50 transition-all">
                  <td className="px-8 py-4">
                    <div className="w-12 h-16 rounded-lg bg-slate-100 border overflow-hidden shadow-sm">
                      <img src={page.imageUrl} className="w-full h-full object-cover" />
                    </div>
                  </td>
                  <td className="px-8 py-4 font-bold text-slate-700 uppercase">Página {page.pageNumber}</td>
                  <td className="px-8 py-4 text-center">
                    {stats.total === 0 ? (
                      <span className="text-slate-300 text-[10px] font-bold uppercase italic">Sin notas</span>
                    ) : pending === 0 ? (
                      <span className="text-emerald-500 text-xs font-black">✓ OK</span>
                    ) : (
                      <span className="bg-rose-100 text-rose-600 px-3 py-1 rounded-lg text-[10px] font-black">{pending} Pendientes</span>
                    )}
                  </td>
                  <td className="px-8 py-4 text-right">
                    <Link to={`/project/${project.id}/version/${currentVersion.id}/page/${page.id}`} className="text-rose-600 font-black text-[10px] uppercase">Revisar →</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProjectDetail;
