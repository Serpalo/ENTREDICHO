import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { jsPDF } from "jspdf";

// Tipo para definir las herramientas disponibles
type DrawingTool = 'pen' | 'highlighter';

const ProjectDetail = ({ projects = [], onRefresh }: any) => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  
  // DATOS
  const [corrections, setCorrections] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  
  // ESTADO DE APROBACIÓN LOCAL
  const [isPageApproved, setIsPageApproved] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // 1. IDENTIFICAR PROYECTO ACTUAL
  const project = useMemo(() => 
    projects.find((p: any) => String(p.id) === String(projectId)), 
  [projects, projectId]);

  // Sincronizar estado de aprobación cuando carga el proyecto
  useEffect(() => {
      if (project) {
          setIsPageApproved(project.is_approved || false);
      }
  }, [project]);

  // 2. NAVEGACIÓN HERMANOS
  const siblings = useMemo(() => {
    if (!project) return [];
    return projects
      .filter((p: any) => p.parent_id === project.parent_id && p.version === project.version)
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [projects, project]);

  const currentIndex = siblings.findIndex((p: any) => String(p.id) === String(projectId));
  const prevProject = siblings[currentIndex - 1];
  const nextProject = siblings[currentIndex + 1];

  // 3. COMPARACIÓN INTELIGENTE
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
  const [compareTargetId, setCompareTargetId] = useState<string>("");

  useEffect(() => {
    if (historicalVersions.length > 0 && !compareTargetId) {
      setCompareTargetId(String(historicalVersions[0].id));
    }
  }, [historicalVersions, compareTargetId]);

  const compareProject = useMemo(() => 
    projects.find((p: any) => String(p.id) === String(compareTargetId)),
  [projects, compareTargetId]);

  // ESTADOS DIBUJO
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [activeTool, setActiveTool] = useState<DrawingTool>('pen'); 
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [tempDrawings, setTempDrawings] = useState<{path: string, tool: DrawingTool}[]>([]);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // CARGA DE NOTAS
  const loadCorrections = async () => {
    if (!projectId) return;
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('page_id', projectId) 
      .order('created_at', { ascending: true });
    if (error) console.error("Error cargando notas:", error);
    setCorrections(data || []);
  };

  useEffect(() => { loadCorrections(); }, [projectId]);

  // FUNCIÓN PARA APROBAR/DESAPROBAR PÁGINA
  const togglePageApproval = async () => {
      const newState = !isPageApproved;
      setIsPageApproved(newState); // Actualizamos visualmente rápido
      
      const { error } = await supabase
        .from('projects')
        .update({ is_approved: newState })
        .eq('id', projectId);

      if (error) {
          alert("Error al actualizar estado");
          setIsPageApproved(!newState); // Revertir si falla
      } else {
          // Si tienes una función para refrescar la lista global de proyectos, llámala aquí
          if (onRefresh) onRefresh(); 
      }
  };

  // PDF
  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const title = project ? `Correcciones: ${project.name}` : "Correcciones";
    
    doc.setFontSize(16);
    doc.setTextColor(225, 29, 72);
    doc.text(title, 10, 15);
    
    // Indicador de estado en el PDF
    if (isPageApproved) {
        doc.setTextColor(22, 163, 74); // Verde
        doc.text("[PÁGINA APROBADA]", 140, 15);
    }

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generado el: ${new Date().toLocaleString()}`, 10, 22);
    doc.setLineWidth(0.5);
    doc.line(10, 25, 200, 25);

    let yPosition = 35;

    corrections.forEach((c, index) => {
        if (yPosition > 270) { doc.addPage(); yPosition = 20; }
        
        let statusText = "[PENDIENTE]";
        if (c.resolved) {
            doc.setTextColor(22, 163, 74);
            statusText = "[HECHO]";
        } else if (c.is_general) {
            doc.setTextColor(37, 99, 235);
            statusText = "[GENERAL]";
        } else {
            doc.setTextColor(225, 29, 72);
            statusText = "[PENDIENTE]";
        }

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`${index + 1}. ${statusText}`, 10, yPosition);
        
        const date = new Date(c.created_at).toLocaleString();
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150);
        doc.text(date, 150, yPosition);

        yPosition += 5;
        doc.setTextColor(0);
        const splitText = doc.splitTextToSize(c.content || "(Sin texto, solo marca visual)", 180);
        doc.text(splitText, 15, yPosition);
        
        let extraInfo = [];
        if (c.drawing_data) extraInfo.push("Contiene dibujo/subrayado");
        if (c.attachment_url) extraInfo.push("Contiene archivo adjunto");
        if(extraInfo.length > 0) {
            yPosition += (splitText.length * 4) + 2;
            doc.setFontSize(8);
            doc.setTextColor(100);
            doc.text(`(${extraInfo.join(", ")})`, 15, yPosition);
        }
        yPosition += (splitText.length * 5) + 10;
        doc.setDrawColor(240);
        doc.line(10, yPosition - 5, 200, yPosition - 5);
    });
    doc.save(`Correcciones_${project?.name || 'documento'}.pdf`);
  };

  const handleSliderMove = (e: any) => {
    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSliderPosition((x / rect.width) * 100);
  };

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
    // SI ESTÁ APROBADA, NO HACEMOS NADA
    if (isComparing || isPageApproved) return;

    if (isDrawingMode) {
        setIsDrawing(true);
        const { x, y } = getRelativeCoords(e);
        setCurrentPath(`M ${x} ${y}`);
        e.preventDefault(); 
    } else {
        const { x, y } = getRelativeCoords(e);
        if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
            setNewCoords({ x: x/100, y: y/100 });
            setTimeout(() => textareaRef.current?.focus(), 50);
        }
    }
  };

  const handlePointerMove = (e: any) => {
    if (!isDrawing || !isDrawingMode) return;
    e.preventDefault(); 
    const { x, y } = getRelativeCoords(e);
    setCurrentPath(prev => `${prev} L ${x} ${y}`);
  };

  const handlePointerUp = () => {
    if (isDrawing && isDrawingMode && currentPath) {
        setTempDrawings(prev => [...prev, { path: currentPath, tool: activeTool }]);
        setCurrentPath("");
    }
    setIsDrawing(false);
  };

  const handleAddNote = async (isGeneral = false) => {
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

      const drawingDataString = tempDrawings.length > 0 ? tempDrawings.map(d => d.path).join('|') : null;
      const usedTool = tempDrawings.length > 0 ? tempDrawings[tempDrawings.length-1].tool : 'pen';

      const { error: insertError } = await supabase.from('comments').insert([{
        page_id: projectId,
        content: newNote,
        attachment_url: fileUrl,
        resolved: false,
        is_general: isGeneral,
        x: newCoords?.x || null,
        y: newCoords?.y || null,
        drawing_data: drawingDataString,
        drawing_tool: usedTool,
      }]);

      if (insertError) alert("Error al guardar: " + insertError.message);
      else {
        setNewNote("");
        setSelectedFile(null);
        setNewCoords(null);
        setTempDrawings([]); 
        setCurrentPath("");
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

  // Helper para estilos estáticos
  const getStrokeStyle = (tool: DrawingTool) => {
      const isHighlighter = tool === 'highlighter';
      return {
          color: isHighlighter ? "#fde047" : "#f43f5e", 
          width: isHighlighter ? "2" : "0.5",
          opacity: isHighlighter ? "0.5" : "1"
      };
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
            
            {/* --- BOTÓN NUEVO: APROBAR PÁGINA --- */}
            <button 
                onClick={togglePageApproval}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all shadow-md flex items-center gap-2 ${isPageApproved ? 'bg-emerald-500 text-white hover:bg-red-500' : 'bg-slate-800 text-white hover:bg-emerald-600'}`}
                title={isPageApproved ? "Click para reabrir (desaprobar)" : "Click para finalizar y bloquear"}
            >
                {isPageApproved ? (
                    <span className="group-hover:hidden">✅ PÁGINA APROBADA</span>
                ) : (
                    "👍 APROBAR PÁGINA"
                )}
            </button>

            {corrections.length > 0 && (
                <button onClick={handleDownloadPDF} className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-slate-50 flex items-center gap-2 shadow-sm">
                    <span>📄 PDF</span>
                </button>
            )}

            {historicalVersions.length > 0 ? (
                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                    <button onClick={() => setIsComparing(!isComparing)} className={`px-3 py-1.5 rounded-lg font-black text-[10px] uppercase transition-all flex items-center gap-2 ${isComparing ? "bg-slate-800 text-white shadow-md" : "text-slate-500 hover:bg-white"}`}>
                        {isComparing ? "Cerrar" : "⚖️ Comparar"}
                    </button>
                    {isComparing && (
                        <select value={compareTargetId} onChange={(e) => setCompareTargetId(e.target.value)} className="bg-white border border-slate-200 text-slate-700 text-[10px] font-bold py-1.5 px-2 rounded-lg focus:outline-none focus:border-rose-500 uppercase cursor-pointer">
                            {historicalVersions.map((v: any) => (<option key={v.id} value={v.id}>V{v.version}</option>))}
                        </select>
                    )}
                </div>
            ) : (
                project.version > 1 && <span className="text-[9px] text-slate-300 font-bold border border-slate-100 px-2 py-1 rounded">SIN PREVIO</span>
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
            
            {!isComparing && prevProject && (
                <button onClick={() => navigate(`/project/${prevProject.id}`)} className="fixed left-6 top-1/2 -translate-y-1/2 z-50 p-4 bg-slate-800/90 text-white rounded-full shadow-2xl hover:bg-rose-600 hover:scale-110 transition-all border-2 border-white/20">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
            )}

            {isComparing && compareProject ? (
                <div ref={imageContainerRef} className="relative shadow-2xl bg-white cursor-col-resize group" onMouseMove={handleSliderMove} onTouchMove={handleSliderMove} onClick={handleSliderMove} style={{ width: zoomLevel===1?'auto':`${zoomLevel*100}%`, height: zoomLevel===1?'100%':'auto', aspectRatio:'3/4' }}>
                    <img src={project.image_url} className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none" />
                    <div className="absolute top-0 left-0 h-full overflow-hidden border-r-4 border-white shadow-xl" style={{ width: `${sliderPosition}%` }}>
                        <div className="relative w-full h-full" style={{ width: imageContainerRef.current ? `${imageContainerRef.current.clientWidth}px` : '100%' }}>
                            <img src={compareProject.image_url} className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none" />
                            <div className="absolute top-4 left-4 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded opacity-80">V{compareProject.version} (Anterior)</div>
                        </div>
                    </div>
                    <div className="absolute top-0 bottom-0 w-1 bg-white cursor-col-resize z-30 flex items-center justify-center" style={{ left: `${sliderPosition}%` }}>
                        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow border border-slate-200"><span className="text-slate-400 text-[10px]">↔</span></div>
                    </div>
                    <div className="absolute top-4 right-4 bg-rose-600 text-white text-[10px] font-bold px-2 py-1 rounded opacity-80">V{project.version} (Actual)</div>
                </div>
            ) : (
                <div 
                    ref={imageContainerRef} 
                    onPointerDown={handlePointerDown} 
                    onPointerMove={handlePointerMove} 
                    onPointerUp={handlePointerUp} 
                    onPointerLeave={handlePointerUp}
                    // SI ESTÁ APROBADA, cursor normal (no deja dibujar)
                    className={`relative shadow-2xl bg-white group transition-transform duration-200 ease-out touch-none ${!isPageApproved && isDrawingMode ? (activeTool==='highlighter' ? 'cursor-text' : 'cursor-crosshair') : 'cursor-default'}`} 
                    style={{ width: zoomLevel===1?'auto':`${zoomLevel*100}%`, height: zoomLevel===1?'100%':'auto' }}
                >
                  {project.image_url ? <img src={project.image_url} className="w-full h-full object-contain block select-none pointer-events-none" draggable={false} /> : <div className="w-[500px] h-[700px] flex items-center justify-center">SIN IMAGEN</div>}
                  
                  {/* CAPA DE BLOQUEO VISUAL SI ESTÁ APROBADA (OPCIONAL) */}
                  {isPageApproved && (
                      <div className="absolute top-4 right-4 bg-emerald-500 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-lg z-50 pointer-events-none opacity-80 border-2 border-white">
                          🔒 FINALIZADA
                      </div>
                  )}

                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
                      {/* --- LÓGICA DE DIBUJO --- */}
                      {corrections.map(c => !c.resolved && c.drawing_data && (
                          c.drawing_data.split('|').map((path: string, i: number) => {
                              const isHovered = hoveredId === c.id;
                              const isHighlighter = c.drawing_tool === 'highlighter';
                              
                              let strokeColor = isHighlighter ? "#fde047" : "#f43f5e"; 
                              if (c.is_general && !isHighlighter) strokeColor = "#2563eb"; 
                              
                              const strokeWidth = isHighlighter 
                                  ? (isHovered ? "4" : "2") 
                                  : (isHovered ? "1.5" : "0.5");
                                  
                              const opacity = isHighlighter 
                                  ? (isHovered ? "0.8" : "0.5") 
                                  : "1";

                              return (
                                  <path 
                                      key={`${c.id}-${i}`} 
                                      d={path} 
                                      stroke={strokeColor} 
                                      strokeWidth={strokeWidth} 
                                      opacity={opacity} 
                                      fill="none" 
                                      strokeLinecap="round" 
                                      strokeLinejoin="round" 
                                      className={`transition-all duration-200 ${isHovered ? "drop-shadow-lg" : ""}`} 
                                  />
                              );
                          })
                      ))}
                      
                      {tempDrawings.map((item, i) => {
                          const style = getStrokeStyle(item.tool);
                          return <path key={`temp-${i}`} d={item.path} stroke={style.color} strokeWidth={style.width} opacity={style.opacity} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      })}
                      {currentPath && (
                          <path d={currentPath} stroke={getStrokeStyle(activeTool).color} strokeWidth={getStrokeStyle(activeTool).width} opacity={getStrokeStyle(activeTool).opacity} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      )}
                  </svg>

                  {/* CHINCHETAS */}
                  {corrections.map(c => !c.resolved && c.x!=null && !c.drawing_data && (
                    <div key={c.id} className={`absolute w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center -translate-x-1/2 -translate-y-1/2 z-20 ${hoveredId===c.id? (c.is_general ? "bg-blue-600 scale-150 z-30" : "bg-purple-600 scale-150 z-30") : (c.is_general ? "bg-blue-500 hover:scale-125" : "bg-purple-600 hover:scale-125")}`} style={{left:`${c.x*100}%`, top:`${c.y*100}%`}}><div className="w-1.5 h-1.5 bg-white rounded-full"></div></div>
                  ))}
                  
                  {newCoords && <div className="absolute w-8 h-8 bg-purple-600/80 animate-pulse rounded-full border-2 border-white shadow-lg -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none" style={{left:`${newCoords.x*100}%`, top:`${newCoords.y*100}%`}}></div>}
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
              
              {/* --- ZONA DE EDICIÓN: SE OCULTA SI ESTÁ APROBADA --- */}
              {isPageApproved ? (
                  <div className="p-8 bg-emerald-50 border-b border-emerald-100 text-center flex flex-col items-center gap-2">
                      <span className="text-4xl">🎉</span>
                      <h3 className="text-emerald-800 font-black uppercase text-lg">Página Aprobada</h3>
                      <p className="text-emerald-600 text-xs px-4">Esta página está finalizada. Para añadir más correcciones, debes volver a abrirla pulsando el botón superior.</p>
                  </div>
              ) : (
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nueva Nota</h3>
                        {isDrawingMode ? (
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded animate-pulse ${activeTool === 'highlighter' ? 'text-yellow-600 bg-yellow-100' : 'text-rose-600 bg-rose-50'}`}>
                                {activeTool === 'highlighter' ? '🖍️ Subrayando...' : '✏️ Dibujando...'}
                            </span>
                        ) : newCoords ? (
                            <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded animate-bounce">🎯 Punto marcado</span>
                        ) : null}
                      </div>
                      
                      <textarea 
                        ref={textareaRef}
                        value={newNote} 
                        onChange={(e) => setNewNote(e.target.value)} 
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm mb-3 min-h-[80px] resize-none focus:outline-none focus:border-rose-300" 
                        placeholder="Escribe corrección..." 
                      />
                      
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                            <button onClick={() => { setIsDrawingMode(true); setActiveTool('pen'); setNewCoords(null); }} className={`flex-1 p-2 rounded-md border transition-all text-[10px] font-bold flex items-center justify-center gap-1 ${isDrawingMode && activeTool === 'pen' ? 'bg-white text-rose-600 border-rose-200 shadow-sm' : 'text-slate-500 border-transparent hover:bg-white'}`} title="Bolígrafo (línea fina)">✏️ Boli</button>
                            <button onClick={() => { setIsDrawingMode(true); setActiveTool('highlighter'); setNewCoords(null); }} className={`flex-1 p-2 rounded-md border transition-all text-[10px] font-bold flex items-center justify-center gap-1 ${isDrawingMode && activeTool === 'highlighter' ? 'bg-yellow-100 text-yellow-700 border-yellow-200 shadow-sm' : 'text-slate-500 border-transparent hover:bg-white'}`} title="Subrayador (línea gruesa transparente)">🖍️ Subrayador</button>
                            {isDrawingMode && (<button onClick={() => setIsDrawingMode(false)} className="px-2 text-slate-400 hover:text-slate-600" title="Cancelar dibujo">✕</button>)}
                        </div>

                        <div className="flex gap-2 mt-1">
                            <input type="file" id="adjunto" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                            <label htmlFor="adjunto" className={`px-4 py-3 rounded-lg font-black text-[9px] cursor-pointer border flex items-center gap-2 ${selectedFile?"bg-emerald-50 text-emerald-600 border-emerald-200":"bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}><span>📎</span>{selectedFile ? "LISTO" : "ADJUNTAR"}</label>
                            <button onClick={() => handleAddNote(false)} disabled={loading} className={`flex-1 py-3 rounded-lg font-black text-[10px] uppercase text-white shadow-md transition-all ${loading?"bg-slate-400":"bg-rose-600 hover:bg-rose-700"}`}>{loading ? "..." : "GUARDAR"}</button>
                        </div>
                        
                        <button onClick={() => handleAddNote(true)} disabled={loading} className="w-full py-2 bg-blue-50 border border-blue-200 text-blue-600 rounded-lg font-black text-[10px] uppercase hover:bg-blue-100 transition-colors">MODIFICACIÓN GENERAL</button>

                        {selectedFile && <span className="text-[10px] font-bold text-emerald-600 text-center truncate">📄 {selectedFile.name}</span>}
                        {tempDrawings.length > 0 && <button onClick={() => setTempDrawings([])} className="text-[9px] text-rose-400 hover:text-rose-600 font-bold text-right underline">Borrar dibujo actual</button>}
                      </div>
                  </div>
              )}
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
                {corrections.length===0 && <div className="mt-10 text-center text-slate-300 text-xs font-bold uppercase italic">Sin correcciones</div>}
                {corrections.map((c, i) => (
                  <div 
                    key={c.id} 
                    onMouseEnter={() => setHoveredId(c.id)} 
                    onMouseLeave={() => setHoveredId(null)} 
                    className={`p-4 rounded-2xl border-2 transition-all 
                        ${c.resolved ? 'bg-emerald-50 border-emerald-200 opacity-60' : (c.is_general ? 'bg-blue-50 border-blue-200' : 'bg-rose-50 border-rose-200')} 
                        ${hoveredId===c.id?'scale-[1.02] shadow-md':''}`}
                  >
                    <div className="flex gap-3 items-start">
                      <button 
                        onClick={() => toggleCheck(c.id, c.resolved)} 
                        className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shadow-sm 
                            ${c.resolved ? "bg-emerald-500 border-emerald-500 text-white" : (c.is_general ? "bg-white border-blue-400 hover:scale-110" : "bg-white border-rose-400 hover:scale-110")}`}
                      >
                          {c.resolved && "✓"}
                      </button>
                      
                      <div className="flex-1">
                        <div className="flex justify-between">
                            <span className={`text-[9px] font-black uppercase ${c.is_general ? 'text-blue-400' : 'text-rose-300'}`}>#{i+1} {c.is_general && "GENERAL"}</span>
                            <span className="text-[9px] text-slate-400 font-bold">{new Date(c.created_at).toLocaleString([], { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        
                        <p className={`text-sm font-bold leading-snug mt-1 ${c.resolved ? "text-emerald-800 line-through" : (c.is_general ? "text-blue-900" : "text-rose-900")}`}>
                            {c.content}
                        </p>
                        
                        <div className="flex flex-wrap gap-2 mt-2 items-center">
                          {c.attachment_url && <a href={c.attachment_url} target="_blank" rel="noreferrer" className="text-[8px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded uppercase hover:bg-slate-200 border border-slate-200">📎 Ver Adjunto</a>}
                        </div>

                        {/* Solo permitir borrar si NO está aprobada la página (Opcional, si quieres que se pueda borrar siempre, quita la condición isPageApproved) */}
                        <div className="mt-2 flex justify-end pt-2 border-t border-slate-200/50">
                           {!isPageApproved && <button onClick={() => deleteComment(c.id)} className={`text-[9px] font-black uppercase ${c.is_general ? 'text-blue-300 hover:text-blue-600' : 'text-rose-300 hover:text-rose-600'}`}>Borrar</button>}
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
