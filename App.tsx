import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { supabase } from './supabase';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import Revision from './pages/Revision';

export default function App() {
  const [projects, setProjects] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);

  // Función para obtener y formatear todos los datos de Supabase
  const fetchData = async () => {
    const { data: pData } = await supabase.from('projects').select('*');
    const { data: fData } = await supabase.from('folders').select('*');
    const { data: pgData } = await supabase.from('pages').select('*').order('page_number', { ascending: true });

    if (pData && pgData) {
      // Agrupamos versiones para que el Dashboard solo muestre una tarjeta por proyecto
      const formattedProjects = pData.map(proj => {
        const projPages = pgData.filter(pg => pg.project_id === proj.id);
        const versionsMap: any = {};
        
        projPages.forEach(pg => {
          if (!versionsMap[pg.version]) {
            versionsMap[pg.version] = { 
              id: `${proj.id}-v${pg.version}`, 
              versionNumber: pg.version, 
              pages: [] 
            };
          }
          versionsMap[pg.version].pages.push({ 
            id: pg.id, 
            pageNumber: pg.page_number, 
            imageUrl: pg.image_url 
          });
        });

        return {
          id: proj.id,
          name: proj.title || proj.name,
          parentId: proj.parent_id,
          // Ordenamos para que la última versión sea la mostrada por defecto
          versions: Object.values(versionsMap).sort((a: any, b: any) => a.versionNumber - b.versionNumber)
        };
      });
      setProjects(formattedProjects);
    }

    if (fData) {
      setFolders(fData.map(f => ({ 
        id: f.id, 
        name: f.name, 
        parentId: f.parent_id 
      })));
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <Routes>
      {/* RUTA PRINCIPAL */}
      <Route 
        path="/" 
        element={<Dashboard projects={projects} folders={folders} onRefresh={fetchData} />} 
      />
      
      {/* RUTA DE CARPETA: Crucial para detectar el ID y cambiar el título a "UNICO" */}
      <Route 
        path="/folder/:folderId" 
        element={<Dashboard projects={projects} folders={folders} onRefresh={fetchData} />} 
      />
      
      {/* Detalle del proyecto */}
      <Route 
        path="/project/:projectId" 
        element={<ProjectDetail projects={projects} />} 
      />
      
      {/* Pantalla de revisión */}
      <Route 
        path="/project/:projectId/version/:versionId/page/:pageId" 
        element={<Revision projects={projects} />} 
      />
    </Routes>
  );
}
