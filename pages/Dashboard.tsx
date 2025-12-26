import React, { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';

const Dashboard = ({ projects = [], folders = [], onRefresh }: any) => {
  const navigate = useNavigate();
  const { folderId } = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openFolders, setOpenFolders] = useState<Record<number, boolean>>({});

  const toggleFolder = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenFolders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const safeFolders = Array.isArray(folders) ? folders : [];
  // Volvemos a usar la tabla 'projects' que es la que tenías originalmente
  const currentItems = projects.filter((p: any) => 
    folderId ? String(p.parent_id) === String(folderId) : !p.parent_id
  );

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const cleanName = `${Math.random().toString(36).substring(2)}-${file.name}`;

      // 1. Subida al Bucket correcto
      const { error: uploadError } = await supabase.storage
        .from('FOLLETOS')
        .upload(cleanName, file);

      if (uploadError) {
        alert("Error de subida: " + uploadError.message);
        continue;
      }

      // 2. Generar URL Pública
      const { data: { publicUrl } } = supabase.storage
        .from('FOLLETOS')
        .getPublicUrl(cleanName);

      // 3. Guardar en 'projects' con la URL correcta
      await supabase.from('projects').insert([{ 
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
      {/* SIDEBAR CON TU LOGO */}
      <div className="w-64 bg-white border-r border-slate-200 p-8 flex flex-col gap-8">
        <img src="/logo.png" alt="Logo" className="h-10 w-fit object-contain" />
        <nav className="flex flex-col gap-2">
          <div onClick={() => navigate('/')} className="flex items-center gap-3 text-slate-800 font-bold text-sm cursor-pointer p-2 hover:bg-slate-50 rounded-xl">🏠 Inicio</div>
          <div className="mt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Estructura</div>
          {/* Aquí iría tu renderFolderTree si lo necesitas */}
        </nav>
      </div>

      <div className="flex-1 p-10">
        <div className="flex justify-between items-center mb-10 bg-white p-8 rounded-[2rem] shadow-sm border-b-4 border-rose-600">
          <h1 className="text-4xl font-black italic uppercase text-slate-800 tracking-tighter">MIS PROYECTOS</h1>
          <div className="flex gap-4">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple />
            <button onClick={() => fileInputRef.current?.click()} className="px-8 py-3 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg">SUBIR FOLLETOS</button>
          </div>
        </div>

        {/* LISTA RECUPERADA */}
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-50 text-[10px] font-black text-slate-400 uppercase bg-slate-50/50">
                <th className="px-10 py-6">Vista</th>
                <th className="px-10 py-6">Página</th>
                <th className="px-10 py-6 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((p: any) => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-all">
                  <td className="px-10 py-6">
                    <div className="w-16 h-20 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] text-slate-300">IMG</div>
                      )}
                    </div>
                  </td>
                  <td className="px-10 py-6 italic font-black text-slate-700 text-lg uppercase">{p.name}</td>
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
