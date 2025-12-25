import React, { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';

const Dashboard = ({ projects, folders, onRefresh }: any) => {
  const navigate = useNavigate();
  const { folderId } = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // TÍTULO DINÁMICO: Buscamos el nombre de la carpeta por ID
  const currentFolder = folders.find((f: any) => String(f.id) === String(folderId));
  const pageTitle = folderId && currentFolder ? currentFolder.name.toUpperCase() : "MIS PROYECTOS";

  const handleDelete = async (e: any, table: string, id: string) => {
    e.stopPropagation();
    if (window.confirm("¿BORRAR?")) {
      if (table === 'projects') await supabase.from('pages').delete().eq('project_id', id);
      await supabase.from(table).delete().eq('id', id);
      onRefresh();
    }
  };

  return (
    <div className="p-10 bg-slate-900 min-h-screen font-sans"> {/* FONDO OSCURO PARA TESTEAR */}
      <div className="flex justify-between items-center mb-10 bg-white p-8 rounded-[2rem] border-b-8 border-rose-600">
        <h1 className="text-4xl font-black text-slate-900 italic tracking-tighter uppercase">
            {pageTitle}
        </h1>
        <div className="flex gap-4">
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-slate-200 rounded-xl font-bold text-[10px]">INICIO</button>
          <button onClick={() => fileInputRef.current?.click()} className="px-8 py-4 bg-rose-600 text-white rounded-2xl font-black text-[12px] shadow-xl">SUBIR</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
        {/* CARPETAS */}
        {folders.filter((f: any) => folderId ? String(f.parentId) === String(folderId) : !f.parentId).map((f: any) => (
          <div key={f.id} className="relative group">
            <div onClick={() => navigate(`/folder/${f.id}`)} className="bg-white p-10 rounded-[2.5rem] cursor-pointer flex flex-col items-center">
              <span className="text-6xl mb-2">📁</span>
              <span className="font-black text-[10px] uppercase text-slate-800">{f.name}</span>
            </div>
            <button onClick={(e) => handleDelete(e, 'folders', f.id)} className="absolute -top-2 -right-2 bg-rose-600 text-white w-10 h-10 rounded-full border-4 border-white font-bold z-50">✕</button>
          </div>
        ))}

        {/* PROYECTOS */}
        {projects.filter((p: any) => folderId ? String(p.parentId) === String(folderId) : !p.parentId).map((p: any) => (
          <div key={p.id} className="relative">
            <div onClick={() => navigate(`/project/${p.id}`)} className="bg-white p-4 rounded-[2.5rem] cursor-pointer flex flex-col h-full">
              <div className="aspect-[3/4] rounded-[1.5rem] overflow-hidden mb-4 bg-slate-100 relative">
                <img src={p.versions?.[p.versions.length-1]?.pages?.[0]?.imageUrl} className="w-full h-full object-cover" />
              </div>
              <h3 className="font-black text-xs uppercase text-slate-800">{p.name}</h3>
            </div>
            <button onClick={(e) => handleDelete(e, 'projects', p.id)} className="absolute -top-2 -right-2 bg-rose-600 text-white w-10 h-10 rounded-full border-4 border-white font-bold z-50">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
