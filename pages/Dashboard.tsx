import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase'; // Asegúrate de que la ruta a supabase.ts es correcta

const Dashboard = ({ projects = [], folders = [], onRefresh }: any) => {
  const navigate = useNavigate();
  const { folderId } = useParams();

  const safeFolders = Array.isArray(folders) ? folders : [];
  const safeProjects = Array.isArray(projects) ? projects : [];

  const currentFolder = safeFolders.find((f: any) => String(f.id) === String(folderId));
  const pageTitle = folderId && currentFolder ? currentFolder.name.toUpperCase() : "MIS PROYECTOS";

  // --- FUNCIONES DE ACCIÓN ---

  const handleCreateFolder = async () => {
    const name = prompt("Nombre de la nueva carpeta:");
    if (!name) return;

    const { error } = await supabase
      .from('folders')
      .insert([{ 
        name, 
        parent_id: folderId ? parseInt(folderId) : null 
      }]);
    
    if (error) {
      alert("Error de Supabase: " + error.message);
    } else {
      if (onRefresh) onRefresh();
    }
  };

  const handleDeleteFolder = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation(); // Evita que al borrar se abra la carpeta
    if (window.confirm("¿Estás seguro de que quieres eliminar esta carpeta?")) {
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', id);
      
      if (error) {
        alert("No se pudo eliminar: " + error.message);
      } else {
        if (onRefresh) onRefresh();
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      {/* SIDEBAR */}
      <div className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col gap-8">
        <div className="flex items-center gap-2">
          <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Alcampo_logo.svg/2560px-Alcampo_logo.svg.png" alt="Logo" className="h-8" />
        </div>
        <nav className="flex flex-col gap-4">
          <div onClick={() => navigate('/')} className="flex items-center gap-3 text-slate-600 font-bold text-sm cursor-pointer">
            <span>🏠</span> Inicio
          </div>
          <div className="mt-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Carpetas</div>
          {safeFolders.filter(f => !f.parent_id).map(f => (
            <div key={f.id} onClick={() => navigate(`/folder/${f.id}`)} className="flex items-center gap-3 text-slate-500 text-sm cursor-pointer hover:text-rose-600 transition-colors">
              <span>📁</span> {f.name}
            </div>
          ))}
        </nav>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 p-10">
        <div className="flex justify-between items-center mb-10 bg-white p-8 rounded-[2rem] shadow-sm">
          <h1 className="text-4xl font-black text-slate-800 uppercase tracking-tighter italic">
            {pageTitle}
          </h1>
          <div className="flex gap-4">
            <button 
              onClick={handleCreateFolder}
              className="px-6 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase shadow-sm hover:bg-slate-50 transition-all"
            >
              + CARPETA
            </button>
            <button className="px-8 py-3 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-rose-200">
              SUBIR FOLLETO
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* CARPETAS */}
          {safeFolders
            .filter((f: any) => folderId ? String(f.parent_id) === String(folderId) : !f.parent_id)
            .map((f: any) => (
              <div key={f.id} onClick={() => navigate(`/folder/${f.id}`)} 
                   className="group relative bg-white p-10 rounded-[2.5rem] border border-slate-100 cursor-pointer flex flex-col items-center hover:shadow-xl transition-all">
                
                {/* Botón de Borrar (aparece al pasar el ratón) */}
                <button 
                  onClick={(e) => handleDeleteFolder(e, f.id)}
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 bg-rose-50 text-rose-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all"
                >
                  ✕
                </button>

                <div className="text-6xl mb-4 opacity-80">📁</div>
                <span className="font-black text-[11px] uppercase text-slate-500 tracking-widest text-center">{f.name}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
