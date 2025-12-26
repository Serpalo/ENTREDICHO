import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const ProjectDetail = ({ projects = [] }: any) => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  
  const project = projects.find((p: any) => String(p.id) === String(projectId));

  // Simulamos las páginas del folleto para la vista de lista
  const pages = [
    { id: 1, name: "PÁGINA 1", status: "4 Pendientes", color: "bg-rose-100 text-rose-600" },
    { id: 2, name: "PÁGINA 2", status: "SIN NOTAS", color: "text-slate-400" },
    { id: 3, name: "PÁGINA 3", status: "SIN NOTAS", color: "text-slate-400" },
  ];

  if (!project) return <div className="p-10">Cargando proyecto...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-10">
      {/* CABECERA DE VERSIONES */}
      <div className="flex gap-4 mb-10">
        <button onClick={() => navigate(-1)} className="mr-4 text-slate-400 hover:text-slate-800">← Volver</button>
        <button className="px-6 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-400 text-xs">VERSIÓN 1</button>
        <button className="px-6 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-400 text-xs">VERSIÓN 2</button>
        <button className="px-6 py-2 bg-[#1e293b] text-white rounded-xl font-bold text-xs shadow-lg">VERSIÓN 3</button>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm overflow-hidden border border-slate-100">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <th className="px-10 py-6">Vista</th>
              <th className="px-10 py-6">Página</th>
              <th className="px-10 py-6 text-center">Correcciones</th>
              <th className="px-10 py-6 text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => (
              <tr key={page.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                <td className="px-10 py-6">
                  <div className="w-16 h-20 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden shadow-sm group-hover:scale-105 transition-transform">
                    <span className="text-[8px] text-slate-300">PREVISUALIZACIÓN</span>
                  </div>
                </td>
                <td className="px-10 py-6">
                  <span className="font-black text-slate-700 tracking-tighter text-lg italic">{page.name}</span>
                </td>
                <td className="px-10 py-6 text-center">
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-tight ${page.color}`}>
                    {page.status}
                  </span>
                </td>
                <td className="px-10 py-6 text-right">
                  <button className="text-rose-600 font-black text-[10px] uppercase tracking-widest flex items-center gap-1 ml-auto hover:gap-2 transition-all">
                    Revisar <span className="text-sm">→</span>
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
