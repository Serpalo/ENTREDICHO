import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Project } from '../types';
import { supabase } from '../supabase';

const ProjectDetail: React.FC<{ projects: Project[] }> = ({ projects }) => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const project = projects.find(p => p.id === projectId);

  // Estado para controlar qué versión se está visualizando
  const [activeVersionNum, setActiveVersionNum] = useState<number | null>(null);

  if (!project) return <div className="p-8">Cargando proyecto...</div>;

  // Si no hay versión seleccionada, mostramos la última por defecto
  const sortedVersions = [...project.versions].sort((a, b) => b.versionNumber - a.versionNumber);
  const currentVersion = activeVersionNum 
    ? project.versions.find(v => v.versionNumber === activeVersionNum) 
    : sortedVersions[0];

  const getVersionStatusText = (num: number) => {
    return project.status === 'APROBADO' ? 'APROBADO' : `${num}ª CORRECCIÓN`;
  };

  return (
    <div className="p-8 bg-slate-50 min-h-full">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-600 font-bold">← Volver</button>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight">{project.name}</h1>
        </div>
        <button className="bg-rose-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg">
          📂 Subir Nueva Versión
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* SELECTOR DE VERSIONES (Pestañas al lado izquierdo) */}
        <div className="px-8 py-5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-2">
            {[...project.versions].sort((a, b) => a.versionNumber - b.versionNumber).map((v) => (
              <button
                key={v.id}
                onClick={() => setActiveVersionNum(v.versionNumber)}
                className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all border ${
                  currentVersion?.versionNumber === v.versionNumber
                    ? 'bg-slate-800 text-white border-slate-800 shadow-md scale-105'
                    : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'
                }`}
              >
                Versión {v.versionNumber}
              </button>
            ))}
            <span className="ml-4 text-slate-400 font-bold px-3 py-1 border border-slate-200 rounded-lg text-xs italic">
              {currentVersion?.pages.length} PÁGINAS
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                <th className="px-8 py-4 text-left w-24">Vista</th>
                <th className="px-8 py-4 text-left">Nombre de página</th>
                <th className="px-8 py-4 text-center">Correcciones</th>
                <th className="px-8 py-4 text-center">Estado</th>
                <th className="px-8 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {currentVersion?.pages.map((page) => (
                <tr key={page.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-4">
                    <div className="w-12 h-16 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shadow-sm">
                      <img src={page.imageUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <div className="font-bold text-slate-700">Página {page.pageNumber}</div>
                    <div className="text-[10px] text-slate-400 font-medium">v{currentVersion.versionNumber}</div>
                  </td>
                  <td className="px-8 py-4 text-center">
                     <span className="text-emerald-500 text-xs font-bold">✓ Ok</span>
                  </td>
                  <td className="px-8 py-4 text-center">
                    <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-100">
                      {getVersionStatusText(currentVersion.versionNumber)}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-right">
                    <Link 
                      to={`/project/${project.id}/version/${currentVersion.versionNumber}/page/${page.id}`}
                      className="text-rose-600 font-black text-xs hover:underline"
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
    </div>
  );
};

export default ProjectDetail;
