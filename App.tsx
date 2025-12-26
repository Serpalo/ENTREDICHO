import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { supabase } from './supabase';
import Dashboard from './pages/Dashboard';

export default function App() {
  const [projects, setProjects] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);

  // Esta función es la que recarga los datos desde Supabase
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
    <div className="app-container">
      {/* HEMOS QUITADO EL NAVBAR DE AQUÍ PARA QUE NO SALGA DUPLICADO */}
      <Routes>
        <Route 
          path="/" 
          element={<Dashboard projects={projects} folders={folders} onRefresh={fetchData} />} 
        />
        <Route 
          path="/folder/:folderId" 
          element={<Dashboard projects={projects} folders={folders} onRefresh={fetchData} />} 
        />
      </Routes>
    </div>
  );
}
