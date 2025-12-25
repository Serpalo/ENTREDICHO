import React, { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';

const Dashboard = ({ projects, folders, onRefresh }: any) => {
  const navigate = useNavigate();
  const { folderId } = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // 1. CABECERA DINÁMICA: Busca el nombre de la carpeta actual
  const currentFolder = folders.find((f: any) => String(f.id) === String(folderId));
  const pageTitle = folderId && currentFolder ? currentFolder.name : "MIS PROYECTOS";

  // 2. FILTRADO ANTIDUPLICADOS
  const uniqueProjectIds = new Set();
  const currentProjects = projects.filter((p: any) => {
    const isMatchingFolder = folderId ? String(p.parentId) === String(folderId) : !p.parentId;
    if (isMatchingFolder && !uniqueProjectIds.has(p.id)) {
      uniqueProjectIds.add(p.id);
      return true;
    }
    return false;
  });

  const currentFolders = folders.filter((f: any) => 
    folderId ? String(f.parentId) === String(folderId) : !f.parentId
  );

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return setShowNewFolder(false);
    const { error } = await supabase.from('folders').insert([{ name: newFolderName, parent_id: folderId || null }]);
    if (!error) {
      setNewFolderName("");
      setShowNewFolder(false);
      onRefresh();
    }
  };

  const handleDelete = async (e: React.MouseEvent, type: string, id: string) => {
    e.stopPropagation();
    if (window.confirm(`¿Eliminar permanentemente?`)) {
      if (type === 'projects') await supabase.from('pages').delete().eq('project_id', id);
      await supabase.from(type).delete().eq('id', id);
      onRefresh();
    }
  };

  return (
    <div className="p-10 bg-gray-50 min-h-screen font-sans">
      <input type="file" ref={fileInputRef} hidden multiple accept="image/*" onChange={async (e) => {
        if (!e.target.files?.length) return;
        setIsUploading(true);
        const files = Array.from(e.target.files).sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}));
        const { data: pData } = await supabase.from('projects').insert([{ title: files[0].name.split('.')[0], parent_id: folderId || null }]).select();
        if (pData) {
          for (let i = 0; i < files.length; i++) {
            const fileName = `${Date.now()}-${files[i].name}`;
            await supabase.storage.from('brochures').upload(fileName, files[i]);
            const { data: url } = supabase.storage.from('brochures').getPublicUrl(fileName);
            await supabase.from('pages').insert([{ project_id: pData[0].id, image_url: url.publicUrl, page_number: i + 1, version: 1 }]);
          }
          onRefresh();
          setIsUploading(false);
        }
      }} />

      {/* CABECERA DINÁMICA CON EL NOMBRE DE LA CARPETA */}
      <div className="flex justify-between items-center mb-10 bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
        <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-800 italic">
          {pageTitle}
        </h1>
        <div className="flex gap-4">
          <button onClick={() => setShowNewFolder(true)} className="px-6 py-3 bg-white border-2 border-gray-100 rounded-2xl font-black text-[10px] uppercase tracking-widest">+ Carpeta</button>
          <button onClick={() => fileInputRef.current?.click()} className="px-8 py-3 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-100">
            {isUploading ? 'Procesando...' : 'Subir Folleto'}
          </button>
        </div>
      </div>

      {showNewFolder && (
        <div className="mb-8 p-6 bg-white rounded-[2rem] border-2 border-dashed flex gap-4">
          <input autoFocus className="flex-1 bg-slate-50 p-4 rounded-xl font-bold border-2 focus:border-rose-600 outline-none" placeholder="Nombre..." value={newFolderName} onChange={e => setNewFolderName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateFolder()} />
          <button onClick={handleCreateFolder} className="bg-slate-900 text-white px-8 rounded-xl font-black text-[10px] uppercase">Crear</button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
        {currentFolders.map((f: any) => (
          <div key={f.id} className="group relative">
            <button onClick={(e) => handleDelete(e, 'folders', f.id)} className="absolute -top-2 -right-2 bg-rose-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg z-30 font-bold hover:scale-110 transition-all">✕</button>
            <div onClick={() => navigate(`/folder/${f.id}`)} className="bg-white p-10 rounded-[2.5rem] border-2 border-gray-100 cursor-pointer shadow-sm hover:shadow-2xl transition-all flex flex-col items-center gap-4">
              <div className="text-6xl drop-shadow-sm">📁</div>
              <h3 className="font-black text-[11px] text-slate-700 uppercase tracking-widest text-center">{f.name}</h3>
            </div>
          </div>
        ))}

        {currentProjects.map((p: any) => {
          const latest = p.versions?.[p.versions.length - 1];
          return (
            <div key={p.id} className="group relative">
              <button onClick={(e) => handleDelete(e, 'projects', p.id)} className="absolute -top-2 -right-2 bg-rose-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg z-30 font-bold hover:scale-110 transition-all">✕</button>
              <div onClick={() => navigate(`/project/${p.id}`)} className="bg-white p-5 rounded-[2.5rem] border-2 border-gray-100 cursor-pointer shadow-sm hover:shadow-2xl transition-all flex flex-col h-full">
                <div className="aspect-[3/4] rounded-[2rem] overflow-hidden mb-6 bg-gray-50 border border-gray-50 relative shadow-inner">
                  {latest?.pages?.[0]?.imageUrl && (
                    <img src={latest.pages[0].imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="" />
                  )}
                  <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur text-white px-3 py-1.5 rounded-xl text-[9px] font-black uppercase">
                    V{latest?.versionNumber || 1}
                  </div>
                </div>
                <h3 className="font-black text-xs truncate text-slate-800 uppercase px-2 mb-2 tracking-tighter">{p.name}</h3>
                <div className="flex items-center gap-2 px-2 mt-auto">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">En Revisión</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard;
