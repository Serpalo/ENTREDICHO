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
  const project = projects.find((p: any) => String(p.id) === String(projectId));

  // ESTADOS VISUALES
  const [newCoords, setNewCoords] = useState<{x: number, y: number} | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // CARGAR CORRECCIONES
  const loadCorrections = async () => {
    if (!projectId) return;
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('page_id', parseInt(projectId)) // CORRECCIÓN 1: Aseguramos que sea número
      .order('created_at', { ascending: false });
      
    if (error) console.error("Error cargando notas:", error);
    setCorrections(data || []);
  };

  useEffect(() => { loadCorrections(); }, [projectId]);

  // MANEJO DE CLIC EN IMAGEN
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setNewCoords({ x, y });
  };

  // GUARDAR NOTA
  const handleAddNote = async () => {
    if (!newNote && !newCoords) {
      alert("Escribe una nota o marca un punto en la imagen.");
      return;
    }
    setLoading(true);
    let fileUrl = "";

    try {
      if (selectedFile) {
        const fileName = `nota-${Date.now()}-${selectedFile.name}`;
        const { error: uploadError } = await supabase.storage.from('FOLLETOS').upload(fileName, selectedFile);
        if (uploadError) throw uploadError;
        
        const { data } = supabase.storage.from('FOLLETOS').getPublicUrl(fileName);
        fileUrl = data.publicUrl;
      }

      // CORRECCIÓN 2: Enviamos los datos con el formato exacto y capturamos errores
      const { error: insertError } = await supabase.from('comments').insert([{
        page_id: projectId ? parseInt(projectId) : null, // IMPORTANTE: Convertir a número
        content: newNote || "Corrección visual",
        attachment_url: fileUrl,
        resolved: false,
        x: newCoords?.x || null,
        y: newCoords?.y || null
      }]);

      if (insertError) {
        alert("Error al guardar: " + insertError.message); // AQUÍ VEREMOS SI FALLA
        console.error(insertError);
      } else {
        // Si todo va bien, limpiamos
        setNewNote("");
        setSelectedFile(null);
        setNewCoords(null);
        await loadCorrections();
      }

    } catch (err: any) {
      alert("Ha ocurrido un error inesperado: " + err.message);
    } finally {
      setLoading(false);
    }
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

  if (!project) return <div className="h-screen flex items-center justify-center font-black text-slate-300 uppercase">Cargando...</div>;

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">
      
      {/* CABECERA */}
      <div className="h-20 bg-white border-b border-slate-200 px-8 flex justify-between items-center shrink-0 z-50">
        <div className="flex gap-4 items-center">
          <button onClick={() => navigate(-1)} className="bg-slate-100 px-4 py-2 rounded-xl text-slate-600 font-bold text-xs uppercase hover:bg-slate-200 transition-all">
            ← Volver
          </button>
          <h2 className="text-xl font-black italic uppercase text-slate-800 tracking-tighter truncate max-w-md">
            {project.name}
          </h2>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
          <button onClick={() => setZoomLevel(Math.max(1, zoomLevel - 0.5))} className="w-8 h-8 flex items-center justify-center bg-white rounded-md shadow-sm text-slate-600 font-bold hover:text-rose-600">-</button>
          <span className="text-[10px] font-black w-12 text-center text-slate-500">
             {zoomLevel === 1 ? "AJUSTAR" : `${Math.round(zoomLevel * 100)}%`}
          </span>
          <button onClick={() => setZoomLevel(zoomLevel + 0.5)} className="w-8 h-8 flex items-center justify-center bg-white rounded-md shadow-sm text-slate-600 font-bold hover:text-rose-600">+</button>
        </div>

        <div className="px-3 py-1 bg-slate-800 rounded-lg text-[10px] font-black text-white uppercase tracking-widest">
          V{project.version || 1}
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* VISOR DE IMAGEN */}
        <div className="flex-1 bg-slate-200/50 relative overflow-auto flex items-center justify-center p-8">
            <div 
              ref={imageContainerRef}
              onClick={handleImageClick}
              className="relative shadow-2xl bg-white transition-all duration-300 ease-out cursor-crosshair group"
              style={{ 
                width: zoomLevel === 1 ? 'auto' : `${zoomLevel * 100}%`,
                height: zoomLevel === 1 ? '100%' : 'auto',
                maxWidth: zoomLevel === 1 ? '100%' : 'none',
              }}
            >
              {project.image_url ? (
                <img src={project.image_url} alt="Folleto" className="w-full h-full object-contain block" draggable={false} />
              ) : (
                <div className="w-[500px] h-[700px] flex items-center justify-center text-slate-300 font-black italic">SIN IMAGEN</div>
              )}

              {corrections.map(c => c.x !== null && c.y !== null && !c.resolved && (
                <div 
                  key={c.id}
                  className={`absolute w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center -translate-x-1/2 -translate-y-1/2 z-10 transition-transform ${
                    hoveredId === c.id ? "bg-rose-600 scale-150 z-20" : "bg-rose-500 hover:scale-125"
                  }`}
                  style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
                >
                  <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                </div>
              ))}

              {newCoords && (
                <div 
                  className="absolute w-8 h-8 bg-rose-500/80 animate-pulse rounded-full border-2 border-white shadow-lg flex items-center justify-center -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30"
                  style={{ left: `${newCoords.x * 100}%`, top: `${newCoords.y * 100}%` }}
                >
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              )}
            </div>
        </div>

        {/* BARRA LATERAL */}
        <div className="w-[400px] bg-white border-l border-slate-200 flex flex-col shadow-xl z-20">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
             <div className="flex justify-between items-center mb-3">
               <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nueva Nota</h3>
               {newCoords && <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded animate-bounce">🎯 Punto marcado</span>}
             </div>
             
             <textarea 
                value={newNote} 
                onChange={(e) => setNewNote(e.target.value)}
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm mb-3 min-h-[80px] resize-none focus:outline-none focus:border-rose-300 transition-colors"
                placeholder="Escribe aquí..." 
             />
             
             <div className="flex gap-2">
                <input type="file" id="adjunto" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                <label htmlFor="adjunto" className={`px-4 py-3 rounded-lg font-black text-[9px] uppercase cursor-pointer border flex items-center ${selectedFile ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}>
                  {selectedFile ? "📎" : "📎"}
                </label>
                <button onClick={handleAddNote} disabled={loading} className={`flex-1 py-3 rounded-lg font-black text-[10px] uppercase text-white shadow-md transition-all ${loading ? "bg-slate-400" : "bg-rose-600 hover:bg-rose-700"}`}>
                  {loading ? "..." : "GUARDAR"}
                </button>
             </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
            {corrections.length === 0 && (
              <div className="mt-10 text-center text-slate-300 text-xs font-bold uppercase italic">Sin correcciones</div>
            )}
            
            {corrections.map((c) => (
              <div 
                key={c.id} 
                onMouseEnter={() => setHoveredId(c.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`p-4 rounded-2xl border transition-all ${
                  c.resolved 
                    ? 'bg-slate-50 border-slate-100 opacity-60' 
                    : hoveredId === c.id 
                      ? 'bg-rose-50 border-rose-200 shadow-md transform scale-[1.02]' 
                      : 'bg-white border-slate-100 shadow-sm hover:border-rose-100'
                }`}
              >
                <div className="flex gap-3 items-start">
                  <button onClick={() => toggleCheck(c.id, c.resolved)} className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors ${c.resolved ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-slate-300 hover:border-rose-400"}`}>
                    {c.resolved && "✓"}
                  </button>
                  <div className="flex-1">
                    <p className={`text-sm font-bold text-slate-700 leading-snug ${c.resolved && "line-through text-slate-400"}`}>{c.content}</p>
                    <div className="flex flex-wrap gap-2 mt-2 items-center">
                      {c.x !== null && <span className="text-[8px] font-black bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded uppercase">🎯 Mapa</span>}
                      {c.attachment_url && <a href={c.attachment_url} target="_blank" rel="noreferrer" className="text-[8px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase hover:bg-slate-200">📎 Adjunto</a>}
                    </div>
                    <div className="mt-2 flex justify-between items-center pt-2 border-t border-slate-50">
                       <span className="text-[9px] text-slate-300 font-bold">{new Date(c.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                       <button onClick={() => deleteComment(c.id)} className="text-[9px] font-black text-rose-300 hover:text-rose-600 uppercase">Borrar</button>
                    </div>
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
