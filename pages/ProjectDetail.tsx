import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Project, AppNotification } from '../types';
import { supabase } from '../supabase';

interface ProjectDetailProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  addNotification?: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
}

type ViewMode = 'grid' | 'list';

const STATUS_OPTIONS = {
  '1ª corrección': 'bg-amber-100 text-amber-700 border-amber-200',
  '2ª corrección': 'bg-orange-100 text-orange-700 border-orange-200',
  '3ª corrección': 'bg-rose-100 text-rose-700 border-rose-200',
  'Imprenta': 'bg-emerald-100 text-emerald-700 border-emerald-200'
};

const ProjectDetail: React.FC<ProjectDetailProps> = ({ projects, setProjects }) => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [viewMode, setViewMode] = useState<ViewMode>('list'); 
  const [activeVersionNumber, setActiveVersionNumber] = useState<number | null>(null);
  const [commentsCount, setCommentsCount] = useState<Record<string, number>>({});
  const [isUploadingVersion, setIsUploadingVersion] = useState(false);

  const project = projects.find(p => p.id === projectId);

  useEffect(() => {
    if (project && activeVersionNumber === null && project.versions.length > 0) {
      // Por defecto, mostramos la versión más reciente (la última)
      const latest = Math.max(...project.versions.map(v => v.versionNumber));
      setActiveVersionNumber(latest);
    }
  }, [project, activeVersionNumber]);

  const activeVersion = project?.versions.find(v => v.versionNumber === activeVersionNumber);

  useEffect(() => {
    if (activeVersion) fetchCommentsCount();
  }, [activeVersion]);

  const fetchCommentsCount = async () => {
    const pageIds = activeVersion?.pages.map(p => p.id) || [];
    if (pageIds.length === 0) { setCommentsCount({}); return; }
    const { data } = await supabase.from('comments').select('page_id').in('page_id', pageIds).eq('resolved', false);
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach((c: any) => { counts[c.page_id] = (counts[c.page_id] || 0) + 1; });
      setCommentsCount(counts);
    }
  };

  // --- FUNCIÓN PARA GENERAR EL INFORME ---
  const handleGenerateReport = async () => {
    if (!activeVersion) return;
    
    const pageIds = activeVersion.pages.map(p => p.id);
    const { data: comments } = await supabase
      .from('comments')
      .select('*, pages(page_number)')
      .in('page_id', pageIds)
      .eq('resolved', false)
      .order('created_at', { ascending: true });

    if (!comments || comments.length === 0) {
      alert("No hay correcciones pendientes en esta versión.");
      return;
    }

    // Crear una ventana simple para imprimir
    const reportWindow = window.open('', '_blank');
    if (reportWindow) {
      const html = `
        <html>
          <head>
            <title>Informe de Correcciones - ${project?.name}</title>
            <style>
              body { font-family: sans-serif; padding: 40px; color: #334155; }
              h1 { border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
              .item { border-bottom: 1px solid #f1f5f9; padding: 15px 0; }
              .page-num { font-weight: bold; color: #4f46e5; margin-right: 10px; }
              .date { font-size: 0.8em; color: #94a3b8; }
            </style>
          </head>
          <body>
            <h1>Correcciones Pendientes: ${project?.name} (V${activeVersionNumber})</h1>
            ${comments.map((c: any) => `
              <div class="item">
                <span class="page-num">PÁGINA ${c.pages.page_number}:</span>
                <span>${c.content}</span>
                <div class="date">${new Date(c.created_at).toLocaleString()}</div>
              </div>
            `).join('')}
            <script>window.print();</script>
          </body>
        </html>
      `;
      reportWindow.document.write(html);
      reportWindow.document.close();
    }
  };

  const handleNewVersionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !project) return;
    setIsUploadingVersion(true);

    const maxV = Math.max(...project.versions.map(v => v.versionNumber), 0);
    const nextVersionNum = maxV + 1;
    const files = Array.from(e.target.files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `v${nextVersionNum}-${Date.now()}-${i}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        await supabase.storage.from('brochures').upload(fileName, file);
        const { data: { publicUrl } } = supabase.storage.from('brochures').getPublicUrl(fileName);
        const { data: pageData } = await supabase.from('pages').insert([{ project_id: project.id, image_url: publicUrl, page_number: i + 1, version: nextVersionNum, status: '1ª corrección' }]).select();
        
        if (pageData) { /* update local state as before */ }
      }
      window.location.reload(); // Recarga simple para asegurar que el orden V1, V2... se aplique desde DB
    } catch (err) {
      console.error(err);
      setIsUploadingVersion(false);
    }
  };

  if (!project) return <div className="p-20 text-center font-bold text-slate-400 text-sm uppercase tracking-widest">Cargando...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleNewVersionUpload} />
      
      <header className="bg-white border-b border-slate-200 px-8 py-6 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate(-1)} className="p-2.5 hover:bg-slate-50 rounded-2xl text-slate-400 border border-transparent hover:border-slate-100 transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              </button>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{project.name}</h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Historial de versiones</p>
              </div>
            </div>

            <div className="flex gap-3">
                 <button 
                    onClick={handleGenerateReport}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                 >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Generar Informe
                 </button>

                 <button 
                    onClick={() => !isUploadingVersion && fileInputRef.current?.click()}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-xl transition-all ${isUploadingVersion ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 active:scale-95'}`}
                 >
                    {isUploadingVersion ? 'Subiendo...' : 'Añadir Nueva Versión'}
                    {!isUploadingVersion && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>}
                 </button>
            </div>
        </div>

        <div className="flex items-center justify-between">
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                {project.versions.map(v => (
                    <button 
                        key={v.id}
                        onClick={() => setActiveVersionNumber(v.versionNumber)}
                        className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-2 ${activeVersionNumber === v.versionNumber ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                    >
                        Versión {v.versionNumber}
                    </button>
                ))}
            </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-10">
        {activeVersion && activeVersion.pages.length > 0 ? (
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
             <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/50 border-b border-slate-100">
                    <tr>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 w-24 text-center">Orden</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Vista Previa</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Correcciones</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Estado</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {activeVersion.pages.map((page, index) => {
                      const count = commentsCount[page.id] || 0;
                      return (
                        <tr key={page.id} onClick={() => navigate(`/project/${project.id}/version/${activeVersion.id}/page/${page.id}`)} className="group hover:bg-slate-50/50 cursor-pointer transition-colors">
                          <td className="px-8 py-6 text-center font-black text-slate-300">#{index + 1}</td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-5">
                              <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
                                <img src={page.imageUrl} className="w-full h-full object-cover" />
                              </div>
                              <span className="text-sm font-black text-slate-700">Página {page.pageNumber}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-center">
                             {count > 0 ? (
                               <div className="inline-flex items-center gap-2 bg-rose-50 text-rose-600 px-4 py-1.5 rounded-full text-[10px] font-black border border-rose-100 shadow-sm shadow-rose-50">
                                 <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>
                                 {count} PENDIENTES
                               </div>
                             ) : (
                               <span className="text-slate-200 text-[10px] font-black uppercase tracking-widest">Limpia</span>
                             )}
                          </td>
                          <td className="px-8 py-6" onClick={(e) => e.stopPropagation()}>
                             <select 
                                value={page.status || '1ª corrección'} 
                                onChange={(e) => {
                                  const { error } = supabase.from('pages').update({ status: e.target.value }).eq('id', page.id);
                                  if (!error) window.location.reload();
                                }} 
                                className={`text-[10px] font-black px-4 py-2 rounded-xl uppercase tracking-widest border-2 cursor-pointer outline-none transition-all appearance-none shadow-sm ${STATUS_OPTIONS[page.status as keyof typeof STATUS_OPTIONS] || 'bg-slate-50'}`}
                             >
                               {Object.keys(STATUS_OPTIONS).map(status => <option key={status} value={status}>{status}</option>)}
                             </select>
                          </td>
                          <td className="px-8 py-6 text-right">
                             <button className="bg-indigo-50 text-indigo-600 px-5 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all">Revisar</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
          </div>
        ) : (
          <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-[3rem] bg-white"><p className="text-slate-400 font-black text-xs uppercase tracking-widest">No hay páginas en esta versión</p></div>
        )}
      </main>
    </div>
  );
};

export default ProjectDetail;
