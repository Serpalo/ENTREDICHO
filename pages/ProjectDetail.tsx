import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';

const ProjectDetail = ({ projects = [] }: any) => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [corrections, setCorrections] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const project = projects.find((p: any) => String(p.id) === String(projectId));

  // Cargar correcciones de este folleto
  useEffect(() => {
    if (projectId) {
      supabase.from('corrections')
        .select('*')
        .eq('project_id', projectId)
        .then(({ data }) => setCorrections(data || []));
    }
  }, [projectId]);

  const handleAddCorrection = async () => {
    if (!newNote) return;
    let imgUrl = "";

    if (selectedFile) {
      const fileName = `${Math.random()}-${selectedFile.name}`;
      await supabase.storage.from('folletos').upload(fileName, selectedFile);
      const { data } = supabase.storage.from('folletos').getPublicUrl(fileName);
      imgUrl = data.publicUrl;
    }

    const { data: inserted } = await supabase.from('corrections').insert([{
      project_id: projectId,
      note: newNote,
      image_url: imgUrl,
      status: 'pending'
    }]).select();

    if (inserted) setCorrections([...corrections, ...inserted]);
    setNewNote("");
    setSelectedFile(null);
  };

  const toggleStatus = async (id: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'done' ? 'pending' : 'done';
    await supabase.from('corrections').update({ status: nextStatus }).eq('id', id);
    setCorrections(corrections.map(c => c.id === id ? { ...c, status: nextStatus } : c));
  };

  if (!project) return <div className="p-20 text-center font-black uppercase text-slate-300 italic">Cargando detalles del proyecto...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-10 font-sans">
      {/* CABECERA Y COMPARADOR DE VERSIONES */}
      <div className="flex justify-between items-center mb-10">
        <div className="flex gap-4 items-center">
          <button onClick={() => navigate(-1)} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-all">←</button>
          <h2 className="text-2xl font-black italic uppercase text-slate-800 tracking-tighter">{project.name}</h2>
        </div>
        <div className="flex gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
          <button className="px-6 py-2 rounded-xl font-black text-[10px] uppercase text-slate-400 hover:bg-slate-50">V1</button>
          <button className="px-6 py-2 rounded-xl font-black text-[10px] uppercase text-slate-400 hover:bg-slate-50">V2</button>
          <button className="px-6 py-2 rounded-xl font-black text-[10px] uppercase bg-slate-800 text-white shadow-lg">V3 (Actual)</button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-10">
        {/* LADO IZQUIERDO: PREVISUALIZACIÓN Y NOTAS */}
        <div className="col-span-7 space-y-6">
          <div className="bg-white p-4 rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
             {project.image_url ? (
               <img src={project.image_url} alt="Vista previa" className="w-full h-auto rounded-[1.5rem] shadow-inner" />
             ) : (
               <div className="h-[600px] bg-slate-50 rounded-[1.5rem] flex items-center justify-center text-slate-300 font-black italic uppercase">Sin imagen de folleto</div>
             )}
          </div>
        </div>

        {/* LADO DERECHO: PANEL DE CORRECCIONES */}
        <div className="col-span-5 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 h-fit">
            <h3 className="text-sm font-black uppercase text-slate-400 tracking-[0.2em] mb-6">Nueva Corrección</h3>
            <textarea 
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Escribe aquí la nota..."
              className="w-full p-6 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-rose-500 text-sm font-medium mb-4 min-h-[120px]"
            />
            <div className="flex gap-3 mb-6">
              <input type="file" id="note-img" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
              <label htmlFor="note-img" className="flex-1 text-center py-3 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase cursor-pointer hover:bg-slate-200 transition-all">
                {selectedFile ? "✓ Imagen Lista" : "📎 Adjuntar Imagen"}
              </label>
              <button onClick={handleAddCorrection} className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-rose-100 hover:scale-105 transition-all">
                Guardar Nota
              </button>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {corrections.map((c) => (
                <div 
                  key={c.id} 
                  className={`p-6 rounded-2xl border transition-all flex gap-4 items-start ${
                    c.status === 'done' ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'
                  }`}
                >
                  <input 
                    type="checkbox" 
                    checked={c.status === 'done'}
                    onChange={() => toggleStatus(c.id, c.status)}
                    className="mt-1 w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div className="flex-1">
                    <p className={`text-sm font-bold uppercase italic tracking-tight ${c.status === 'done' ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {c.note}
                    </p>
                    {c.image_url && (
                      <a href={c.image_url} target="_blank" rel="noreferrer" className="mt-3 block w-20 h-20 rounded-lg overflow-hidden border border-white/50 shadow-sm">
                        <img src={c.image_url} className="w-full h-full object-cover" alt="Nota" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
