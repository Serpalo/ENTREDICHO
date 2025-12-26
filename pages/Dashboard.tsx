import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const Dashboard = ({ projects = [], folders = [], onRefresh }: any) => {
  const navigate = useNavigate();
  const { folderId } = useParams();

  const safeFolders = Array.isArray(folders) ? folders : [];
  const safeProjects = Array.isArray(projects) ? projects : [];

  const currentFolder = safeFolders.find((f: any) => String(f.id) === String(folderId));
  const pageTitle = folderId && currentFolder ? currentFolder.name.toUpperCase() : "MIS PROYECTOS";

  return (
    <div className="p-10 bg-slate-50 min-h-screen font-sans">
      {/* CABECERA ESTILO PREMIUM */}
      <div className="flex justify-between items-center mb-10 bg-white p-8 rounded-[2rem] shadow-xl border-b-4 border-rose-600">
        <h1 className="text-4xl font-black text-slate-800 italic uppercase tracking-tighter">
          {pageTitle}
        </h1>
        <button className="px-8 py-3 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-rose-200 hover:scale-105 transition-transform">
          NUEVO
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
        {/* CARPETAS CON DISEÑO ORIGINAL */}
        {safeFolders
          .filter((f: any) => folderId ? String(f.parentId) === String(folderId) : !f.parentId)
          .map((f: any) => (
            <div key={f.id} onClick={() => navigate(`/folder/${f.id}`)} 
                 className="bg-white p-10 rounded-[2.5rem] border-2 border-slate-100 cursor-pointer flex flex-col items-center hover:shadow-2xl transition-all hover:-translate-y-1">
              <div className="text-6xl mb-4 opacity-80">📁</div>
              <span className="font-black text-[11px] uppercase text-slate-500 tracking-widest text-center">{f.name}</span>
            </div>
          ))}

        {/* PROYECTOS CON DISEÑO ORIGINAL */}
        {safeProjects
          .filter((p: any) => folderId ? String(p.parentId) === String(folderId) : !p.parentId)
          .map((p: any) => (
            <div key={p.id} onClick={() => navigate(`/project/${p.id}`)} 
                 className="bg-white p-5 rounded-[2.5rem] border-2 border-slate-100 cursor-pointer flex flex-col h-full hover:shadow-2xl transition-all hover:-translate-y-1">
              <div className="aspect-[3/4] rounded-[1.8rem] overflow-hidden mb-4 bg-slate-100 flex items-center justify-center">
                <span className="text-5xl opacity-20">📄</span>
              </div>
              <h3 className="font-black text-xs truncate uppercase px-2 text-slate-800 tracking-tight text-center">
                {p.name || "Sin título"}
              </h3>
            </div>
          ))}
      </div>
    </div>
  );
};

export default Dashboard;
