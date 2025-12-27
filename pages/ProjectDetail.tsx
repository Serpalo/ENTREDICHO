import React, { useState, useEffect, useRef } from 'react';
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
  
  // 1. OBTENER PROYECTO ACTUAL Y HERMANOS (Para navegación)
  const project = projects.find((p: any) => String(p.id) === String(projectId));
  
  // LÓGICA DE NAVEGACIÓN (Anterior / Siguiente)
  const siblings = project 
    ? projects.filter((p: any) => p.parent_id === project.parent_id).sort((a: any, b: any) => a.name.localeCompare(b.name))
    : [];
  const currentIndex = siblings.findIndex((p: any) => String(p.id) === String(projectId));
  const prevProject = siblings[currentIndex - 1];
  const nextProject = siblings[currentIndex + 1];

  // ESTADOS VISUALES
  const [newCoords, setNewCoords] = useState<{x: number, y: number} | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isComparing, setIsComparing] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [compareProject, setCompareProject] = useState<any>(null);
  
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // 2. CARGA DE NOTAS (USANDO TEXTO/UUID)
  const loadCorrections = async () => {
    if (!projectId) return;
    
    // NO usamos parseInt, enviamos el ID tal cual (texto)
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('page_id', projectId) 
      .order('created_at', { ascending: false });
      
    if (error) console.error("Error cargando notas:", error);
    setCorrections(data || []);
  };

  useEffect(() => { loadCorrections(); }, [projectId]);

  // Comparador
  useEffect(() => {
    if (project && projects.length > 0) {
      const sameFolder = projects.filter((p: any) => p.parent_id === project.parent_id);
      const prevVer = sameFolder.find((p: any) => p.version === (project.version - 1) && p.name === project.name);
      if (!prevVer) {
         const currentVerList = sameFolder.filter((p: any) => p.version === project.version);
         const prevVerList = sameFolder.filter((p: any) => p.version === (project.version - 1));
         const idx = currentVerList.findIndex((p: any) => p.id === project.id);
         if (prevVerList[idx]) setCompareProject(prevVerList[idx]);
      } else {
         setCompareProject(prevVer);
      }
    }
  }, [project, projects]);

  const handleSliderMove = (e: any) => {
    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSliderPosition((x / rect.width) * 100);
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isComparing || !imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Solo marcamos punto si el click fue dentro de los límites (a veces los bordes engañan)
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
        setNewCoords({ x, y });
    }
  };

  // 3. GUARDADO DE NOTA CON ADJUNTO
  const handleAddNote = async () => {
    if (!newNote && !newCoords) return alert("Escribe algo o marca un punto.");
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

      const { error: insertError } = await supabase.from('comments').insert([{
        page_id: projectId,
        content: newNote,
        attachment_url: fileUrl,
        resolved: false,
        x: newCoords?.x || null,
        y: newCoords?.y || null
      }]);

      if (insertError) alert("Error al guardar: " + insertError.message);
      else {
        setNewNote("");
        setSelectedFile(null);
        setNewCoords(null);
        loadCorrections(); 
      }
    } catch (err: any) {
      alert("Error subiendo archivo: " + err.message);
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
            {compareProject ? (
              <button onClick={() => setIsComparing(!isComparing)} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${isComparing ? "bg-slate-800 text-white" : "bg-white border text-slate-600"}`}>
                {isComparing ? "❌ Cerrar" : "⚖️ Comparar V" + compareProject.version}
              </button>
            ) : project.version > 1 && <span className="text-[9px] text-slate-300 font-bold">SIN PREVIO</span>}
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setZoomLevel(Math.max(1, zoomLevel - 0.5))} className="w-8 h-8 flex items-center justify-center bg-white rounded-md font-bold text-slate-600">-</button>
                <span className="text-[10px] font-black w-12 text-center text-slate-500">{Math.round(zoomLevel * 100)}%</span>
                <button onClick={() => setZoomLevel(zoomLevel + 0.5)} className="w-8 h-8 flex items-center justify-center bg-white rounded-md font-bold text-slate-600">+</button>
            </div>
            <div className="px-3 py-1 bg-rose-600 rounded-lg text-[10px] font-black text-white uppercase">V{project.version}</div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* ZONA CENTRAL (IMAGEN) */}
        <div className="flex-1 bg-slate-200/50 relative overflow-auto flex items-center justify-center p-8 select-none">
            
            {/* === FLECHA IZQUIERDA (ANTERIOR) === */}
            {prevProject && (
                <button 
                    onClick={() => navigate(`/project/${prevProject.id}`)}
                    className="fixed left-6 top-1/2 -translate-y-1/2 z-50 p-4 bg-slate-800/90 text-white rounded-full shadow-2xl hover:bg-rose-600 hover:scale-110 transition-all border-2 border-white/20"
                    title={`Ir a: ${prevProject.name}`}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
            )}

            {isComparing && compareProject ? (
                <div ref={imageContainerRef} className="relative shadow-2xl bg-white cursor-col-resize group" onMouseMove={handleSliderMove} onTouchMove={handleSliderMove} onClick={handleSliderMove} style={{ width: zoomLevel===1?'auto':`${zoomLevel*100}%`, height: zoomLevel===1?'100%':'auto', aspectRatio:'3/4' }}>
                    <img src={project.image_url} className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none" />
                    <div className="absolute top-0 left-0 h-full overflow-hidden border-r-4 border-white shadow-xl" style={{ width: `${sliderPosition}%` }}>
                        <img src={compareProject.image_url} className="absolute top-0 left-0 w-[100vw] max-w-none h-full object-contain pointer-events-none" style={{ width: imageContainerRef.current ? `${imageContainerRef.current.clientWidth}px` : '100%' }} />
                    </div>
                    <div className="absolute top-0 bottom-0 w-1 bg-white cursor-col-resize z-30 flex items-center justify-center" style={{ left: `${sliderPosition}%` }}><div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow border border-slate-200"><span className="text-slate-400 text-[10px]">↔</span></div></div>
                </div>
            ) : (
                <div ref={imageContainerRef} onClick={handleImageClick} className="relative shadow-2xl bg-white cursor-crosshair group transition-transform duration-200 ease-out" style={{ width: zoomLevel===1?'auto':`${zoomLevel*100}%`, height: zoomLevel===1?'100%':'auto' }}>
                  {project.image_url ? <img src={project.image_url} className="w-full h-full object-contain block" draggable={false} /> : <div className="w-[500px] h-[700px] flex items-center justify-center">SIN IMAGEN</div>}
                  
                  {/* PINES GUARDADOS */}
                  {corrections.map(c => !c.resolved && c.x!=null && (
                    <div key={c.id} className={`absolute w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center -translate-x-1/2 -translate-y-1/2 z-10 ${hoveredId===c.id?"bg-rose-600 scale-150 z-20":"bg-rose-500 hover:scale-125"}`} style={{left:`${c.x*100}%`, top:`${c.y*100}%`}}><div className="w-1.5 h-1.5 bg-white rounded-full"></div></div>
                  ))}
                  
                  {/* PIN NUEVO (TEMPORAL) */}
                  {newCoords && <div className="absolute w-8 h-8 bg-rose-500/80 animate-pulse rounded-full border-2 border-white shadow-lg -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none" style={{left:`${newCoords.x*100}%`, top:`${newCoords.y*100}%`}}></div>}
                </div>
            )}

            {/* === FLECHA DERECHA (SIGUIENTE) === */}
            {nextProject && (
                // Usamos absolute dentro del contenedor flex para que se quede pegado al borde derecho del área gris, antes de la sidebar
                <button 
                    onClick={() => navigate(`/project/${nextProject.id}`)}
                    className="fixed right-[430px] top-1/2 -translate-y-1/2 z-50 p-4 bg-slate-800/90 text-white rounded-full shadow-2xl hover:bg-rose-600 hover:scale-110 transition-all border-2 border-white/20"
                    title={`Ir a: ${nextProject.name}`}
                >
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
                    {newCoords && <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded animate-bounce">🎯 Punto marcado</span>}
                  </div>
                  <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm mb-3 min-h-[80px] resize-none focus:outline-none focus:border-rose-300" placeholder="Escribe corrección..." />
                  <div className="flex flex-col gap-2">
                     <div className="flex gap-2">
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
                          {c.x !== null && <span className="text-[8px] font-black bg-white/50 text-rose-600 px-1.5 py-0.5 rounded uppercase border border-rose-100">🎯 Mapa</span>}
                          {c.attachment_url && <a href={c.attachment_url} target="_blank" rel="noreferrer" className="text-[8px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded uppercase hover:bg-slate-200 border border-slate-200">📎 Ver Adjunto</a>}
                        </div>
                        <div className="mt-2 flex justify-between items-center pt-2 border-t border-slate-200/50">
                           <span className="text-[9px] text-slate-400 font-bold">{new Date(c.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
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
