import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';

const ProjectDetail = ({ projects = [] }: any) => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  
  // DATOS
  const [corrections, setCorrections] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  
  // 1. IDENTIFICAR PROYECTO ACTUAL
  const project = useMemo(() => 
    projects.find((p: any) => String(p.id) === String(projectId)), 
  [projects, projectId]);

  // 2. NAVEGACIÓN HERMANOS (Siguiente / Anterior en la misma versión)
  const siblings = useMemo(() => {
    if (!project) return [];
    return projects
      .filter((p: any) => p.parent_id === project.parent_id && p.version === project.version)
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [projects, project]);

  const currentIndex = siblings.findIndex((p: any) => String(p.id) === String(projectId));
  const prevProject = siblings[currentIndex - 1];
  const nextProject = siblings[currentIndex + 1];

  // 3. LÓGICA DE COMPARACIÓN (Por posición)
  const historicalVersions = useMemo(() => {
    if (!project) return [];
    
    const folderProjects = projects.filter((p: any) => p.parent_id === project.parent_id);
    const myVersionSiblings = folderProjects
        .filter((p: any) => p.version === project.version)
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
        
    const myPositionIndex = myVersionSiblings.findIndex((p: any) => String(p.id) === String(project.id));
    if (myPositionIndex === -1) return [];

    const availableVersions = [...new Set(folderProjects.map((p: any) => p.version))]
        .filter((v: any) => v !== project.version)
        .sort((a: any, b: any) => b - a);

    const matches = [];
    for (const v of availableVersions) {
        const versionSiblings = folderProjects
            .filter((p: any) => p.version === v)
            .sort((a: any, b: any) => a.name.localeCompare(b.name));
        if (versionSiblings[myPositionIndex]) {
            matches.push(versionSiblings[myPositionIndex]);
        }
    }
    return matches;
  }, [projects, project]);

  // ESTADOS VISUALES
  const [newCoords, setNewCoords] = useState<{x: number, y: number} | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isComparing, setIsComparing] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  
  // ESTADO PARA LA VERSIÓN SELECCIONADA A COMPARAR
  const [compareTargetId, setCompareTargetId] = useState<string>("");

  useEffect(() => {
    if (historicalVersions.length > 0 && !compareTargetId) {
      setCompareTargetId(String(historicalVersions[0].id));
    }
  }, [historicalVersions, compareTargetId]);

  const compareProject = useMemo(() => 
    projects.find((p: any) => String(p.id) === String(compareTargetId)),
  [projects, compareTargetId]);


  // ESTADOS PARA DIBUJO
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [tempDrawings, setTempDrawings] = useState<string[]>([]);
  
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // CARGA DE NOTAS
  const loadCorrections = async () => {
    if (!projectId) return;
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('page_id', projectId) 
      // CAMBIO REALIZADO AQUÍ: ascending: true (Orden cronológico: de antigua a nueva)
      .order('created_at', { ascending: true });
    if (error) console.error("Error cargando notas:", error);
    setCorrections(data || []);
  };

  useEffect(() => { loadCorrections(); }, [projectId]);

  const handleSliderMove = (e: any) => {
    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSliderPosition((x / rect.width) * 100);
  };

  // --- LÓGICA DE DIBUJO ---
  const getRelativeCoords = (e: any) => {
    if (!imageContainerRef.current) return { x: 0, y: 0 };
    const rect = imageContainerRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return { x, y };
  };

  const handlePointerDown = (e: any) => {
    if (isComparing) return;

    if (isDrawingMode) {
        setIsDrawing(true);
        const { x, y } = getRelativeCoords(e);
        setCurrentPath(`M ${x} ${y}`);
        e.preventDefault();
    } else {
        const { x, y } = getRelativeCoords(e);
        if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
            setNewCoords({ x: x/100, y: y/100 });
        }
    }
  };

  const handlePointerMove = (e: any) => {
    if (!isDrawing || !isDrawingMode) return;
    const { x, y } = getRelativeCoords(e);
    setCurrentPath(prev => `${prev} L ${x} ${y}`);
  };

  const handlePointerUp = () => {
    if (isDrawing && isDrawingMode && currentPath) {
        setTempDrawings(prev => [...prev, currentPath]);
        setCurrentPath("");
    }
    setIsDrawing(false);
  };

  // GUARDADO DE NOTA
  const handleAddNote = async () => {
    if (!newNote && !newCoords && tempDrawings.length === 0) return alert("Escribe algo, marca un punto o dibuja.");
    setLoading(true);
    let fileUrl = "";

    try {
      if (selectedFile) {
        const sanitizedName = selectedFile.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
        const fileName = `adjunto-${Date.now()}-${sanitizedName}`;
        const { error: uploadError } = await supabase.storage.from('FOLLETOS').upload(fileName, selectedFile);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('FOLLETOS').getPublicUrl(fileName);
        fileUrl = data.publicUrl;
      }

      const drawingDataString = tempDrawings.length > 0 ? tempDrawings.join('|') : null;

      const { error: insertError } = await supabase.from('comments').insert([{
        page_id: projectId,
        content: newNote,
        attachment_url: fileUrl,
        resolved: false,
        x: newCoords?.x || null,
        y: newCoords?.y || null,
        drawing_data: drawingDataString
      }]);

      if (insertError) alert("Error al guardar: " + insertError.message);
      else {
        setNewNote("");
        setSelectedFile(null);
        setNewCoords(null);
        setTempDrawings([]); 
        setCurrentPath("");
        setIsDrawingMode(false);
        loadCorrections(); 
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleCheck = async (id: string, currentResolved: boolean) => {
    setCorrections(prev => prev.map(c => c.id === id ? { ...c, resolved: !currentResolved } : c));
    await supabase.from('comments').update({ resolved: !currentResolved }).eq('id', id);
    loadCorrections();
  };

  const deleteComment = async (id: string) => {
    if (window.confirm("¿Borrar nota?")) {
      await supabase.from('comments').delete().eq('id', id);
      loadCorrections();
    }
  };

  if (!project) return <div className="h-screen flex items-center justify-center text-slate-300 font-black">CARGANDO...</div>;

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">
      {/* HEADER */}
      <div className="h-20 bg-white border-b border-slate-200 px-8 flex justify-between items-center shrink-0 z-50">
        <div className="flex gap-4 items-center">
          <button onClick={() => navigate(-1)} className="bg-slate-100 px-4 py-2 rounded-xl text-slate-600 font-bold text-xs hover:bg-slate-200">← VOLVER</button>
          <h2 className="text-xl font-black italic uppercase text-slate-800 tracking-tighter truncate max-w-md">{project.name}</h2>
        </div>
        
        <div className="flex gap-4 items-center">
            
            {/* --- SELECTOR DE COMPARACIÓN INTELIGENTE --- */}
            {historicalVersions.length > 0 ? (
                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                    <button 
                        onClick={() => setIsComparing(!isComparing)} 
                        className={`px-3 py-1.5 rounded-lg font-black text-[10px] uppercase transition-all flex items-center gap-2 ${isComparing ? "bg-slate-800 text-white shadow-md" : "text-slate-500 hover:bg-white"}`}
                    >
                        {isComparing ? "Cerrar Comparador" : "⚖️ Comparar"}
                    </button>
                    
                    {isComparing && (
                        <select 
                            value={compareTargetId} 
                            onChange={(e) => setCompareTargetId(e.target.value)}
                            className="bg-white border border-slate-200 text-slate-700 text-[10px] font-bold py-1.5 px-2 rounded-lg focus:outline-none focus:border-rose-500 uppercase cursor-pointer"
                        >
                            {historicalVersions.map((v: any) => (
                                <option key={v.id} value={v.id}>
                                    Contra V{v.version}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            ) : (
                project.version > 1 && <span className="text-[9px] text-slate-300 font-bold border border-slate-100 px-2 py-1 rounded">SIN PREVIO (POSICIÓN {currentIndex + 1})</span>
            )}
            
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setZoomLevel(Math.max(1, zoomLevel - 0.5))} className="w-8 h-8 flex items-center justify-center bg-white rounded-md font-bold text-slate-600">-</button>
                <span className="text-[10px] font-black w-12 text-center text-slate-500">{Math.round(zoomLevel * 100)}%</span>
                <button onClick={() => setZoomLevel(zoomLevel + 0.5)} className="w-8 h-8 flex items-center justify-center bg-white rounded-md font-bold text-slate-600">+</button>
            </div>
            <div className="px-3 py-1 bg-rose-600 rounded-lg text-[10px] font-black text-white uppercase shadow-md shadow-rose-200">V{project.version}</div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* ZONA CENTRAL */}
        <div className="flex-1 bg-slate-200/50 relative overflow-auto flex items-center justify-center p-8 select-none">
            
            {/* === FLECHAS DE NAVEGACIÓN (Solo si NO estamos comparando) === */}
            {!isComparing && prevProject && (
                <button onClick={() => navigate(`/project/${prevProject.id}`)} className="fixed left-6 top-1/2 -translate-y-1/2 z-50 p-4 bg-slate-800/90 text-white rounded-full shadow-2xl hover:bg-rose-600 hover:scale-110 transition-all border-2 border-white/20">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
            )}

            {isComparing && compareProject ? (
                /* MODO COMPARADOR */
                <div ref={imageContainerRef} className="relative shadow-2xl bg-white cursor-col-resize group" onMouseMove={handleSliderMove} onTouchMove={handleSliderMove} onClick={handleSliderMove} style={{ width: zoomLevel===1?'auto':`${zoomLevel*100}%`, height: zoomLevel===1?'100%':'auto', aspectRatio:'3/4' }}>
                    {/* IMAGEN NUEVA */}
                    <img src={project.image_url} className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none" />
                    
                    {/* IMAGEN VIEJA (RECORTADA) */}
                    <div className="absolute top-0 left-0 h-full overflow-hidden border-r-4 border-white shadow-xl" style={{ width: `${sliderPosition}%` }}>
                        <div className="relative w-full h-full" style={{ width: imageContainerRef.current ? `${imageContainerRef.current.clientWidth}px` : '100%' }}>
                            <img src={compareProject.image_url} className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none" />
                            <div className="absolute top-4 left-4 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded opacity-80">
                                V{compareProject.version} (Anterior)
                            </div>
                        </div>
                    </div>
                    
                    {/* BARRA */}
                    <div className="absolute top-0 bottom-0 w-1 bg-white cursor-col-resize z-30 flex items-center justify-center" style={{ left: `${sliderPosition}%` }}>
                        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow border border-slate-200">
                            <span className="text-slate-400 text-[10px]">↔</span>
                        </div>
                    </div>
                    
                    <div className="absolute top-4 right-4 bg-rose-600 text-white text-[10px] font-bold px-2 py-1 rounded opacity-80">
                         V{project.version} (Actual)
                    </div>
                </div>
            ) : (
                /* MODO EDICIÓN NORMAL */
                <div 
                    ref={imageContainerRef} 
                    onPointerDown={handlePointerDown} 
                    onPointerMove={handlePointerMove} 
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    className={`relative shadow-2xl bg-white group transition-transform duration-200 ease-out touch-none ${isDrawingMode ? 'cursor-crosshair' : 'cursor-default'}`} 
                    style={{ width: zoomLevel===1?'auto':`${zoomLevel*100}%`, height: zoomLevel===1?'100%':'auto' }}
                >
                  {project.image_url ? <img src={project.image_url} className="w-full h-full object-contain block select-none pointer-events-none" draggable={false} /> : <div className="w-[500px] h-[700px] flex items-center justify-center">SIN IMAGEN</div>}
                  
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
                      {corrections.map(c => !c.resolved && c.drawing_data && (
                          c.drawing_data.split('|').map((path: string, i: number) => (
                              <path key={`${c.id}-${i}`} d={path} stroke="#f43f5e" strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className={hoveredId===c.id ? "drop-shadow-md stroke-[0.8]" : ""} />
                          ))
                      ))}
                      {tempDrawings.map((path, i) => (
                          <path key={`temp-${i}`} d={path} stroke="#f43f5e" strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      ))}
                      {currentPath && (
                          <path d={currentPath} stroke="#f43f5e" strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      )}
                  </svg>

                  {corrections.map(c => !c.resolved && c.x!=null && !c.drawing_data && (
                    <div key={c.id} className={`absolute w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center -translate-x-1/2 -translate-y-1/2 z-20 ${hoveredId===c.id?"bg-rose-600 scale-150 z-30":"bg-rose-500 hover:scale-125"}`} style={{left:`${c.x*100}%`, top:`${c.y*100}%`}}><div className="w-1.5 h-1.5 bg-white rounded-full"></div></div>
                  ))}
                  
                  {newCoords && <div className="absolute w-8 h-8 bg-rose-500/80 animate-pulse rounded-full border-2 border-white shadow-lg -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none" style={{left:`${newCoords.x*100}%`, top:`${newCoords.y*100}%`}}></div>}
                </div>
            )}

            {!isComparing && nextProject && (
                <button onClick={() => navigate(`/project/${nextProject.id}`)} className="fixed right-[430px] top-1/2 -translate-y-1/2 z-50 p-4 bg-slate-800/90 text-white rounded-full shadow-2xl hover:bg-rose-600 hover:scale-110 transition-all border-2 border-white/20">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
            )}
        </div>

        {/* SIDEBAR DERECHA */}
        {!isComparing && (
            <div className="w-[400px] bg-white border-l border-slate-200 flex flex-col shadow-xl z-20">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nueva Nota</h3>
                    {isDrawingMode ? (
                        <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded animate-pulse">✏️ Dibujando...</span>
                    ) : newCoords ? (
                        <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded animate-bounce">🎯 Punto marcado</span>
                    ) : null}
                  </div>
                  
                  <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm mb-3 min-h-[80px] resize-none focus:outline-none focus:border-rose-300" placeholder="Escribe corrección..." />
                  
                  <div className="flex flex-col gap-2">
                     <div className="flex gap-2">
                         <button 
                            onClick={() => { setIsDrawingMode(!isDrawingMode); setNewCoords(null); }}
                            className={`p-3 rounded-lg border transition-all ${isDrawingMode ? 'bg-rose-600 text-white border-rose-600 shadow-inner' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                            title="Dibujar en imagen"
                         >
                            ✏️
                         </button>

                         <input type="file" id="adjunto" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                         <label htmlFor="adjunto" className={`px-4 py-3 rounded-lg font-black text-[9px] cursor-pointer border flex items-center gap-2 ${selectedFile?"bg-emerald-50 text-emerald-600 border-emerald-200":"bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}>
                             <span>📎</span>
                             {selectedFile ? "LISTO" : "ADJUNTAR"}
                         </label>
                         <button onClick={handleAddNote} disabled={loading} className={`flex-1 py-3 rounded-lg font-black text-[10px] uppercase text-white shadow-md transition-all ${loading?"bg-slate-400":"bg-rose-600 hover:bg-rose-700"}`}>
                             {loading ? "SUBIENDO..." : "GUARDAR"}
                         </button>
                     </div>
                     {selectedFile && <span className="text-[10px] font-bold text-emerald-600 text-center truncate">📄 {selectedFile.name}</span>}
                     {tempDrawings.length > 0 && <button onClick={() => setTempDrawings([])} className="text-[9px] text-rose-400 hover:text-rose-600 font-bold text-right underline">Borrar dibujo actual</button>}
                  </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
                {corrections.length===0 && <div className="mt-10 text-center text-slate-300 text-xs font-bold uppercase italic">Sin correcciones</div>}
                {corrections.map((c) => (
                  <div key={c.id} onMouseEnter={() => setHoveredId(c.id)} onMouseLeave={() => setHoveredId(null)} className={`p-4 rounded-2xl border-2 transition-all ${c.resolved?'bg-emerald-50 border-emerald-200 opacity-60':'bg-rose-50 border-rose-200'} ${hoveredId===c.id?'scale-[1.02] shadow-md':''}`}>
                    <div className="flex gap-3 items-start">
                      <button onClick={() => toggleCheck(c.id, c.resolved)} className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shadow-sm ${c.resolved?"bg-emerald-500 border-emerald-500 text-white":"bg-white border-rose-400 hover:scale-110"}`}>{c.resolved && "✓"}</button>
                      <div className="flex-1">
                        <p className={`text-sm font-bold leading-snug ${c.resolved?"text-emerald-800 line-through":"text-rose-900"}`}>{c.content}</p>
                        <div className="flex flex-wrap gap-2 mt-2 items-center">
                          {c.drawing_data && <span className="text-[8px] font-black bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded uppercase border border-rose-200">✏️ Dibujo</span>}
                          {c.x !== null && !c.drawing_data && <span className="text-[8px] font-black bg-white/50 text-rose-600 px-1.5 py-0.5 rounded uppercase border border-rose-100">🎯 Mapa</span>}
                          {c.attachment_url && <a href={c.attachment_url} target="_blank" rel="noreferrer" className="text-[8px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded uppercase hover:bg-slate-200 border border-slate-200">📎 Ver Adjunto</a>}
                        </div>
                        <div className="mt-2 flex justify-between items-center pt-2 border-t border-slate-200/50">
                           <span className="text-[9px] text-slate-400 font-bold">
                               {new Date(c.created_at).toLocaleString([], { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                           </span>
                           <button onClick={() => deleteComment(c.id)} className="text-[9px] font-black text-rose-300 hover:text-rose-600 uppercase">Borrar</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDetail;
