import React, { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';

const Dashboard = ({ projects, folders, onRefresh }: any) => {
  const navigate = useNavigate();
  const { folderId } = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // TÍTULO DINÁMICO ULTRA-COMPROBADO
  const currentFolder = folders.find((f: any) => String(f.id) === String(folderId));
  
  // Si estamos en una carpeta, forzamos que aparezca su nombre o su ID
  const pageTitle = folderId 
    ? (currentFolder ? currentFolder.name.toUpperCase() : `CARPETA: ${folderId}`) 
    : "MIS PROYECTOS";

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

  const handleDelete = async (e: any, table: string, id: string) => {
    e.stopPropagation();
    const confirmacion = window.confirm("¿BORRAR PERMANENTEMENTE?");
    if (confirmacion) {
      if (table === 'projects') await supabase.from('pages').delete().eq('project_id', id);
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) alert("ERROR SUPABASE: " + error.message);
      onRefresh();
    }
  };

  return (
    <div className="p-10 bg-slate-50 min-h-screen font-sans">
      <div className="flex justify-between items-center mb-10 bg-white p-8 rounded-[2rem] shadow-xl border-b-4 border-rose-500">
        <h1 className="text-4xl font-black text-slate-800 italic tracking-tighter">
            {pageTitle}
        </h1>
        <div className="flex gap-4">
          <button onClick={() => setShowNewFolder(true)} className="px-6 py-3 bg-slate-100 rounded-2xl font-black text-[10px] uppercase border-2 border-slate-200">+ CARPETA</button>
          <button onClick={() => fileInputRef.current?.click()} className="px-8 py-3 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-rose-200">SUBIR FOLLETO</button>
        </div>
      </div>

      {/* RENDER DE CARPETAS CON BOTÓN SIEMPRE VISIBLE */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
        {currentFolders.map((f: any) => (
          <div key={f.id} className="relative group">
            <div onClick={() => navigate(`/folder/${f.id}`)} className="bg-white p-10 rounded-[2.5rem] border-2 border-slate-100 cursor-pointer shadow-sm hover:shadow-2xl transition-all flex flex-col items-center">
              <span className="text-6xl mb-4">📁</span>
              <span className="font-black text-[10px] uppercase text-slate-500">{f.name}</span>
            </div>
            <button 
              onClick={(e) => handleDelete(e, 'folders', f.id)}
              className="absolute -top-2 -right-2 bg-rose-600 text-white w-10 h-10 rounded-full shadow-2xl font-bold z-50 flex items-center justify-center border-4 border-white"
            >
              ✕
            </button>
          </div>
        ))}

        {/* RENDER DE PROYECTOS */}
        {currentProjects.map((p: any) => {
          const latest = p.versions?.[p.versions.length - 1];
          return (
            <div key={p.id} className="relative">
              <div onClick={() => navigate(`/project/${p.id}`)} className="bg-white p-5 rounded-[2.5rem] border-2 border-slate-100 cursor-pointer shadow-sm flex flex-col h-full hover:shadow-2xl transition-all">
                <div className="aspect-[3/4] rounded-[1.8rem] overflow-hidden mb-4 bg-slate-100 border relative">
                  {latest?.pages?.[0]?.imageUrl && <img src={latest.pages[0].imageUrl} className="w-full h-full object-cover" />}
                  <div className="absolute top-3 right-3 bg-black text-white px-3 py-1 rounded-lg text-[9px] font-black">V{latest?.versionNumber || 1}</div>
                </div>
                <h3 className="font-black text-xs truncate uppercase px-2 text-slate-800">{p.name}</h3>
              </div>
              <button 
                onClick={(e) => handleDelete(e, 'projects', p.id)}
                className="absolute -top-2 -right-2 bg-rose-600 text-white w-10 h-10 rounded-full shadow-2xl font-bold z-50 flex items-center justify-center border-4 border-white"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard;
