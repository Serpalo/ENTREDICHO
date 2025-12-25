import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { supabase } from './supabase';
import { Project, Folder } from './types';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import Revision from './pages/Revision';

const FolderTreeItem = ({ folder, allFolders, level = 0 }: { folder: Folder, allFolders: Folder[], level?: number }) => {
  const location = useLocation();
  const isActive = location.pathname === `/folder/${folder.id}`;
  const [isOpen, setIsOpen] = useState(false);
  const children = allFolders.filter(f => f.parentId === folder.id);
  return (
    <div className="select-none">
      <div className={`flex items-center gap-1 px-3 py-2 rounded-lg cursor-pointer transition-colors ${isActive ? 'bg-rose-50 text-rose-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`} style={{ marginLeft: `${level * 12}px` }}>
        <button onClick={(e) => { e.preventDefault(); setIsOpen(!isOpen); }} className={`p-1 ${children.length > 0 ? '' : 'invisible'} ${isOpen ? 'rotate-90' : ''} transition-transform`}>▶</button>
        <Link to={`/folder/${folder.id}`} className="flex-1 truncate flex items-center gap-2">
            <span>{isOpen ? '📂' : '📁'}</span>
            <span className="truncate">{folder.name}</span>
        </Link>
      </div>
      {isOpen && children.map(child => <FolderTreeItem key={child.id} folder={child} allFolders={allFolders} level={level + 1} />)}
    </div>
  );
};

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('main').on('postgres_changes', { event: '*', schema: 'public' }, () => fetchData()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    const { data: f } = await supabase.from('folders').select('*');
    if (f) setFolders(f.map(x => ({ id: x.id.toString(), name: x.name, type: 'folder', parentId: x.parent_id?.toString() })));
    const { data: p } = await supabase.from('projects').select(`*, pages (*)`);
    if (p) {
      setProjects(p.map(x => {
        const pagesByVersion: Record<number, any[]> = {};
        (x.pages || []).forEach((pg: any) => {
          if (!pagesByVersion[pg.version]) pagesByVersion[pg.version] = [];
          pagesByVersion[pg.version].push({ id: pg.id.toString(), imageUrl: pg.image_url, pageNumber: pg.page_number, version: pg.version, status: pg.status || '1ª corrección', comments: [] });
        });
        return {
          id: x.id.toString(), name: x.name || x.title || "Sin nombre", type: 'project', parentId: x.parent_id?.toString(), status: x.status,
          versions: Object.keys(pagesByVersion).map(v => ({ id: `${x.id}-v${v}`, versionNumber: parseInt(v), pages: pagesByVersion[parseInt(v)].sort((a, b) => a.pageNumber - b.pageNumber) }))
        };
      }));
    }
  };

  return (
    <Router>
      <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans">
        {/* HEADER CON LOGO SVG (DIBUJADO POR CÓDIGO) */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-50 shadow-sm">
          <Link to="/" className="flex items-center">
             <svg width="120" height="30" viewBox="0 0 120 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14.65 4.35C10.5 4.35 6.5 6.85 4.5 10.85C2.5 14.85 2.5 19.85 4.5 23.85C6.5 27.85 10.5 30.35 14.65 30.35C18.8 30.35 22.8 27.85 24.8 23.85L19.3 21.35C18.3 23.35 16.3 24.85 14.65 24.85C12.3 24.85 10.3 23.35 9.3 20.85H29.3C29.55 19.6 29.8 18.35 29.8 17.1C29.8 12.35 26.3 4.35 14.65 4.35ZM9.55 16.35C10.55 13.1 12.3 10.35 14.65 10.35C17.3 10.35 19.3 12.85 20.05 16.35H9.55Z" fill="#E2001A"/>
                <path d="M42.3 0V30H33.8V0H42.3Z" fill="#E2001A"/>
                <path d="M57.8 30.35C62.8 30.35 67.3 27.85 69.8 23.35L64.3 20.85C63.05 23.35 61.05 24.85 57.8 24.85C53.3 24.85 50.3 20.85 50.3 15.35C50.3 9.85 53.3 5.85 57.8 5.85C61.05 5.85 63.05 7.35 64.3 9.85L69.8 7.35C67.3 2.85 62.8 0.35 57.8 0.35C49.3 0.35 41.8 7.1 41.8 15.35C41.8 23.6 49.3 30.35 57.8 30.35Z" fill="#E2001A"/>
                <path d="M102.3 30H110.8V0H102.3V30Z" fill="#E2001A"/>
                <path d="M85.3 0V30H76.8V0H85.3Z" fill="#E2001A"/>
                <path d="M96.3 30.35C100.8 30.35 104.3 26.85 104.3 22.35C104.3 17.85 100.8 14.35 96.3 14.35C91.8 14.35 88.3 17.85 88.3 22.35C88.3 26.85 91.8 30.35 96.3 30.35Z" fill="#E2001A"/>
             </svg>
             <div className="h-5 w-[1.5px] bg-slate-200 mx-3"></div>
             <span className="text-2xl font-black text-rose-600 tracking-tighter italic">Flow</span>
          </Link>
          <div className="flex items-center gap-4 text-slate-400">
             <button className="hover:text-rose-600 transition-colors">🔔</button>
             <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase">Admin</div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden flex relative">
          <aside className="w-64 bg-white border-r border-slate-200 flex flex-col p-4 shrink-0 hidden md:flex">
            <Link to="/" className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all mb-6 text-slate-600 hover:bg-slate-50 font-bold">
                <span>🏠</span> Inicio
            </Link>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-4">Carpetas</h3>
            <div className="space-y-1 overflow-y-auto">
                {folders.filter(f => !f.parentId).map(f => <FolderTreeItem key={f.id} folder={f} allFolders={folders} />)}
            </div>
          </aside>

          <main className="flex-1 overflow-y-auto bg-slate-50">
            <Routes>
              <Route path="/" element={<Dashboard projects={projects} setProjects={setProjects} folders={folders} setFolders={setFolders} />} />
              <Route path="/folder/:folderId" element={<Dashboard projects={projects} setProjects={setProjects} folders={folders} setFolders={setFolders} />} />
              <Route path="/project/:projectId" element={<ProjectDetail projects={projects} setProjects={setProjects} />} />
              <Route path="/project/:projectId/version/:versionId/page/:pageId" element={<Revision projects={projects} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
};
export default App;
