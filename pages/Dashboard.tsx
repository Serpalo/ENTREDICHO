import React, { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';

const Dashboard = ({ projects, folders, onRefresh }: any) => {
  const navigate = useNavigate();
  const { folderId } = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Título: Si hay una carpeta seleccionada, busca su nombre real
  const currentFolder = folders.find((f: any) => String(f.id) === String(folderId));
  const pageTitle = folderId && currentFolder ? currentFolder.name : "MIS PROYECTOS";

  const handleDelete = async (e: any, table: string, id: string) => {
    e.stopPropagation();
    if (window.confirm("¿Eliminar permanentemente?")) {
      if (table === 'projects') await supabase.from('pages').delete().eq('project_id', id);
      await supabase.from(table).delete().eq('id', id);
      onRefresh();
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return setShowNewFolder(false);
    await supabase.from('folders').insert([{ name: newFolderName, parent_id: folderId || null }]);
    setNewFolderName(""); setShowNewFolder(false); onRefresh();
  };

  return (
    <div className="p-10 bg-gray-50 min-h-screen font-sans">
      <div className="flex justify-between items-center mb-10 bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
        <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-800 italic">{pageTitle}</h1>
        <div className="flex gap-4">
          <button onClick={() => setShowNewFolder(true)} className="px-6 py-3 bg-white border-2 border-gray-100 rounded-2xl font-black text-[10px] uppercase">+ Carpeta</button>
          <button onClick={() => fileInputRef.current?.click()} className="px-8 py-3 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-rose-100">SUBIR FOLLETO</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
        {/* CARPETAS */}
        {folders.filter((f: any) => folderId ? String(f.parentId) === String(folderId) : !f.parentId).map((f: any) => (
          <div key={f.id} className="group relative">
            <button onClick={(e) => handleDelete(e, 'folders', f.id)} className="absolute -top-2 -right-2 bg-rose-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg z-30 font-bold">✕</button>
            <div onClick={() => navigate(`/folder/${f.id}`)} className="bg-white p-10 rounded-[2.5rem] border-2 border-gray-100 cursor-pointer shadow-sm flex flex-col items-center">
              <div className="text-6xl mb-4">📁</div>
              <h3 className="font-black text-[10px] text-slate-700 uppercase">{f.name}</h3>
            </div>
          </div>
        ))}
        {/* PROYECTOS */}
        {projects.filter((p: any) => folderId ? String(p.parentId) === String(folderId) : !p.parentId).map((p: any) => {
          const latest = p.versions?.[p.versions.length - 1];
          return (
            <div key={p.id} className="group relative">
              <button onClick={(e) => handleDelete(e, 'projects', p.id)} className="absolute -top-2 -right-2 bg-rose-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg z-30 font-bold">✕</button>
              <div onClick={() => navigate(`/project/${p.id}`)} className="bg-white p-5 rounded-[2.5rem] border-2 border-gray-100 cursor-pointer shadow-sm flex flex-col h-full">
                <div className="aspect-[3/4] rounded-[2rem] overflow-hidden mb-4 bg-gray-50 border relative">
                  {latest?.pages?.[0]?.imageUrl && <img src={latest.pages[0].imageUrl} className="w-full h-full object-cover" />}
                  <div className="absolute top-3 right-3 bg-black text-white px-2 py-1 rounded-lg text-[8px] font-black uppercase">V{latest?.versionNumber || 1}</div>
                </div>
                <h3 className="font-black text-xs truncate uppercase px-2">{p.name}</h3>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard; // Crucial: Exportación arreglada
