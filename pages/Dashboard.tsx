import React, { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Project, Folder } from '../types';
import { supabase } from '../supabase';

const Dashboard: React.FC<any> = ({ projects, setProjects, folders, setFolders }) => {
  const navigate = useNavigate();
  const { folderId } = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const currentProjects = projects.filter((p: any) => folderId ? p.parentId === folderId : !p.parentId);
  const currentFolders = folders.filter((f: any) => folderId ? f.parentId === folderId : !f.parentId);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const { data } = await supabase.from('folders').insert([{ name: newFolderName, parent_id: folderId || null }]).select();
    if (data) {
      setFolders([...folders, { id: data[0].id.toString(), name: data[0].name, type: 'folder', parentId: folderId }]);
      setNewFolderName("");
      setShowNewFolder(false);
    }
  };

  const handleFileUpload = async (e: any) => {
    if (!e.target.files?.length) return;
    setIsUploading(true);
    const files = Array.from(e.target.files);
    const name = files[0].name.split('.')[0];
    const { data: pData } = await supabase.from('projects').insert([{ title: name, name: name, status: 'revisión', parent_id: folderId || null }]).select();
    if (pData) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i] as File;
        const fileName = `${Date.now()}-${file.name}`;
        await supabase.storage.from('brochures').upload(fileName, file);
        const { data: url } = supabase.storage.from('brochures').getPublicUrl(fileName);
        await supabase.from('pages').insert([{ project_id: pData[0].id, image_url: url.publicUrl, page_number: i + 1, version: 1 }]);
      }
      window.location.reload();
    }
  };

  return (
    <div className="p-8 min-h-full bg-slate-50 font-sans">
      <input type="file" ref={fileInputRef} hidden multiple accept="image/*" onChange={handleFileUpload} />
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Proyectos</h2>
        <div className="flex gap-3">
          <button onClick={() => setShowNewFolder(true)} className="px-4 py-2 bg-white border font-bold rounded-xl text-xs uppercase">+ Carpeta</button>
          <button onClick={() => fileInputRef.current?.click()} className="px-6 py-2 bg-rose-600 text-white font-bold rounded-xl text-xs uppercase shadow-lg shadow-rose-100">{isUploading ? 'Subiendo...' : 'Subir Folleto'}</button>
        </div>
      </div>
      {showNewFolder && (
        <div className="mb-8 p-6 bg-white rounded-2xl border-2 border-dashed flex items-center gap-4">
          <input autoFocus className="flex-1 bg-slate-50 rounded-xl p-3 font-bold outline-none" placeholder="Nombre..." value={newFolderName} onChange={e => setNewFolderName(e.target.value)} />
          <button onClick={handleCreateFolder} className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold uppercase text-[10px]">Crear</button>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
        {currentFolders.map((f: any) => (
          <div key={f.id} onClick={() => navigate(`/folder/${f.id}`)} className="bg-white border p-6 rounded-2xl cursor-pointer flex flex-col items-center gap-2 hover:shadow-xl transition-all">
            <div className="text-4xl">📁</div>
            <h3 className="font-bold text-xs text-slate-700">{f.name}</h3>
          </div>
        ))}
        {currentProjects.map((p: any) => (
          <div key={p.id} onClick={() => navigate(`/project/${p.id}`)} className="bg-white p-4 rounded-2xl border hover:shadow-2xl cursor-pointer transition-all">
            <div className="aspect-[3/4] bg-slate-100 rounded-xl mb-3 overflow-hidden">
              {p.versions?.[0]?.pages?.[0]?.imageUrl && <img src={p.versions[0].pages[0].imageUrl} className="w-full h-full object-cover" />}
            </div>
            <h3 className="font-bold text-xs truncate text-slate-700 uppercase">{p.name}</h3>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
