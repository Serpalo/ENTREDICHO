import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabase';
import { Project, Folder, AppNotification } from './types';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import PageReview from './pages/PageReview';

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    fetchData();
    // Suscripción simple
    const channel = supabase.channel('global').on('postgres_changes', { event: '*', schema: 'public' }, () => fetchData()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    // 1. Cargar Carpetas
    const { data: foldersData } = await supabase.from('folders').select('*');
    if (foldersData) {
      setFolders(foldersData.map(f => ({
        id: f.id.toString(),
        name: f.name,
        type: 'folder',
        parentId: f.parent_id ? f.parent_id.toString() : undefined
      })));
    }

    // 2. Cargar Proyectos (SIN LA FECHA, versión estable)
    const { data: projectsData, error } = await supabase.from('projects').select(`*, pages (*)`);
    
    if (error) console.error("Error cargando proyectos:", error);

    if (projectsData) {
      const formattedProjects: Project[] = projectsData.map(p => {
        const pagesByVersion: Record<number, any[]> = {};
        p.pages.forEach((page: any) => {
          if (!pagesByVersion[page.version]) pagesByVersion[page.version] = [];
          pagesByVersion[page.version].push({
            id: page.id.toString(),
            imageUrl: page.image_url,
            pageNumber: page.page_number,
            version: page.version,
            status: page.status || '1ª corrección',
            comments: []
          });
        });

        const versions = Object.keys(pagesByVersion).map(vNum => ({
          id: `${p.id}-v${vNum}`,
          versionNumber: parseInt(vNum),
          pages: pagesByVersion[parseInt(vNum)].sort((a, b) => a.pageNumber - b.pageNumber)
        }));

        return {
          id: p.id.toString(),
          name: p.title,
          type: 'project',
          parentId: p.parent_id ? p.parent_id.toString() : undefined,
          status: p.status,
          versions: versions
        };
      });
      setProjects(formattedProjects);
    }
  };

  const addNotification = (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    setNotifications(prev => [{...notif, id: Date.now().toString(), timestamp: new Date(), read: false}, ...prev]);
  };

  return (
    <Router>
      <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-50">
          {/* LOGO RESTAURADO */}
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-rose-600 rounded-lg flex items-center justify-center text-white font-black italic text-lg">A</div>
             <span className="text-xl font-black text-rose-600 tracking-tight">Alcampo<span className="text-slate-800 font-medium">Flow</span></span>
          </div>
          <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 text-slate-400 hover:text-rose-600">
             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          </button>
        </header>

        <div className="flex-1 overflow-hidden relative">
          <Routes>
            <Route path="/" element={<Dashboard projects={projects} setProjects={setProjects} folders={folders} setFolders={setFolders} addNotification={addNotification} />} />
            <Route path="/folder/:folderId" element={<Dashboard projects={projects} setProjects={setProjects} folders={folders} setFolders={setFolders} addNotification={addNotification} />} />
            <Route path="/project/:projectId" element={<ProjectDetail projects={projects} setProjects={setProjects} addNotification={addNotification} />} />
            <Route path="/project/:projectId/version/:versionId/page/:pageId" element={<PageReview projects={projects} setProjects={setProjects} addNotification={addNotification} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;
