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
  const safeProjects = Array.isArray(projects) ? projects : [];
  const currentFolder = safeFolders.find((f: any) => String(f.id) === String(folderId));
  const pageTitle = folderId && currentFolder ? currentFolder.name.toUpperCase() : "MIS PROYECTOS";

  // --- ÁRBOL LATERAL ---
  const renderFolderTree = (parentId: number | null = null, level: number = 0) => {
    return safeFolders
      .filter(f => f.parent_id === parentId)
      .map(f => {
        const hasChildren = safeFolders.some(child => child.parent_id === f.id);
        const isOpen = openFolders[f.id];
        return (
          <div key={f.id} className="flex flex-col">
            <div onClick={() => navigate(`/folder/${f.id}`)}
              className={`flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors ${String(folderId) === String(f.id) ? 'bg-rose-50 text-rose-600' : 'text-slate-500 hover:bg-slate-50'}`}
              style={{ paddingLeft: `${level * 12 + 8}px` }}>
              {hasChildren ? (
                <span onClick={(e) => toggleFolder(f.id, e)} className="text-[8px]" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
              ) : <span className="w-2"></span>}
              <span className="text-sm font-medium">📁 {f.name}</span>
            </div>
            {hasChildren && isOpen && renderFolderTree(f.id, level + 1)}
          </div>
        );
      });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      await supabase.from('projects').insert([{ name: files[i].name, parent_id: folderId ? parseInt(folderId) : null }]);
    }
    onRefresh();
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      {/* SIDEBAR CON LOGO */}
      <div className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col gap-6">
        <img src="/logo.png" alt="Logo" className="h-10 w-fit object-contain px-2" />
        <nav className="flex flex-col gap-2">
          <div onClick={() => navigate('/')} className="flex items-center gap-3 text-slate-800 font-bold text-sm cursor-pointer p-2 hover:bg-slate-50 rounded-lg">🏠 Inicio</div>
          <div className="mt-4 text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">Estructura</div>
          {renderFolderTree(null)}
        </nav>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 p-10 overflow-y-auto">
        <div className="flex justify-between items-center mb-10 bg-white p-8 rounded-[2rem] shadow-sm border-b-4 border-rose-600">
          <h1 className="text-4xl font-black text-slate-800 uppercase italic tracking-tighter">{pageTitle}</h1>
          <div className="flex gap-4">
            <button onClick={() => {const n = prompt("Nombre:"); if(n) supabase.from('folders').insert([{name:n, parent_id:folderId?parseInt(folderId):null}]).then(()=>onRefresh())}}
              className="px-6 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase shadow-sm">+ CARPETA</button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple />
            <button onClick={() => fileInputRef.current?.click()} className="px-8 py-3 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg">SUBIR FOLLETOS</button>
          </div>
        </div>

        {/* LISTA DE SUB-CARPETAS (SI LAS HAY) */}
        <div className="grid grid-cols-4 gap-6 mb-10">
          {safeFolders.filter(f => folderId ? String(f.parent_id) === String(folderId) : !f.parent_id).map(f => (
            <div key={f.id} onClick={() => navigate(`/folder/${f.id}`)} className="bg-white p-6 rounded-[2rem] border border-slate-100 flex flex-col items-center cursor-pointer hover:shadow-lg transition-all">
              <span className="text-4xl mb-2">📁</span>
              <span className="text-[10px] font-black uppercase text-slate-500">{f.name}</span>
            </div>
          ))}
        </div>

        {/* VISTA DE LISTA PARA LOS PROYECTOS / PÁGINAS */}
        <div className="bg-white rounded-[2.5rem] shadow-sm overflow-hidden border border-slate-100">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">
                <th className="px-10 py-6">Vista</th>
                <th className="px-10 py-6">Página</th>
                <th className="px-10 py-6 text-center">Correcciones</th>
                <th className="px-10 py-6 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {safeProjects.filter(p => folderId ? String(p.parent_id) === String(folderId) : !p.parent_id).map((p) => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-100/50 transition-colors group">
                  <td className="px-10 py-6">
                    <div className="w-12 h-16 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-[8px] text-slate-400">IMG</div>
                  </td>
                  <td className="px-10 py-6 italic font-black text-slate-700 text-lg uppercase tracking-tighter">{p.name}</td>
                  <td className="px-10 py-6 text-center">
                    <span className="px-4 py-1.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-400">Sin Notas</span>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <button onClick={() => navigate(`/project/${p.id}`)} className="text-rose-600 font-black text-[10px] uppercase tracking-widest">Revisar →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {safeProjects.filter(p => folderId ? String(p.parent_id) === String(folderId) : !p.parent_id).length === 0 && (
            <div className="p-20 text-center text-slate-300 font-black uppercase tracking-widest text-xs italic">No hay folletos en esta sección</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
