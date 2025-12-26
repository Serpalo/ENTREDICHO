import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';

const Dashboard = ({ projects = [], folders = [], onRefresh }: any) => {
  const navigate = useNavigate();
  const { folderId } = useParams();

  // Filtros de seguridad para evitar errores si los datos tardan en llegar
  const safeFolders = Array.isArray(folders) ? folders : [];
  const safeProjects = Array.isArray(projects) ? projects : [];

  // Título dinámico según la carpeta donde estés
  const currentFolder = safeFolders.find((f: any) => String(f.id) === String(folderId));
  const pageTitle = folderId && currentFolder ? currentFolder.name.toUpperCase() : "MIS PROYECTOS";

  // --- FUNCIÓN PARA CREAR CARPETA (ACTUALIZACIÓN AUTOMÁTICA) ---
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
      alert("Error al crear: " + error.message);
    } else {
      // Avisamos a la web que debe recargar los datos de Supabase ahora mismo
      if (onRefresh) await onRefresh();
    }
  };

  // --- FUNCIÓN PARA BORRAR CARPETA (ACTUALIZACIÓN AUTOMÁTICA) ---
  const handleDeleteFolder = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation(); // Evita que se abra la carpeta al intentar borrarla
    
    if (window.confirm("¿Estás seguro de que quieres eliminar esta carpeta?")) {
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', id);
      
      if (error) {
        alert("No tienes permisos o hubo un error: " + error.message);
      } else {
        // Avisamos a la web que debe recargar los datos de Supabase ahora mismo
        if (onRefresh) await onRefresh();
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      {/* SIDEBAR CON LOGO ALCAMPO */}
      <div className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col gap-8">
        <div className="flex items-center gap-2">
          <img 
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Alcampo_logo.svg/2560px-Alcampo_logo.svg.png" 
            alt="Logo Alcampo" 
            className="h-8" 
          />
        </div>
        <nav className="flex flex-col gap-4">
          <div 
            onClick={() => navigate('/')} 
            className="flex items-center gap-3 text-slate-600 font-bold text-sm cursor-pointer hover:text-rose-600 transition-colors"
          >
            <span>🏠</span> Inicio
          </div>
          <div className="mt-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Carpetas</div>
          {/* Listado de carpetas principales en el menú */}
          {safeFolders.filter(f => !f.parent_id).map(f => (
            <div 
              key={f.id} 
              onClick={() => navigate(`/folder/${f.id}`)} 
              className="flex items-center gap-3 text-slate-500 text-sm cursor-pointer hover:text-rose-600 transition-colors"
            >
              <span>📁</span> {f.name}
            </div>
          ))}
        </nav>
      </div>

      {/* ÁREA DE CONTENIDO PRINCIPAL */}
      <div className="flex-1 p-10">
        <div className="flex justify-between items-center mb-10 bg-white p-8 rounded-[2.5rem] shadow-sm border-b-4 border-rose-600">
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
            <button className="px-8 py-3 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-rose-200 hover:scale-105 transition-transform">
              SUBIR FOLLETO
            </button>
          </div>
        </div>

        {/* REJILLA DE CARPETAS Y PROYECTOS */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          {/* RENDERIZAR CARPETAS DENTRO DEL DIRECTORIO ACTUAL */}
          {safeFolders
            .filter((f: any) => folderId ? String(f.parent_id) === String(folderId) : !f.parent_id)
            .map((f: any) => (
              <div 
                key={f.id} 
                onClick={() => navigate(`/folder/${f.id}`)} 
                className="group relative bg-white p-10 rounded-[2.5rem] border border-slate-100 cursor-pointer flex flex-col items-center hover:shadow-xl transition-all hover:-translate-y-1"
              >
                {/* BOTÓN BORRAR (X) */}
                <button 
                  onClick={(e) => handleDeleteFolder(e, f.id)}
                  className="absolute top-4 right-4 bg-rose-50 text-rose-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all z-10"
                >
                  ✕
                </button>

                <div className="text-6xl mb-4 opacity-80">📁</div>
                <span className="font-black text-[11px] uppercase text-slate-500 tracking-widest text-center">
                  {f.name}
                </span>
              </div>
            ))}

          {/* RENDERIZAR PROYECTOS/FOLLETOS */}
          {safeProjects
            .filter((p: any) => folderId ? String(p.parent_id) === String(folderId) : !p.parent_id)
            .map((p: any) => (
              <div 
                key={p.id} 
                onClick={() => navigate(`/project/${p.id}`)} 
                className="bg-white p-6 rounded-[2.5rem] border border-slate-100 cursor-pointer flex flex-col h-full hover:shadow-xl transition-all hover:-translate-y-1"
              >
                <div className="aspect-[3/4] rounded-[1.8rem] overflow-hidden mb-4 bg-slate-50 flex items-center justify-center border border-slate-100">
                  <span className="text-4xl opacity-10">📄</span>
                </div>
                <h3 className="font-black text-[11px] uppercase text-slate-800 text-center truncate px-2">
                  {p.name}
                </h3>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
