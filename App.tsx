import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { supabase } from './supabase';
import { Project, Folder, AppNotification } from './types';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import PageReview from './pages/PageReview';

// Componente pequeño para el enlace del menú lateral
const NavItem = ({ to, label, icon, active }: { to: string, label: string, icon: string, active?: boolean }) => (
  <Link to={to} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all mb-1 ${active ? 'bg-rose-50 text-rose-600 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
    <span className="text-xl">{icon}</span>
    <span className="text-sm">{label}</span>
  </Link>
);

// Componente auxiliar para detectar ruta activa
const SidebarContent = ({ folders }: { folders: Folder[] }) => {
  const location = useLocation();
  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col h-full overflow-y-auto hidden md:flex">
      <div className="p-6">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Estructura</h3>
        <NavItem to="/" label="Proyectos" icon="🏠" active={location.pathname === '/'} />
        
        <div className="mt-6">
           <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Carpetas</h3>
           {folders.length === 0 && <p className="text-xs text-slate-300 italic px-4">Sin carpetas</p>}
           {folders.map(f => (
             <NavItem key={f.id} to={`/folder/${f.id}`} label={f.name} icon="📁" active={location.pathname === `/folder/${f.id}`} />
           ))}
        </div>
      </div>
    </aside>
  );
};

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
    // Cargar carpetas
    const { data: foldersData } = await supabase.from('folders').select('*');
    if (foldersData) {
      setFolders(foldersData.map(f => ({ id: f.id.toString(), name: f.name, type: 'folder', parentId: f.parent_id?.toString() })));
    }

    // Cargar proyectos (Versión segura sin 'name' si falla)
    const { data: projectsData } = await supabase.from('projects').select(`*, pages (*)`);

    if (projectsData) {
      const formattedProjects: Project[] = projectsData.map(p => {
        const pagesByVersion: Record<number, any[]> = {};
        const rawPages = p.pages || [];
        
        rawPages.forEach((page: any) => {
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
          // IMPORTANTE: Aquí aseguramos que siempre tenga un nombre
          name: p.name || p.title || "Sin nombre",
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
        {/* HEADER */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-50 relative shadow-sm">
          <div className="flex items-center gap-2">
             <img src="/logo.png" alt="AlcampoFlow" className="h-8 w-auto" onError={(e) => {e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling?.classList.remove('hidden')}} />
             <span className="hidden text-xl font-black text-rose-600 tracking-tight">Alcampo<span className="text-slate-800 font-medium">Flow</span></span>
          </div>
          <div className="relative">
            <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 text-slate-400 hover:text-rose-600 relative">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              {notifications.some(n => !n.read) && <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full"></span>}
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white shadow-2xl p-0 rounded-2xl border border-slate-100 overflow-hidden z-50">
                <div className="p-4 border-b bg-slate-50"><p className="text-xs font-black text-slate-400 uppercase">Notificaciones</p></div>
                <div className="max-h-64 overflow-y-auto">
                    {notifications.length===0 ? <p className="text-xs text-slate-400 p-4 text-center">Todo al día</p> : notifications.map(n => (
                        <div key={n.id} className="p-4 border-b hover:bg-slate-50"><p className="text-sm font-bold text-slate-800">{n.title}</p><p className="text-xs text-slate-500">{n.message}</p></div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* CONTENIDO PRINCIPAL CON SIDEBAR */}
        <div className="flex-1 overflow-hidden flex relative">
          <SidebarContent folders={folders} />
          
          <main className="flex-1 overflow-y-auto bg-slate-50 relative">
            <Routes>
              <Route path="/" element={<Dashboard projects={projects} setProjects={setProjects} folders={folders} setFolders={setFolders} addNotification={addNotification} />} />
              <Route path="/folder/:folderId" element={<Dashboard projects={projects} setProjects={setProjects} folders={folders} setFolders={setFolders} addNotification={addNotification} />} />
              <Route path="/project/:projectId" element={<ProjectDetail projects={projects} setProjects={setProjects} addNotification={addNotification} />} />
              <Route path="/project/:projectId/version/:versionId/page/:pageId" element={<PageReview projects={projects} setProjects={setProjects} addNotification={addNotification} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
};

export default App;
