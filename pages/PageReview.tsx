import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
// IMPORTANTE: Asegúrate de que estas rutas existen. Si fallan, avísame.
import { supabase } from '../supabase'; 
import { Project } from '../types';

const PageReview = ({ projects }: { projects: Project[] }) => {
  const { projectId, versionId, pageId } = useParams();
  const navigate = useNavigate();
  const [commentsList, setCommentsList] = useState<any[]>([]);
  
  // ESTADOS NUEVOS
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [compareVersionId, setCompareVersionId] = useState("");

  const project = projects.find(p => p.id === projectId);
  const version = project?.versions.find(v => v.id === versionId);
  const page = version?.pages.find((p:any) => p.id === pageId);

  // Lógica Comparador
  const compareImageUrl = compareVersionId 
    ? project?.versions.find(v => v.id === compareVersionId)?.pages.find((p:any) => p.pageNumber === page?.pageNumber)?.imageUrl 
    : null;

  useEffect(() => {
    if(pageId) supabase.from('comments').select('*').eq('page_id', pageId).then(({data}) => { if(data) setCommentsList(data) });
  }, [pageId]);

  if (!page) return <div className="p-10 text-white bg-slate-900 h-screen">CARGANDO... (Si ves esto, el código se actualizó)</div>;

  return (
    <div className="h-screen bg-slate-900 text-white flex flex-col overflow-hidden">
      
      {/* --- BARRA SUPERIOR ROJA DE PRUEBA --- */}
      <div className="bg-red-600 text-white text-center font-bold text-xs py-1">
          SI NO VES ESTA BARRA ROJA, RECARGA LA PÁGINA CON F5
      </div>

      <header className="h-14 bg-slate-800 flex items-center justify-between px-4 shrink-0">
          <button onClick={() => navigate(-1)} className="text-slate-400">← Volver</button>
          
          <div className="flex gap-2">
            {/* SELECTOR COMPARAR */}
            {isCompareMode && (
                <select className="bg-black border border-blue-500 text-xs rounded" onChange={e=>setCompareVersionId(e.target.value)}>
                    <option value="">Elegir versión antigua...</option>
                    {project?.versions.filter(v=>v.id !== versionId).map(v=><option key={v.id} value={v.id}>v{v.versionNumber}</option>)}
                </select>
            )}
            
            {/* BOTÓN COMPARAR */}
            <button 
                onClick={() => setIsCompareMode(!isCompareMode)}
                className={`px-3 py-1 rounded font-bold text-sm ${isCompareMode ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'}`}
            >
                {isCompareMode ? 'Salir Comparar' : 'COMPARAR ↔'}
            </button>
          </div>
      </header>

      {/* ÁREA PRINCIPAL */}
      <div className="flex-1 relative flex items-center justify-center bg-black"
           onMouseMove={(e) => {
               if(e.buttons === 1 && isCompareMode) {
                   const rect = e.currentTarget.getBoundingClientRect();
                   setSliderPosition(((e.clientX - rect.left) / rect.width) * 100);
               }
           }}
      >
          {/* MODO NORMAL */}
          {!isCompareMode && (
              <div className="relative">
                  <img src={page.imageUrl} className="max-h-[80vh] shadow-2xl" />
                  {/* SIN COLORES - SOLO PINES ROJOS */}
                  {commentsList.map((c, i) => (
                      <div key={c.id} className="absolute w-6 h-6 bg-red-600 rounded-full flex items-center justify-center font-bold text-xs -ml-3 -mt-3 border border-white" style={{left:`${c.x}%`, top:`${c.y}%`}}>{i+1}</div>
                  ))}
              </div>
          )}

          {/* MODO COMPARAR */}
          {isCompareMode && (
              <div className="relative max-h-[80vh]">
                  <img src={page.imageUrl} className="max-h-[80vh] opacity-50" />
                  {compareImageUrl && (
                      <div className="absolute top-0 left-0 h-full overflow-hidden border-r-2 border-white bg-slate-900" style={{width: `${sliderPosition}%`}}>
                          <img src={compareImageUrl} className="max-h-[80vh]" style={{maxWidth:'none', width: 'auto', height: '100%'}} />
                          <span className="absolute top-2 left-2 bg-black px-2 text-xs font-bold">ANTES</span>
                      </div>
                  )}
                  {/* BARRA DESLIZANTE */}
                  <div className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-50 shadow-[0_0_20px_black]" style={{left: `${sliderPosition}%`}}>
                     <div className="absolute top-1/2 -mt-4 -ml-4 w-8 h-8 bg-white rounded-full flex items-center justify-center text-black font-bold">↔</div>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};

export default PageReview;
