import React, { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';

const Dashboard = ({ projects = [], folders = [], onRefresh }: any) => {
  const navigate = useNavigate();
  const { folderId } = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openFolders, setOpenFolders] = useState<Record<number, boolean>>({});
  
  // ESTADO NUEVO: Controla si vemos Lista o Iconos ('list' o 'grid')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const toggleFolder = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenFolders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const safeFolders = Array.isArray(folders) ? folders : [];
  const currentFolders = safeFolders.filter(f => folderId ? String(f.parent_id) === String(folderId) : !f.parent_id);
  const currentItems = projects.filter((p: any) => 
    folderId ? String(p.parent_id) === String(folderId) : !p.parent_id
  );

  const handleDeleteFolder = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (window.confirm("¿Eliminar carpeta?")) {
      await supabase.from('folders').delete().eq('id', id);
      if (onRefresh) onRefresh();
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (window.confirm("¿Eliminar este folleto?")) {
      await supabase.from('projects').delete().eq('id', id);
      if (onRefresh) onRefresh();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const cleanName = `${Date.now()}-${i}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('FOLLETOS')
        .upload(cleanName, file);

      if (uploadError) {
        alert("Error de subida: " + uploadError.message);
        continue;
      }

      const { data: publicUrlData } = supabase.storage
        .from('FOLLETOS')
        .getPublicUrl(cleanName);

      await supabase.from('projects').insert([{ 
        name: file.name, 
        parent_id: folderId ? parseInt(folderId) : null,
        image_url: publicUrlData.publicUrl 
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
              {hasChildren && <span onClick={(e) => toggleFolder(f.id, e)} className="text-[10px]">{isOpen ? '▼' : '▶'}</span>}
              <span className="text-sm">📁 {f.name}</span>
            </div>
            {hasChildren && isOpen && renderFolderTree(f.id, level + 1)}
          </div>
        );
      });
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      {/* SIDEBAR */}
      <div className="w-64 bg-white border-r border-slate-200 p-8 flex flex-col gap-8">
        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Alcampo_logo.svg/2560px-Alcampo_logo.svg.png" alt="Logo" className="h-10 w-fit object-contain" />
        <nav className="flex flex-col gap-2">
          <div onClick={() => navigate('/')} className="flex items-center gap-3 text-slate-800 font-bold text-sm cursor-pointer p-2 hover:bg-slate-50 rounded-xl">🏠 Inicio</div>
          <div className="mt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Estructura</div>
          {renderFolderTree(null)}
        </nav>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 p-10 overflow-y-auto">
        <div className="flex justify-between items-center mb-10 bg-white p-8 rounded-[2rem] shadow-sm border-b-4 border-rose-600">
          <h1 className="text-4xl font-black italic uppercase text-slate-800 tracking-tighter">
            {folderId ? safeFolders.find(f => String(f.id) === String(folderId))?.name.toUpperCase() : "MIS PROYECTOS"}
          </h1>
          <div className="flex gap-4 items-center">
            
            {/* BOTONES DE VISTA (LISTA / ICONOS) */}
            <div className="flex bg-slate-100 p-1 rounded-xl mr-4">
              <button 
                onClick={() => setViewMode('list')} 
                className={`p-3 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow text-rose-600' : 'text-slate-400 hover:text-slate-600'}`}
                title="Vista Lista"
              >
                📄
              </button>
              <button 
                onClick={() => setViewMode('grid')} 
                className={`p-3 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow text-rose-600' : 'text-slate-400 hover:text-slate-600'}`}
                title="Vista Iconos"
              >
                🧱
              </button>
            </div>

            <button onClick={() => {const n = prompt("Nombre:"); if(n) supabase.from('folders').insert([{name:n, parent_id:folderId?parseInt(folderId):null}]).then(()=>onRefresh())}}
              className="px-6 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase shadow-sm">+ CARPETA</button>
            
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple />
            <button onClick={() => fileInputRef.current?.click()} className="px-8 py-3 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg hover:scale-105 transition-all">
              {currentItems.length > 0 ? "SUBIR NUEVA VERSIÓN" : "SUBIR FOLLETOS"}
            </button>
          </div>
        </div>

        {/* ZONA DE CARPETAS (Siempre visible si hay carpetas) */}
        {currentFolders.length > 0 && (
          <div className="grid grid-cols-4 gap-6 mb-10">
            {currentFolders.map(f => (
              <div key={f.id} onClick={() => navigate(`/folder/${f.id}`)} className="group relative bg-white p-8 rounded-[2rem] border border-slate-100 flex flex-col items-center cursor-pointer hover:shadow-lg transition-all">
                <button onClick={(e) => handleDeleteFolder(e, f.id)} className="absolute top-4 right-4 bg-rose-50 text-rose-600 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">✕</button>
                <span className="text-4xl mb-2">📁</span>
                <span className="text-[10px] font-black uppercase text-slate-500">{f.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* ZONA DE ARCHIVOS (FOLLETOS) */}
        {currentItems.length === 0 ? (
          // SI ESTÁ VACÍO: No mostramos tabla ni cabeceras feas, solo un mensaje limpio
          <div className="flex flex-col items-center justify-center py-20 opacity-50">
            <span className="text-6xl mb-4">📂</span>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Carpeta sin folletos</p>
          </div>
        ) : (
          // SI HAY ARCHIVOS: Mostramos según el modo elegido
          viewMode === 'list' ? (
            // VISTA LISTA (TU TABLA ORIGINAL)
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
                          {p.image_url ? <img src={p.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px] text-slate-300 font-bold">IMG</div>}
                        </div>
                      </td>
                      <td className="px-10 py-6 italic font-black text-slate-700 text-lg uppercase tracking-tighter">{p.name}</td>
                      <td className="px-10 py-6 text-right">
                        <div className="flex gap-4 justify-end items-center">
                          <button onClick={(e) => handleDeleteProject(e, p.id)} className="text-slate-300 hover:text-rose-600 transition-colors">✕</button>
                          <button onClick={() => navigate(`/project/${p.id}`)} className="text-rose-600 font-black text-[10px] uppercase tracking-widest">Revisar →</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            // VISTA ICONOS (GRID / CUADRÍCULA)
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
              {currentItems.map((p: any) => (
                <div key={p.id} className="group bg-white rounded-[2rem] border border-slate-100 overflow-hidden hover:shadow-xl transition-all flex flex-col">
                  {/* Imagen Grande */}
                  <div className="aspect-[3/4] bg-slate-50 relative overflow-hidden">
                    {p.image_url ? (
                      <img src={p.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300 font-black italic">SIN IMAGEN</div>
                    )}
                    
                    {/* Botón borrar flotante */}
                    <button 
                      onClick={(e) => handleDeleteProject(e, p.id)}
                      className="absolute top-3 right-3 bg-white/90 text-rose-500 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm font-bold"
                    >
                      ✕
                    </button>
                  </div>
                  
                  {/* Pie de foto */}
                  <div className="p-6 flex flex-col gap-3">
                    <h3 className="font-black italic text-slate-700 uppercase tracking-tight text-sm truncate" title={p.name}>
                      {p.name}
                    </h3>
                    <button 
                      onClick={() => navigate(`/project/${p.id}`)} 
                      className="w-full py-3 bg-slate-50 text-rose-600 rounded-xl font-black text-[10px] uppercase hover:bg-rose-50 transition-colors"
                    >
                      Revisar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default Dashboard;
