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

  // 1. DETERMINAR EL NOMBRE DE LA CABECERA
  const currentFolderName = folders.find((f: any) => String(f.id) === String(folderId))?.name;
  const pageTitle = folderId && currentFolderName ? currentFolderName : "MIS PROYECTOS";

  // 2. FILTRADO DE CONTENIDO (Mantenemos la lógica de una sola tarjeta por proyecto)
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

  // ... (Resto de funciones handleCreateFolder, handleDelete, etc. se mantienen igual)

  return (
    <div className="p-10 bg-gray-50 min-h-screen font-sans">
      <input type="file" ref={fileInputRef} hidden multiple accept="image/*" onChange={/* ... lógica de subida ... */} />

      {/* CABECERA DINÁMICA ACTUALIZADA */}
      <div className="flex justify-between items-center mb-10 bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
        <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-800">
          {pageTitle}
        </h1>
        <div className="flex gap-4">
          <button 
            onClick={() => setShowNewFolder(true)} 
            className="px-6 py-3 bg-white border-2 border-gray-100 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all"
          >
            + Carpeta
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()} 
            className="px-8 py-3 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-rose-100 hover:bg-rose-700 transition-all"
          >
            {isUploading ? 'Subiendo...' : 'Subir Folleto'}
          </button>
        </div>
      </div>

      {/* ... (Resto del render de carpetas y proyectos) */}
    </div>
  );
};

export default Dashboard;
