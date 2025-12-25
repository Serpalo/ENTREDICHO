import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const ProjectDetail = ({ projects }: any) => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const project = projects.find((p: any) => String(p.id) === String(projectId));

  if (!project) return <div className="p-20 text-center font-black text-slate-400 uppercase">Cargando proyecto...</div>;

  const latestVersion = project.versions[project.versions.length - 1];

  return (
    <div className="p-12 bg-white min-h-screen font-sans">
      <div className="flex justify-between items-center mb-12">
        <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tighter italic">{project.name}</h2>
        <button onClick={() => navigate('/')} className="text-slate-400 font-bold uppercase text-[10px]">← Volver</button>
      </div>

      <div className="bg-white rounded-[3rem] border-2 border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 font-black text-[10px] uppercase text-slate-400 tracking-widest">
              <th className="p-8">Vista</th>
              <th className="p-8">Página</th>
              <th className="p-8 text-center">Estado</th>
              <th className="p-8 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {latestVersion?.pages.map((page: any) => (
              <tr key={page.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-6 w-32">
                  <div className="w-16 aspect-[3/4] bg-slate-100 rounded-xl overflow-hidden border">
                    <img src={page.imageUrl} className="w-full h-full object-cover" />
                  </div>
                </td>
                <td className="p-8 font-black text-slate-700 uppercase text-sm">Página {page.pageNumber}</td>
                <td className="p-8 text-center">
                  <span className="text-slate-300 italic text-[10px] font-black uppercase tracking-widest">Sin notas</span>
                </td>
                <td className="p-8 text-right">
                  <button onClick={() => navigate(`/project/${project.id}/version/${latestVersion.id}/page/${page.id}`)} className="text-rose-600 font-black text-[10px] uppercase tracking-widest">Entrar →</button>
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
