import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { supabase } from './supabase';
import Dashboard from './pages/Dashboard'; 

export default function App() {
  const [projects, setProjects] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const { data: pData } = await supabase.from('projects').select('*');
      const { data: fData } = await supabase.from('folders').select('*');
      // Si pData o fData son nulos, usamos una lista vacía para no romper la web
      setProjects(pData || []);
      setFolders(fData || []);
    } catch (error) {
      console.error("Error de conexión:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Dashboard projects={projects} folders={folders} onRefresh={fetchData} />} />
      <Route path="/folder/:folderId" element={<Dashboard projects={projects} folders={folders} onRefresh={fetchData} />} />
    </Routes>
  );
}
