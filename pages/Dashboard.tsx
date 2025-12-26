import React, { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';

// Añadimos valores por defecto [] para que nunca sean "undefined"
const Dashboard = ({ projects = [], folders = [], onRefresh }: any) => {
  const navigate = useNavigate();
  const { folderId } = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Usamos el símbolo "?" para que si folders es nulo, no se rompa la web
  const currentFolder = folders?.find((f: any) => String(f.id) === String(folderId));
  const pageTitle = folderId && currentFolder ? currentFolder.name.toUpperCase() : "MIS PROYECTOS";

  const handleDelete = async (e: any, table: string, id: string) => {
    e.stopPropagation();
    if (window.confirm("¿Eliminar para siempre?")) {
      if (table === 'projects') await supabase.from('pages').delete().eq('project_id', id);
      await supabase.from(table).delete().eq('id', id);
      if (onRefresh) onRefresh();
    }
  };

  return (
    <div className="p-10 bg-slate-50 min-h-screen font-sans">
      <div className="flex justify-between items-center mb-10 bg-white p-8 rounded-[2rem] shadow-xl border-b-4 border-rose-600">
        <h1 className="text-4xl font-black text-slate-800 italic uppercase tracking-tighter">{pageTitle}</h1>
        <div className="flex gap-4">
          <button onClick={() => setShowNewFolder(true)} className="px-6 py-3 bg-slate-100 rounded-2xl font-black text-[10px] uppercase">+ CARPETA</button>
          <button onClick={() => fileInputRef.current?.click()} className="px-8 py-3 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-rose-200">SUBIR</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
        {/* Renderizado seguro de Carpetas */}
        {folders?.filter((f: any) => folderId ? String(f.parentId) === String(folderId) : !f.parentId).map((f: any) => (
          <div key={f.id} className="relative group">
            <div onClick={() => navigate(`/folder/${f.id}`)} className="bg-white p-10 rounded-[2.5rem] border-2 border-slate-100 cursor-pointer flex flex-col items-center hover:shadow-2xl transition-all">
              <span className="text-6xl mb-4 text-slate-300">📁</span>
              <span className="font-black text-[10px] uppercase text-slate-500 tracking-widest">{f.name}</span>
            </div>
            <button onClick={(e) => handleDelete(e, 'folders', f.id)} className="absolute -top-2 -right-2 bg-rose-600 text-white w-10 h-10 rounded-full border-4 border-white font-bold z-50 shadow-lg">✕</button>
          </div>
        ))}

        {/* Renderizado seguro de Proyectos */}
        {projects?.filter((p: any) => folderId ? String(p.parentId) === String(folderId) : !p.parentId).map((p: any) => {
          const latestVersion = p.versions?.[p.versions.length - 1];
          return (
            <div key={p.id} className="relative group">
              <div onClick={() => navigate(`/project/${p.id}`)} className="bg-white p-5 rounded-[2.5rem] border-2 border-slate-100 cursor-pointer flex flex-col h-full hover:shadow-2xl transition-all">
                <div className="aspect-[3/4] rounded-[1.8rem] overflow-hidden mb-4 bg-slate-100 border border-slate-50">
                  {latestVersion?.pages?.[0]?.imageUrl ? (
                    <img src={latestVersion.pages[0].imageUrl} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[8px] font-black text-slate-300 italic uppercase">Sin previa</div>
                  )}
                </div>
                <h3 className="font-black text-xs truncate uppercase px-2 text-slate-800 tracking-tight">{p.name}</h3>
              </div>
              <button onClick={(e) => handleDelete(e, 'projects', p.id)} className="absolute -top-2 -right-2 bg-rose-600 text-white w-10 h-10 rounded-full border-4 border-white font-bold z-50 shadow-lg">✕</button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard;
