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
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [isUploading, setIsUploading] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

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
    
    // Alerta visual para que sepas que empieza
    // alert("Iniciando subida..."); 
    
    const file = e.target.files[0];

    try {
      const fileName = `cover-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: uploadError } = await supabase.storage.from('brochures').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('brochures').getPublicUrl(fileName);
      const projectName = file.name.split('.')[0];

      // --- CORRECCIÓN CLAVE AQUÍ ---
      // Solo enviamos 'title', que es lo que la base de datos seguro tiene.
      // Quitamos 'name' para evitar el Error 400.
      const { data: projData, error: projError } = await supabase.from('projects').insert([{
        title: projectName,
        status: '1ª corrección',
        parent_id: folderId || null
      }]).select();

      if (projError) throw projError;

      const newProject = projData[0];
      await supabase.from('pages').insert([{
        project_id: newProject.id, image_url: urlData.publicUrl, page_number: 1, version: 1, status: '1ª corrección'
      }]);

      // Recarga automática
      setTimeout(() => window.location.reload(), 1000);

    } catch (error: any) {
      alert("Error al subir: " + error.message);
      setIsUploading(false);
    }
  };

  // Función auxiliar para mostrar el nombre correctamente (busca name o title)
  const getProjectName = (p: Project) => p.name || (p as any).title || "Sin nombre";

  return (
    <div className="p-8 min-h-full bg-slate-50 font-sans">
      <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileUpload} />
      
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
           {folderId && <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-800 transition">←</button>}
           {currentFolderName}
        </h2>
        <div className="flex gap-3">
            <div className="bg-white border border-slate-200 p-1 rounded-xl flex gap-1">
                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-slate-100 text-rose-600' : 'text-slate-400'}`}>⬜</button>
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-slate-100 text-rose-600' : 'text-slate-400'}`}>≡</button>
            </div>

            {showNewFolderInput ? (
                <div className="flex gap-2 bg-white p-1 rounded-xl border shadow-sm">
                    <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="Nombre..." className="px-3 py-1 outline-none text-sm w-32" />
                    <button onClick={handleCreateFolder} className="bg-slate-900 text-white px-3 rounded-lg text-xs font-bold">OK</button>
                    <button onClick={() => setShowNewFolderInput(false)} className="text-slate-400 px-2">✕</button>
                </div>
            ) : (
                <button onClick={() => setShowNewFolderInput(true)} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-50 flex items-center gap-2">
                    <span className="text-lg leading-none">+</span> Carpeta
                </button>
            )}
            <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="px-6 py-2 bg-rose-600 text-white font-bold rounded-xl text-sm shadow-lg shadow-rose-200 hover:bg-rose-700 hover:-translate-y-0.5 transition flex items-center gap-2">
                {isUploading ? 'Subiendo...' : 'Subir Folleto'}
            </button>
        </div>
      </div>

      {(currentFolders.length === 0 && currentProjects.length === 0) ? (
        <div className="border-2 border-dashed border-slate-200 rounded-3xl h-64 flex flex-col items-center justify-center text-slate-400 gap-4">
            <p className="font-medium">Carpeta vacía</p>
        </div>
      ) : (
        <>
            {viewMode === 'list' && (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr><th className="p-4 text-xs font-black text-slate-400 uppercase">Nombre</th><th className="p-4 text-xs font-black text-slate-400 uppercase">Estado</th><th className="p-4 text-xs font-black text-slate-400 uppercase">Versiones</th><th className="p-4 text-xs font-black text-slate-400 uppercase text-right">Acción</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {currentFolders.map(f => (
                                <tr key={f.id} onClick={() => navigate(`/folder/${f.id}`)} className="hover:bg-slate-50 cursor-pointer group">
                                    <td className="p-4 flex items-center gap-3"><span className="text-2xl text-amber-400">📁</span> <span className="font-bold text-slate-700">{f.name}</span></td>
                                    <td className="p-4 text-slate-400 text-xs">-</td>
                                    <td className="p-4 text-slate-400 text-xs">-</td>
                                    <td className="p-4 text-right"><span className="text-slate-300 text-xs">Abrir &rarr;</span></td>
                                </tr>
                            ))}
                            {currentProjects.map(p => (
                                <tr key={p.id} onClick={() => navigate(`/project/${p.id}`)} className="hover:bg-slate-50 cursor-pointer">
                                    <td className="p-4 flex items-center gap-3">
                                        <div className="w-10 h-10 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center text-slate-300 font-bold">{p.versions?.[0]?.pages?.[0]?.imageUrl ? <img src={p.versions[0].pages[0].imageUrl} className="w-full h-full object-cover" /> : "A"}</div>
                                        <span className="font-bold text-slate-800">{getProjectName(p)}</span>
                                    </td>
                                    <td className="p-4"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-bold uppercase">{p.status}</span></td>
                                    <td className="p-4 text-xs text-slate-500 font-bold">v{p.versions?.length || 1}</td>
                                    <td className="p-4 text-right"><button className="text-rose-600 font-bold text-xs hover:underline">Ver</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {viewMode === 'grid' && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {currentFolders.map(f => (
                        <div key={f.id} onClick={() => navigate(`/folder/${f.id}`)} className="bg-slate-100 hover:bg-white border border-transparent hover:border-slate-200 p-6 rounded-2xl cursor-pointer transition-all hover:shadow-lg flex flex-col items-center gap-4">
                            <div className="text-4xl">📁</div>
                            <h3 className="font-bold text-slate-700 text-sm">{f.name}</h3>
                        </div>
                    ))}
                    {currentProjects.map(p => (
                        <div key={p.id} onClick={() => navigate(`/project/${p.id}`)} className="bg-white p-4 rounded-2xl border border-slate-100 hover:border-rose-200 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1">
                            <div className="aspect-[3/4] bg-slate-50 rounded-xl mb-4 overflow-hidden relative flex items-center justify-center bg-slate-100 text-slate-300 font-bold text-2xl">
                                {p.versions?.[0]?.pages?.[0]?.imageUrl ? <img src={p.versions[0].pages[0].imageUrl} className="w-full h-full object-cover" /> : "A"}
                            </div>
                            <h3 className="font-bold text-slate-800 text-sm truncate">{getProjectName(p)}</h3>
                        </div>
                    ))}
                </div>
            )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
