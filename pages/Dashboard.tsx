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
  
  // IMPORTANTE: Ahora leemos de la tabla 'projects' pero filtrando por carpeta
  const currentItems = projects.filter((p: any) => 
    folderId ? String(p.parent_id) === String(folderId) : !p.parent_id
  );

  const currentFolder = safeFolders.find((f: any) => String(f.id) === String(folderId));
  const pageTitle = folderId && currentFolder ? currentFolder.name.toUpperCase() : "MIS PROYECTOS";

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split('.').pop();
      const cleanFileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;

      // 1. Subir al Storage
      const { error: uploadError } = await supabase.storage
        .from('FOLLETOS')
        .upload(cleanFileName, file);

      if (uploadError) {
        alert(`Error en Storage: ${uploadError.message}`);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage.from('FOLLETOS').getPublicUrl(cleanFileName);

      // 2. Insertar en 'projects' (Asegúrate de que esta tabla tiene la columna image_url)
      const { error: insertError } = await supabase.from('projects').insert([{ 
        name: file.name, 
        parent_id: folderId ? parseInt(folderId) : null,
        image_url: publicUrl 
      }]);

      if (insertError) {
        alert(`Error en Tabla: ${insertError.message}`);
      }
    }

    if (onRefresh) await onRefresh();
    alert("Subida completada y lista actualizada");
    if (event.target) event.target.value = '';
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
              className={`flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-all ${String(folderId) === String(f.id) ? 'bg-rose-50 text-rose-600 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}
              style={{ paddingLeft: `${level * 12 + 8}px` }}>
              {hasChildren && (
                <span onClick={(e) => toggleFolder(f.id, e)} className="text-[8px]" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
              )}
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
        <img src="/logo.png" alt="Alcampo" className="h-12 w-fit object-contain" />
        <nav className="flex flex-col gap-2">
          <div onClick={() => navigate('/')} className="flex items-center gap-3 text-slate-800 font-bold text-sm cursor-pointer p-2 hover:bg-slate-50 rounded-xl">🏠 Inicio</div>
          <div className="mt-6 text-[10px] font-black uppercase text-slate-400 tracking-widest px-2 border-b border-slate-50 pb-1">Estructura</div>
          {renderFolderTree(null)}
        </nav>
      </div>

      <div className="flex-1 p-12 overflow-y-auto">
        <div className="flex justify-between items-center mb-12 bg-white p-10 rounded-[2.5rem] shadow-sm border-b-4 border-rose-600">
          <h1 className="text-5xl font-black text-slate-800 uppercase italic tracking-tighter">{pageTitle}</h1>
          <div className="flex gap-4">
            <button onClick={() => {const n = prompt("Nombre:"); if(n) supabase.from('folders').insert([{name:n, parent_id:folderId?parseInt(folderId):null}]).then(()=>onRefresh())}}
              className="px-8 py-4 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl font-black text-[11px] uppercase">+ CARPETA</button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple />
            <button onClick={() => fileInputRef.current?.click()} className="px-10 py-4 bg-rose-600 text-white rounded-2xl font-black text-[11px] uppercase shadow-xl hover:scale-105 transition-all">
              {currentItems.length > 0 ? "SUBIR NUEVA VERSIÓN" : "SUBIR FOLLETO"}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-50 text-[11px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/30">
                <th className="px-12 py-8">Vista</th>
                <th className="px-12 py-8">Página</th>
                <th className="px-12 py-8 text-center">Correcciones</th>
                <th className="px-12 py-8 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((p: any) => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="px-12 py-8">
                    <div className="w-20 h-28 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                      {p.image_url ? <img src={p.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-300">IMG</div>}
                    </div>
                  </td>
                  <td className="px-12 py-8 italic font-black text-slate-700 text-2xl uppercase tracking-tighter">{p.name}</td>
                  <td className="px-12 py-8 text-center">
                    <span className="px-5 py-2 rounded-full text-[11px] font-black uppercase bg-slate-100 text-slate-400 tracking-tight">Sin Notas</span>
                  </td>
                  <td className="px-12 py-8 text-right">
                    <button onClick={() => navigate(`/project/${p.id}`)} className="text-rose-600 font-black text-[11px] uppercase tracking-widest hover:mr-2 transition-all">Revisar →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {currentItems.length === 0 && (
            <div className="p-32 text-center text-slate-300 font-black uppercase tracking-widest text-sm italic">No hay folletos aquí. Pulsa el botón rojo para subir uno.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
