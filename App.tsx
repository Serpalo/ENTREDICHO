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
    const channel = supabase.channel('main').on('postgres_changes', { event: '*', schema: 'public' }, () => fetchData()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    const { data: foldersData } = await supabase.from('folders').select('*');
    if (foldersData) {
      setFolders(foldersData.map(f => ({ id: f.id.toString(), name: f.name, type: 'folder', parentId: f.parent_id?.toString() })));
    }

    const { data: projectsData } = await supabase.from('projects').select(`*, pages (*)`);

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

        return {
          id: p.id.toString(),
          name: p.title,
          type: 'project',
          parentId: p.parent_id?.toString(),
          status: p.status,
          versions: Object.keys(pagesByVersion).map(v => ({
            id: `${p.id}-v${v}`,
            versionNumber: parseInt(v),
            pages: pagesByVersion[parseInt(v)].sort((a, b) => a.pageNumber - b.pageNumber)
          }))
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
          <div className="flex items-center gap-2">
             <img src="/logo.png" alt="AlcampoFlow" className="h-8 w-auto" onError={(e) => {e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling?.classList.remove('hidden')}} />
             <span className="hidden text-xl font-black text-rose-600 tracking-tight">Alcampo<span className="text-slate-800 font-medium">Flow</span></span>
          </div>
          <div className="relative">
            <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 text-slate-400 hover:text-rose-600">🔔</button>
            {showNotifications && <div className="absolute right-0 mt-2 w-64 bg-white shadow-xl p-4 rounded border"><p className="text-sm font-bold">Notificaciones</p>{notifications.length===0 && <p className="text-xs text-slate-400">Sin novedades</p>}</div>}
          </div>
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
