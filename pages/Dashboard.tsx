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
  
  const [isUploading, setIsUploading] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Filtramos qué se ve en pantalla (Root o dentro de carpeta)
  const currentProjects = projects.filter(p => folderId ? p.parentId === folderId : !p.parentId);
  const currentFolders = folders.filter(f => folderId ? f.parentId === folderId : !f.parentId);
  
  const currentFolderName = folderId ? folders.find(f => f.id === folderId)?.name : "Proyectos";

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const { data, error } = await supabase.from('folders').insert([{ name: newFolderName, parent_id: folderId || null }]).select();
    if (!error && data) {
      setFolders([...folders, { id: data[0].id.toString(), name: data[0].name, type: 'folder', parentId: folderId }]);
      setNewFolderName("");
      setShowNewFolderInput(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setIsUploading(true);
    const file = e.target.files[0];

    try {
      // 1. Subir imagen
      const fileName = `cover-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: uploadError } = await supabase.storage.from('brochures').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('brochures').getPublicUrl(fileName);

      // 2. Crear Proyecto (SIN FECHAS, versión segura)
      const projectName = file.name.split('.')[0];
      const { data: projData, error: projError } = await supabase.from('projects').insert([{
        title: projectName, // Usamos title para compatibilidad
        name: projectName,
        status: '1ª corrección',
        parent_id: folderId || null
      }]).select();

      if (projError) throw projError;

      const newProject = projData[0];

      // 3. Crear Página 1
      await supabase.from('pages').insert([{
        project_id: newProject.id,
        image_url: urlData.publicUrl,
        page_number: 1,
        version: 1,
        status: '1ª corrección'
      }]);

      // 4. Actualizar pantalla
      setTimeout(() => window.location.reload(), 1000);

    } catch (error: any) {
      alert("Error al subir: " + error.message);
      setIsUploading(false);
    }
  };

  return (
    <div className="p-8 min-h-full bg-slate-50">
      <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileUpload} />
      
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
           {folderId && <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-800 transition">←</button>}
           {currentFolderName}
        </h2>
        <div className="flex gap-3">
            {showNewFolderInput ? (
                <div className="flex gap-2 bg-white p-1 rounded-xl border shadow-sm animate-fade-in">
                    <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="Nombre carpeta..." className="px-3 py-1 outline-none text-sm" />
                    <button onClick={handleCreateFolder} className="bg-slate-900 text-white px-3 rounded-lg text-xs font-bold">OK</button>
                    <button onClick={() => setShowNewFolderInput(false)} className="text-slate-400 px-2">✕</button>
                </div>
            ) : (
                <button onClick={() => setShowNewFolderInput(true)} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-50 transition shadow-sm flex items-center gap-2">
                    <span className="text-lg leading-none">+</span> Nueva Carpeta
                </button>
            )}
            <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="px-6 py-2 bg-rose-600 text-white font-bold rounded-xl text-sm shadow-lg shadow-rose-200 hover:bg-rose-700 hover:-translate-y-0.5 transition flex items-center gap-2">
                {isUploading ? 'Subiendo...' : (<><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg> Subir Folleto</>)}
            </button>
        </div>
      </div>

      {(currentFolders.length === 0 && currentProjects.length === 0) ? (
        <div className="border-2 border-dashed border-slate-200 rounded-3xl h-64 flex flex-col items-center justify-center text-slate-400 gap-4">
            <svg className="w-12 h-12 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
            <p className="font-medium">Esta carpeta está vacía</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {/* 1. MOSTRAR CARPETAS PRIMERO */}
            {currentFolders.map(folder => (
                <div key={folder.id} onClick={() => navigate(`/folder/${folder.id}`)} className="group bg-slate-100 hover:bg-white border border-transparent hover:border-slate-200 p-6 rounded-2xl cursor-pointer transition-all hover:shadow-lg flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform text-slate-300 group-hover:text-amber-400">
                        <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>
                    </div>
                    <h3 className="font-bold text-slate-700 text-sm">{folder.name}</h3>
                </div>
            ))}

            {/* 2. MOSTRAR PROYECTOS */}
            {currentProjects.map(project => (
                <div key={project.id} onClick={() => navigate(`/project/${project.id}`)} className="group bg-white p-4 rounded-2xl border border-slate-100 hover:border-rose-200 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1">
                    <div className="aspect-[3/4] bg-slate-50 rounded-xl mb-4 overflow-hidden relative">
                         {project.versions?.[0]?.pages?.[0]?.imageUrl ? (
                             <img src={project.versions[0].pages[0].imageUrl} className="w-full h-full object-cover" />
                         ) : (
                             <div className="w-full h-full flex items-center justify-center text-rose-200 font-black text-4xl">A</div>
                         )}
                         <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider text-slate-800 shadow-sm">{project.status}</div>
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm leading-tight mb-1 truncate">{project.name}</h3>
                    <p className="text-xs text-slate-400">v{project.versions?.length || 1}</p>
                </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
