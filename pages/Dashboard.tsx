import React, { useRef, useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Project, Folder, FileSystemItem, AppNotification } from '../types';
import { supabase } from '../supabase';

interface DashboardProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  folders: Folder[];
  setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
  addNotification?: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
}

type ViewMode = 'grid' | 'list';

const Dashboard: React.FC<DashboardProps> = ({ projects, setProjects, folders, setFolders, addNotification }) => {
  const { folderId } = useParams<{ folderId?: string }>();
  const currentFolderId = folderId || null;
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [itemToDelete, setItemToDelete] = useState<FileSystemItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const currentFolders = folders.filter(f => f.parentId === currentFolderId);
  const currentProjects = projects.filter(p => p.parentId === currentFolderId);

  // --- Funciones Auxiliares ---
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  
  // Breadcrumbs y Navegación
  useEffect(() => {
    if (currentFolderId) {
       const newExpanded = new Set(expandedFolders);
       let currId: string | null = currentFolderId;
       while (currId) { const folder = folders.find(f => f.id === currId); if (folder && folder.parentId) { newExpanded.add(folder.parentId); currId = folder.parentId; } else { currId = null; } }
       setExpandedFolders(newExpanded);
    }
  }, [currentFolderId, folders]);
  
  const getBreadcrumbs = () => { const crumbs = [{ name: 'Proyectos', id: null }]; let currentId = currentFolderId; const path = []; while (currentId) { const folder = folders.find(f => f.id === currentId); if (folder) { path.unshift({ name: folder.name, id: folder.id }); currentId = folder.parentId; } else { break; } } return [...crumbs, ...path]; };
  const breadcrumbs = getBreadcrumbs();

  // Acciones de Carpetas
  const handleCreateFolder = async () => {
      if (!newFolderName.trim()) { setIsCreatingFolder(false); return; }
      const { data, error } = await supabase.from('folders').insert([{ name: newFolderName, parent_id: currentFolderId }]).select();
      if (data) setFolders(prev => [...prev, { id: data[0].id.toString(), name: data[0].name, parentId: data[0].parent_id, type: 'folder' }]);
      setNewFolderName(""); setIsCreatingFolder(false);
  };
  
  const handleRename = (item: FileSystemItem) => { setIsRenaming(item.id); setRenameValue(item.name); };
  
  const confirmDelete = async () => {
    if (!itemToDelete) return;
    if (itemToDelete.type === 'folder') {
        const { error } = await supabase.from('folders').delete().eq('id', itemToDelete.id);
        if (!error) setFolders(prev => prev.filter(f => f.id !== itemToDelete.id));
    } else {
        const { error } = await supabase.from('projects').delete().eq('id', itemToDelete.id);
        if (!error) setProjects(prev => prev.filter(p => p.id !== itemToDelete.id));
    }
    setItemToDelete(null);
  };
  
  const handleDeleteClick = (item: FileSystemItem, e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setItemToDelete(item); };
  const toggleExpand = (id: string, e: React.MouseEvent) => { e.stopPropagation(); const newExpanded = new Set(expandedFolders); if (newExpanded.has(id)) newExpanded.delete(id); else newExpanded.add(id); setExpandedFolders(newExpanded); };

  // --- SUBIDA MÚLTIPLE ---
  const handleFilesUpload = async (files: FileList) => {
    if (files.length === 0) return;
    setIsUploading(true);

    const firstFileName = files[0].name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").trim();
    const filesArray = Array.from(files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    try {
      // 1. Crear Proyecto
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .insert([{ 
          title: firstFileName, 
          status: 'active', 
          description: `Folleto con ${files.length} páginas`,
          parent_id: currentFolderId 
        }])
        .select();

      if (projectError || !projectData) {
        alert('Error al crear el proyecto.'); setIsUploading(false); return;
      }

      const projectId = projectData[0].id;
      const uploadedPages = [];

      // 2. Subir Páginas
      for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i];
        const fileName = `${Date.now()}-${i}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

        const { error: uploadError } = await supabase.storage.from('brochures').upload(fileName, file);
        if (uploadError) console.error('Error subiendo', fileName, uploadError);

        const { data: { publicUrl } } = supabase.storage.from('brochures').getPublicUrl(fileName);

        const { data: pageData } = await supabase
          .from('pages')
          .insert([{ project_id: projectId, image_url: publicUrl, page_number: i + 1 }])
          .select();
        
        if (pageData) {
            uploadedPages.push({
                id: pageData[0].id.toString(),
                pageNumber: i + 1,
                imageUrl: publicUrl,
                status: 'first_version',
                approvals: {},
                comments: []
            });
        }
      }

      // 3. Actualizar
      const newProject: Project = {
        id: projectId.toString(),
        name: firstFileName,
        parentId: currentFolderId,
        type: 'project',
        versions: [{ id: `v1-${projectId}`, versionNumber: 1, createdAt: new Date(), isActive: true, pages: uploadedPages as any }],
        advertisingEmails: [],
        productDirectionEmails: []
      };

      setProjects(prev => [newProject, ...prev]);
      setIsUploading(false);
      setTimeout(() => navigate(`/project/${projectId}`), 500);

    } catch (err) {
      console.error(err); setIsUploading(false); alert('Error al subir.');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesUpload(e.target.files);
      e.target.value = '';
    }
  };

  const renderTreeItem = (parentId: string | null, depth: number = 0) => {
    const items = folders.filter(f => f.parentId === parentId);
    if (items.length === 0) return null;
    return (
      <ul className={`${depth > 0 ? 'ml-4 border-l border-slate-100' : ''}`}>
        {items.map(folder => {
          const isExpanded = expandedFolders.has(folder.id);
          const hasChildren = folders.some(f => f.parentId === folder.id);
          const isActive = currentFolderId === folder.id;
          return (
            <li key={folder.id} className="mt-1">
              <div onClick={() => navigate(`/folder/${folder.id}`)} className={`flex items-center gap-1 py-1.5 px-2 rounded-lg cursor-pointer transition-all hover:bg-slate-100 group ${isActive ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600'}`}>
                <div onClick={(e) => toggleExpand(folder.id, e)} className={`p-0.5 rounded hover:bg-slate-200 transition-colors ${!hasChildren ? 'invisible' : ''}`}>
                  <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                </div>
                <svg className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                <span className="text-xs truncate">{folder.name}</span>
              </div>
              {isExpanded && renderTreeItem(folder.id, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Modal Borrar */}
      {itemToDelete && (
         <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setItemToDelete(null)}></div>
             <div className="relative bg-white p-8 rounded-2xl shadow-2xl max-w-sm">
                 <p className="mb-4 font-bold text-center">¿Borrar {itemToDelete.name}?</p>
                 <div className="flex gap-2">
                     <button onClick={() => setItemToDelete(null)} className="flex-1 bg-slate-100 py-2 rounded font-bold text-slate-600">Cancelar</button>
                     <button onClick={confirmDelete} className="flex-1 bg-rose-600 text-white py-2 rounded font-bold shadow-lg shadow-rose-200">Borrar</button>
                 </div>
             </div>
         </div>
      )}

      {/* Sidebar Árbol */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
         <div className="p-4 border-b border-slate-100"><h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Estructura</h3></div>
         <nav className="flex-1 overflow-y-auto p-3 custom-scrollbar">
            <div onClick={() => navigate('/')} className={`flex items-center gap-2 py-2 px-3 rounded-xl cursor-pointer transition-all hover:bg-slate-100 mb-2 ${!currentFolderId ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-100' : 'text-slate-700'}`}>
              <svg className={`w-4 h-4 ${!currentFolderId ? 'text-white' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              <span className="text-xs">Proyectos</span>
            </div>
            {renderTreeItem(null)}
         </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-slate-50 relative">
        <div className="max-w-6xl mx-auto px-6 py-8">
          
          <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,image/*" multiple onChange={handleFileSelect} />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
               <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                 {breadcrumbs.map((crumb, idx) => (
                   <React.Fragment key={crumb.id || 'root'}>
                     {idx > 0 && <span className="text-slate-300">/</span>}
                     <Link to={crumb.id ? `/folder/${crumb.id}` : '/'} className="hover:text-indigo-600 transition-colors">{crumb.name}</Link>
                   </React.Fragment>
                 ))}
               </nav>
               <h1 className="text-3xl font-black text-slate-900 tracking-tight">{currentFolderId ? folders.find(f => f.id === currentFolderId)?.name : 'Proyectos'}</h1>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
                {/* BOTONES DE VISTA (GRID / LISTA) */}
                <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm mr-2">
                    <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-slate-100 text-indigo-600 shadow-inner' : 'text-slate-400 hover:text-slate-600'}`} title="Vista Cuadrícula">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                    </button>
                    <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-slate-100 text-indigo-600 shadow-inner' : 'text-slate-400 hover:text-slate-600'}`} title="Vista Lista">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                </div>

                <button onClick={() => setIsCreatingFolder(true)} className="bg-white border border-slate-200 hover:border-indigo-600 text-slate-700 px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-sm">
                    <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                    Nueva Carpeta
                </button>
                
                <button 
                  onClick={() => !isUploading && fileInputRef.current?.click()} 
                  className={`px-5 py-2.5 rounded-xl font-bold text-sm text-white flex items-center gap-2 shadow-lg transition-all ${isUploading ? 'bg-slate-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'}`}
                >
                  {isUploading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Subiendo...</span>
                      </>
                  ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                        <span>Subir Folleto</span>
                      </>
                  )}
                </button>
            </div>
          </div>

          {viewMode === 'grid' ? (
            /* VISTA CUADRÍCULA */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {isCreatingFolder && (
                  <div className="bg-indigo-50/50 rounded-2xl border-2 border-dashed border-indigo-200 p-5">
                    <input autoFocus onBlur={handleCreateFolder} onKeyDown={e => e.key === 'Enter' && handleCreateFolder()} onChange={e => setNewFolderName(e.target.value)} className="w-full bg-white border border-indigo-200 rounded px-2 py-1.5 text-sm font-bold outline-none" placeholder="Nombre..." />
                  </div>
                )}
                
                {currentFolders.map(f => (
                    <div key={f.id} onClick={() => navigate(`/folder/${f.id}`)} className="bg-white p-5 rounded-2xl border border-slate-200 hover:shadow-lg cursor-pointer transition-all hover:-translate-y-1">
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center mb-3">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                        </div>
                        <h3 className="font-bold truncate">{f.name}</h3>
                        <div className="flex justify-between mt-2">
                          <span className="text-xs font-bold text-slate-400 uppercase">Carpeta</span>
                          <button onClick={(e) => handleDeleteClick(f, e)} className="text-slate-300 hover:text-rose-500"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                        </div>
                    </div>
                ))}

                {currentProjects.map(p => (
                    <div key={p.id} onClick={() => navigate(`/project/${p.id}`)} className="bg-white p-5 rounded-2xl border border-slate-200 hover:shadow-lg cursor-pointer transition-all hover:-translate-y-1">
                        <div className="w-full aspect-video bg-slate-50 text-slate-400 rounded-lg flex items-center justify-center mb-3 overflow-hidden relative border border-slate-100">
                            {p.versions[0]?.pages[0] ? (
                                <img src={p.versions[0].pages[0].imageUrl} className="w-full h-full object-cover" />
                            ) : (
                                <svg className="w-8 h-8 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            )}
                            {p.versions[0]?.pages.length > 1 && (
                                <div className="absolute bottom-1 right-1 bg-black/70 backdrop-blur text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                                    {p.versions[0].pages.length} págs
                                </div>
                            )}
                        </div>
                        <h3 className="font-bold truncate text-sm">{p.name}</h3>
                        <div className="flex justify-between mt-2 items-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Folleto</span>
                          <button onClick={(e) => handleDeleteClick(p, e)} className="text-slate-300 hover:text-rose-500 p-1"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                        </div>
                    </div>
                ))}
            </div>
          ) : (
            /* VISTA LISTA (TABLA) */
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Nombre</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Páginas</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {currentFolders.map(f => (
                    <tr key={f.id} onClick={() => navigate(`/folder/${f.id}`)} className="group hover:bg-slate-50 cursor-pointer transition-colors">
                      <td className="px-6 py-4"><div className="flex items-center gap-3"><svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg><span className="font-bold text-slate-900">{f.name}</span></div></td>
                      <td className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Carpeta</td>
                      <td className="px-6 py-4 text-center text-slate-400 text-xs font-bold">-</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100">
                          <button onClick={(e) => handleDeleteClick(f, e)} className="p-2 text-slate-400 hover:text-rose-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {currentProjects.map(p => (
                    <tr key={p.id} onClick={() => navigate(`/project/${p.id}`)} className="group hover:bg-slate-50 cursor-pointer transition-colors">
                      <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                              {/* Miniatura en lista */}
                              <div className="w-8 h-8 rounded bg-slate-100 overflow-hidden border border-slate-200">
                                  {p.versions[0]?.pages[0] ? <img src={p.versions[0].pages[0].imageUrl} className="w-full h-full object-cover" /> : null}
                              </div>
                              <span className="font-bold text-slate-900">{p.name}</span>
                          </div>
                      </td>
                      <td className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Folleto</td>
                      <td className="px-6 py-4 text-center text-xs font-bold text-slate-600">{p.versions[0]?.pages.length || 0}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100">
                          <button onClick={(e) => handleDeleteClick(p, e)} className="p-2 text-slate-400 hover:text-rose-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }`}</style>
    </div>
  );
};

export default Dashboard;
