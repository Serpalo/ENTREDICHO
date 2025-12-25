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
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const currentProjects = projects.filter(p => folderId ? p.parentId === folderId : !p.parentId);
  const currentFolders = folders.filter(f => folderId ? f.parentId === folderId : !f.parentId);
  const currentFolderName = folderId ? folders.find(f => f.id === folderId)?.name : "Proyectos";

  // --- FUNCIÓN PARA CAMBIAR EL ESTADO DEL PROYECTO ---
  const updateProjectStatus = async (id: string, newStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('projects').update({ status: newStatus }).eq('id', id);
    if (!error) {
        setProjects(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const { data } = await supabase.from('folders').insert([{ name: newFolderName, parent_id: folderId || null }]).select();
    if (data) {
      setFolders([...folders, { id: data[0].id.toString(), name: data[0].name, type: 'folder', parentId: folderId }]);
      setNewFolderName(""); setShowNewFolderInput(false);
    }
  };

  const handleDeleteFolder = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("⚠️ ¿BORRAR CARPETA Y CONTENIDO?")) return;
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
        <h2 className="text-3xl font-black text-slate-800 flex items-center gap-2">{folderId && <button onClick={() => navigate(-1)}>←</button>} {currentFolderName}</h2>
        <div className="flex gap-3">
            <button onClick={() => setShowNewFolderInput(true)} className="px-4 py-2 bg-white border font-bold rounded-xl text-sm">+ Carpeta</button>
            <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="px-6 py-2 bg-rose-600 text-white font-bold rounded-xl text-sm shadow-lg">{isUploading ? uploadStatus : 'Subir Folleto'}</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {currentFolders.map(f => (
              <div key={f.id} onClick={() => navigate(`/folder/${f.id}`)} className="relative group bg-slate-100 hover:bg-white border p-6 rounded-2xl cursor-pointer flex flex-col items-center gap-4 transition-all">
                  <button onClick={(e) => handleDeleteFolder(f.id, e)} className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">🗑️</button>
                  <div className="text-4xl">📁</div>
                  <h3 className="font-bold text-sm text-center">{f.name}</h3>
              </div>
          ))}
          
          {currentProjects.map(p => (
              <div key={p.id} onClick={() => navigate(`/project/${p.id}`)} className="relative group bg-white p-4 rounded-2xl border hover:shadow-xl cursor-pointer transition-all">
                  <button onClick={(e) => handleDeleteProject(p.id, e)} className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-10">🗑️</button>
                  
                  {/* INDICADOR DE ESTADO VISIBLE */}
                  <div className="absolute top-2 left-2 z-10">
                      <select 
                        value={p.status} 
                        onClick={(e) => e.stopPropagation()} 
                        onChange={(e) => updateProjectStatus(p.id, e.target.value, e as any)}
                        className={`text-[10px] font-black uppercase px-2 py-1 rounded border shadow-sm outline-none cursor-pointer
                          ${p.status === 'APROBADO' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}
                      >
                          <option value="1ª corrección">1ª corrección</option>
                          <option value="2ª corrección">2ª corrección</option>
                          <option value="APROBADO">APROBADO</option>
                      </select>
                  </div>

                  <div className="aspect-[3/4] bg-slate-100 rounded-xl mb-4 relative flex items-center justify-center overflow-hidden border border-slate-50">
                      {p.versions?.[0]?.pages?.[0]?.imageUrl ? <img src={p.versions[0].pages[0].imageUrl} className="w-full h-full object-cover"/> : "📄"} 
                      <div className="absolute bottom-0 right-0 bg-slate-800 text-white text-[10px] px-2 font-bold">{p.versions?.[0]?.pages?.length || 0} p</div>
                  </div>
                  <h3 className="font-bold text-sm truncate text-slate-700">{p.name}</h3>
              </div>
          ))}
      </div>
    </div>
  );
};

export default Dashboard;
