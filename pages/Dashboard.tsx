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

  // 1. FILTRADO ESTRICTO: Solo uno por ID y que pertenezca a la carpeta actual
  const uniqueIds = new Set();
  const currentProjects = projects.filter((p: any) => {
    const isCorrectFolder = folderId ? String(p.parentId) === String(folderId) : !p.parentId;
    if (isCorrectFolder && !uniqueIds.has(p.id)) {
      uniqueIds.add(p.id);
      return true;
    }
    return false;
  });

  const currentFolders = folders.filter((f: any) => 
    folderId ? String(f.parentId) === String(folderId) : !f.parentId
  );

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setShowNewFolder(false);
      return;
    }
    const { error } = await supabase.from('folders').insert([{ 
      name: newFolderName, 
      parent_id: folderId || null 
    }]);
    
    if (!error) {
      setNewFolderName("");
      setShowNewFolder(false);
      onRefresh(); // Forzamos recarga de datos
    } else {
      alert("Error al crear: " + error.message);
    }
  };

  const handleDelete = async (e: React.MouseEvent, table: string, id: string) => {
    e.stopPropagation();
    if (window.confirm(`¿Seguro que quieres eliminar este ${table === 'folders' ? 'directorio' : 'proyecto'}?`)) {
      if (table === 'projects') {
        await supabase.from('pages').delete().eq('project_id', id);
      }
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (!error) onRefresh();
    }
  };

  return (
    <div className="p-10 bg-gray-100 min-h-screen font-sans">
      <input 
        type="file" 
        ref={fileInputRef} 
        hidden 
        multiple 
        accept="image/*" 
        onChange={async (e) => {
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
        }} 
      />

      {/* CABECERA */}
      <div className="flex justify-between items-center mb-10 bg-white p-6 rounded-3xl shadow-sm">
        <h1 className="text-2xl font-black uppercase tracking-tighter">Mis Archivos</h1>
        <div className="flex gap-4">
          <button 
            onClick={() => setShowNewFolder(true)} 
            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-xl font-bold text-xs uppercase transition-all"
          >
            + Nueva Carpeta
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()} 
            className="px-6 py-3 bg-rose-600 text-white rounded-xl font-bold text-xs uppercase shadow-lg shadow-rose-200"
          >
            {isUploading ? 'Subiendo...' : 'Subir Proyecto'}
          </button>
        </div>
      </div>

      {/* FORMULARIO CARPETA */}
      {showNewFolder && (
        <div className="mb-8 p-6 bg-white rounded-3xl border-4 border-dashed border-gray-200 flex gap-4">
          <input 
            autoFocus 
            className="flex-1 bg-gray-50 p-4 rounded-xl font-bold border-2 border-transparent focus:border-rose-500 outline-none" 
            placeholder="Nombre de la carpeta..." 
            value={newFolderName} 
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
          />
          <button onClick={handleCreateFolder} className="bg-black text-white px-8 rounded-xl font-bold text-xs uppercase">Crear Ahora</button>
          <button onClick={() => setShowNewFolder(false)} className="text-gray-400 font-bold text-xs uppercase">Cancelar</button>
        </div>
      )}

      {/* REJILLA DE ELEMENTOS */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {/* RENDER CARPETAS */}
        {currentFolders.map((f: any) => (
          <div key={f.id} className="flex flex-col gap-2">
            <div 
              onClick={() => navigate(`/folder/${f.id}`)}
              className="bg-white p-8 rounded-[2rem] border-2 border-transparent hover:border-rose-200 cursor-pointer shadow-sm hover:shadow-xl transition-all flex flex-col items-center justify-center min-h-[160px]"
            >
              <span className="text-6xl mb-2">📁</span>
              <span className="font-black text-[10px] uppercase text-gray-600 text-center">{f.name}</span>
            </div>
            <button 
              onClick={(e) => handleDelete(e, 'folders', f.id)}
              className="bg-red-50 text-red-600 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-red-600 hover:text-white transition-all"
            >
              Eliminar Carpeta
            </button>
          </div>
        ))}

        {/* RENDER PROYECTOS */}
        {currentProjects.map((p: any) => {
          const latest = p.versions?.[p.versions.length - 1];
          return (
            <div key={p.id} className="flex flex-col gap-2">
              <div 
                onClick={() => navigate(`/project/${p.id}`)}
                className="bg-white p-4 rounded-[2rem] border-2 border-transparent hover:border-rose-200 cursor-pointer shadow-sm hover:shadow-xl transition-all flex flex-col"
              >
                <div className="aspect-[3/4] rounded-[1.5rem] overflow-hidden mb-3 bg-gray-100 border relative">
                  {latest?.pages?.[0]?.imageUrl && (
                    <img src={latest.pages[0].imageUrl} className="w-full h-full object-cover" alt="" />
                  )}
                  <div className="absolute top-2 right-2 bg-black text-white px-2 py-1 rounded-md text-[8px] font-bold">
                    V{latest?.versionNumber || 1}
                  </div>
                </div>
                <h3 className="font-black text-[11px] uppercase truncate px-1">{p.name}</h3>
              </div>
              <button 
                onClick={(e) => handleDelete(e, 'projects', p.id)}
                className="bg-red-50 text-red-600 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-red-600 hover:text-white transition-all"
              >
                Eliminar Proyecto
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
