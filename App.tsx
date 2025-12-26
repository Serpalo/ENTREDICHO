import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { supabase } from './supabase';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';

export default function App() {
  const [projects, setProjects] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const { data: pData } = await supabase.from('projects').select('*');
      const { data: fData } = await supabase.from('folders').select('*');
      setProjects(pData || []);
      setFolders(fData || []);
    } catch (error) {
      console.error("Error cargando datos:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard projects={projects} folders={folders} onRefresh={fetchData} />} />
        <Route path="/folder/:folderId" element={<Dashboard projects={projects} folders={folders} onRefresh={fetchData} />} />
        <Route path="/project/:projectId" element={<ProjectDetail projects={projects} />} />
      </Routes>
    </BrowserRouter>
  );
}
