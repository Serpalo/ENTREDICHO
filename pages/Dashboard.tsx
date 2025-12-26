import React, { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';

const Dashboard = ({ projects = [], folders = [], onRefresh }: any) => {
  const navigate = useNavigate();
  const { folderId } = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtramos los folletos de la carpeta actual usando la tabla 'pages'
  const currentPages = projects.filter((p: any) => 
    folderId ? String(p.parent_id) === String(folderId) : !p.parent_id
  );

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const cleanName = `${Math.random().toString(36).substring(2)}-${file.name}`;

      // 1. Subida al Bucket MAYÚSCULAS
      const { error: uploadError } = await supabase.storage
        .from('FOLLETOS')
        .upload(cleanName, file);

      if (uploadError) {
        alert("Error subiendo archivo: " + uploadError.message);
        continue;
      }

      // 2. Obtener URL Pública
      const { data: { publicUrl } } = supabase.storage
        .from('FOLLETOS')
        .getPublicUrl(cleanName);

      // 3. Guardar en la tabla 'pages' (que es la que usas en Supabase)
      await supabase.from('pages').insert([{ 
        name: file.name, 
        parent_id: folderId ? parseInt(folderId) : null,
        image_url: publicUrl 
      }]);
    }

    if (onRefresh) await onRefresh();
    alert("Subida completada");
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      {/* Sidebar y Header se mantienen igual... */}
      <div className="flex-1 p-10">
        <div className="flex justify-between items-center mb-10 bg-white p-8 rounded-[2rem] shadow-sm border-b-4 border-rose-600">
          <h1 className="text-4xl font-black italic uppercase text-slate-800 tracking-tighter">
            {folderId ? "Carpeta" : "Mis Proyectos"}
          </h1>
          <div className="flex gap-4">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple />
            <button onClick={() => fileInputRef.current?.click()} className="px-8 py-3 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg">
              SUBIR FOLLETOS
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">
                <th className="px-10 py-6">Vista</th>
                <th className="px-10 py-6">Página</th>
                <th className="px-10 py-6 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {currentPages.map((p: any) => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-all">
                  <td className="px-10 py-6">
                    <div className="w-16 h-20 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                      {/* Usamos image_url que es donde guardamos la ruta de Supabase */}
                      {p.image_url ? (
                        <img src={p.image_url} alt="Vista" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] text-slate-300 font-bold">SIN IMG</div>
                      )}
                    </div>
                  </td>
                  <td className="px-10 py-6 italic font-black text-slate-700 text-lg uppercase tracking-tighter">{p.name}</td>
                  <td className="px-10 py-6 text-right">
                    <button onClick={() => navigate(`/project/${p.id}`)} className="text-rose-600 font-black text-[10px] uppercase">Revisar →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
