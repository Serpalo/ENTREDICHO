import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';

const ProjectDetail: React.FC<any> = ({ projects }) => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const [activeVersionNum, setActiveVersionNum] = useState<number | null>(null);
  const [pageStats, setPageStats] = useState<Record<string, {total: number, resolved: number}>>({});

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
        setPageStats(stats);
      }
    };
    fetchStats();
  }, [project]);

  if (!project) return <div className="p-8 font-black text-slate-400 italic uppercase text-xs">Sincronizando...</div>;

  const sortedVersions = [...project.versions].sort((a, b) => b.versionNumber - a.versionNumber);
  const currentVersion = activeVersionNum 
    ? project.versions.find((v: any) => v.versionNumber === activeVersionNum) 
    : sortedVersions[0];

  const getCorrectionName = (num: number) => {
    if (num === 1) return "1ª CORRECCIÓN";
    if (num === 2) return "2ª CORRECCIÓN";
    if (num === 3) return "3ª CORRECCIÓN";
    return `${num}ª CORRECCIÓN`;
  };

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
          <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-600 font-bold uppercase text-[10px] tracking-widest transition-colors">← Volver</button>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight leading-none">{project.name}</h1>
        </div>
        <button onClick={handleUploadNewVersion} disabled={isUploading} className="bg-rose-600 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase shadow-xl shadow-rose-200 hover:bg-rose-700 transition-all">
          {isUploading ? 'Subiendo...' : '📂 Nueva Versión'}
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        {/* SELECTOR DE VERSIONES */}
        <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-200 flex items-center gap-3">
          {project.versions.map((v: any) => (
            <button
              key={v.id}
              onClick={() => setActiveVersionNum(v.versionNumber)}
              className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all border-2 ${
                currentVersion?.versionNumber === v.versionNumber 
                ? 'bg-slate-800 text-white border-slate-800 shadow-lg' 
                : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
              }`}
            >
              V{v.versionNumber}
            </button>
          ))}
        </div>

        <table className="w-full">
          <thead>
            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white">
              <th className="px-8 py-5 text-left w-32">Vista</th>
              <th className="px-8 py-5 text-left">Página</th>
              <th className="px-8 py-5 text-center">Estado</th>
              <th className="px-8 py-5 text-center">Correcciones</th>
              <th className="px-8 py-5 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {currentVersion?.pages.map((page: any) => {
              const stats = pageStats[page.id] || { total: 0, resolved: 0 };
              const pending = stats.total - stats.resolved;
              return (
                <tr key={page.id} className="group hover:bg-slate-50/80 transition-all">
                  <td className="px-8 py-5">
                    <div 
                      onClick={() => navigate(`/project/${project.id}/version/${currentVersion.id}/page/${page.id}`)}
                      className="w-16 h-20 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shadow-sm cursor-pointer hover:border-rose-400 hover:scale-105 transition-all duration-300"
                    >
                      <img src={page.imageUrl} className="w-full h-full object-cover" alt="" />
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="font-black text-slate-800 uppercase text-sm tracking-tight">Página {page.pageNumber}</span>
                  </td>
                  {/* COLUMNA ESTADO SEPARADA */}
                  <td className="px-8 py-5 text-center">
                    <span className="text-rose-600 font-black text-[10px] tracking-widest uppercase">
                      {getCorrectionName(currentVersion.versionNumber)}
                    </span>
                  </td>
                  {/* COLUMNA CORRECCIONES SEPARADA */}
                  <td className="px-8 py-5 text-center">
                    {stats.total === 0 ? (
                      <span className="text-slate-300 text-[9px] font-black uppercase tracking-widest italic">Sin notas</span>
                    ) : pending === 0 ? (
                      <span className="bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full text-[10px] font-black border border-emerald-100">✓ Revisado</span>
                    ) : (
                      <span className="bg-rose-50 text-rose-600 px-4 py-1.5 rounded-full text-[10px] font-black border border-rose-100">
                        {pending} Pendientes
                      </span>
                    )}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button 
                      onClick={() => navigate(`/project/${project.id}/version/${currentVersion.id}/page/${page.id}`)}
                      className="text-rose-600 font-black text-[10px] uppercase tracking-widest group-hover:translate-x-1 transition-transform inline-block"
                    >
                      Entrar →
                    </button>
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
