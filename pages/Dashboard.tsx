import React, { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';

export default function Dashboard({ projects, folders, onRefresh }: any) {
  const navigate = useNavigate();
  const { folderId } = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const currentProjects = projects.filter((p: any) => folderId ? String(p.parentId) === String(folderId) : !p.parentId);
  const currentFolders = folders.filter((f: any) => folderId ? String(f.parentId) === String(folderId) : !f.parentId);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return setShowNewFolder(false);
    const { error } = await supabase.from('folders').insert([{ name: newFolderName, parent_id: folderId || null }]);
    if (!error) {
      setNewFolderName("");
      setShowNewFolder(false);
      onRefresh();
    }
  };

  const handleDeleteFolder = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Evita que al borrar se abra la carpeta
    if (window.confirm("¿Eliminar esta carpeta?")) {
      await supabase.from('folders').delete().eq('id', id);
      onRefresh();
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Evita que al borrar se abra el proyecto
    if (window.confirm("¿Eliminar este proyecto?")) {
      await supabase.from('pages').delete().eq('project_id', id);
      await supabase.from('projects').delete().eq('id', id);
      onRefresh();
    }
  };

  return (
    <div className="p-10 bg-slate-50 min-h-screen font-sans">
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

      <div className="flex justify-between items-center mb-10">
        <h2 className="text-3xl font-black text-slate-800 uppercase italic">Mis Proyectos</h2>
        <div className="flex gap-3">
          <button onClick={() => setShowNewFolder(true)} className="px-6 py-3 bg-white border shadow-sm rounded-2xl font-black text-[10px] uppercase hover:bg-slate-50">+ Carpeta</button>
          <button onClick={() => fileInputRef.current?.click()} className="px-6 py-3 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-rose-200">{isUploading ? 'Subiendo...' : 'Subir Folleto'}</button>
        </div>
      </div>

      {showNewFolder && (
        <div className="mb-8 p-6 bg-white rounded-[2rem] border-2 border-dashed flex gap-4 animate-in fade-in zoom-in duration-200">
          <input autoFocus className="flex-1 bg-slate-50 p-4 rounded-xl font-bold outline-none border-2 focus:border-rose-600" placeholder="Nombre de la carpeta..." value={newFolderName} onChange={e => setNewFolderName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateFolder()} />
          <button onClick={handleCreateFolder} className="bg-slate-800 text-white px-8 rounded-xl font-black text-[10px] uppercase">Crear</button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {/* CARPETAS CON BOTÓN DE BORRAR */}
        {currentFolders.map((f: any) => (
          <div key={f.id} onClick={() => navigate(`/folder/${f.id}`)} className="group bg-white p-8 rounded-[2rem] border cursor-pointer hover:shadow-xl transition-all flex flex-col items-center gap-2 relative">
            <button 
              onClick={(e) => handleDeleteFolder(e, f.id)}
              className="absolute top-4 right-4 bg-rose-50 text-rose-600 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-600 hover:text-white font-bold"
            >
              ✕
            </button>
            <span className="text-5xl">📁</span>
            <span className="font-black text-[10px] uppercase text-slate-600">{f.name}</span>
          </div>
        ))}

        {/* PROYECTOS CON BOTÓN DE BORRAR */}
        {currentProjects.map((p: any) => {
          const latest = p.versions[p.versions.length - 1];
          return (
            <div key={p.id} onClick={() => navigate(`/project/${p.id}`)} className="group bg-white p-4 rounded-[2rem] border hover:shadow-2xl cursor-pointer transition-all flex flex-col relative">
              <button 
                onClick={(e) => handleDeleteProject(e, p.id)}
                className="absolute top-6 right-6 z-20 bg-rose-600 text-white w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg font-bold"
              >
                ✕
              </button>
              <div className="aspect-[3/4] rounded-[1.5rem] overflow-hidden mb-4 border bg-slate-50 relative">
                <img src={latest?.pages[0]?.imageUrl} className="w-full h-full object-cover" alt="" />
                <div className="absolute bottom-3 right-3 bg-slate-900 text-white px-2 py-1 rounded-lg text-[8px] font-black uppercase">V{latest?.versionNumber}</div>
              </div>
              <h3 className="font-black text-[11px] uppercase truncate px-2 mb-1">{p.name}</h3>
              <div className="flex items-center gap-1.5 px-2 mt-auto">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{latest?.versionNumber}ª Corrección</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
