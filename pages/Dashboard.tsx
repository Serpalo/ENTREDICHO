import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';

const Dashboard = ({ projects = [], folders = [], onRefresh }: any) => {
  const navigate = useNavigate();
  const { folderId } = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // ESTADOS
  const [openFolders, setOpenFolders] = useState<Record<number, boolean>>({});
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [selectedVersion, setSelectedVersion] = useState<number>(1);
  const [comments, setComments] = useState<any[]>([]); 

  const safeFolders = Array.isArray(folders) ? folders : [];
  const currentFolders = safeFolders.filter(f => folderId ? String(f.parent_id) === String(folderId) : !f.parent_id);
  const allItemsInFolder = useMemo(() => projects.filter((p: any) => folderId ? String(p.parent_id) === String(folderId) : !p.parent_id).sort((a: any, b: any) => a.name.localeCompare(b.name)), [projects, folderId]);
  const availableVersions = useMemo(() => { const v = new Set<number>(); allItemsInFolder.forEach((p: any) => v.add(p.version || 1)); return Array.from(v).sort((a, b) => a - b); }, [allItemsInFolder]);

  useEffect(() => { if (availableVersions.length > 0) setSelectedVersion(availableVersions[availableVersions.length - 1]); }, [availableVersions]);
  const currentItems = allItemsInFolder.filter((p: any) => (p.version || 1) === selectedVersion);

  // CARGA DE COMENTARIOS
  const loadComments = async () => {
    const pageIds = allItemsInFolder.map((p: any) => p.id);
    if (pageIds.length === 0) return;
    
    const { data } = await supabase.from('comments').select('*').in('page_id', pageIds);
    if (data) setComments(data);
  };

  useEffect(() => { loadComments(); const t = setTimeout(loadComments, 1000); return () => clearTimeout(t); }, [projects.length, selectedVersion]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;
    const nextVer = availableVersions.length > 0 ? Math.max(...availableVersions) + 1 : 1;
    const ts = Date.now();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const cleanName = `${ts}-${String(i+1).padStart(3,'0')}-${file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from('FOLLETOS').upload(cleanName, file);
      if (error) { alert("Error: " + error.message); continue; }
      const { data } = supabase.storage.from('FOLLETOS').getPublicUrl(cleanName);
      await supabase.from('projects').insert([{ name: file.name, parent_id: folderId ? parseInt(folderId) : null, image_url: data.publicUrl, version: nextVer, storage_name: cleanName }]);
    }
    if (onRefresh) await onRefresh();
    setSelectedVersion(nextVer);
    alert(`Versión ${nextVer} subida`);
  };

  const deleteProject = async (e: any, id: number) => { e.stopPropagation(); if(confirm("¿Borrar?")) { await supabase.from('projects').delete().eq('id', id); if(onRefresh) onRefresh(); } };
  const deleteFolder = async (e: any, id: number) => { e.stopPropagation(); if(confirm("¿Borrar?")) { await supabase.from('folders').delete().eq('id', id); if(onRefresh) onRefresh(); } };
  
  const renderTree = (pid: number | null = null, lvl: number = 0) => safeFolders.filter(f => f.parent_id === pid).map(f => {
    const hasChild = safeFolders.some(c => c.parent_id === f.id);
    return (
      <div key={f.id} className="flex flex-col">
        <div onClick={() => navigate(`/folder/${f.id}`)} className={`flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer ${String(folderId)===String(f.id)?'bg-rose-50 text-rose-600 font-bold':'text-slate-500 hover:bg-slate-50'}`} style={{paddingLeft:`${lvl*12+8}px`}}>
           {hasChild && <span onClick={(e)=>{e.stopPropagation();setOpenFolders(p=>({...p,[f.id]:!p[f.id]}))}} className="text-[10px]">{openFolders[f.id]?'▼':'▶'}</span>}
           <span className="text-sm">📁 {f.name}</span>
        </div>
        {hasChild && openFolders[f.id] && renderTree(f.id, lvl+1)}
      </div>
    );
  });

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <div className="w-64 bg-white border-r border-slate-200 p-8 flex flex-col gap-8">
        
        {/* --- CAMBIO AQUÍ: RUTA DIRECTA A PUBLIC --- */}
        <img src="/logo.png" alt="Logo" className="h-10 w-fit object-contain" />
        
        <nav className="flex flex-col gap-2">
          <div onClick={() => navigate('/')} className="flex items-center gap-3 text-slate-800 font-bold text-sm cursor-pointer p-2 hover:bg-slate-50 rounded-xl">🏠 Inicio</div>
          <div className="mt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Estructura</div>
          {renderTree(null)}
        </nav>
      </div>

      <div className="flex-1 p-10 overflow-y-auto">
        <div className="flex justify-between items-center mb-10 bg-white p-8 rounded-[2rem] shadow-sm border-b-4 border-rose-600">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-black italic uppercase text-slate-800 tracking-tighter">{folderId ? safeFolders.find(f => String(f.id) === String(folderId))?.name.toUpperCase() : "MIS PROYECTOS"}</h1>
            <div className="flex gap-2 mt-2">{availableVersions.map(v => (<button key={v} onClick={() => setSelectedVersion(v)} className={`px-4 py-1 rounded-full text-[10px] font-black uppercase transition-all ${selectedVersion===v?'bg-rose-600 text-white shadow-md scale-105':'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>V{v}</button>))}</div>
          </div>
          <div className="flex gap-4 items-center">
             <div className="flex bg-slate-100 p-1 rounded-xl mr-2"><button onClick={() => setViewMode('list')} className={`p-3 rounded-lg ${viewMode==='list'?'bg-white shadow text-rose-600':'text-slate-400'}`}>📄</button><button onClick={() => setViewMode('grid')} className={`p-3 rounded-lg ${viewMode==='grid'?'bg-white shadow text-rose-600':'text-slate-400'}`}>🧱</button></div>
             <button onClick={() => {const n = prompt("Nombre:"); if(n) supabase.from('folders').insert([{name:n, parent_id:folderId?parseInt(folderId):null}]).then(()=>onRefresh())}} className="px-6 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase shadow-sm">+ CARPETA</button>
             <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple />
             <button onClick={() => fileInputRef.current?.click()} className="px-8 py-3 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg hover:scale-105 transition-all">{allItemsInFolder.length > 0 ? `SUBIR VERSIÓN ${Math.max(...availableVersions, 0) + 1}` : "SUBIR FOLLETOS"}</button>
          </div>
        </div>

        {currentFolders.length > 0 && <div className="grid grid-cols-4 gap-6 mb-10">{currentFolders.map(f => (<div key={f.id} onClick={() => navigate(`/folder/${f.id}`)} className="group relative bg-white p-8 rounded-[2rem] border border-slate-100 flex flex-col items-center cursor-pointer hover:shadow-lg transition-all"><button onClick={(e) => deleteFolder(e, f.id)} className="absolute top-4 right-4 bg-rose-50 text-rose-600 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">✕</button><span className="text-4xl mb-2">📁</span><span className="text-[10px] font-black uppercase text-slate-500">{f.name}</span></div>))}</div>}

        {currentItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-50"><span className="text-6xl mb-4">📂</span><p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Carpeta vacía</p></div>
        ) : viewMode === 'list' ? (
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-left table-fixed">
              <thead>
                <tr className="border-b border-slate-50 text-[10px] font-black text-slate-400 uppercase bg-slate-50/50">
                  <th className="px-8 py-6 w-32">Vista</th>
                  <th className="px-4 py-6 w-5/12">Página</th>
                  <th className="pl-12 py-6 w-3/12">Correcciones</th>
                  <th className="px-8 py-6 text-right w-40">Acción</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((p: any) => {
                  const myComments = comments.filter(c => String(c.page_id) === String(p.id));
                  const pendingCount = myComments.filter(c => !c.resolved).length;
                  return (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-all">
                      <td className="px-8 py-6 align-top"><div onClick={() => navigate(`/project/${p.id}`)} className="w-16 h-20 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden shadow-sm cursor-pointer hover:opacity-80 transition-opacity"><img src={p.image_url} className="w-full h-full object-cover" /></div></td>
                      <td className="px-4 py-6 align-top"><p className="italic font-black text-slate-700 text-sm uppercase tracking-tighter pr-4">{p.name}</p></td>
                      <td className="pl-12 py-6 align-top">
                        <div className="flex flex-col gap-2">
                           {pendingCount > 0 ? (
                             <div className="text-[11px] font-black text-rose-600 uppercase tracking-widest mb-1 bg-rose-100 w-fit px-3 py-1.5 rounded-full border border-rose-200 shadow-sm animate-pulse">🚨 {pendingCount} PENDIENTE{pendingCount!==1?'S':''}</div>
                           ) : myComments.length > 0 ? (
                             <div className="text-[11px] font-black text-emerald-600 uppercase tracking-widest mb-1 bg-emerald-100 w-fit px-3 py-1.5 rounded-full border border-emerald-200 shadow-sm">✓ TODO HECHO</div>
                           ) : (
                             <span className="text-[10px] font-bold text-slate-300 uppercase italic py-1.5">Sin correcciones</span>
                           )}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right align-top"><button onClick={() => navigate(`/project/${p.id}`)} className="text-rose-600 font-black text-[10px] uppercase border border-rose-100 px-3 py-1 rounded-lg hover:bg-rose-50 mr-2">Revisar →</button><button onClick={(e) => deleteProject(e, p.id)} className="text-slate-300 hover:text-rose-600 text-[10px] font-bold uppercase">Eliminar</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-8">
             {currentItems.map((p: any) => {
                 const myComments = comments.filter(c => String(c.page_id) === String(p.id));
                 const pendingCount = myComments.filter(c => !c.resolved).length;
                 return (
                  <div key={p.id} className="group bg-white rounded-[2rem] border border-slate-100 overflow-hidden hover:shadow-xl transition-all flex flex-col">
                    <div onClick={() => navigate(`/project/${p.id}`)} className="aspect-[3/4] bg-slate-50 relative overflow-hidden cursor-pointer"><img src={p.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      {pendingCount > 0 && <div className="absolute top-3 left-3 bg-rose-600 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-md z-10 animate-pulse border-2 border-white">{pendingCount} CORRECCIONES</div>}
                      {pendingCount === 0 && myComments.length > 0 && <div className="absolute top-3 left-3 bg-emerald-500 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-md z-10 border-2 border-white">✓ HECHO</div>}
                      <button onClick={(e) => deleteProject(e, p.id)} className="absolute top-3 right-3 bg-white/90 text-rose-500 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all font-bold">✕</button>
                    </div>
                    <div className="p-6 flex flex-col gap-3"><h3 className="font-black italic text-slate-700 uppercase tracking-tight text-sm truncate">{p.name}</h3><button onClick={() => navigate(`/project/${p.id}`)} className="w-full py-3 bg-slate-50 text-rose-600 rounded-xl font-black text-[10px] uppercase hover:bg-rose-50 transition-colors">Revisar</button></div>
                  </div>
                )
             })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
