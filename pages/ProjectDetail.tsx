import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';

const ProjectDetail = ({ projects = [] }: any) => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [corrections, setCorrections] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Estado para la chincheta nueva y el resaltado al pasar el ratón
  const [newCoords, setNewCoords] = useState<{x: number, y: number} | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const project = projects.find((p: any) => String(p.id) === String(projectId));

  // Carga las notas ordenadas: las más nuevas primero (para que salgan justo debajo)
  const loadCorrections = async () => {
    if (!projectId) return;
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('page_id', projectId)
      .order('created_at', { ascending: false }); // Orden descendente (nuevas arriba)
    setCorrections(data || []);
  };

  useEffect(() => { loadCorrections(); }, [projectId]);

  // Detecta dónde haces clic en la imagen
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setNewCoords({ x, y });
  };

  const handleAddNote = async () => {
    if (!newNote && !newCoords) {
      alert("Escribe una nota o pincha en la imagen para marcar un punto.");
      return;
    }
    setLoading(true);
    let fileUrl = "";

    if (selectedFile) {
      const fileName = `nota-${Date.now()}-${selectedFile.name}`;
      await supabase.storage.from('FOLLETOS').upload(fileName, selectedFile);
      const { data } = supabase.storage.from('FOLLETOS').getPublicUrl(fileName);
      fileUrl = data.publicUrl;
    }

    // Guardamos usando tus columnas 'x' e 'y'
    await supabase.from('comments').insert([{
      page_id: projectId,
      content: newNote || "Corrección visual",
      attachment_url: fileUrl,
      resolved: false,
      x: newCoords?.x || null,
      y: newCoords?.y || null
    }]);

    // Limpiamos todo para la siguiente nota
    setNewNote("");
    setSelectedFile(null);
    setNewCoords(null);
    
    // Recargamos la lista AL INSTANTE
    await loadCorrections();
    setLoading(false);
  };

  const toggleCheck = async (id: string, currentResolved: boolean) => {
    await supabase.from('comments').update({ resolved: !currentResolved }).eq('id', id);
    loadCorrections();
  };

  const deleteComment = async (id: string) => {
    if (window.confirm("¿Borrar esta nota?")) {
      await supabase.from('comments').delete().eq('id', id);
      loadCorrections();
    }
  };

  if (!project) return <div className="p-20 text-center font-black text-slate-300 uppercase tracking-widest">Cargando...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      {/* CABECERA */}
      <div className="flex justify-between items-center mb-8">
        <button 
          onClick={() => navigate(-1)} 
          className="bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-100 text-slate-600 font-bold text-xs uppercase hover:bg-slate-50 transition-all flex items-center gap-2"
        >
          ← Volver
        </button>
        <h2 className="text-2xl font-black italic uppercase text-slate-800 tracking-tighter truncate max-w-2xl">{project.name}</h2>
        <div className="px-4 py-2 bg-slate-100 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest">V{project.version || 1} (ACTUAL)</div>
      </div>

      <div className="grid grid-cols-12 gap-8 h-[calc(100vh-140px)]">
        
        {/* COLUMNA IZQUIERDA: IMAGEN CON CHINCHETAS */}
        <div className="col-span-7 bg-white p-4 rounded-[2.5rem] shadow-sm border border-slate-100 overflow-y-auto h-full flex flex-col items-center relative">
          
          <div 
            ref={imageContainerRef}
            onClick={handleImageClick}
            className="relative w-full h-auto rounded-[1.5rem] overflow-hidden cursor-crosshair group shadow-inner"
          >
            {project.image_url ? (
              <img src={project.image_url} alt="Folleto" className="w-full h-auto" />
            ) : (
              <div className="aspect-[3/4] bg-slate-50 flex items-center justify-center text-slate-300 font-bold italic">SIN IMAGEN</div>
            )}

            {/* PINTAR CHINCHETAS EXISTENTES */}
            {corrections.map(c => (
              c.x !== null && c.y !== null && !c.resolved && (
                <div 
                  key={c.id}
                  className={`absolute w-6 h-6 rounded-full border-2 border-white shadow-md flex items-center justify-center -translate-x-1/2 -translate-y-1/2 z-10 transition-all duration-300 ${
                    hoveredId === c.id ? "bg-rose-600 scale-150 z-20" : "bg-rose-500 hover:scale-125"
                  }`}
                  style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
                  title={c.content}
                >
                  <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                </div>
              )
            ))}

            {/* CHINCHETA NUEVA (Parpadeante mientras decides) */}
            {newCoords && (
              <div 
                className="absolute w-6 h-6 bg-rose-500/80 animate-pulse rounded-full border-2 border-white shadow-lg flex items-center justify-center -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30"
                style={{ left: `${newCoords.x * 100}%`, top: `${newCoords.y * 100}%` }}
              >
                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
              </div>
            )}
          </div>
          
          <p className="mt-4 text-[9px] font-black uppercase text-slate-300 tracking-widest">
            {newCoords ? "Punto marcado - Dale a Guardar" : "Haz clic en la imagen para marcar un punto"}
          </p>
        </div>

        {/* COLUMNA DERECHA: PANEL DE NOTAS */}
        <div className="col-span-5 flex flex-col gap-6 h-full overflow-hidden">
          
          {/* CAJA FIJA ARRIBA: NUEVA CORRECCIÓN */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 shrink-0 transition-all relative overflow-hidden z-20">
            {newCoords && <div className="absolute top-0 left-0 w-full h-1 bg-rose-500 animate-pulse"/>}
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 flex justify-between items-center">
              Nueva Corrección
              {newCoords && <span className="text-rose-600 bg-rose-50 px-2 py-1 rounded-lg animate-bounce">🎯 Punto marcado</span>}
            </h3>
            
            <textarea 
              value={newNote} 
              onChange={(e) => setNewNote(e.target.value)}
              className="w-full p-4 bg-slate-50 rounded-2xl border-none text-sm font-medium mb-4 min-h-[100px] resize-none focus:ring-2 focus:ring-rose-100 outline-none transition-all placeholder:text-slate-300"
              placeholder="Escribe la corrección aquí..." 
            />
            
            <div className="flex gap-3">
              <input type="file" id="adjunto" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
              <label htmlFor="adjunto" className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase cursor-pointer flex items-center justify-center gap-2 transition-all ${selectedFile ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                {selectedFile ? "📎 LISTO" : "📎 ADJUNTO"}
              </label>
              
              <button onClick={handleAddNote} disabled={loading || (!newNote && !newCoords)} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg transition-all ${loading || (!newNote && !newCoords) ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-rose-600 text-white shadow-rose-200 hover:scale-105"}`}>
                {loading ? "GUARDANDO..." : "GUARDAR NOTA"}
              </button>
            </div>
          </div>

          {/* LISTA DE NOTAS (Justo debajo y con scroll) */}
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 pb-10">
            {corrections.length === 0 && <div className="text-center py-10 text-slate-300 text-xs font-bold uppercase tracking-widest italic">No hay correcciones aún</div>}
            
            {corrections.map((c) => (
              <div 
                key={c.id} 
                onMouseEnter={() => setHoveredId(c.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`group p-5 rounded-[2rem] border transition-all flex gap-4 items-start ${
                  c.resolved 
                    ? 'bg-emerald-50/50 border-emerald-100 opacity-60' 
                    : hoveredId === c.id 
                      ? 'bg-rose-50 border-rose-200 shadow-md scale-[1.02]' 
                      : 'bg-white border-rose-100 shadow-sm'
                }`}
              >
                {/* Botón Check */}
                <div onClick={() => toggleCheck(c.id, c.resolved)} className="cursor-pointer mt-1 shrink-0">
                   <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${c.resolved ? 'bg-emerald-500 border-emerald-500' : 'border-slate-200 bg-white hover:border-rose-400'}`}>
                     {c.resolved && <span className="text-white text-xs font-bold">✓</span>}
                   </div>
                </div>

                {/* Texto y detalles */}
                <div className="flex-1">
                  <p className={`text-sm font-bold uppercase italic tracking-tight leading-tight ${c.resolved ? 'text-emerald-700 line-through' : 'text-slate-700'}`}>{c.content}</p>
                  
                  {/* Etiqueta si tiene chincheta */}
                  {c.x !== null && c.y !== null && (
                    <span className="inline-flex items-center gap-1 mt-2 text-[9px] font-black text-rose-500 bg-rose-50 px-2 py-1 rounded-md uppercase tracking-wider">
                      🎯 En imagen
                    </span>
                  )}

                  {c.attachment_url && <a href={c.attachment_url} target="_blank" rel="noreferrer" className="mt-2 ml-2 inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-lg text-[9px] font-bold text-slate-500 uppercase hover:bg-slate-200 transition-colors">📎 Ver Adjunto</a>}
                  
                  <div className="mt-2 text-[9px] text-slate-300 font-bold uppercase tracking-widest flex justify-between items-center">
                    <span>{new Date(c.created_at).toLocaleDateString()} {new Date(c.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    <button onClick={() => deleteComment(c.id)} className="text-rose-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity">BORRAR</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
