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

  const loadCorrections = async () => {
    if (!projectId) return;
    const { data } = await supabase.from('comments').select('*').eq('page_id', projectId); 
    setCorrections(data || []);
  };

  useEffect(() => { loadCorrections(); }, [projectId]);

  const handleAddNote = async () => {
    if (!newNote || !projectId) return;
    let fileUrl = "";

    if (selectedFile) {
      const fileName = `${Date.now()}-note.jpg`;
      await supabase.storage.from('FOLLETOS').upload(fileName, selectedFile);
      const { data } = supabase.storage.from('FOLLETOS').getPublicUrl(fileName);
      fileUrl = data.publicUrl;
    }

    await supabase.from('comments').insert([{
      page_id: projectId,
      content: newNote,
      attachment_url: fileUrl,
      resolved: false 
    }]);

    setNewNote("");
    setSelectedFile(null);
    loadCorrections();
  };

  const toggleCheck = async (id: string, currentResolved: boolean) => {
    await supabase.from('comments').update({ resolved: !currentResolved }).eq('id', id);
    loadCorrections();
  };

  if (!project) return <div className="p-20 font-black italic text-slate-400 uppercase">Cargando...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-10 font-sans">
      <div className="flex justify-between items-center mb-10">
        <button onClick={() => navigate(-1)} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">← Volver</button>
        <h2 className="text-3xl font-black italic uppercase text-slate-800 tracking-tighter">{project.name}</h2>
        <div className="flex gap-2 bg-white p-2 rounded-2xl border border-slate-100 font-black text-[10px] text-slate-400 uppercase">V3 (ACTUAL)</div>
      </div>

      <div className="grid grid-cols-12 gap-10">
        <div className="col-span-7 bg-white p-6 rounded-[3rem] shadow-sm border border-slate-100 sticky top-10">
          <img src={project.image_url} alt="Folleto" className="w-full h-auto rounded-[2rem] shadow-inner" />
        </div>

        <div className="col-span-5 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-6">Nueva Corrección</h3>
            <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)}
              className="w-full p-6 bg-slate-50 rounded-2xl border-none text-sm font-medium mb-4 min-h-[100px]"
              placeholder="Escribe la nota..." />
            <div className="flex gap-3">
              <input type="file" id="adjunto" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
              <label htmlFor="adjunto" className="flex-1 text-center py-4 bg-slate-100 text-slate-500 rounded-xl font-black text-[9px] uppercase cursor-pointer">
                {selectedFile ? "✓ LISTO" : "📎 ADJUNTO"}
              </label>
              <button onClick={handleAddNote} className="flex-1 py-4 bg-rose-600 text-white rounded-xl font-black text-[9px] uppercase shadow-lg shadow-rose-100">
                GUARDAR
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {corrections.map((c) => (
              <div key={c.id} 
                className={`p-6 rounded-[2rem] border transition-all flex gap-4 items-start ${
                  c.resolved ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'
                }`}>
                <input type="checkbox" checked={c.resolved} onChange={() => toggleCheck(c.id, c.resolved)}
                  className="mt-1 w-6 h-6 rounded-lg border-slate-300 text-emerald-600 cursor-pointer" />
                <div className="flex-1">
                  <p className={`text-sm font-bold uppercase italic tracking-tighter ${c.resolved ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {c.content}
                  </p>
                  {c.attachment_url && (
                    <a href={c.attachment_url} target="_blank" rel="noreferrer" className="mt-4 block w-24 h-24 rounded-xl overflow-hidden border-2 border-white shadow-md">
                      <img src={c.attachment_url} className="w-full h-full object-cover" />
                    </a>
                  )}
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
