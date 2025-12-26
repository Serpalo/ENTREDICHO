import React, { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';

const Dashboard = ({ projects = [], folders = [], onRefresh }: any) => {
  const navigate = useNavigate();
  const { folderId } = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estado para controlar qué carpetas están desplegadas en el menú
  const [openFolders, setOpenFolders] = useState<Record<number, boolean>>({});

  const toggleFolder = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenFolders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const safeFolders = Array.isArray(folders) ? folders : [];
  const safeProjects = Array.isArray(projects) ? projects : [];
  const currentFolder = safeFolders.find((f: any) => String(f.id) === String(folderId));
  const pageTitle = folderId && currentFolder ? currentFolder.name.toUpperCase() : "MIS PROYECTOS";

  // Función recursiva para dibujar el árbol de carpetas con flechas
  const renderFolderTree = (parentId: number | null = null, level: number = 0) => {
    return safeFolders
      .filter(f => f.parent_id === parentId)
      .map(f => {
        const hasChildren = safeFolders.some(child => child.parent_id === f.id);
        const isOpen = openFolders[f.id];

        return (
          <div key={f.id} className="flex flex-col">
            <div 
              onClick={() => navigate(`/folder/${f.id}`)}
              className={`flex items-center gap-2 py-1 px-2 rounded-lg cursor-pointer transition-colors ${String(folderId) === String(f.id) ? 'bg-rose-50 text-rose-600' : 'text-slate-500 hover:bg-slate-50'}`}
              style={{ paddingLeft: `${level * 12 + 8}px` }}
            >
              {hasChildren ? (
                <span onClick={(e) => toggleFolder(f.id, e)} className="text-[10px] transition-transform duration-200" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                  ▶
                </span>
              ) : (
                <span className="w-2"></span>
              )}
              <span className="text-sm">📁 {f.name}</span>
            </div>
            {/* Si la carpeta tiene hijos y está abierta, los dibujamos debajo */}
            {hasChildren && isOpen && (
              <div className="flex flex-col">
                {renderFolderTree(f.id, level + 1)}
              </div>
            )}
          </div>
        );
      });
  };

  // ... (Funciones de borrado y subida se mantienen igual que antes)
  const handleDeleteFolder = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (window.confirm("¿Eliminar carpeta?")) {
      await supabase.from('folders').delete().eq('id', id);
      onRefresh();
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (window.confirm("¿Eliminar folleto?")) {
      await supabase.from('projects').delete().eq('id', id);
      onRefresh();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      await supabase.from('projects').insert([{ name: files[i].name, parent_id: folderId ? parseInt(folderId) : null }]);
    }
    onRefresh();
    if (event.target) event.target.value = '';
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      {/* SIDEBAR */}
      <div className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col gap-6 overflow-y-auto">
        <div className="flex items-center mb-4">
          {/* Recuperamos el logo local logo.png */}
          <img src="/logo.png" alt="Logo" className="h-10 object-contain" />
        </div>
        
        <nav className="flex flex-col gap-2">
          <div onClick={() => navigate('/')} className="flex items-center gap-3 text-slate-800 font-bold text-sm cursor-pointer p-2 hover:bg-slate-50 rounded-lg">
            <span>🏠</span> Inicio
          </div>
          
          <div className="mt-4 mb-2 text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">Estructura</div>
          {/* Llamamos a la función del árbol */}
          {renderFolderTree(null)}
        </nav>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 p-10 relative">
        <div className="flex justify-between items-center mb-10 bg-white p-8 rounded-[2rem] shadow-sm border-b-4 border-rose-600 relative z-50">
          <h1 className="text-4xl font-black text-slate-800 uppercase tracking-tighter italic">{pageTitle}</h1>
          <div className="flex gap-4">
            <button 
              onClick={() => {
                const name = prompt("Nombre:");
                if(name) supabase.from('folders').insert([{ name, parent_id: folderId ? parseInt(folderId) : null }]).then(() => onRefresh());
              }}
              className="px-6 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase cursor-pointer hover:bg-slate-50"
            >
              + CARPETA
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple />
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="px-8 py-3 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg cursor-pointer hover:scale-105 transition-all relative z-[9999]"
            >
              SUBIR FOLLETOS
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          {/* CARPETAS EN CUADRICULA */}
          {safeFolders
            .filter((f: any) => folderId ? String(f.parent_id) === String(folderId) : !f.parent_id)
            .map((f: any) => (
              <div key={f.id} onClick={() => navigate(`/folder/${f.id}`)} className="group relative bg-white p-10 rounded-[2.5rem] border border-slate-100 cursor-pointer flex flex-col items-center hover:shadow-xl transition-all">
                <button onClick={(e) => handleDeleteFolder(e, f.id)} className="absolute top-4 right-4 bg-rose-50 text-rose-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all z-10">✕</button>
                <div className="text-6xl mb-4 opacity-80">📁</div>
                <span className="font-black text-[11px] uppercase text-slate-500 tracking-widest text-center">{f.name}</span>
              </div>
            ))}

          {/* FOLLETOS EN CUADRICULA */}
          {safeProjects
            .filter((p: any) => folderId ? String(p.parent_id) === String(folderId) : !p.parent_id)
            .map((p: any) => (
              <div key={p.id} className="group relative bg-white p-6 rounded-[2.5rem] border border-slate-100 flex flex-col items-center hover:shadow-xl transition-all cursor-pointer">
                <button onClick={(e) => handleDeleteProject(e, p.id)} className="absolute top-4 right-4 bg-rose-50 text-rose-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all z-10">✕</button>
                <div onClick={() => navigate(`/project/${p.id}`)} className="w-full flex flex-col items-center">
                  <div className="aspect-[3/4] rounded-[1.8rem] mb-4 bg-slate-50 flex items-center justify-center border border-slate-100 w-full text-4xl opacity-10">📄</div>
                  <h3 className="font-black text-[11px] uppercase text-slate-800 text-center truncate w-full px-2">{p.name}</h3>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
