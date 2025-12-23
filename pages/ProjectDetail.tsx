
import React, { useState, useRef, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Project, CorrectionStatus, ReviewerRole, BrochurePage, BrochureVersion, AppNotification } from '../types';
import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

interface ProjectDetailProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  addNotification?: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ projects, setProjects, addNotification }) => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState("Preparando páginas...");
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [downloadMenuId, setDownloadMenuId] = useState<string | null>(null);
  
  const project = projects.find(p => p.id === projectId);

  const downloadFile = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownload = (e: React.MouseEvent, page: BrochurePage, format: 'jpg' | 'pdf') => {
    e.stopPropagation();
    const extension = format === 'pdf' ? 'pdf' : 'jpg';
    downloadFile(page.imageUrl, `${project?.name}_Pag_${page.pageNumber}.${extension}`);
    setDownloadMenuId(null);
  };

  if (!project) return <div className="p-8 text-center font-medium text-slate-500">Proyecto no encontrado</div>;

  const activeVersion = project.versions.find(v => v.isActive) || project.versions[project.versions.length - 1];

  const updatePageStatus = (pageId: string, status: CorrectionStatus) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        versions: p.versions.map(v => {
          if (v.id !== activeVersion.id) return v;
          return {
            ...v,
            pages: v.pages.map(pg => pg.id === pageId ? { ...pg, status } : pg)
          };
        })
      };
    }));
  };

  const getStatusColor = (status: CorrectionStatus) => {
    switch (status) {
      case CorrectionStatus.FIRST: return 'bg-amber-100 text-amber-700 border-amber-200';
      case CorrectionStatus.SECOND: return 'bg-orange-100 text-orange-700 border-orange-200';
      case CorrectionStatus.THIRD: return 'bg-rose-100 text-rose-700 border-rose-200';
      case CorrectionStatus.PRINT: return 'bg-green-100 text-green-700 border-green-200';
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingStatus("Analizando PDF...");
    
    try {
      const fileList = Array.from(files) as File[];
      const newVersionNumber = project.versions.length + 1;
      const versionId = `v${newVersionNumber}-${Date.now()}`;
      let allProcessedPages: BrochurePage[] = [];
      const pdfFile = fileList.find(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));

      if (!pdfFile && fileList.length === 0) {
        setIsProcessing(false);
        return;
      }

      if (pdfFile) {
        const arrayBuffer = await pdfFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          setProcessingProgress(Math.round((i / pdf.numPages) * 100));
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) continue;
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          await page.render({ canvasContext: context, viewport: viewport, canvas }).promise;
          allProcessedPages.push({
            id: `p-${versionId}-${i}`,
            pageNumber: i,
            imageUrl: canvas.toDataURL('image/jpeg', 0.8),
            status: CorrectionStatus.FIRST,
            approvals: {
              "Publicidad": { role: "Publicidad", approved: false, pending: true },
              "Dirección de producto": { role: "Dirección de producto", approved: false, pending: true },
            },
            comments: []
          });
        }
      }

      const newVersion: BrochureVersion = {
        id: versionId,
        versionNumber: newVersionNumber,
        createdAt: new Date(),
        isActive: true,
        pages: allProcessedPages
      };

      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, versions: [...p.versions.map(v => ({ ...v, isActive: false })), newVersion] } : p));

      // AUTOMATIZACIÓN DE CORREOS/NOTIFICACIONES SEGÚN REQUISITO
      setProcessingStatus("Enviando avisos de corrección...");
      
      const recipients = [
        ...(project.advertisingEmails || []),
        ...(project.productDirectionEmails || [])
      ];

      if (addNotification && recipients.length > 0) {
        const currentUrl = window.location.href;
        addNotification({
          type: 'system',
          title: 'TIENES UN FOLLETO NUEVO PARA CORREGIR',
          message: `Se ha enviado el enlace de corrección a ${recipients.length} revisores. Haz clic para abrir el folleto.`,
          link: `/project/${projectId}`
        });
      }

    } catch (error) {
      alert("Error al procesar el archivo.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingOver(false); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingOver(false); if (e.dataTransfer.files) handleFiles(e.dataTransfer.files); };

  const getPeriodStatus = () => {
    if (!project.correctionPeriod) return null;
    const now = new Date();
    const start = new Date(project.correctionPeriod.startDateTime);
    const end = new Date(project.correctionPeriod.endDateTime);
    
    const total = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    const progress = Math.max(0, Math.min(100, (elapsed / total) * 100));

    if (now < start) {
      const diff = start.getTime() - now.getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return { label: `Inicia en ${days}d`, color: 'bg-amber-50 text-amber-700', progress: 0, barColor: 'bg-amber-400' };
    }
    if (now > end) return { label: 'Finalizado', color: 'bg-rose-50 text-rose-700', progress: 100, barColor: 'bg-slate-300' };
    
    const diff = end.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return { label: `${days}d restantes`, color: 'bg-emerald-50 text-emerald-700', progress, barColor: 'bg-emerald-500' };
  };

  const periodStatus = getPeriodStatus();

  return (
    <div className="relative min-h-screen" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {/* Drop Overlay */}
      {isDraggingOver && (
        <div className="fixed inset-0 bg-indigo-600/90 backdrop-blur-sm z-[200] flex flex-col items-center justify-center text-white p-8 pointer-events-none">
          <svg className="w-16 h-16 mb-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
          <h2 className="text-4xl font-black mb-2">Suelta el PDF aquí</h2>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Processing Modal */}
        {isProcessing && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center">
            <div className="bg-white p-10 rounded-3xl shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full text-center">
              <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <div className="space-y-2">
                <h3 className="font-bold text-xl text-slate-900">{processingStatus}</h3>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${processingProgress}%` }}></div>
                </div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Progreso: {processingProgress}%</p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex-1">
            <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              <Link to="/" className="hover:text-indigo-600">Proyectos</Link>
              <span className="text-slate-300">/</span>
              <span className="text-slate-600 truncate max-w-[200px]">{project.name}</span>
            </nav>
            <div className="flex items-center gap-4 mb-4">
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">{project.name}</h1>
              {activeVersion && (
                <div className="flex items-center bg-indigo-600 text-white px-3 py-1 rounded-full shadow-sm">
                    <span className="text-[10px] font-black uppercase tracking-widest mr-1">V</span>
                    <span className="text-sm font-bold">{activeVersion.versionNumber}</span>
                </div>
              )}
            </div>
            
            {project.correctionPeriod && periodStatus && (
              <div className="max-w-md bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em] ${periodStatus.color}`}>
                    {periodStatus.label}
                  </span>
                  <span className="text-[9px] font-black text-slate-400 uppercase">
                    {Math.round(periodStatus.progress)}% Completado
                  </span>
                </div>
                <div className="relative w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                   <div 
                    className={`h-full transition-all duration-1000 ease-out ${periodStatus.barColor}`}
                    style={{ width: `${periodStatus.progress}%` }}
                   />
                </div>
                <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                   <span>Inicio: {new Date(project.correctionPeriod.startDateTime).toLocaleDateString()}</span>
                   <span>Fin: {new Date(project.correctionPeriod.endDateTime).toLocaleDateString()}</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex gap-3 h-fit">
            <label className="group cursor-pointer bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              Subir Nueva Versión (PDF)
              <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
            </label>
          </div>
        </div>

        {activeVersion && (
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden mb-12">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-8 py-5 font-bold text-slate-400 text-[10px] uppercase tracking-widest">Página</th>
                    <th className="px-6 py-5 font-bold text-slate-400 text-[10px] uppercase tracking-widest">Publicidad</th>
                    <th className="px-6 py-5 font-bold text-slate-400 text-[10px] uppercase tracking-widest">Dir. Producto</th>
                    <th className="px-6 py-5 font-bold text-slate-400 text-[10px] uppercase tracking-widest">Estado</th>
                    <th className="px-6 py-5 font-bold text-slate-400 text-[10px] uppercase tracking-widest">PLAZO</th>
                    <th className="px-6 py-5 font-bold text-slate-400 text-[10px] uppercase tracking-widest text-right">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {activeVersion.pages.map((page) => (
                    <tr 
                      key={page.id} 
                      onClick={() => navigate(`/project/${projectId}/version/${activeVersion.id}/page/${page.id}`)}
                      className="hover:bg-indigo-50/50 transition-all group cursor-pointer"
                    >
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-20 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden shadow-sm group-hover:shadow-md transition-all">
                            <img src={page.imageUrl} className="w-full h-full object-cover" />
                          </div>
                          <span className="font-black text-slate-900 text-lg group-hover:text-indigo-600 transition-colors">{page.pageNumber}</span>
                        </div>
                      </td>
                      {(["Publicidad", "Dirección de producto"] as ReviewerRole[]).map(role => (
                        <td key={role} className="px-6 py-5">
                          {page.approvals[role].approved ? <span className="text-green-600 text-[10px] font-black uppercase tracking-widest bg-green-50 px-2 py-1 rounded-lg">OK</span> : <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg">Pendiente</span>}
                        </td>
                      ))}
                      <td className="px-6 py-5">
                        <select 
                          value={page.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updatePageStatus(page.id, e.target.value as CorrectionStatus)}
                          className={`font-black px-4 py-2 rounded-xl text-[10px] uppercase tracking-widest shadow-sm ${getStatusColor(page.status)} cursor-default`}
                        >
                          {Object.values(CorrectionStatus).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-6 py-5">
                        {periodStatus && (
                          <div className="flex flex-col gap-1.5 min-w-[120px]">
                            <div className="flex justify-between items-center">
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${periodStatus.color}`}>
                                {periodStatus.label}
                              </span>
                              <span className="text-[8px] font-bold text-slate-400">{Math.round(periodStatus.progress)}%</span>
                            </div>
                            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-700 ${periodStatus.barColor}`}
                                style={{ width: `${periodStatus.progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right relative">
                        <div className="flex justify-end items-center gap-2">
                          <div className="relative">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setDownloadMenuId(downloadMenuId === page.id ? null : page.id); }}
                              className={`p-3 rounded-2xl transition-all border ${downloadMenuId === page.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'text-slate-400 hover:text-indigo-600 hover:bg-white border-transparent hover:border-slate-200 hover:shadow-sm'}`}
                              title="Opciones de descarga"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            </button>
                            
                            {downloadMenuId === page.id && (
                              <>
                                <div className="fixed inset-0 z-[10]" onClick={(e) => { e.stopPropagation(); setDownloadMenuId(null); }}></div>
                                <div className="absolute right-0 top-full mt-2 w-40 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[20] overflow-hidden animate-in fade-in zoom-in-95 duration-150 origin-top-right">
                                  <button onClick={(e) => handleDownload(e, page, 'jpg')} className="w-full px-4 py-3 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    Imagen (JPG)
                                  </button>
                                  <button onClick={(e) => handleDownload(e, page, 'pdf')} className="w-full px-4 py-3 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-t border-slate-100">
                                    <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                    Documento (PDF)
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                          <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDetail;
