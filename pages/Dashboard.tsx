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
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(""); // Para ver el progreso
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

  const handleDeleteFolder = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("⚠️ ¿BORRAR CARPETA Y SU CONTENIDO?")) return;
    const { error } = await supabase.from('folders').delete().eq('id', id);
    if (error) alert("Error al borrar: " + error.message);
    else setFolders(folders.filter(f => f.id !== id));
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("⚠️ ¿BORRAR PROYECTO?")) return;
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) alert("Error: " + error.message);
    else setProjects(projects.filter(p => p.id !== id));
  };

  // --- NUEVA LÓGICA DE SUBIDA MÚLTIPLE ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    setIsUploading(true);
    setUploadStatus("Preparando...");

    // 1. Ordenamos los archivos por nombre para que las páginas salgan en orden (pag1, pag2...)
    const files = Array.from(e.target.files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const firstFile = files[0];

    try {
      // 2. Creamos EL Proyecto (Uno solo para todas las imágenes)
      const projectName = firstFile.name.split('.')[0].replace(/[-_]page\d+/i, ''); // Intentamos limpiar el nombre
      
      const { data: projData, error: projError } = await supabase.from('projects').insert([{
        title: projectName,
        status: '1ª corrección',
        parent_id: folderId || null
      }]).select();

      if (projError) throw new Error("Fallo al crear proyecto: " + projError.message);
      const newProjectId = projData[0].id;

      // 3. Subimos cada imagen como una página del mismo proyecto
      for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setUploadStatus(`Subiendo ${i + 1} de ${files.length}...`);

          const fileName = `page-${Date.now()}-${i}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          
          // Subir imagen
          const { error: uploadError } = await supabase.storage.from('brochures').upload(fileName, file);
          if (uploadError) throw new Error(`Fallo en imagen ${i+1}: ${uploadError.message}`);

          const { data: urlData } = supabase.storage.from('brochures').getPublicUrl(fileName);

          // Crear página
          await supabase.from('pages').insert([{
            project_id: newProjectId,
            image_url: urlData.publicUrl,
            page_number: i + 1, // Página 1, 2, 3...
            version: 1,
            status: '1ª corrección'
          }]);
      }

      setUploadStatus("¡Listo!");
      setTimeout(() => window.location.reload(), 500);

    } catch (error: any) {
      alert("🛑 ERROR: " + error.message);
      setIsUploading(false);
    }
  };

  const getProjectName = (p: Project) => p.name || (p as any).title || "Sin nombre";

  return (
    <div className="p-8 min-h-full bg-slate-50 font-sans">
      {/* AÑADIDO 'multiple' AL INPUT */}
      <input type="file" ref={fileInputRef} hidden multiple accept="image/*" onChange={handleFileUpload} />
      
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
                {isUploading ? uploadStatus : 'Subir Folleto'}
            </button>
        </div>
      </div>

      {(currentFolders.length === 0 && currentProjects.length === 0) ? (
        <div className="border-2 border-dashed border-slate-200 rounded-3xl h-64 flex flex-col items-center justify-center text-slate-400 gap-4">
            <p className="font-medium">Carpeta vacía</p>
        </div>
      ) : (
        <>
            {/* VISTA DE LISTA */}
            {viewMode === 'list' && (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr><th className="p-4 text-xs font-black text-slate-400 uppercase">Nombre</th><th className="p-4 text-xs font-black text-slate-400 uppercase text-right">Acción</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {currentFolders.map(f => (
                                <tr key={f.id} onClick={() => navigate(`/folder/${f.id}`)} className="hover:bg-slate-50 cursor-pointer group">
                                    <td className="p-4 flex items-center gap-3"><span className="text-2xl text-amber-400">📁</span> <span className="font-bold text-slate-700">{f.name}</span></td>
                                    <td className="p-4 text-right">
                                        <button onClick={(e) => handleDeleteFolder(f.id, e)} className="bg-red-100 text-red-600 px-3 py-1 rounded hover:bg-red-600 hover:text-white font-bold text-xs mr-2">BORRAR</button>
                                        <span className="text-slate-300 text-xs">Abrir &rarr;</span>
                                    </td>
                                </tr>
                            ))}
                            {currentProjects.map(p => (
                                <tr key={p.id} onClick={() => navigate(`/project/${p.id}`)} className="hover:bg-slate-50 cursor-pointer">
                                    <td className="p-4 flex items-center gap-3">
                                        <span className="font-bold text-slate-800">{getProjectName(p)}</span>
                                        <span className="text-xs text-slate-400 ml-2">({p.versions?.[0]?.pages?.length || 0} págs)</span>
                                    </td>
                                    <td className="p-4 text-right">
                                         <button onClick={(e) => handleDeleteProject(p.id, e)} className="bg-red-100 text-red-600 px-3 py-1 rounded hover:bg-red-600 hover:text-white font-bold text-xs mr-2">BORRAR</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* VISTA DE CUADRÍCULA */}
            {viewMode === 'grid' && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {currentFolders.map(f => (
                        <div key={f.id} onClick={() => navigate(`/folder/${f.id}`)} className="relative group bg-slate-100 hover:bg-white border border-transparent hover:border-slate-200 p-6 rounded-2xl cursor-pointer transition-all hover:shadow-lg flex flex-col items-center gap-4">
                            <button onClick={(e) => handleDeleteFolder(f.id, e)} className="absolute top-2 right-2 bg-white text-red-500 hover:bg-red-600 hover:text-white w-8 h-8 rounded-full shadow-md flex items-center justify-center font-bold z-10" title="Borrar Carpeta">🗑️</button>
                            <div className="text-4xl">📁</div>
                            <h3 className="font-bold text-slate-700 text-sm">{f.name}</h3>
                        </div>
                    ))}
                    {currentProjects.map(p => (
                        <div key={p.id} onClick={() => navigate(`/project/${p.id}`)} className="relative group bg-white p-4 rounded-2xl border border-slate-100 hover:border-rose-200 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1">
                            <button onClick={(e) => handleDeleteProject(p.id, e)} className="absolute top-2 right-2 bg-white text-red-500 hover:bg-red-600 hover:text-white w-8 h-8 rounded-full shadow-md flex items-center justify-center font-bold z-10" title="Borrar Proyecto">🗑️</button>
                            <div className="aspect-[3/4] bg-slate-50 rounded-xl mb-4 overflow-hidden relative flex items-center justify-center bg-slate-100 text-slate-300 font-bold text-2xl">
                                {p.versions?.[0]?.pages?.[0]?.imageUrl ? <img src={p.versions[0].pages[0].imageUrl} className="w-full h-full object-cover" /> : "A"}
                                <div className="absolute bottom-0 right-0 bg-slate-800 text-white text-[10px] px-2 py-1 rounded-tl-lg font-bold">
                                    {p.versions?.[0]?.pages?.length || 0} págs
                                </div>
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
