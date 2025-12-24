import React, { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Project, Folder, AppNotification } from '../types';
import { supabase } from '../supabase';

interface DashboardProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  folders: Folder[];
  setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
  addNotification?: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ projects, setProjects, folders, setFolders, addNotification }) => {
  const navigate = useNavigate();
  const { folderId } = useParams<{ folderId: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Filtrar contenido según la carpeta actual
  const currentFolder = folders.find(f => f.id === folderId);
  const filteredProjects = projects.filter(p => p.parentId === (folderId || null));
  const filteredFolders = folders.filter(f => f.parentId === (folderId || null));

  // --- SUBIR NUEVO PROYECTO (MASIVO) ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploading(true);

    const files = Array.from(e.target.files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    // Usamos el nombre del primer archivo como nombre del proyecto (limpio)
    const projectName = files[0].name.split('.')[0].replace(/[-_]/g, ' ');

    try {
      // 1. Crear Proyecto
      const { data: projectData, error: projError } = await supabase
        .from('projects')
        .insert([{ title: projectName, parent_id: folderId || null, status: 'active' }])
        .select();

      if (projError || !projectData) throw new Error("Error creando proyecto");
      const newProjectId = projectData[0].id;

      // 2. Subir Imágenes y Crear Páginas
      const newPages = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `${newProjectId}-${Date.now()}-${i}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        
        await supabase.storage.from('brochures').upload(fileName, file);
        const { data: { publicUrl } } = supabase.storage.from('brochures').getPublicUrl(fileName);

        const { data: pageData } = await supabase
          .from('pages')
          .insert([{ 
            project_id: newProjectId, 
            image_url: publicUrl, 
            page_number: i + 1,
            version: 1, // V1 inicial
            status: '1ª corrección'
          }])
          .select();
          
        if (pageData) {
            newPages.push({
                id: pageData[0].id.toString(),
                pageNumber: i + 1,
                imageUrl: publicUrl,
                status: '1ª corrección',
                approvals: {},
                comments: []
            });
        }
      }

      // 3. Actualizar Estado Local
      const newProject: Project = {
        id: newProjectId.toString(),
        name: projectName,
        parentId: folderId || null,
        type: 'project',
        advertisingEmails: [],
        productDirectionEmails: [],
        versions: [{
            id: `v1-${newProjectId}`,
            versionNumber: 1,
            createdAt: new Date(),
            isActive: true,
            pages: newPages as any
        }]
      };

      setProjects(prev => [newProject, ...prev]);
      if (addNotification) addNotification({ type: 'system', title: 'Proyecto Creado', message: `Se ha subido "${projectName}" correctamente.` });

    } catch (error) {
      console.error(error);
      alert("Error al subir el folleto. Inténtalo de nuevo.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const { data, error } = await supabase.from('folders').insert([{ name: newFolderName, parent_id: folderId || null }]).select();
    
    if (!error && data) {
      const newFolder: Folder = { id: data[0].id.toString(), name: data[0].name, parentId: data[0].parent_id, type: 'folder' };
      setFolders(prev => [...prev, newFolder]);
      setNewFolderName("");
      setIsCreatingFolder(false);
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("¿Seguro que quieres eliminar este proyecto?")) return;
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (!error) setProjects(prev => prev.filter(p => p.id !== id));
  };

  // --- BREADCRUMBS ---
  const getBreadcrumbs = () => {
    const crumbs = [];
    let current = currentFolder;
    while (current) {
      crumbs.unshift(current);
      current = folders.find(f => f.id === current.parentId);
    }
    return crumbs;
  };

  return (
    <div className="flex h-full bg-slate-50">
      <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*,.pdf" onChange={handleFileUpload} />

      {/* --- SIDEBAR LATERAL --- */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
        <div className="p-6">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Estructura</h2>
          <nav className="space-y-1">
            <button 
              onClick={() => navigate('/')}
              // CAMBIO: bg-rose-50 text-rose-700 para el activo
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${!folderId ? 'bg-rose-50 text-rose-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <svg className={`w-5 h-5 ${!folderId ? 'text-rose-600' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              Proyectos
            </button>
            
            {/* Lista de carpetas raíz en el sidebar */}
            {folders.filter(f => !f.parentId).map(folder => (
              <div key={folder.id} className="pl-4">
                 <button 
                   onClick={() => navigate(`/folder/${folder.id}`)}
                   className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${folderId === folder.id ? 'bg-rose-50 text-rose-700' : 'text-slate-600 hover:bg-slate-50'}`}
                 >
                   <svg className={`w-5 h-5 ${folderId === folder.id ? 'text-rose-500' : 'text-slate-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                   {folder.name}
                 </button>
                 {/* Subcarpetas si está abierta */}
                 {(folderId === folder.id || folders.find(f => f.id === folderId)?.parentId === folder.id) && (
                    <div className="pl-4 mt-1 space-y-1 border-l-2 border-slate-100 ml-2">
                        {folders.filter(sub => sub.parentId === folder.id).map(sub => (
                            <button key={sub.id} onClick={() => navigate(`/folder/${sub.id}`)} className={`w-full text-left px-3 py-1.5 rounded-md text-xs font-bold ${folderId === sub.id ? 'text-rose-600 bg-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                                {sub.name}
                            </button>
                        ))}
                    </div>
                 )}
              </div>
            ))}
          </nav>
        </div>
      </aside>

      {/* --- CONTENIDO PRINCIPAL --- */}
      <main className="flex-1 overflow-auto p-8">
        {/* Cabecera y Migas de Pan */}
        <div className="flex items-center justify-between mb-8">
            <div>
               <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                  <span onClick={() => navigate('/')} className="cursor-pointer hover:text-rose-600">Proyectos</span>
                  {getBreadcrumbs().map(crumb => (
                      <React.Fragment key={crumb.id}>
                          <span>/</span>
                          <span onClick={() => navigate(`/folder/${crumb.id}`)} className="cursor-pointer hover:text-rose-600">{crumb.name}</span>
                      </React.Fragment>
                  ))}
               </div>
               <h1 className="text-3xl font-black text-slate-900 tracking-tight">{currentFolder ? currentFolder.name : 'Proyectos'}</h1>
            </div>

            <div className="flex gap-3">
                {/* BOTÓN VISTAS */}
                <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                    <button className="p-2 rounded-lg bg-rose-50 text-rose-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg></button>
                    <button className="p-2 rounded-lg text-slate-400 hover:text-slate-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
                </div>

                {/* BOTÓN NUEVA CARPETA */}
                {!isCreatingFolder ? (
                    <button onClick={() => setIsCreatingFolder(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-rose-200 hover:text-rose-600 text-slate-700 rounded-xl font-bold text-sm shadow-sm transition-all">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                        Nueva Carpeta
                    </button>
                ) : (
                    <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-rose-200 shadow-lg animate-in fade-in slide-in-from-right-5">
                        <input autoFocus type="text" placeholder="Nombre..." value={newFolderName} onChange={e => setNewFolderName(e.target.value)} className="w-32 px-3 py-1.5 text-sm outline-none font-bold text-slate-700" onKeyDown={e => e.key === 'Enter' && handleCreateFolder()} />
                        <button onClick={handleCreateFolder} className="p-1.5 bg-rose-100 text-rose-600 rounded-lg hover:bg-rose-200"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg></button>
                        <button onClick={() => setIsCreatingFolder(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>
                )}

                {/* BOTÓN SUBIR FOLLETO (ROJO) */}
                <button 
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm text-white shadow-xl hover:-translate-y-1 transition-all ${isUploading ? 'bg-slate-400 cursor-wait' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'}`}
                >
                    {isUploading ? 'Subiendo...' : 'Subir Folleto'}
                    {!isUploading && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>}
                </button>
            </div>
        </div>

        {/* --- GRID DE CONTENIDO --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5 gap-6">
            
            {/* CARPETAS */}
            {filteredFolders.map(folder => (
                <div key={folder.id} onClick={() => navigate(`/folder/${folder.id}`)} className="group bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-rose-100 transition-all cursor-pointer">
                    <div className="flex justify-between items-start mb-4">
                        {/* CAMBIO: Icono carpeta azul -> rosa/rojo suave */}
                        <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform">
                           <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                        </div>
                    </div>
                    <h3 className="font-bold text-slate-800 truncate">{folder.name}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Carpeta</p>
                </div>
            ))}

            {/* PROYECTOS */}
            {filteredProjects.map(project => {
                const currentVersion = project.versions[0];
                const coverImage = currentVersion?.pages[0]?.imageUrl;
                const pageCount = currentVersion?.pages.length || 0;

                return (
                    <div key={project.id} onClick={() => navigate(`/project/${project.id}`)} className="group bg-white p-4 rounded-3xl border border-slate-200 shadow-sm hover:shadow-2xl hover:border-rose-200 transition-all cursor-pointer flex flex-col">
                        <div className="relative aspect-[4/3] bg-slate-100 rounded-2xl overflow-hidden mb-4 border border-slate-100">
                             {coverImage ? (
                                <img src={coverImage} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                             ) : (
                                <div className="flex items-center justify-center h-full text-slate-300"><svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
                             )}
                             <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-lg">
                                {pageCount} págs
                             </div>
                        </div>
                        
                        <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0 pr-2">
                                <h3 className="font-bold text-slate-900 truncate leading-tight">{project.name}</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Folleto</p>
                            </div>
                            <button onClick={(e) => handleDeleteProject(project.id, e)} className="text-slate-300 hover:text-rose-500 p-1 rounded-lg hover:bg-rose-50 transition-colors">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>

        {filteredFolders.length === 0 && filteredProjects.length === 0 && (
            <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-[2rem] bg-slate-50/50 mt-10">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                    <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
                </div>
                <p className="text-slate-400 font-bold text-sm">Esta carpeta está vacía</p>
            </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
