import React, { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';

const Dashboard: React.FC<any> = ({ projects, folders, setFolders }) => {
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
    const files = Array.from(e.target.files).sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}));
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
      
      <div className="flex justify-between items-center mb-12">
        <h2 className="text-4xl font-black text-slate-800 tracking-tight uppercase">Mis Proyectos</h2>
        <div className="flex gap-4">
          <button onClick={() => setShowNewFolder(true)} className="px-6 py-3 bg-white border-2 border-slate-200 font-black rounded-2xl text-[10px] uppercase tracking-wider hover:border-slate-400 transition-all">+ Carpeta</button>
          <button onClick={() => fileInputRef.current?.click()} className="px-8 py-3 bg-rose-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-wider shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all">{isUploading ? 'Subiendo...' : 'Subir Folleto'}</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
        {currentFolders.map((f: any) => (
          <div key={f.id} onClick={() => navigate(`/folder/${f.id}`)} className="bg-white border-2 border-slate-100 p-10 rounded-[2.5rem] cursor-pointer flex flex-col items-center gap-4 transition-all hover:shadow-2xl hover:-translate-y-2">
            <div className="text-6xl drop-shadow-sm">📁</div>
            <h3 className="font-black text-xs text-slate-700 uppercase tracking-widest">{f.name}</h3>
          </div>
        ))}

        {currentProjects.map((p: any) => (
          <div key={p.id} className="group bg-white p-5 rounded-[2.5rem] border-2 border-slate-100 hover:shadow-2xl transition-all flex flex-col h-full">
            {/* Portada del proyecto (clic lleva al detalle general) */}
            <div onClick={() => navigate(`/project/${p.id}`)} className="aspect-[3/4] bg-slate-50 rounded-[2rem] mb-6 overflow-hidden border border-slate-50 shadow-inner relative cursor-pointer">
              {p.versions?.[0]?.pages?.[0]?.imageUrl ? (
                <img src={p.versions[p.versions.length - 1].pages[0].imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300 font-black text-[10px] uppercase italic">Sin previa</div>
              )}
            </div>

            <h3 className="font-black text-sm truncate text-slate-800 uppercase px-2 mb-4 tracking-tighter">{p.name}</h3>
            
            {/* LISTA DE VERSIONES DISPONIBLES */}
            <div className="flex flex-wrap gap-2 px-2 mt-auto">
              {p.versions.map((v: any) => (
                <button
                  key={v.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Al pinchar en una versión específica, vamos al detalle de esa versión
                    navigate(`/project/${p.id}`);
                  }}
                  className="bg-slate-100 hover:bg-slate-800 hover:text-white text-slate-500 px-3 py-1.5 rounded-lg text-[9px] font-black transition-all border border-transparent hover:border-slate-800"
                >
                  V{v.versionNumber}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 px-2 mt-4 pt-4 border-t border-slate-50">
              <div className="w-2 h-2 rounded-full bg-amber-500"></div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                {p.versions.length}ª CORRECCIÓN
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
