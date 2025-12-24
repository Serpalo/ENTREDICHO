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
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [itemToDelete, setItemToDelete] = useState<FileSystemItem | null>(null);

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [activeEmailTab, setActiveEmailTab] = useState<"Publicidad" | "Dirección de producto">("Publicidad");
  const [newEmail, setNewEmail] = useState("");
  const [isSending, setIsSending] = useState(false);

  const currentFolders = folders.filter(f => f.parentId === currentFolderId);
  const currentProjects = projects.filter(p => p.parentId === currentFolderId);

  useEffect(() => {
    if ((showEmailModal || showCalendarModal) && !activeProjectId && currentProjects.length > 0) {
      setActiveProjectId(currentProjects[0].id);
    }
  }, [showEmailModal, showCalendarModal, activeProjectId, currentProjects]);

  const activeProject = projects.find(p => p.id === activeProjectId);

  const splitISO = (iso: string | undefined) => {
    if (!iso) return { date: '', time: '' };
    const dt = new Date(iso);
    const date = dt.toISOString().split('T')[0];
    const time = dt.toTimeString().split(' ')[0].substring(0, 5); 
    return { date, time };
  };

  const [tempDates, setTempDates] = useState({
    startDate: "",
    startTime: "09:00",
    endDate: "",
    endTime: "18:00"
  });

  useEffect(() => {
    if (activeProject) {
      const si = splitISO(activeProject.correctionPeriod?.startDateTime);
      const ei = splitISO(activeProject.correctionPeriod?.endDateTime);
      setTempDates({
        startDate: si.date || new Date().toISOString().split('T')[0],
        startTime: si.time || "09:00",
        endDate: ei.date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endTime: ei.time || "18:00"
      });
    }
  }, [activeProjectId, activeProject?.correctionPeriod]);

  useEffect(() => {
    if (currentFolderId) {
      const newExpanded = new Set(expandedFolders);
      let currId: string | null = currentFolderId;
      while (currId) {
        const folder = folders.find(f => f.id === currId);
        if (folder && folder.parentId) {
          newExpanded.add(folder.parentId);
          currId = folder.parentId;
        } else {
          currId = null;
        }
      }
      setExpandedFolders(newExpanded);
    }
  }, [currentFolderId, folders]);

  const getBreadcrumbs = () => {
    const crumbs: { name: string; id: string | null }[] = [{ name: 'Proyectos', id: null }];
    let currentId = currentFolderId;
    const path: { name: string; id: string | null }[] = [];

    while (currentId) {
      const folder = folders.find(f => f.id === currentId);
      if (folder) {
        path.unshift({ name: folder.name, id: folder.id });
        currentId = folder.parentId;
      } else {
        break;
      }
    }
    return [...crumbs, ...path];
  };

  const breadcrumbs = getBreadcrumbs();

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setIsCreatingFolder(false);
      return;
    }
    
    const { data, error } = await supabase
      .from('folders')
      .insert([{ name: newFolderName, parent_id: currentFolderId }])
      .select();

    if (error) {
      console.error('Error creando carpeta:', error);
      alert('No se pudo crear la carpeta en la base de datos.');
      return;
    }

    if (data && data.length > 0) {
      const newFolder: Folder = {
        id: data[0].id.toString(),
        name: data[0].name,
        parentId: data[0].parent_id,
        type: 'folder'
      };
      setFolders(prev => [...prev, newFolder]);
    }
    setNewFolderName("");
    setIsCreatingFolder(false);
  };

  const handleRename = (item: FileSystemItem) => {
    setIsRenaming(item.id);
    setRenameValue(item.name);
  };

  const saveRename = () => {
    if (!isRenaming || !renameValue.trim()) {
      setIsRenaming(null);
      return;
    }
    const isFolder = folders.some(f => f.id === isRenaming);
    if (isFolder) {
      setFolders(prev => prev.map(f => f.id === isRenaming ? { ...f, name: renameValue } : f));
    } else {
      setProjects(prev => prev.map(p => p.id === isRenaming ? { ...p, name: renameValue } : p));
    }
    setIsRenaming(null);
  };

  // --- FUNCIÓN BORRAR CORREGIDA (AHORA BORRA DE SUPABASE) ---
  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      if (itemToDelete.type === 'folder') {
        // 1. Borrar de Supabase (Tabla Folders)
        const { error } = await supabase
          .from('folders')
          .delete()
          .eq('id', itemToDelete.id);

        if (error) throw error;

        // 2. Actualizar Pantalla (Recursivo visual)
        const deleteRecursive = (id: string, allFolders: Folder[]): string[] => {
          const ids = [id];
          const children = allFolders.filter(f => f.parentId === id);
          children.forEach(c => ids.push(...deleteRecursive(c.id, allFolders)));
          return ids;
        };
        const folderIdsToRemove = deleteRecursive(itemToDelete.id, folders);
        setFolders(prev => prev.filter(f => !folderIdsToRemove.includes(f.id)));
        setProjects(prev => prev.filter(p => !folderIdsToRemove.includes(p.parentId || '')));

      } else {
        // 1. Borrar de Supabase (Tabla Projects)
        const { error } = await supabase
          .from('projects')
          .delete()
          .eq('id', itemToDelete.id);

        if (error) throw error;

        // 2. Actualizar Pantalla
        setProjects(prev => prev.filter(p => p.id !== itemToDelete.id));
      }
    } catch (err) {
      console.error('Error al borrar:', err);
      alert('Error al borrar de la base de datos.');
    }
    
    setItemToDelete(null);
  };

  const handleDeleteClick = (item: FileSystemItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setItemToDelete(item);
  };

  const handleFilesUpload = async (files: FileList | File[], targetFolderId: string | null = currentFolderId) => {
    const file = files[0];
    if (!file) return;

    const projectName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").trim();
    // Limpiamos caracteres raros del nombre del archivo para que no falle al subir
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${Date.now()}-${cleanFileName}`;

    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('brochures')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Error storage:', uploadError);
        alert('Error al subir archivo. Revisa si tu bucket "brochures" permite archivos PDF e imágenes.');
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('brochures')
        .getPublicUrl(fileName);

      const { data, error } = await supabase
        .from('projects')
        .insert([
          { 
            title: projectName, 
            status: 'active', 
            description: 'Subido desde Dashboard',
            image_url: publicUrl,
            parent_id: targetFolderId 
          }
        ])
        .select();

      if (error) {
        console.error('Error DB:', error);
        alert('Error al guardar el proyecto en la base de datos.');
        return;
      }

      if (data && data.length > 0) {
        const savedProject = data[0];
        const realId = savedProject.id.toString();

        const newProject: Project = {
          id: realId,
          name: projectName,
          parentId: targetFolderId,
          type: 'project',
          versions: [
             {
               id: `v1-${realId}`,
               versionNumber: 1,
               createdAt: new Date(),
               isActive: true,
               pages: [
                 {
                   id: `pg1-${realId}`,
                   pageNumber: 1,
                   imageUrl: publicUrl,
                   status: 'first_version' as any,
                   approvals: {},
                   comments: []
                 }
               ]
             }
          ],
          advertisingEmails: [],
          productDirectionEmails: []
        };

        setProjects(prev => [newProject, ...prev]);
        setTimeout(() => navigate(`/project/${realId}`), 100);
      }

    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFilesUpload(e.target.files);
      e.target.value = '';
    }
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedFolders(newExpanded);
  };

  const getPeriodStatus = (project: Project) => {
    if (!project.correctionPeriod) return null;
    const now = new Date().getTime();
    const start = new Date(project.correctionPeriod.startDateTime).getTime();
    const end = new Date(project.correctionPeriod.endDateTime).getTime();
    const total = end - start;
    const elapsed = now - start;
    const progress = Math.max(0, Math.min(100, (elapsed / total) * 100));
    if (now < start) {
      const diff = start - now;
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return { label: `Inicia en ${days}d`, color: 'text-amber-500 bg-amber-50', barColor: 'bg-amber-400', progress: 0 };
    }
    if (now > end) {
      return { label: 'Finalizado', color: 'text-rose-500 bg-rose-50', barColor: 'bg-slate-300', progress: 100 };
    }
    const diff = end - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return { label: `${days}d restantes`, color: 'text-emerald-500 bg-emerald-50', barColor: 'bg-emerald-500', progress };
  };

  const addEmail = () => {
    if (!newEmail || !newEmail.includes('@') || !activeProjectId) return;
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const field = activeEmailTab === "Publicidad" ? 'advertisingEmails' : 'productDirectionEmails';
      const emails = p[field] || [];
      if (emails.includes(newEmail)) return p;
      return { ...p, [field]: [...emails, newEmail] };
    }));
    setNewEmail("");
  };

  const removeEmail = (email: string) => {
    if (!activeProjectId) return;
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const field = activeEmailTab === "Publicidad" ? 'advertisingEmails' : 'productDirectionEmails';
      return { ...p, [field]: (p[field] || []).filter(e => e !== email) };
    }));
  };

  const savePeriod = () => {
    if (!activeProjectId) return;
    const startDateTime = new Date(`${tempDates.startDate}T${tempDates.startTime}`).toISOString();
    const endDateTime = new Date(`${tempDates.endDate}T${tempDates.endTime}`).toISOString();
    setProjects(prev => prev.map(p => p.id === activeProjectId ? { 
      ...p, 
      correctionPeriod: { startDateTime, endDateTime } 
    } : p));
    setShowCalendarModal(false);
  };

  const handleSendNotifications = () => {
    if (!activeProject || !addNotification) return;
    const allEmails = [
      ...(activeProject.advertisingEmails || []),
      ...(activeProject.productDirectionEmails || [])
    ];

    if (allEmails.length === 0) {
      alert("Debes añadir al menos un correo electrónico antes de enviar.");
      return;
    }

    setIsSending(true);

    setTimeout(() => {
      addNotification({
        type: 'system',
        title: 'TIENE UN NUEVO FOLLETO PARA CORREGIR',
        message: `Se ha enviado el aviso a ${allEmails.length} correos para el folleto '${activeProject.name}'. Haga clic para abrir y corregir.`,
        link: `/project/${activeProjectId}`
      });
      setIsSending(false);
      setShowEmailModal(false);
    }, 1200);
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
              <div 
                onClick={() => navigate(`/folder/${folder.id}`)}
                className={`flex items-center gap-1 py-1.5 px-2 rounded-lg cursor-pointer transition-all hover:bg-slate-100 group ${isActive ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600'}`}
              >
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
      {/* Modals Container */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setItemToDelete(null)}></div>
          <div className="relative bg-white rounded-[2rem] shadow-2xl max-w-sm w-full p-8 animate-in zoom-in duration-200">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
               <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h3 className="text-xl font-black text-slate-900 text-center mb-2 tracking-tight">¿Eliminar elemento?</h3>
            <p className="text-slate-500 text-sm text-center mb-8">Estás a punto de borrar <strong>{itemToDelete.name}</strong>. {itemToDelete.type === 'folder' ? 'Esto eliminará permanentemente la carpeta y su contenido.' : 'Esta acción no se puede deshacer.'}</p>
            <div className="flex gap-3">
              <button onClick={() => setItemToDelete(null)} className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all">Cancelar</button>
              <button onClick={confirmDelete} className="flex-1 px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl shadow-lg shadow-rose-100 transition-all">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl p-8 flex flex-col animate-in slide-in-from-right">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">Notificaciones</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Configurar avisos por correo</p>
              </div>
              <button onClick={() => setShowEmailModal(false)} className="p-2 hover:bg-slate-100 rounded-lg"><svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>

            <div className="mb-6">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Seleccionar Folleto</label>
              <select 
                value={activeProjectId || ""} 
                onChange={(e) => setActiveProjectId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              >
                {currentProjects.length === 0 && <option value="">No hay proyectos en esta carpeta</option>}
                {currentProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {activeProject ? (
              <>
                <div className="flex border-b border-slate-100 mb-6">
                  {(["Publicidad", "Dirección de producto"] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveEmailTab(tab)} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeEmailTab === tab ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400"}`}>{tab}</button>
                  ))}
                </div>
                <div className="flex gap-2 mb-8">
                  <input type="email" placeholder="email@ejemplo.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && addEmail()} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  <button onClick={addEmail} className="bg-slate-900 text-white px-4 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all">Añadir</button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar mb-6">
                  {(activeEmailTab === "Publicidad" ? activeProject.advertisingEmails : activeProject.productDirectionEmails)?.map(email => (
                    <div key={email} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group">
                      <span className="text-sm font-bold text-slate-700">{email}</span>
                      <button onClick={() => removeEmail(email)} className="text-rose-500 opacity-0 group-hover:opacity-100 p-2 hover:bg-rose-50 rounded-lg transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                    </div>
                  ))}
                  {((activeEmailTab === "Publicidad" ? activeProject.advertisingEmails : activeProject.productDirectionEmails)?.length || 0) === 0 && (
                    <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                        <p className="text-xs font-bold text-slate-300 uppercase">Sin correos en esta lista</p>
                    </div>
                  )}
                </div>

                <button 
                  onClick={handleSendNotifications}
                  disabled={isSending || ((activeProject.advertisingEmails?.length || 0) + (activeProject.productDirectionEmails?.length || 0) === 0)}
                  className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-xl ${isSending || ((activeProject.advertisingEmails?.length || 0) + (activeProject.productDirectionEmails?.length || 0) === 0) ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100 hover:-translate-y-1'}`}
                >
                  {isSending ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>ENVIANDO AVISOS...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      <span>ENVIAR AVISO A TODOS</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-xs font-bold uppercase tracking-widest text-center">
                Debes tener un proyecto para configurar notificaciones
              </div>
            )}
          </div>
        </div>
      )}

      {/* Calendar Modal */}
      {showCalendarModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Plazo de Corrección</h3>
                  <p className="text-slate-400 text-sm font-medium">Define el tiempo disponible para cambios</p>
                </div>
                <button onClick={() => setShowCalendarModal(false)} className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-2xl transition-all">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="mb-8">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Proyecto a configurar</label>
                <select 
                  value={activeProjectId || ""} 
                  onChange={(e) => setActiveProjectId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                >
                  {currentProjects.length === 0 && <option value="">No hay proyectos</option>}
                  {currentProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {activeProject ? (
                <>
                  <div className="space-y-6 mb-10">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2"><label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Inicio</label></div>
                        <input type="date" value={tempDates.startDate} onChange={(e) => setTempDates({ ...tempDates, startDate: e.target.value })} className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-700 font-bold focus:ring-4 focus:ring-indigo-100 outline-none transition-all" />
                        <input type="time" value={tempDates.startTime} onChange={(e) => setTempDates({ ...tempDates, startTime: e.target.value })} className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-700 font-bold focus:ring-4 focus:ring-indigo-100 outline-none transition-all" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2"><label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Fin / Fecha Límite</label></div>
                        <input type="date" value={tempDates.endDate} onChange={(e) => setTempDates({ ...tempDates, endDate: e.target.value })} className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-700 font-bold focus:ring-4 focus:ring-indigo-100 outline-none transition-all" />
                        <input type="time" value={tempDates.endTime} onChange={(e) => setTempDates({ ...tempDates, endTime: e.target.value })} className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-700 font-bold focus:ring-4 focus:ring-indigo-100 outline-none transition-all" />
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => setShowCalendarModal(false)} className="flex-1 px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all">Cancelar</button>
                    <button onClick={savePeriod} className="flex-1 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-xl shadow-indigo-100 transition-all">Guardar Plazo</button>
                  </div>
                </>
              ) : (
                <div className="py-10 text-center text-slate-400 text-sm font-bold uppercase tracking-widest">
                  No hay folletos disponibles para configurar
                </div>
              )}
           </div>
        </div>
      )}

      {/* Sidebar Folder Tree */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100"><h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Estructura</h3></div>
        <nav className="flex-1 overflow-y-auto p-3 custom-scrollbar">
          <div onClick={() => navigate('/')} className={`flex items-center gap-2 py-2 px-3 rounded-xl cursor-pointer transition-all hover:bg-slate-100 mb-2 ${!currentFolderId ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-100' : 'text-slate-700'}`}>
            <svg className={`w-4 h-4 ${!currentFolderId ? 'text-white' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            <span className="text-xs">Proyectos</span>
          </div>
          {renderTreeItem(null)}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-slate-50 relative" onDragOver={(e) => { e.preventDefault(); setIsGlobalDragging(true); }} onDragLeave={(e) => { e.preventDefault(); if (e.clientX === 0) setIsGlobalDragging(false); }} onDrop={(e) => { e.preventDefault(); setIsGlobalDragging(false); if (e.dataTransfer.files.length > 0) handleFilesUpload(e.dataTransfer.files); }}>
        <div className="max-w-6xl mx-auto px-6 py-8">
          <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,image/*" onChange={handleFileSelect} />
          
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
              <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm mr-2">
                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-slate-100 text-indigo-600 shadow-inner' : 'text-slate-400 hover:text-slate-600'}`} title="Vista Cuadrícula">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                </button>
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-slate-100 text-indigo-600 shadow-inner' : 'text-slate-400 hover:text-slate-600'}`} title="Vista Lista">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
              </div>

              <button 
                onClick={() => setShowCalendarModal(true)}
                className="bg-white border border-slate-200 hover:border-indigo-600 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shadow-sm"
              >
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                Plazo de Cambios
              </button>
              <button 
                onClick={() => setShowEmailModal(true)}
                className="bg-white border border-slate-200 hover:border-indigo-600 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shadow-sm"
              >
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                Notificaciones
              </button>

              <button onClick={() => setIsCreatingFolder(true)} className="bg-white border border-slate-200 hover:border-indigo-600 text-slate-700 px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-sm">
                <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                Nueva Carpeta
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-indigo-100">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                Subir Folleto
              </button>
            </div>
          </div>

          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {isCreatingFolder && (
                <div className="bg-indigo-50/50 rounded-2xl border-2 border-dashed border-indigo-200 p-5">
                  <input ref={newFolderInputRef} type="text" placeholder="Nombre..." value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onBlur={handleCreateFolder} onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()} className="w-full bg-white border border-indigo-200 rounded px-2 py-1.5 text-sm font-bold outline-none" />
                </div>
              )}
              {currentFolders.map(f => (
                <div key={f.id} onClick={() => navigate(`/folder/${f.id}`)} className="group relative rounded-2xl border p-5 transition-all cursor-pointer hover:-translate-y-1 bg-white border-slate-200 hover:shadow-lg">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-all bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); handleRename(f); }} className="p-2 text-slate-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                      <button onClick={(e) => handleDeleteClick(f, e)} className="p-2 text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                    </div>
                  </div>
                  {isRenaming === f.id ? (
                    <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)} onBlur={saveRename} onKeyDown={e => e.key === 'Enter' && saveRename()} className="w-full bg-slate-50 border border-indigo-300 rounded px-2 py-1 text-sm font-bold outline-none" onClick={e => e.stopPropagation()} />
                  ) : (
                    <>
                      <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 truncate">{f.name}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Carpeta</p>
                    </>
                  )}
                </div>
              ))}
              {currentProjects.map(p => {
                const period = getPeriodStatus(p);
                // DETECTAR SI ES PDF
                const isPdf = p.versions[p.versions.length-1]?.pages[0]?.imageUrl?.toLowerCase().includes('.pdf');
                
                return (
                  <div key={p.id} onClick={() => navigate(`/project/${p.id}`)} className="group relative bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg hover:border-indigo-200 transition-all cursor-pointer hover:-translate-y-1 overflow-hidden">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner overflow-hidden relative">
                        {p.versions[p.versions.length-1]?.pages[0] ? (
                          isPdf ? (
                            <div className="flex flex-col items-center justify-center text-rose-500 bg-rose-50 w-full h-full">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                <span className="text-[8px] font-bold uppercase mt-1">PDF</span>
                            </div>
                          ) : (
                            <img src={p.versions[p.versions.length-1].pages[0].imageUrl} className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition-opacity" />
                          )
                        ) : (
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        )}
                      </div>
                      <div className="flex gap-0.5">
                        <button onClick={(e) => { e.stopPropagation(); handleRename(p); }} className="p-2 text-slate-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                        <button onClick={(e) => handleDeleteClick(p, e)} className="p-2 text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                      </div>
                    </div>
                    {isRenaming === p.id ? (
                      <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)} onBlur={saveRename} onKeyDown={e => e.key === 'Enter' && saveRename()} className="w-full bg-slate-50 border border-indigo-300 rounded px-2 py-1 text-sm font-bold outline-none" onClick={e => e.stopPropagation()} />
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2">
                           <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 truncate">{p.name}</h3>
                           {period && <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${period.color}`}>{period.label}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Folleto</span>
                          {p.versions.length > 0 && <span className="text-[9px] font-black bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 uppercase tracking-tighter">v{p.versions[p.versions.length-1].versionNumber}</span>}
                        </div>
                      </>
                    )}
                    {period && (
                      <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-50">
                        <div className={`h-full transition-all duration-500 ${period.barColor}`} style={{ width: `${period.progress}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Nombre</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Plazo de Cambios</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {currentFolders.map(f => (
                    <tr key={f.id} onClick={() => navigate(`/folder/${f.id}`)} className="group hover:bg-slate-50 cursor-pointer transition-colors">
                      <td className="px-6 py-4"><div className="flex items-center gap-3"><svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg><span className="font-bold text-slate-900">{f.name}</span></div></td>
                      <td className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Carpeta</td>
                      <td className="px-6 py-4"></td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100">
                          <button onClick={(e) => { e.stopPropagation(); handleRename(f); }} className="p-2 text-slate-400 hover:text-indigo-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                          <button onClick={(e) => handleDeleteClick(f, e)} className="p-2 text-slate-400 hover:text-rose-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {currentProjects.map(p => {
                    const period = getPeriodStatus(p);
                    return (
                      <tr key={p.id} onClick={() => navigate(`/project/${p.id}`)} className="group hover:bg-slate-50 cursor-pointer transition-colors">
                        <td className="px-6 py-4"><div className="flex items-center gap-3"><svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg><span className="font-bold text-slate-900">{p.name}</span></div></td>
                        <td className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Folleto</td>
                        <td className="px-6 py-4">
                          {period && (
                            <div className="flex flex-col gap-1.5 min-w-[140px] max-w-[180px]">
                              <div className="flex justify-between items-center"><span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${period.color}`}>{period.label}</span><span className="text-[8px] font-bold text-slate-400">{Math.round(period.progress)}%</span></div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner"><div className={`h-full transition-all duration-700 ${period.barColor}`} style={{ width: `${period.progress}%` }} /></div>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100">
                            <button onClick={(e) => { e.stopPropagation(); handleRename(p); }} className="p-2 text-slate-400 hover:text-indigo-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                            <button onClick={(e) => handleDeleteClick(p, e)} className="p-2 text-slate-400 hover:text-rose-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default Dashboard;
