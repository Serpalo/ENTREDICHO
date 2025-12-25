import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { supabase } from './supabase';
import { Project, Folder, AppNotification } from './types';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
// CAMBIO IMPORTANTE: Importamos el nuevo archivo "Revision" en lugar del viejo "PageReview"
import Revision from './pages/Revision';

// --- COMPONENTE DE ÁRBOL DESPLEGABLE ---
const FolderTreeItem = ({ folder, allFolders, level = 0 }: { folder: Folder, allFolders: Folder[], level?: number }) => {
  const location = useLocation();
  const isActive = location.pathname === `/folder/${folder.id}`;
  const [isOpen, setIsOpen] = useState(false);
  
  const children = allFolders.filter(f => f.parentId === folder.id);
  const hasChildren = children.length > 0;

  return (
    <div className="select-none">
      <div 
        className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-all mb-0.5 text-sm cursor-pointer ${isActive ? 'bg-rose-50 text-rose-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
        style={{ marginLeft: `${level * 12}px` }}
      >
        <button 
            onClick={(e) => { e.preventDefault(); setIsOpen(!isOpen); }} 
            className={`p-1 rounded hover:bg-slate-200 text-slate-400 text-[10px] transition-transform ${hasChildren ? '' : 'invisible'} ${isOpen ? 'rotate-90' : ''}`}
        >
            ▶
        </button>
        
        <Link to={`/folder/${folder.id}`} className="flex-1 flex items-center gap-2 truncate">
            <span>{isOpen ? '📂' : '📁'}</span>
            <span className="truncate">{folder.name}</span>
        </Link>
      </div>
      
      {isOpen && children.map(child => (
        <FolderTreeItem key={child.id} folder={child} allFolders={allFolders} level={level + 1} />
      ))}
    </div>
  );
};

const SidebarContent = ({ folders }: { folders: Folder[] }) => {
  const location = useLocation();
  const rootFolders = folders.filter(f => !f.parentId);

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col h-full overflow-y-auto hidden md:flex">
      <div className="p-4">
        <div className="mb-6">
            <Link to="/" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${location.pathname === '/' ? 'bg-rose-600 text-white font-bold shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                <span>🏠</span>
                <span>Inicio</span>
            </Link>
        </div>
        
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-4">Carpetas</h3>
        {folders.length === 0 ? (
            <p className="text-xs text-slate-300 italic px-4">Sin carpetas</p>
        ) : (
            <div className="space-y-0.5">
                {rootFolders.map(f => (
                    <FolderTreeItem key={f.id} folder={f} allFolders={folders} />
                ))}
            </div>
        )}
      </div>
    </aside>
  );
};

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

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
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-50 relative shadow-sm">
          <div className="flex items-center gap-2">
             <img src="/logo.png" alt="AlcampoFlow" className="h-8 w-auto" onError={(e) => {e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling?.classList.remove('hidden')}} />
             <span className="hidden text-xl font-black text-rose-600 tracking-tight">Alcampo<span className="text-slate-800 font-medium">Flow</span></span>
          </div>
          <button className="p-2 text-slate-400 hover:text-rose-600">🔔</button>
        </header>
        <div className="flex-1 overflow-hidden flex relative">
          <SidebarContent folders={folders} />
          <main className="flex-1 overflow-y-auto bg-slate-50 relative">
            <Routes>
              <Route path="/" element={<Dashboard projects={projects} setProjects={setProjects} folders={folders} setFolders={setFolders} addNotification={addNotification} />} />
              <Route path="/folder/:folderId" element={<Dashboard projects={projects} setProjects={setProjects} folders={folders} setFolders={setFolders} addNotification={addNotification} />} />
              <Route path="/project/:projectId" element={<ProjectDetail projects={projects} setProjects={setProjects} addNotification={addNotification} />} />
              
              {/* CAMBIO IMPORTANTÍSIMO: Usamos <Revision> en vez de <PageReview> */}
              <Route path="/project/:projectId/version/:versionId/page/:pageId" element={<Revision projects={projects} setProjects={setProjects} />} />
              
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
};

export default App;
