import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';

const ProjectDetail = ({ projects = [] }: any) => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [corrections, setCorrections] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentVersion, setCurrentVersion] = useState(3);

  // Forzamos la comparación de IDs como String para evitar errores de tipo (uuid vs int)
  const project = projects.find((p: any) => String(p.id) === String(projectId));

  const loadCorrections = async () => {
    if (!projectId) return;
    // Buscamos las notas asociadas a este folio/página
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('page_id', projectId); 
    
    if (error) console.error("Error cargando notas:", error.message);
    else setCorrections(data || []);
  };

  useEffect(() => {
    loadCorrections();
  }, [projectId]);

  const handleAddNote = async () => {
    if (!newNote || !projectId) return;
    let fileUrl = "";

    if (selectedFile) {
      const fileName = `${Math.random()}-${selectedFile.name}`;
      await supabase.storage.from('folletos').upload(fileName, selectedFile);
      const { data } = supabase.storage.from('folletos').getPublicUrl(fileName);
      fileUrl = data.publicUrl;
    }

    // Insertamos usando tus columnas reales de la captura
    const { error } = await supabase.from('comments').insert([{
      page_id: projectId,
      content: newNote,
      attachment_url: fileUrl, // Columna de tu captura
      resolved: false 
    }]);

    if (error) {
      alert("Error al guardar nota: " + error.message);
    } else {
      setNewNote("");
      setSelectedFile(null);
      loadCorrections();
    }
  };

  const toggleCheck = async (id: string, currentResolved: boolean) => {
    // Cambia el estado y actualiza el color (Rojo <-> Verde)
    await supabase.from('comments').update({ resolved: !currentResolved }).eq('id', id);
    loadCorrections();
  };

  if (!project) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-black uppercase text-slate-300 italic">
      Buscando datos del folleto...
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-10 font-sans">
      {/* CABECERA */}
      <div className="flex justify-between items-center mb-10">
        <div className="flex gap-6 items-center">
          <button onClick={() => navigate(-1)} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-all">
            <span className="text-xl">←</span>
          </button>
          <h2 className="text-3xl font-black italic uppercase text-slate-800 tracking-tighter">
            {project.name}
          </h2>
        </div>
        <div className="flex gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
          {[1, 2, 3].map((v) => (
            <button key={v} onClick={() => setCurrentVersion(v)}
              className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${currentVersion === v ? 'bg-[#1e293b] text-white shadow-lg' : 'text-slate-400'}`}>
              V{v} {currentVersion === v && '(ACTUAL)'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-10">
        {/* VISOR DE IMAGEN (IZQUIERDA) */}
        <div className="col-span-7">
          <div className="bg-white p-6 rounded-[3rem] shadow-sm border border-slate-100 sticky top-10">
            {project.image_url ? (
              <img 
                src={project.image_url} 
                alt="Folleto" 
                className="w-full h-auto rounded-[2rem] shadow-inner" 
                onError={(e) => {
                  console.error("Error cargando imagen:", project.image_url);
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="aspect-[3/4] bg-slate-50 rounded-[2rem] flex items-center justify-center border-2 border-dashed border-slate-200">
                <span className="text-slate-300 font-black italic uppercase tracking-widest text-center px-10">
                  Sin imagen previsualizable (image_url vacía)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* PANEL DE NOTAS (DERECHA) */}
        <div className="col-span-5 space-y-8">
          <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Nueva Corrección</h3>
            <textarea 
              value={newNote} 
              onChange={(e) => setNewNote(e.target.value)}
              className="w-full p-8 bg-slate-50 rounded-[2rem] border-none text-sm font-medium mb-6 min-h-[150px] focus:ring-2 focus:ring-rose-500 shadow-inner"
              placeholder="Escribe la nota de corrección aquí..." 
            />
            <div className="flex gap-4">
              <input type="file" id="adjunto" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
              <label htmlFor="adjunto" className="flex-1 text-center py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase cursor-pointer hover:bg-slate-200">
                {selectedFile ? "✓ LISTO" : "📎 ADJUNTAR"}
              </label>
              <button onClick={handleAddNote} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl shadow-rose-100 hover:scale-105 active:scale-95 transition-all">
                GUARDAR NOTA
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {corrections.map((c) => (
              <div key={c.id} 
                className={`p-8 rounded-[2.5rem] border-2 transition-all flex gap-6 items-start shadow-sm ${
                  c.resolved ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'
                }`}>
                <input 
                  type="checkbox" 
                  checked={c.resolved} 
                  onChange={() => toggleCheck(c.id, c.resolved)}
                  className="mt-1 w-7 h-7 rounded-xl border-slate-300 text-emerald-600 cursor-pointer shadow-sm" 
                />
                <div className="flex-1">
                  <p className={`text-base font-bold uppercase italic tracking-tighter leading-tight ${c.resolved ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {c.content}
                  </p>
                  {/* Mostramos el adjunto de la nota si existe */}
                  {c.attachment_url && (
                    <a href={c.attachment_url} target="_blank" rel="noreferrer" className="mt-6 block w-32 h-32 rounded-[1.5rem] overflow-hidden border-4 border-white shadow-lg hover:scale-110 transition-transform">
                      <img src={c.attachment_url} className="w-full h-full object-cover" alt="Adjunto" />
                    </a>
                  )}
                </div>
              </div>
            ))}
            {corrections.length === 0 && (
              <div className="py-10 text-center text-slate-300 font-black italic uppercase text-[10px] tracking-widest">
                No hay correcciones guardadas aún
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
