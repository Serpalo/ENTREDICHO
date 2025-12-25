import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { Download, MessageSquare, ChevronLeft, ChevronRight, CheckCircle2, X } from 'lucide-react';
import jsPDF from 'jspdf';

const Revision: React.FC<any> = ({ projects }) => {
  const { projectId, versionId, pageId } = useParams();
  const navigate = useNavigate();
  const [comments, setComments] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [showGeneralComments, setShowGeneralComments] = useState(false);

  // ... (resto de la lógica de Supabase y estados se mantiene igual)

  const handleExportPDF = async () => {
    setIsExporting(true);
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(`Correcciones - Página ${currentPage?.pageNumber}`, 20, 20);
    
    comments.forEach((c, i) => {
      const y = 40 + (i * 10);
      doc.setFontSize(12);
      doc.text(`${i + 1}. ${c.text_content} [${c.resolved ? 'RESUELTO' : 'PENDIENTE'}]`, 20, y);
    });

    doc.save(`correcciones-p${currentPage?.pageNumber}.pdf`);
    setIsExporting(false);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden font-sans">
      {/* HEADER */}
      <div className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-50">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => navigate(`/project/${projectId}`)}
            className="p-3 hover:bg-slate-100 rounded-2xl transition-colors group"
          >
            <ChevronLeft className="w-6 h-6 text-slate-400 group-hover:text-slate-800" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none">PÁGINA {currentPage?.pageNumber}</h1>
            <p className="text-[10px] text-rose-600 font-black tracking-[0.2em] mt-1.5 uppercase italic">Modo Revisión</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* BOTÓN DESCARGAR PDF ACTUALIZADO */}
          <button 
            onClick={handleExportPDF}
            disabled={isExporting}
            className="bg-slate-900 text-white px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-rose-500" />
            {isExporting ? 'Generando...' : 'Descargar correcciones en PDF'}
          </button>

          {/* BOTÓN CORRECCIONES GENERALES ACTUALIZADO */}
          <button 
            onClick={() => setShowGeneralComments(true)}
            className="bg-white text-slate-800 border-2 border-slate-100 px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 hover:border-slate-300 transition-all active:scale-95"
          >
            <MessageSquare className="w-4 h-4 text-slate-400" />
            Correcciones generales
          </button>

          <div className="w-[1px] h-8 bg-slate-200 mx-2" />

          <button className="bg-rose-600 text-white px-8 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-rose-200 hover:bg-rose-700 transition-all active:scale-95 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5" />
            Finalizar Revisión
          </button>
        </div>
      </div>

      {/* ÁREA DE TRABAJO */}
      <div className="flex-1 flex overflow-hidden relative bg-[#0f172a]">
        {/* ... (resto del visor de imagen y comentarios se mantiene igual) */}
      </div>
    </div>
  );
};

export default Revision;
