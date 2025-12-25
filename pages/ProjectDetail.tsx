import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

const ProjectDetail: React.FC<any> = ({ projects }) => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const project = projects.find((p: any) => p.id === projectId);

  if (!project) return <div className="p-8 font-bold text-slate-400 italic">Sincronizando...</div>;

  const currentVersion = project.versions[project.versions.length - 1];

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
        <button onClick={() => navigate(-1)} className="text-slate-400 font-bold uppercase text-[10px]">← Volver</button>
        <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">{project.name}</h1>
        <button onClick={handleUploadNewVersion} disabled={isUploading} className="bg-rose-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-rose-100">
          {isUploading ? 'Subiendo...' : '📂 Nueva Versión'}
        </button>
      </div>
      <div className="bg-white rounded-3xl border overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400">Página</th>
              <th className="px-8 py-4 text-right text-[10px] font-black uppercase text-slate-400">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currentVersion?.pages.map((page: any) => (
              <tr key={page.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-8 py-4 font-bold text-slate-700 uppercase">Página {page.pageNumber}</td>
                <td className="px-8 py-4 text-right">
                  <button onClick={() => navigate(`/project/${project.id}/version/${currentVersion.id}/page/${page.id}`)} className="text-rose-600 font-black text-[10px] uppercase tracking-widest">Revisar →</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProjectDetail;
