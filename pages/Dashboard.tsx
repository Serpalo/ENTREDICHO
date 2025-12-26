import React from 'react';
import { useParams } from 'react-router-dom';

const Dashboard = ({ projects = [], folders = [], onRefresh }: any) => {
  const { folderId } = useParams();

  // Buscamos la carpeta actual para el título
  const currentFolder = folders?.find((f: any) => String(f.id) === String(folderId));
  const pageTitle = folderId && currentFolder ? currentFolder.name.toUpperCase() : "MIS PROYECTOS";

  return (
    <div className="p-10 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center mb-10 bg-white p-8 rounded-3xl shadow-sm border-b-4 border-rose-600">
        <h1 className="text-4xl font-black text-slate-800 italic uppercase">{pageTitle}</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
        {/* Si no hay nada, esto evitará que la pantalla sea blanca */}
        {folders.length === 0 && projects.length === 0 && (
          <p className="col-span-full text-center text-slate-400 font-bold uppercase tracking-widest">
            Cargando datos de Supabase...
          </p>
        )}
        
        {/* Listado de carpetas */}
        {folders.filter((f: any) => folderId ? String(f.parentId) === String(folderId) : !f.parentId).map((f: any) => (
          <div key={f.id} className="bg-white p-10 rounded-[2.5rem] border-2 flex flex-col items-center">
            <span className="text-6xl mb-4 text-slate-300">📁</span>
            <span className="font-black text-[10px] uppercase text-slate-500">{f.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
