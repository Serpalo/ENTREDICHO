
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import PageReview from './pages/PageReview';
import { Project, Folder, CorrectionStatus, AppNotification } from './types';

// Mock Initial State
const INITIAL_PROJECTS: Project[] = [
  {
    id: "p1",
    name: "Folleto Ofertas Verano 2024",
    parentId: null,
    type: 'project',
    versions: [
      {
        id: "v1",
        versionNumber: 1,
        createdAt: new Date(),
        isActive: true,
        pages: Array.from({ length: 4 }).map((_, i) => ({
          id: `p1-v1-pg${i + 1}`,
          pageNumber: i + 1,
          imageUrl: `https://picsum.photos/seed/brochure${i+1}/800/1200`,
          status: CorrectionStatus.FIRST,
          approvals: {
            "Publicidad": { role: "Publicidad", approved: false, pending: true },
            "Dirección de producto": { role: "Dirección de producto", approved: false, pending: true },
          },
          comments: []
        }))
      }
    ]
  }
];

const INITIAL_FOLDERS: Folder[] = [];

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [folders, setFolders] = useState<Folder[]>(INITIAL_FOLDERS);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<AppNotification[]>([]);

  const addNotification = (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: AppNotification = {
      ...notif,
      id: `n-${Date.now()}`,
      timestamp: new Date(),
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);
    setToasts(prev => [...prev, newNotif]);
    
    // Auto-remove toast after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== newNotif.id));
    }, 5000);
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col bg-slate-50 relative overflow-hidden">
        <Navbar 
          notifications={notifications} 
          markAllAsRead={markAllAsRead} 
        />
        
        {/* Global Toast Container */}
        <div className="fixed top-20 right-6 z-[200] flex flex-col gap-3 pointer-events-none w-full max-w-sm">
          {toasts.map(toast => (
            <div 
              key={toast.id}
              className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 pointer-events-auto animate-in slide-in-from-right fade-in duration-300"
            >
              <div className="flex gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${toast.type === 'system' ? 'bg-indigo-600 text-white' : toast.type === 'comment' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {toast.type === 'comment' ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  ) : toast.type === 'system' ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-0.5">{toast.title}</p>
                  <p className="text-sm font-bold text-slate-900 truncate">{toast.message}</p>
                </div>
                <button 
                  onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                  className="p-1 hover:bg-slate-50 text-slate-300 rounded-lg transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        <main className="flex-1 overflow-auto">
          <Routes>
            <Route 
              path="/" 
              element={<Dashboard projects={projects} setProjects={setProjects} folders={folders} setFolders={setFolders} addNotification={addNotification} />} 
            />
            <Route 
              path="/folder/:folderId" 
              element={<Dashboard projects={projects} setProjects={setProjects} folders={folders} setFolders={setFolders} addNotification={addNotification} />} 
            />
            <Route 
              path="/project/:projectId" 
              element={<ProjectDetail projects={projects} setProjects={setProjects} addNotification={addNotification} />} 
            />
            <Route 
              path="/project/:projectId/version/:versionId/page/:pageId" 
              element={<PageReview projects={projects} setProjects={setProjects} addNotification={addNotification} />} 
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;
