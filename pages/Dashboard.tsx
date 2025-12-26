import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const Dashboard = ({ projects = [], folders = [], onRefresh }: any) => {
  const navigate = useNavigate();
  const { folderId } = useParams();

  // Filtros seguros para evitar el pantallazo blanco
  const safeFolders = Array.isArray(folders) ? folders : [];
  const safeProjects = Array.isArray(projects) ? projects : [];

  // Título de la carpeta (UNICO)
  const currentFolder = safeFolders.find((f: any) => String(f.id) === String(folderId));
  const pageTitle = folderId && currentFolder ? currentFolder.name.toUpperCase() : "MIS PROYECTOS";

  return (
    <div className="p-10 bg-slate-50 min-h-screen font-sans">
      <div className="flex justify-between items-center mb-10 bg-white p-8 rounded-[2rem] shadow-xl border-b-4 border-rose-600">
        <h1 className="text-4xl font-black text-slate-800 italic uppercase tracking-tighter">
          {pageTitle}
        </h1>
        <button className="px-8 py-3 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg">NUEVO</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
        {/* Renderizado de Carpetas */}
        {safeFolders
          .filter((f: any) => folderId ? String(f.parentId) === String(folderId) : !f.parentId)
          .map((f: any) => (
            <div key={f.id} onClick={() => navigate(`/folder/${f.id}`)} className="bg-white p-10 rounded-[2.5rem] border-2 cursor-pointer flex flex-col items-center hover:shadow-2xl transition-all">
              <span className="text-6xl mb-4 text-slate-200">📁</span>
              <span className="font-black text-[10px] uppercase text-slate-500 tracking-widest">{f.name}</span>
            </div>
          ))}

        {/* Renderizado de Proyectos */}
        {safeProjects
          .filter((p: any) => folderId ? String(p.parentId) === String(folderId) : !p.parentId)
          .map((p: any) => (
            <div key={p.id} onClick={() => navigate(`/project/${p.id}`)} className="bg-white p-10 rounded-[2.5rem] border-2 cursor-pointer flex flex-col items-center hover:shadow-2xl transition-all">
              <span className="text-6xl mb-4 text-rose-100">📄</span>
              <span className="font-black text-[10px] uppercase text-slate-800 text-center">{p.name || "Proyecto"}</span>
            </div>
          ))}
      </div>
    </div>
  );
};

export default Dashboard;
