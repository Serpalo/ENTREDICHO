import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabase';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import Login from './pages/Login';

function App() {
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<'admin' | 'editor' | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);

  // 1. GESTIÓN DE SESIÓN Y CARGA INICIAL
  useEffect(() => {
    // Comprobar sesión al arrancar
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        checkUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Escuchar cambios (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        checkUserRole(session.user.id);
      } else {
        setUserRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. CHECK ROLE (Ver si es admin)
  const checkUserRole = async (userId: string) => {
    try {
        const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).single();
        if (error) throw error;
        setUserRole(data?.role || 'editor'); // Si no tiene rol, es editor por defecto
    } catch (error) {
        console.error("Error checking role:", error);
        setUserRole('editor');
    } finally {
        fetchData(); // Una vez sabemos quién es, cargamos los datos
    }
  };

  const fetchData = async () => {
    // setLoading(true); // No forzamos loading aquí para no parpadear
    const { data: pData } = await supabase.from('projects').select('*');
    const { data: fData } = await supabase.from('folders').select('*');
    setProjects(pData || []);
    setFolders(fData || []);
    setLoading(false);
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-black text-slate-300 animate-pulse">CARGANDO SISTEMA...</div>;

  // SI NO HAY SESIÓN, MANDAR AL LOGIN
  if (!session) return <Login />;

  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={<Dashboard projects={projects} folders={folders} onRefresh={fetchData} userRole={userRole} session={session} />} 
        />
        <Route 
          path="/folder/:folderId" 
          element={<Dashboard projects={projects} folders={folders} onRefresh={fetchData} userRole={userRole} session={session} />} 
        />
        <Route 
          path="/project/:projectId" 
          element={<ProjectDetail projects={projects} onRefresh={fetchData} userRole={userRole} session={session} />} 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
