import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { supabase } from './supabase';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';

export default function App() {
  const [projects, setProjects] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 1. Cargamos las carpetas
      const { data: fData, error: fError } = await supabase
        .from('folders')
        .select('*');
      
      if (fError) console.error("Error folders:", fError.message);

      // 2. Cargamos los folletos/páginas de la tabla 'pages' 
      // Esta es la tabla que muestra las imágenes en tu lista
      const { data: pData, error: pError } = await supabase
        .from('pages')
        .select('*');
      
      if (pError) console.error("Error pages:", pError.message);

      setFolders(fData || []);
      setProjects(pData || []);
    } catch (error) {
      console.error("Error general de carga:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-black uppercase text-slate-300 italic tracking-widest">
        Cargando sistema...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta principal y navegación por carpetas */}
        <Route 
          path="/" 
          element={<Dashboard projects={projects} folders={folders} onRefresh={fetchData} />} 
        />
        <Route 
          path="/folder/:folderId" 
          element={<Dashboard projects={projects} folders={folders} onRefresh={fetchData} />} 
        />
        
        {/* Ruta para el detalle del folleto (donde se ven las notas y correcciones) */}
        <Route 
          path="/project/:projectId" 
          element={<ProjectDetail projects={projects} />} 
        />
      </Routes>
    </BrowserRouter>
  );
}
