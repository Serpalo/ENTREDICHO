import React, { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Project, Folder } from '../types';
import { supabase } from '../supabase';

interface DashboardProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  folders: Folder[];
  setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
}

const Dashboard: React.FC<DashboardProps> = ({ projects, setProjects, folders, setFolders }) => {
  const navigate = useNavigate();
  const { folderId } = useParams<{ folderId: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const currentProjects = projects.filter(p => folderId ? p.parentId === folderId : !p.parentId);
  const currentFolders = folders.filter(f => folderId ? f.parentId === folderId : !f.parentId);
  const currentFolderName = folderId ? folders.find(f => f.id === folderId)?.name : "Proyectos";

  // --- FUNCIÓN DE CREAR CARPETA RESTAURADA ---
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const { data, error } = await supabase
        .from('folders')
        .insert([{ name: newFolderName, parent_id: folderId || null }])
        .select();

      if (error) throw error;

      if (data) {
        setFolders([...folders, { 
          id: data[0].id.toString(), 
          name: data[0].name, 
          type: 'folder', 
          parentId: folderId || undefined 
        }]);
        setNewFolderName("");
        setShowNewFolderInput(false);
      }
    } catch (err: any) {
      alert("Error al crear carpeta: " + err.message);
    }
  };

  const handleDeleteFolder = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("⚠️ ¿BORRAR CARPETA Y TODO SU CONTENIDO?")) return;
    await supabase.from('folders').delete().eq('id', id);
    setFolders(folders.filter(f => f.id !== id));
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("⚠️ ¿BORRAR PROYECTO?")) return;
    await supabase.from('projects').delete().eq('id', id);
    setProjects(projects.filter(p => p.id !== id));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setIsUploading(true);
    const files = Array.from(e.target.files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const projectName = files[0].name.split('.')[0];

    try {
      const { data: projData, error: projError } = await supabase.from('projects').insert([{
        title: projectName, name: projectName, status: '1ª corrección', parent_id: folderId || null
      }]).select();
      
      if (projError) throw projError;
      const newProjectId = projData[0].id;

      for (let i = 0; i < files.length; i++) {
          setUploadStatus(`Subiendo ${i + 1}/${files.length}...`);
          const file = files[i];
          const fileName = `page-${Date.now()}-${i}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          await supabase.storage.from('brochures').upload(fileName, file);
          const { data: urlData } = supabase.storage.from('brochures').getPublicUrl(fileName);
          await supabase.from('pages').insert([{
            project_id: newProjectId, image_url: urlData.publicUrl, page_number: i + 1, version: 1, status: '1ª corrección'
          }]);
      }
      window.location.reload();
    } catch (error: any) {
      alert("Error: " + error.message);
      setIsUploading(false);
    }
  };

  return (
    <div className="p-8 min-h-full bg-slate-50 font-sans">
      <input type="file" ref={fileInputRef} hidden multiple accept="image/*" onChange={handleFileUpload} />
      
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black text-slate-800 flex items-center gap-2">
            {folderId && <button onClick={() => navigate(-1)} className="hover:text-rose-600">←</button>} 
            {currentFolderName}
        </h2>
        <div className="flex gap-3">
            {/* BOTÓN + CARPETA CON LÓGICA */}
            <button 
                onClick={() => setShowNewFolderInput(true)} 
                className="px-4 py-2 bg-white border border-slate-200 font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-slate-50 transition-all"
            >
                + Carpeta
            </button>
            <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isUploading} 
                className="px-6 py-2 bg-rose-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all"
            >
                {isUploading ? uploadStatus : 'Subir Folleto'}
            </button>
        </div>
      </div>

      {/* MODAL / INPUT PARA NUEVA CARPETA */}
      {showNewFolderInput && (
        <div className="mb-8 p-6 bg-white rounded-2xl border-2 border-dashed border-slate-200 flex items-center gap-4 animate-in fade-in zoom-in duration-200">
            <div className="text-2xl">📁</div>
            <input 
                autoFocus
                type="text" 
                className="flex-1 bg-slate-50 border-none rounded-xl p-3 font-bold outline-none focus:ring-2 focus:ring-rose-500" 
                placeholder="Nombre de la carpeta..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
            <button onClick={() => setShowNewFolderInput(false)} className="text-slate-400 font-bold px-4">Cancelar</button>
            <button onClick={handleCreateFolder} className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold">Crear</button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {currentFolders.map(f => (
              <div key={f.id} onClick={() => navigate(`/folder/${f.id}`)} className="relative group bg-white border border-slate-100 p-6 rounded-2xl cursor-pointer flex flex-col items-center gap-4 transition-all hover:shadow-xl hover:-translate-y-1">
                  <button onClick={(e) => handleDeleteFolder(f.id, e)} className="absolute top-3 right-3 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600">🗑️</button>
                  <div className="text-5xl drop-shadow-sm">📁</div>
                  <h3 className="font-bold text-sm text-slate-700 text-center truncate w-full">{f.name}</h3>
              </div>
          ))}
          
          {currentProjects.map(p => (
              <div key={p.id} onClick={() => navigate(`/project/${p.id}`)} className="relative group bg-white p-4 rounded-2xl border border-slate-100 hover:shadow-2xl cursor-pointer transition-all hover:-translate-y-1">
                  <button onClick={(e) => handleDeleteProject(p.id, e)} className="absolute top-3 right-3 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:text-red-600">🗑️</button>
                  <div className="aspect-[3/4] bg-slate-50 rounded-xl mb-4 relative flex items-center justify-center overflow-hidden border border-slate-50">
                      {p.versions?.[0]?.pages?.[0]?.imageUrl ? (
                        <img src={p.versions[0].pages[0].imageUrl} className="w-full h-full object-cover" alt=""/>
                      ) : <span className="text-4xl">📄</span>} 
                      <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded font-bold">{p.versions?.[0]?.pages?.length || 0} p</div>
                  </div>
                  <h3 className="font-bold text-sm truncate text-slate-700">{p.name}</h3>
                  <div className="mt-1 flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${p.status === 'APROBADO' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{p.status}</span>
                  </div>
              </div>
          ))}
      </div>
    </div>
  );
};

export default Dashboard;
