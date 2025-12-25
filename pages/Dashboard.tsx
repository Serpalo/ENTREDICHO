import React, { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

  const handleFileUpload = async (e: any) => {
    if (!e.target.files?.length) return;
    setIsUploading(true);
    const files = Array.from(e.target.files);
    const name = files[0].name.split('.')[0];
    const { data: pData } = await supabase.from('projects').insert([{ title: name, name: name, status: '1ª corrección', parent_id: folderId || null }]).select();
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
      <div className="flex justify-between items-center mb-12">
        <h2 className="text-4xl font-black text-slate-800 tracking-tight uppercase">Mis Proyectos</h2>
        <div className="flex gap-4">
          <button onClick={() => setShowNewFolder(true)} className="px-6 py-3 bg-white border border-slate-200 font-bold rounded-2xl text-[10px] uppercase tracking-wider hover:bg-slate-50 transition-all">+ Carpeta</button>
          <button onClick={() => fileInputRef.current?.click()} className="px-8 py-3 bg-rose-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-wider shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all">{isUploading ? 'Subiendo...' : 'Subir Folleto'}</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
        {currentFolders.map((f: any) => (
          <div key={f.id} onClick={() => navigate(`/folder/${f.id}`)} className="bg-white border border-slate-100 p-8 rounded-[2.5rem] cursor-pointer flex flex-col items-center gap-4 transition-all hover:shadow-2xl hover:-translate-y-2">
            <div className="text-5xl">📁</div>
            <h3 className="font-extrabold text-sm text-slate-700 uppercase tracking-tight">{f.name}</h3>
          </div>
        ))}
        {currentProjects.map((p: any) => (
          <div key={p.id} onClick={() => navigate(`/project/${p.id}`)} className="bg-white p-5 rounded-[2.5rem] border border-slate-100 hover:shadow-2xl cursor-pointer transition-all hover:-translate-y-2">
            <div className="aspect-[3/4] bg-slate-50 rounded-[2rem] mb-5 overflow-hidden border border-slate-50">
              {p.versions?.[0]?.pages?.[0]?.imageUrl && <img src={p.versions[0].pages[0].imageUrl} className="w-full h-full object-cover" />}
            </div>
            <h3 className="font-black text-sm truncate text-slate-800 uppercase px-2 mb-2">{p.name}</h3>
            <div className="flex items-center gap-2 px-2">
              <div className="w-2 h-2 rounded-full bg-amber-500"></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">1ª Corrección</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
