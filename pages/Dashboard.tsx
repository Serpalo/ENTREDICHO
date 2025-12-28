import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { jsPDF } from "jspdf";

const Dashboard = ({ projects = [], folders = [], onRefresh, userRole, session }: any) => {
  const navigate = useNavigate();
  const { folderId } = useParams();
  
  // --- ESTADOS ---
  const [openFolders, setOpenFolders] = useState<Record<number, boolean>>({});
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'visor'>('list');
  const [selectedVersion, setSelectedVersion] = useState<number>(1);
  const [comments, setComments] = useState<any[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  
  // ESTADOS PARA LA VENTANA MODAL DE SUBIDA
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  const [uploadDeadline, setUploadDeadline] = useState("");
  const [isUploading, setIsUploading] = useState(false); 

  // Estado para descarga
  const [downloading, setDownloading] = useState(false);

  const safeFolders = Array.isArray(folders) ? folders : [];
  const currentFolders = safeFolders.filter(f => folderId ? String(f.parent_id) === String(folderId) : !f.parent_id);
  
  const allItemsInFolder = useMemo(() => 
    projects.filter((p: any) => folderId ? String(p.parent_id) === String(folderId) : !p.parent_id)
    .sort((a: any, b: any) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })), 
  [projects, folderId]);

  const availableVersions = useMemo(() => { const v = new Set<number>(); allItemsInFolder.forEach((p: any) => v.add(p.version || 1)); return Array.from(v).sort((a, b) => a - b); }, [allItemsInFolder]);

  useEffect(() => { if (availableVersions.length > 0) setSelectedVersion(availableVersions[availableVersions.length - 1]); }, [availableVersions]);
  useEffect(() => { setPageIndex(0); }, [folderId, selectedVersion]);

  const currentItems = allItemsInFolder.filter((p: any) => (p.version || 1) === selectedVersion);

  // BREADCRUMBS
  const breadcrumbs = useMemo(() => {
    if (!folderId) return [];
    const crumbs = [];
    let current = safeFolders.find(f => String(f.id) === String(folderId));
    while (current) {
        crumbs.unshift(current);
        current = safeFolders.find(f => String(f.id) === String(current.parent_id));
    }
    return crumbs;
  }, [folderId, safeFolders]);

  // VISOR NAV
  const prevPage = () => { if (pageIndex > 0) setPageIndex(p => p - 1); };
  const nextPage = () => { if (pageIndex < currentItems.length - 1) setPageIndex(p => p + 1); };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (viewMode === 'visor') {
        if (e.key === 'ArrowLeft') prevPage();
        if (e.key === 'ArrowRight') nextPage();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [viewMode, pageIndex, currentItems.length]);

  // CARGA COMENTARIOS
  const loadComments = async () => {
    const pageIds = allItemsInFolder.map((p: any) => p.id);
    if (pageIds.length === 0) return;
    const { data } = await supabase.from('comments').select('*').in('page_id', pageIds);
    if (data) setComments(data);
  };

  useEffect(() => { loadComments(); const t = setTimeout(loadComments, 1000); return () => clearTimeout(t); }, [projects.length, selectedVersion]);

  // --- LOGOUT ---
  const handleLogout = async () => {
      await supabase.auth.signOut();
      window.location.reload();
  };

  // --- FUNCIÓN DE SUBIDA ---
  const handleConfirmUpload = async () => {
    if (!uploadFiles || uploadFiles.length === 0) return alert("Por favor, selecciona al menos un archivo.");
    setIsUploading(true);
    const nextVer = availableVersions.length > 0 ? Math.max(...availableVersions) + 1 : 1;
    const ts = Date.now();
    const sortedFiles = Array.from(uploadFiles).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    try {
        for (let i = 0; i < sortedFiles.length; i++) {
          const file = sortedFiles[i];
          const cleanName = `${ts}-${String(i+1).padStart(3,'0')}-${file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          const { error: uploadError } = await supabase.storage.from('FOLLETOS').upload(cleanName, file);
          if (uploadError) throw uploadError;
          const { data } = supabase.storage.from('FOLLETOS').getPublicUrl(cleanName);
          const prettyName = `PÁGINA ${i + 1}`;
          await supabase.from('projects').insert([{ name: prettyName, parent_id: folderId ? parseInt(folderId) : null, image_url: data.publicUrl, version: nextVer, storage_name: cleanName, correction_deadline: uploadDeadline ? new Date(uploadDeadline).toISOString() : null }]);
        }
        if (onRefresh) await onRefresh();
        setSelectedVersion(nextVer);
        setUploadFiles(null); setUploadDeadline(""); setIsUploadModalOpen(false);
        alert(`¡Versión ${nextVer} subida con éxito!`);
    } catch (error: any) { alert("Error subiendo archivos: " + error.message); } finally { setIsUploading(false); }
  };

  const handleDownloadBrochure = async () => {
    if (currentItems.length === 0) return alert("No hay páginas para descargar.");
    setDownloading(true);
    try {
        const doc = new jsPDF();
        for (let i = 0; i < currentItems.length; i++) {
            const page = currentItems[i];
            const response = await fetch(page.image_url);
            const blob = await response.blob();
            const base64 = await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result as string); reader.readAsDataURL(blob); });
            const imgProps = await new Promise<{width: number, height: number}>((resolve) => { const img = new Image(); img.src = base64; img.onload = () => resolve({ width: img.width, height: img.height }); });
            const pdfWidth = 210; const pdfHeight = 297; const imgRatio = imgProps.width / imgProps.height;
            if (i > 0) doc.addPage();
            const margin = 10; const availableWidth = pdfWidth - (margin * 2); const availableHeight = pdfHeight - (margin * 2);
            let finalWidth = availableWidth; let finalHeight = availableWidth / imgRatio;
            if (finalHeight > availableHeight) { finalHeight = availableHeight; finalWidth = availableHeight * imgRatio; }
            const x = (pdfWidth - finalWidth) / 2; const y = (pdfHeight - finalHeight) / 2;
            doc.addImage(base64, 'JPEG', x, y, finalWidth, finalHeight);
        }
        const folderName = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length-1].name : "Folleto";
        doc.save(`${folderName}_v${selectedVersion}.pdf`);
    } catch (error: any) { console.error(error); alert("Error al generar el PDF: " + error.message); } finally { setDownloading(false); }
  };

  const handleDeleteVersion = async () => {
      if (currentItems.length === 0) return;
      if (window.confirm(`⚠️ ¡PELIGRO! ⚠️\n\nBorrar VERSIÓN ${selectedVersion}.\n¿Seguro?`)) {
          const idsToDelete = currentItems.map((p: any) => p.id);
          const { error } = await supabase.from('projects').delete().in('id', idsToDelete);
          if (error) { alert("Error al borrar: " + error.message); } else { alert("Eliminado."); if (onRefresh) onRefresh(); }
      }
  };

  const deleteFolder = async (e: any, id: number) => { e.stopPropagation(); if(confirm("¿Borrar carpeta?")) { await supabase.from('folders').delete().eq('id', id); if(onRefresh) onRefresh(); } };

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

  const renderVisor = () => {
    if (currentItems.length === 0) return null;
    const p = currentItems[pageIndex];
    if (!p) return null;
    const myComments = comments.filter(c => String(c.page_id) === String(p.id));
    const pendingCount = myComments.filter(c => !c.resolved).length;
    const isDeadlinePassed = p.correction_deadline && new Date() > new Date(p.correction_deadline);

    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden group">
        <button onClick={(e) => { e.stopPropagation(); prevPage(); }} disabled={pageIndex === 0} className={`absolute left-4 z-20 p-4 rounded-full shadow-xl transition-all duration-300 ${pageIndex === 0 ? 'opacity-0 pointer-events-none' : 'bg-gray-800 text-white hover:bg-rose-600 hover:scale-110 cursor-pointer'}`}><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg></button>
        <div className="relative h-[75vh] w-full flex items-center justify-center p-4" onClick={() => navigate(`/project/${p.id}`)}>
             <img src={p.image_url} className="max-h-full max-w-full object-contain shadow-lg cursor-pointer" alt={p.name} />
             <div className="absolute top-6 left-6 flex flex-col gap-2 pointer-events-none">
                {p.is_approved ? (<div className="bg-emerald-500 text-white px-4 py-2 rounded-full text-xs font-black shadow-lg border-2 border-white">🎉 APROBADA</div>) : isDeadlinePassed ? (<div className="bg-orange-500 text-white px-4 py-2 rounded-full text-xs font-black shadow-lg border-2 border-white">⏳ PLAZO CERRADO</div>) : pendingCount > 0 ? (<div className="bg-rose-600 text-white px-4 py-2 rounded-full text-xs font-black shadow-lg animate-pulse border-2 border-white">🚨 {pendingCount} PENDIENTES</div>) : myComments.length > 0 ? (<div className="bg-emerald-100 text-emerald-600 px-4 py-2 rounded-full text-xs font-black shadow-lg border-2 border-white">✓ COMPLETADO</div>) : null}
             </div>
        </div>
        <div className="absolute bottom-0 w-full bg-white/90 backdrop-blur-sm p-4 border-t border-slate-100 flex justify-between items-center">
             <div className="flex flex-col"><span className="text-[10px] font-black text-slate-400 uppercase">Página {pageIndex + 1} de {currentItems.length}</span><span className="text-lg font-black italic text-slate-800 uppercase">{p.name}</span></div>
             <div className="flex gap-3">
                 {/* SOLO EL ADMIN PUEDE BORRAR EN EL VISOR */}
                 {userRole === 'admin' && (<button onClick={(e) => deleteFolder(e, p.id)} className="px-4 py-2 bg-slate-100 text-slate-400 rounded-xl text-xs font-bold hover:bg-red-50 hover:text-red-500 transition-colors">ELIMINAR PÁGINA</button>)}
                 <button onClick={() => navigate(`/project/${p.id}`)} className="px-6 py-2 bg-rose-600 text-white rounded-xl text-xs font-black uppercase hover:scale-105 transition-transform shadow-lg shadow-rose-200">ENTRAR A CORREGIR</button>
             </div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); nextPage(); }} disabled={pageIndex === currentItems.length - 1} className={`absolute right-4 z-20 p-4 rounded-full shadow-xl transition-all duration-300 ${pageIndex === currentItems.length - 1 ? 'opacity-0 pointer-events-none' : 'bg-gray-800 text-white hover:bg-rose-600 hover:scale-110 cursor-pointer'}`}><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></button>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <div className="w-64 bg-white border-r border-slate-200 p-8 flex flex-col gap-8">
        <img src="/logo.png" alt="Logo" className="h-10 w-fit object-contain" />
        {session && (
            <div className="flex flex-col gap-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Usuario:</span>
                <span className="text-xs font-bold text-slate-800 truncate" title={session.user.email}>{session.user.email}</span>
                <span className={`text-[9px] font-black uppercase w-fit px-2 py-0.5 rounded ${userRole === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-500'}`}>{userRole === 'admin' ? 'ADMINISTRADOR' : 'EDITOR'}</span>
                <button onClick={handleLogout} className="text-[10px] text-red-400 font-bold hover:text-red-600 hover:underline mt-2 text-left">Cerrar Sesión</button>
            </div>
        )}
        <nav className="flex flex-col gap-2">
          <div onClick={() => navigate('/')} className="flex items-center gap-3 text-slate-800 font-bold text-sm cursor-pointer p-2 hover:bg-slate-50 rounded-xl">🏠 Inicio</div>
          <div className="mt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Estructura</div>
          {renderTree(null)}
        </nav>
      </div>

      <div className="flex-1 p-10 overflow-y-auto">
        <div className="flex justify-between items-center mb-10 bg-white p-8 rounded-[2rem] shadow-sm border-b-4 border-rose-600">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-black italic uppercase text-slate-800 tracking-tighter flex items-center flex-wrap gap-2">
                {breadcrumbs.length > 0 ? (
                    breadcrumbs.map((crumb, idx) => (
                        <React.Fragment key={crumb.id}>
                            <span onClick={() => navigate(`/folder/${crumb.id}`)} className={`cursor-pointer hover:text-rose-600 transition-colors ${idx === breadcrumbs.length - 1 ? 'text-slate-800' : 'text-slate-400'}`}>{crumb.name}</span>
                            {idx < breadcrumbs.length - 1 && <span className="text-slate-300">/</span>}
                        </React.Fragment>
                    ))
                ) : "CAMPAÑAS"} 
            </h1>
            <div className="flex gap-2 mt-2">{availableVersions.map(v => (<button key={v} onClick={() => setSelectedVersion(v)} className={`px-4 py-1 rounded-full text-[10px] font-black uppercase transition-all ${selectedVersion===v?'bg-rose-600 text-white shadow-md scale-105':'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>V{v}</button>))}</div>
          </div>
          <div className="flex gap-4 items-center">
             <div className="flex bg-slate-100 p-1 rounded-xl mr-2">
                <button onClick={() => setViewMode('visor')} className={`p-3 rounded-lg transition-all ${viewMode==='visor'?'bg-white shadow text-rose-600':'text-slate-400'}`} title="Modo Visor">👁️</button>
                <button onClick={() => setViewMode('list')} className={`p-3 rounded-lg transition-all ${viewMode==='list'?'bg-white shadow text-rose-600':'text-slate-400'}`} title="Modo Lista">📄</button>
                <button onClick={() => setViewMode('grid')} className={`p-3 rounded-lg transition-all ${viewMode==='grid'?'bg-white shadow text-rose-600':'text-slate-400'}`} title="Modo Mosaico">🧱</button>
             </div>
             {currentItems.length > 0 && (<button onClick={handleDownloadBrochure} disabled={downloading} className="px-6 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2">{downloading ? "GENERANDO..." : "⬇ PDF COMPLETO"}</button>)}
             
             {/* --- BOTONES PROTEGIDOS: SOLO PARA ADMIN --- */}
             {userRole === 'admin' && (
                 <>
                    <button onClick={() => {const n = prompt("Nombre:"); if(n) supabase.from('folders').insert([{name:n, parent_id:folderId?parseInt(folderId):null}]).then(()=>onRefresh())}} className="px-6 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase shadow-sm">+ CARPETA</button>
                    <button onClick={() => setIsUploadModalOpen(true)} className="px-8 py-3 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg hover:scale-105 transition-all">{allItemsInFolder.length > 0 ? `SUBIR VERSIÓN ${Math.max(...availableVersions, 0) + 1}` : "SUBIR FOLLETOS"}</button>
                 </>
             )}
          </div>
        </div>

        {isUploadModalOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md border border-slate-100 animate-[fadeIn_0.2s_ease-out]">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-black italic text-slate-800 uppercase">Subir Versión</h2>
                        <button onClick={() => setIsUploadModalOpen(false)} className="bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors">✕</button>
                    </div>
                    <div className="flex flex-col gap-6">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">1. Selecciona las imágenes</label>
                            <input type="file" multiple accept="image/*" onChange={(e) => setUploadFiles(e.target.files)} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100 cursor-pointer"/>
                            {uploadFiles && <p className="mt-2 text-xs font-bold text-emerald-600">✅ {uploadFiles.length} archivos seleccionados</p>}
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">2. ¿Fecha límite para correcciones? (Opcional)</label>
                            <input type="datetime-local" value={uploadDeadline} onChange={(e) => setUploadDeadline(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 font-bold focus:outline-none focus:border-rose-500 transition-colors"/>
                            <p className="mt-1 text-[9px] text-slate-400">Si dejas esto vacío, no habrá fecha límite.</p>
                        </div>
                        <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100">
                            <button onClick={() => setIsUploadModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-bold text-xs uppercase hover:bg-slate-200 transition-colors">Cancelar</button>
                            <button onClick={handleConfirmUpload} disabled={isUploading || !uploadFiles} className={`flex-1 py-3 text-white rounded-xl font-black text-xs uppercase shadow-lg transition-all ${isUploading || !uploadFiles ? 'bg-slate-300 cursor-not-allowed' : 'bg-rose-600 hover:scale-105 hover:bg-rose-700'}`}>{isUploading ? "Subiendo..." : "CONFIRMAR SUBIDA"}</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {currentFolders.length > 0 && <div className="grid grid-cols-4 gap-6 mb-10">{currentFolders.map(f => (<div key={f.id} onClick={() => navigate(`/folder/${f.id}`)} className="group relative bg-white p-8 rounded-[2rem] border border-slate-100 flex flex-col items-center cursor-pointer hover:shadow-lg transition-all">
            {/* SOLO EL ADMIN PUEDE BORRAR CARPETAS */}
            {userRole === 'admin' && (<button onClick={(e) => deleteFolder(e, f.id)} className="absolute top-4 right-4 bg-rose-50 text-rose-600 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">✕</button>)}
            <span className="text-4xl mb-2">📁</span><span className="text-[10px] font-black uppercase text-slate-500">{f.name}</span></div>))}</div>}

        {currentItems.length > 0 ? (
            viewMode === 'visor' ? (renderVisor()) : viewMode === 'list' ? (
              <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left table-fixed">
                  <thead>
                    <tr className="border-b border-slate-50 text-[10px] font-black text-slate-400 uppercase bg-slate-50/50">
                      <th className="px-8 py-6 w-32">Vista</th>
                      <th className="px-4 py-6 w-4/12">Página</th>
                      <th className="pl-12 py-6 w-2/12">Correcciones</th>
                      <th className="px-4 py-6 w-2/12">Fecha Límite</th>
                      <th className="px-8 py-6 text-right w-40">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentItems.map((p: any) => {
                      const myComments = comments.filter(c => String(c.page_id) === String(p.id));
                      const pendingCount = myComments.filter(c => !c.resolved).length;
                      const resolvedCount = myComments.filter(c => c.resolved).length;
                      const isDeadlinePassed = p.correction_deadline && new Date() > new Date(p.correction_deadline);
                      return (
                        <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-all">
                          <td className="px-8 py-6 align-top"><div onClick={() => navigate(`/project/${p.id}`)} className="w-16 h-20 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden shadow-sm cursor-pointer hover:opacity-80 transition-opacity"><img src={p.image_url} className="w-full h-full object-cover" /></div></td>
                          <td className="px-4 py-6 align-top"><p className="italic font-black text-slate-700 text-sm uppercase tracking-tighter pr-4">{p.name}</p></td>
                          <td className="pl-12 py-6 align-top">
                            <div className="flex flex-col gap-2">
                               {p.is_approved ? (
                                   <div className="text-[11px] font-black text-white uppercase tracking-widest mb-1 bg-emerald-500 w-fit px-4 py-1.5 rounded-full shadow-md">🎉 APROBADA</div>
                               ) : (
                                   <>
                                       {pendingCount > 0 && (<div className="text-[11px] font-black text-rose-600 uppercase tracking-widest mb-1 bg-rose-100 w-fit px-3 py-1.5 rounded-full border border-rose-200 shadow-sm animate-pulse">🚨 {pendingCount} PENDIENTE{pendingCount!==1?'S':''}</div>)}
                                       {resolvedCount > 0 && (<div className="text-[11px] font-black text-emerald-600 uppercase tracking-widest mb-1 bg-emerald-100 w-fit px-3 py-1.5 rounded-full border border-emerald-200 shadow-sm">✓ {resolvedCount} HECHA{resolvedCount!==1?'S':''}</div>)}
                                       {pendingCount === 0 && resolvedCount === 0 && (<span className="text-[10px] font-bold text-slate-300 uppercase italic py-1.5">Sin correcciones</span>)}
                                   </>
                               )}
                            </div>
                          </td>
                          <td className="px-4 py-6 align-top">{isDeadlinePassed ? (<div className="text-[11px] font-black text-white uppercase tracking-widest mb-1 bg-orange-500 w-fit px-3 py-1.5 rounded-full shadow-md border-2 border-orange-400">🔒 CORRECCIONES CERRADAS</div>) : p.correction_deadline ? (<div className="flex flex-col text-slate-600"><span className="text-xs font-bold text-orange-600">{new Date(p.correction_deadline).toLocaleDateString()}</span><span className="text-[10px] font-medium opacity-60">{new Date(p.correction_deadline).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div>) : (<span className="text-[10px] font-bold text-slate-300 uppercase italic">Sin límite</span>)}</td>
                          <td className="px-8 py-6 text-right align-top">
                              <button onClick={() => navigate(`/project/${p.id}`)} className="text-rose-600 font-black text-[10px] uppercase border border-rose-100 px-3 py-1 rounded-lg hover:bg-rose-50 mr-2">Revisar →</button>
                          </td>
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
                      const resolvedCount = myComments.filter(c => c.resolved).length;
                      const isDeadlinePassed = p.correction_deadline && new Date() > new Date(p.correction_deadline);
                      return (
                       <div key={p.id} className="group bg-white rounded-[2rem] border border-slate-100 overflow-hidden hover:shadow-xl transition-all flex flex-col">
                         <div onClick={() => navigate(`/project/${p.id}`)} className="aspect-[3/4] bg-slate-50 relative overflow-hidden cursor-pointer"><img src={p.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                           {p.is_approved ? (<div className="absolute top-3 left-3 bg-emerald-500 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-md z-10 border-2 border-white">🎉 APROBADA</div>) : isDeadlinePassed ? (<div className="absolute top-3 left-3 bg-orange-500 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-md z-10 border-2 border-white">⏳ PLAZO CERRADO</div>) : pendingCount > 0 ? (<div className="absolute top-3 left-3 bg-rose-600 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-md z-10 animate-pulse border-2 border-white">{pendingCount} CORRECCIONES</div>) : pendingCount === 0 && myComments.length > 0 && (<div className="absolute top-3 left-3 bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black shadow-md z-10 border-2 border-white">✓ HECHO</div>)}
                           {/* SOLO EL ADMIN PUEDE BORRAR EN LA VISTA GRID */}
                           {userRole === 'admin' && (<button onClick={(e) => deleteFolder(e, p.id)} className="absolute top-3 right-3 bg-white/90 text-rose-500 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all font-bold">✕</button>)}
                         </div>
                         <div className="p-6 flex flex-col gap-3">
                             <h3 className="font-black italic text-slate-700 uppercase tracking-tight text-sm truncate">{p.name}</h3>
                             {p.correction_deadline && (<div className="text-[9px] font-bold text-slate-400 flex items-center gap-1"><span>📅 Límite:</span><span className={isDeadlinePassed ? "text-orange-500" : ""}>{new Date(p.correction_deadline).toLocaleDateString()}</span></div>)}
                             <button onClick={() => navigate(`/project/${p.id}`)} className="w-full py-3 bg-slate-50 text-rose-600 rounded-xl font-black text-[10px] uppercase hover:bg-rose-50 transition-colors">Revisar</button>
                         </div>
                       </div>
                      )
                   })}
              </div>
            )
        ) : null}

        {/* --- NUEVO BOTÓN DE ELIMINAR TODO ABAJO (SOLO ADMIN) --- */}
        {currentItems.length > 0 && userRole === 'admin' && (
            <div className="mt-12 flex justify-center border-t border-slate-200 pt-8 pb-20">
                <button 
                    onClick={handleDeleteVersion} 
                    className="text-red-400 font-bold text-xs uppercase hover:text-red-600 hover:bg-red-50 border border-red-100 hover:border-red-200 px-6 py-3 rounded-xl transition-all flex items-center gap-2"
                >
                    <span>🗑️</span> ELIMINAR TODAS LAS PÁGINAS DE ESTA VERSIÓN
                </button>
            </div>
        )}

      </div>
    </div>
  );
};

export default Dashboard;
