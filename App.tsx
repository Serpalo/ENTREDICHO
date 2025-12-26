import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { supabase } from './supabase';
import Dashboard from './pages/Dashboard'; // Asegúrate que el archivo se llame Dashboard.tsx con D mayúscula

export default function App() {
  const [projects, setProjects] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const { data: pData } = await supabase.from('projects').select('*');
      const { data: fData } = await supabase.from('folders').select('*');
      const { data: pgData } = await supabase.from('pages').select('*');

      if (pData) {
        setProjects(pData.map(p => ({
          ...p,
          name: p.title || p.name,
          versions: [] // Simplificado para que arranque sí o sí
        })));
      }
      if (fData) setFolders(fData);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <Routes>
      <Route path="/" element={<Dashboard projects={projects} folders={folders} onRefresh={fetchData} />} />
      <Route path="/folder/:folderId" element={<Dashboard projects={projects} folders={folders} onRefresh={fetchData} />} />
    </Routes>
  );
}
