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
        {/* HEADER CON SOLO logo.png */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-50 shadow-sm">
          <Link to="/" className="flex items-center">
             <img 
                src="/logo.png" 
                alt="Alcampo" 
                className="h-10 w-auto object-contain" 
                onError={(e) => {
                    // Si el archivo no está en la raíz, intentamos buscarlo en la carpeta public
                    e.currentTarget.src = './logo.png';
                }}
             />
          </Link>
          <div className="flex items-center gap-4 text-slate-400">
             <button className="hover:text-rose-600 transition-colors text-xl">🔔</button>
             <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-500 uppercase tracking-tighter">Admin</div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden flex relative">
          <aside className="w-64 bg-white border-r border-slate-200 flex flex-col p-4 shrink-0 hidden md:flex">
            <Link to="/" className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all mb-6 text-slate-600 hover:bg-slate-50 font-bold">
                <span className="text-lg">🏠</span> Inicio
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
