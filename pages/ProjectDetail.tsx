import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const ProjectDetail = ({ projects = [] }: any) => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const project = projects.find((p: any) => String(p.id) === String(projectId));

  const pages = [
    { id: 1, name: "PÁGINA 1", status: "4 Pendientes", color: "bg-rose-100 text-rose-600" },
    { id: 2, name: "PÁGINA 2", status: "SIN NOTAS", color: "text-slate-400" },
    { id: 3, name: "PÁGINA 3", status: "SIN NOTAS", color: "text-slate-400" },
  ];

  if (!project) return <div className="p-10 font-black italic uppercase text-slate-400">Cargando folleto...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-10 font-sans">
      <div className="flex gap-4 mb-10 items-center">
        <button onClick={() => navigate(-1)} className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-all">←</button>
        <button className="px-6 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-400 text-[10px] uppercase tracking-widest">Versión 1</button>
        <button className="px-6 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-400 text-[10px] uppercase tracking-widest">Versión 2</button>
        <button className="px-6 py-2 bg-[#1e293b] text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-slate-200">Versión 3</button>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm overflow-hidden border border-slate-100">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">
              <th className="px-10 py-6">Vista</th>
              <th className="px-10 py-6">Página</th>
              <th className="px-10 py-6 text-center">Correcciones</th>
              <th className="px-10 py-6 text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => (
              <tr key={page.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                <td className="px-10 py-6">
                  <div className="w-16 h-20 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform">
                    <span className="text-[10px] text-slate-300 font-bold">P{page.id}</span>
                  </div>
                </td>
                <td className="px-10 py-6 italic font-black text-slate-700 tracking-tighter text-xl uppercase">{page.name}</td>
                <td className="px-10 py-6 text-center">
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-tight ${page.color}`}>
                    {page.status}
                  </span>
                </td>
                <td className="px-10 py-6 text-right">
                  <button className="text-rose-600 font-black text-[10px] uppercase tracking-widest flex items-center gap-1 ml-auto hover:gap-2 transition-all">
                    Revisar →
                  </button>
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
