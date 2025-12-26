import React, { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';

const Dashboard = ({ projects = [], folders = [], onRefresh }: any) => {
  const navigate = useNavigate();
  const { folderId } = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openFolders, setOpenFolders] = useState<Record<number, boolean>>({});

  const toggleFolder = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenFolders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const safeFolders = Array.isArray(folders) ? folders : [];
  const currentItems = projects.filter((p: any) => 
    folderId ? String(p.parent_id) === String(folderId) : !p.parent_id
  );

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Simplificamos el nombre para evitar el error "Invalid key"
      const cleanName = `${Date.now()}-${i}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('FOLLETOS')
        .upload(cleanName, file);

      if (uploadError) {
        alert("Error de subida: " + uploadError.message);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('FOLLETOS')
        .getPublicUrl(cleanName);

      await supabase.from('projects').insert([{ 
        name: file.name, 
        parent_id: folderId ? parseInt(folderId) : null,
        image_url: publicUrl 
      }]);
    }

    if (onRefresh) await onRefresh();
    alert("Subida completada");
  };

  const renderFolderTree = (parentId: number | null = null, level: number = 0) => {
    return safeFolders
      .filter(f => f.parent_id === parentId)
      .map(f => {
        const hasChildren = safeFolders.some(child => child.parent_id === f.id);
        const isOpen = openFolders[f.id];
        return (
          <div key={f.id} className="flex flex-col">
            <div onClick={() => navigate(`/folder/${f.id}`)}
              className={`flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer ${String(folderId) === String(f.id) ? 'bg-rose-50 text-rose-600 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}
              style={{ paddingLeft: `${level * 12 + 8}px` }}>
              {hasChildren && <span onClick={(e) => toggleFolder(f.id, e)} className="text-[8px]">{isOpen ? '▼' : '▶'}</span>}
              <span className="text-sm">📁 {f.name}</span>
            </div>
            {hasChildren && isOpen && renderFolderTree(f.id, level + 1)}
          </div>
        );
      });
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <div className="w-64 bg-white border-r border-slate-200 p-8 flex flex-col gap-8">
        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Alcampo_logo.svg/2560px-Alcampo_logo.svg.png" alt="Logo" className="h-10 w-fit object-contain" />
        <nav className="flex flex-col gap-2">
          <div onClick={() => navigate('/')} className="flex items-center gap-3 text-slate-800 font-bold text-sm cursor-pointer p-2 hover:bg-slate-50 rounded-xl">🏠 Inicio</div>
          <div className="mt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Estructura</div>
          {renderFolderTree(null)}
        </nav>
      </div>

      <div className="flex-1 p-10">
        <div className="flex justify-between items-center mb-10 bg-white p-8 rounded-[2rem] shadow-sm border-b-4 border-rose-600">
          <h1 className="text-4xl font-black italic uppercase text-slate-800 tracking-tighter">
            {folderId ? safeFolders.find(f => String(f.id) === String(folderId))?.name.toUpperCase() : "MIS PROYECTOS"}
          </h1>
          <div className="flex gap-4">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple />
            <button onClick={() => fileInputRef.current?.click()} className="px-8 py-3 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg hover:scale-105 transition-all">
              {currentItems.length > 0 ? "SUBIR NUEVA VERSIÓN" : "SUBIR FOLLETOS"}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-50 text-[10px] font-black text-slate-400 uppercase bg-slate-50/50">
                <th className="px-10 py-6">Vista</th>
                <th className="px-10 py-6">Página</th>
                <th className="px-10 py-6 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((p: any) => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-all">
                  <td className="px-10 py-6">
                    <div className="w-16 h-20 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] text-slate-300 font-bold italic">IMG</div>
                      )}
                    </div>
                  </td>
                  <td className="px-10 py-6 italic font-black text-slate-700 text-lg uppercase tracking-tighter">{p.name}</td>
                  <td className="px-10 py-6 text-right">
                    <button onClick={() => navigate(`/project/${p.id}`)} className="text-rose-600 font-black text-[10px] uppercase tracking-widest hover:mr-1 transition-all">Revisar →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
