import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import PageReview from './pages/PageReview';
import { Project, Folder, AppNotification } from './types';
import { supabase } from './supabase';

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<AppNotification[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: projectsData } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      const { data: pagesData } = await supabase.from('pages').select('*').order('page_number', { ascending: true });
      const { data: foldersData } = await supabase.from('folders').select('*').order('created_at', { ascending: true });

      if (projectsData) {
        const loadedProjects: Project[] = projectsData.map((item: any) => {
          const projectPages = pagesData?.filter((p: any) => p.project_id === item.id.toString()) || [];
          
          const finalPages = projectPages.length > 0 
            ? projectPages.map((p: any) => ({
                id: p.id.toString(),
                pageNumber: p.page_number,
                imageUrl: p.image_url,
                // AQUI LEEMOS LA V1 (IMAGEN ANTIGUA)
                previousImageUrl: p.previous_image_url || null,
                status: p.status || '1ª corrección', 
                approvals: {},
                comments: []
              }))
            : (item.image_url ? [{
                id: `legacy-${item.id}`,
                pageNumber: 1,
                imageUrl: item.image_url,
                previousImageUrl: null,
                status: '1ª corrección',
                approvals: {},
                comments: []
              }] : []);

          return {
            id: item.id.toString(),
            name: item.title,
            parentId: item.parent_id || null,
            type: 'project',
            advertisingEmails: [],
            productDirectionEmails: [],
            versions: [{
                 id: `v1-${item.id}`,
                 versionNumber: 1,
                 createdAt: new Date(item.created_at),
                 isActive: true,
                 pages: finalPages
            }]
          };
        });
        setProjects(loadedProjects);
      }

      if (foldersData) {
        const loadedFolders: Folder[] = foldersData.map((item: any) => ({
          id: item.id.toString(),
          name: item.name,
          parentId: item.parent_id || null,
          type: 'folder'
        }));
        setFolders(loadedFolders);
      }
    };

    fetchData();
  }, []);

  const addNotification = (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: AppNotification = { ...notif, id: `n-${Date.now()}`, timestamp: new Date(), read: false };
    setNotifications(prev => [newNotif, ...prev]);
    setToasts(prev => [...prev, newNotif]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== newNotif.id)), 5000);
  };

  const markAllAsRead = () => { setNotifications(prev => prev.map(n => ({ ...n, read: true }))); };

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col bg-slate-50 relative overflow-hidden">
        <Navbar notifications={notifications} markAllAsRead={markAllAsRead} />
        <div className="fixed top-20 right-6 z-[200] flex flex-col gap-3 pointer-events-none w-full max-w-sm">
          {toasts.map(toast => (
            <div key={toast.id} className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 pointer-events-auto animate-in slide-in-from-right fade-in duration-300">
              <div className="flex gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${toast.type === 'system' ? 'bg-indigo-600 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-0.5">{toast.title}</p>
                  <p className="text-sm font-bold text-slate-900 truncate">{toast.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard projects={projects} setProjects={setProjects} folders={folders} setFolders={setFolders} addNotification={addNotification} />} />
            <Route path="/folder/:folderId" element={<Dashboard projects={projects} setProjects={setProjects} folders={folders} setFolders={setFolders} addNotification={addNotification} />} />
            <Route path="/project/:projectId" element={<ProjectDetail projects={projects} setProjects={setProjects} addNotification={addNotification} />} />
            <Route path="/project/:projectId/version/:versionId/page/:pageId" element={<PageReview projects={projects} setProjects={setProjects} addNotification={addNotification} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;
