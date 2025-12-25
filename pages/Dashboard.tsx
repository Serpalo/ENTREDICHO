import React, { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';

const Dashboard = ({ projects, folders, onRefresh }: any) => {
  const navigate = useNavigate();
  const { folderId } = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Título dinámico: Muestra el nombre de la carpeta (ej: UNICO)
  const currentFolder = folders.find((f: any) => String(f.id) === String(folderId));
  const pageTitle = folderId && currentFolder ? currentFolder.name : "MIS PROYECTOS";

  const handleDelete = async (e: React.MouseEvent, table: string, id: string) => {
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
    setNewFolderName("");
    setShowNewFolder(false);
    onRefresh();
  };

  return (
    <div className="p-10 bg-gray-50 min-h-screen font-sans">
      <div className="flex justify-between items-center mb-10 bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
        <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-800 italic">{pageTitle}</h1>
        <div className="flex gap-4">
          <button onClick={() => setShowNewFolder(true)} className="px-6 py-3 bg-white border-2 border-gray-100 rounded-2xl font-black text-[10px] uppercase tracking-widest">+ Carpeta</button>
          <button onClick={() => fileInputRef.current?.click()} className="px-8 py-3 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-100">SUBIR FOLLETO</button>
        </div>
      </div>

      {showNewFolder && (
        <div className="mb-8 p-6 bg-white rounded-[2rem] border-2 border-dashed flex gap-4 animate-in fade-in">
          <input autoFocus className="flex-1 bg-slate-50 p-4 rounded-xl font-bold border-2 focus:border-rose-600 outline-none" placeholder="Nombre carpeta..." value={newFolderName} onChange={e => setNewFolderName(e.target.value)} />
          <button onClick={handleCreateFolder} className="bg-slate-800 text-white px-8 rounded-xl font-black text-[10px] uppercase">Crear</button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
        {/* Render de Carpetas con botón de borrar (X) */}
        {folders.filter((f: any) => folderId ? String(f.parentId) === String(folderId) : !f.parentId).map((f: any) => (
          <div key={f.id} className="group relative">
            <button onClick={(e) => handleDelete(e, 'folders', f.id)} className="absolute -top-2 -right-2 bg-rose-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg z-30 font-bold hover:scale-110 transition-transform">✕</button>
            <div onClick={() => navigate(`/folder/${f.id}`)} className="bg-white p-10 rounded-[2.5rem] border-2 border-gray-100 cursor-pointer shadow-sm flex flex-col items-center hover:border-rose-200 transition-colors">
              <div className="text-6xl mb-4">📁</div>
              <h3 className="font-black text-[10px] text-slate-700 uppercase tracking-widest">{f.name}</h3>
            </div>
          </div>
        ))}

        {/* Render de Proyectos con botón de borrar (X) */}
        {projects.filter((p: any) => folderId ? String(p.parentId) === String(folderId) : !p.parentId).map((p: any) => {
          const latest = p.versions?.[p.versions.length - 1];
          return (
            <div key={p.id} className="group relative">
              <button onClick={(e) => handleDelete(e, 'projects', p.id)} className="absolute -top-2 -right-2 bg-rose-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg z-30 font-bold hover:scale-110 transition-transform">✕</button>
              <div onClick={() => navigate(`/project/${p.id}`)} className="bg-white p-5 rounded-[2.5rem] border-2 border-gray-100 cursor-pointer shadow-sm flex flex-col h-full hover:border-rose-200 transition-colors">
                <div className="aspect-[3/4] rounded-[2rem] overflow-hidden mb-4 bg-gray-50 border relative">
                  {latest?.pages?.[0]?.imageUrl && <img src={latest.pages[0].imageUrl} className="w-full h-full object-cover" alt="" />}
                  <div className="absolute top-3 right-3 bg-black text-white px-2 py-1 rounded-lg text-[8px] font-black uppercase">V{latest?.versionNumber || 1}</div>
                </div>
                <h3 className="font-black text-xs truncate uppercase px-2 text-slate-800 tracking-tight">{p.name}</h3>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard; // ESTA LÍNEA FINAL ES LA MÁS IMPORTANTE PARA VERCEL
