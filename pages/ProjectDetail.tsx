import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { jsPDF } from "jspdf";

// TIPOS
type DrawingTool = 'pen' | 'highlighter' | 'arrow' | 'rect';

const COLORS = [
    { name: 'Amarillo Flúor', hex: '#ccff00' },
    { name: 'Rojo', hex: '#ef4444' },
    { name: 'Azul', hex: '#2563eb' },
    { name: 'Verde', hex: '#16a34a' },
    { name: 'Naranja', hex: '#f97316' },
    { name: 'Negro', hex: '#000000' },
    { name: 'Rosa', hex: '#db2777' }
];

declare const emailjs: any; 

// --- FUNCIÓN AUXILIAR PARA GENERAR COLOR DESDE EL EMAIL ---
const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00ffffff).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
};

// --- FUNCIÓN PARA OBTENER INICIALES ---
const getInitials = (email: string) => {
    if (!email) return "?";
    return email.substring(0, 2).toUpperCase();
};

const ProjectDetail = ({ projects = [], onRefresh, userRole, session }: any) => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  
  // DATOS PRINCIPALES (VERSIÓN ACTUAL)
  const [corrections, setCorrections] = useState<any[]>([]);
  const [replies, setReplies] = useState<any[]>([]); 
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  // DATOS HISTÓRICOS (PARA COMPARAR)
  const [historicalCorrections, setHistoricalCorrections] = useState<any[]>([]);
  const [historicalReplies, setHistoricalReplies] = useState<any[]>([]);
  
  // DATOS DE ENTRADA
  const [newNote, setNewNote] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  
  // ESTADOS PARA RESPONDER (HILOS)
  const [replyingTo, setReplyingTo] = useState<string | null>(null); 
  const [replyText, setReplyText] = useState(""); 
  const [sendingReply, setSendingReply] = useState(false);

  // ESTADO DE APROBACIÓN LOCAL
  const [isPageApproved, setIsPageApproved] = useState(false);
  // ESTADO PARA GUARDAR QUIÉN APROBÓ
  const [approvedBy, setApprovedBy] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // 1. IDENTIFICAR PROYECTO ACTUAL
  const project = useMemo(() => 
    projects.find((p: any) => String(p.id) === String(projectId)), 
  [projects, projectId]);

  // --- COMPROBAR FECHA LÍMITE ---
  const isDeadlinePassed = useMemo(() => {
      if (!project?.correction_deadline) return false;
      return new Date() > new Date(project.correction_deadline);
  }, [project]);

  // --- BLOQUEO GENERAL (ADMIN IGNORA LÍMITE) ---
  const isLocked = isPageApproved || (isDeadlinePassed && userRole !== 'admin');

  // 2. NAVEGACIÓN HERMANOS
  const siblings = useMemo(() => {
    if (!project) return [];
    return projects
      .filter((p: any) => p.parent_id === project.parent_id && p.version === project.version)
      .sort((a: any, b: any) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  }, [projects, project]);

  const currentIndex = siblings.findIndex((p: any) => String(p.id) === String(projectId));
  const prevProject = siblings[currentIndex - 1];
  const nextProject = siblings[currentIndex + 1];

  // 3. COMPARACIÓN INTELIGENTE
  const historicalVersions = useMemo(() => {
    if (!project) return [];
    const folderProjects = projects.filter((p: any) => p.parent_id === project.parent_id);
    const myVersionSiblings = folderProjects
        .filter((p: any) => p.version === project.version)
        .sort((a: any, b: any) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    const myPositionIndex = myVersionSiblings.findIndex((p: any) => String(p.id) === String(project.id));
    if (myPositionIndex === -1) return [];

    const availableVersions = [...new Set(folderProjects.map((p: any) => p.version))]
        .filter((v: any) => v !== project.version)
        .sort((a: any, b: any) => b - a);

    const matches = [];
    for (const v of availableVersions) {
        const versionSiblings = folderProjects
            .filter((p: any) => p.version === v)
            .sort((a: any, b: any) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        if (versionSiblings[myPositionIndex]) {
            matches.push(versionSiblings[myPositionIndex]);
        }
    }
    return matches;
  }, [projects, project]);

  // --- LISTA DE TODAS LAS VERSIONES DE ESTA PÁGINA (PARA EL DROPDOWN) ---
  const allPageVersions = useMemo(() => {
      if(!project) return [];
      return [project, ...historicalVersions].sort((a:any, b:any) => a.version - b.version);
  }, [project, historicalVersions]);

  // ESTADOS VISUALES
  const [newCoords, setNewCoords] = useState<{x: number, y: number} | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isComparing, setIsComparing] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [compareTargetId, setCompareTargetId] = useState<string>("");
  const [comparisonMode, setComparisonMode] = useState<'split' | 'overlay'>('split');
  const [hideMarkers, setHideMarkers] = useState(false);
  const [isMagnifierActive, setIsMagnifierActive] = useState(false);
  const [magnifierState, setMagnifierState] = useState({ x: 0, y: 0, show: false });

  // AL CAMBIAR LA VERSIÓN A COMPARAR, CARGAMOS SUS COMENTARIOS
  useEffect(() => {
    if (historicalVersions.length > 0 && !compareTargetId) {
      setCompareTargetId(String(historicalVersions[0].id));
    }
  }, [historicalVersions, compareTargetId]);

  const compareProject = useMemo(() => 
    projects.find((p: any) => String(p.id) === String(compareTargetId)),
  [projects, compareTargetId]);

  // ESTADOS DIBUJO
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [activeTool, setActiveTool] = useState<DrawingTool>('pen'); 
  const [activeColor, setActiveColor] = useState('#ef4444'); 
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [tempDrawings, setTempDrawings] = useState<{path: string, tool: DrawingTool, color: string}[]>([]);
  const [startPoint, setStartPoint] = useState<{x: number, y: number} | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // --- CARGA DE DATOS ACTUALES ---
  const loadData = async () => {
    if (!projectId) return;
    
    const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('*')
        .eq('page_id', projectId)
        .order('created_at', { ascending: true });
    
    if (commentsError) console.error("Error cargando notas:", commentsError); 
    setCorrections(commentsData || []);

    if (commentsData && commentsData.length > 0) {
        const commentIds = commentsData.map((c: any) => c.id);
        const { data: repliesData } = await supabase
            .from('comment_replies')
            .select('*')
            .in('comment_id', commentIds)
            .order('created_at', { ascending: true });
        
        setReplies(repliesData || []);
    } else {
        setReplies([]);
    }
  };

  // --- CARGAR DATOS HISTÓRICOS (COMPARACIÓN) ---
  const loadHistoricalData = async (targetId: string) => {
      if (!targetId) return;
      const { data: hComments } = await supabase.from('comments').select('*').eq('page_id', targetId).order('created_at', { ascending: true });
      setHistoricalCorrections(hComments || []);
      if (hComments && hComments.length > 0) {
          const commentIds = hComments.map((c: any) => c.id);
          const { data: hReplies } = await supabase.from('comment_replies').select('*').in('comment_id', commentIds).order('created_at', { ascending: true });
          setHistoricalReplies(hReplies || []);
      } else {
          setHistoricalReplies([]);
      }
  };

  useEffect(() => {
      if (isComparing && compareTargetId) {
          loadHistoricalData(compareTargetId);
      }
  }, [isComparing, compareTargetId]);

  const loadProjectStatus = async () => {
      if (!projectId) return; 
      const { data } = await supabase
        .from('projects')
        .select('is_approved, approved_by')
        .eq('id', projectId)
        .single(); 
      if (data) {
          setIsPageApproved(data.is_approved);
          setApprovedBy(data.approved_by);
      }
  }

  useEffect(() => {
    if (!projectId || !session?.user?.email) return;
    const roomChannel = supabase.channel(`room-${projectId}`, { config: { presence: { key: session.user.email } } });
    roomChannel.on('presence', { event: 'sync' }, () => { setOnlineUsers(Object.keys(roomChannel.presenceState())); }).subscribe(async (status) => { if (status === 'SUBSCRIBED') { await roomChannel.track({ user: session.user.email, online_at: new Date().toISOString() }); } });
    return () => { supabase.removeChannel(roomChannel); };
  }, [projectId, session]);

  useEffect(() => { 
      loadData(); 
      loadProjectStatus();
      const commentsChannel = supabase.channel('realtime-comments').on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `page_id=eq.${projectId}` }, () => loadData()).subscribe();
      const repliesChannel = supabase.channel('realtime-replies').on('postgres_changes', { event: '*', schema: 'public', table: 'comment_replies' }, () => loadData()).subscribe();
      const projectChannel = supabase.channel('project-status-channel')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` }, (payload: any) => { 
            if (payload.new) { 
                setIsPageApproved(payload.new.is_approved);
                setApprovedBy(payload.new.approved_by); 
                if (onRefresh) onRefresh(); 
            } 
        })
        .subscribe();
      return () => { supabase.removeChannel(commentsChannel); supabase.removeChannel(repliesChannel); supabase.removeChannel(projectChannel); }
  }, [projectId]);

  const togglePageApproval = async () => {
      if (userRole !== 'admin') return alert("Solo el administrador puede aprobar o reabrir páginas.");
      const newState = !isPageApproved; 
      const approverEmail = newState ? (session?.user?.email || 'Admin') : null;
      setIsPageApproved(newState); 
      setApprovedBy(approverEmail);
      const { error } = await supabase.from('projects').update({ is_approved: newState, approved_by: approverEmail }).eq('id', projectId); 
      if (error) { alert("Error al actualizar estado: " + error.message); setIsPageApproved(!newState); } 
      if (onRefresh) onRefresh();
  };

  const handleDownloadPDF = () => {
    const activeCorrections = corrections.filter(c => !c.deleted_at);
    const doc = new jsPDF(); const title = project ? `Correcciones: ${project.name}` : "Correcciones"; doc.setFontSize(16); doc.setTextColor(225, 29, 72); doc.text(title, 10, 15); if (isPageApproved) { doc.setTextColor(22, 163, 74); doc.text("[PÁGINA APROBADA]", 140, 15); } else if (isDeadlinePassed) { doc.setTextColor(249, 115, 22); doc.text("[PLAZO CERRADO]", 140, 15); } doc.setFontSize(10); doc.setTextColor(100); doc.text(`Generado el: ${new Date().toLocaleString()}`, 10, 22); doc.setLineWidth(0.5); doc.line(10, 25, 200, 25); let yPosition = 35; 
    activeCorrections.forEach((c, index) => { 
        if (yPosition > 270) { doc.addPage(); yPosition = 20; } 
        let statusText = "[PENDIENTE]"; if (c.resolved) { doc.setTextColor(22, 163, 74); statusText = "[HECHO]"; } else if (c.is_general) { doc.setTextColor(37, 99, 235); statusText = "[GENERAL]"; } else { doc.setTextColor(225, 29, 72); statusText = "[PENDIENTE]"; } 
        doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text(`${index + 1}. ${statusText}`, 10, yPosition); const date = new Date(c.created_at).toLocaleString(); doc.setFont("helvetica", "normal"); doc.setTextColor(150); doc.text(date, 150, yPosition); yPosition += 5; doc.setTextColor(0); 
        const splitText = doc.splitTextToSize(c.content || "(Sin texto)", 180); doc.text(splitText, 15, yPosition); yPosition += (splitText.length * 5) + 5; 
        const myReplies = replies.filter(r => r.comment_id === c.id);
        if (myReplies.length > 0) {
            myReplies.forEach(r => {
                if (yPosition > 280) { doc.addPage(); yPosition = 20; }
                doc.setTextColor(100); doc.setFontSize(8); doc.text(`↳ Respuesta (${r.user_email || 'Anónimo'}):`, 20, yPosition); yPosition += 4;
                const replyContent = doc.splitTextToSize(r.content, 170); doc.text(replyContent, 20, yPosition); yPosition += (replyContent.length * 4) + 2;
            });
            yPosition += 5;
        }
        doc.setDrawColor(240); doc.line(10, yPosition - 5, 200, yPosition - 5); 
    }); 
    doc.save(`Correcciones_${project?.name || 'documento'}.pdf`);
  };

  const handleSliderMove = (e: any) => { if (!imageContainerRef.current) return; const rect = imageContainerRef.current.getBoundingClientRect(); const clientX = e.touches ? e.touches[0].clientX : e.clientX; const x = Math.max(0, Math.min(clientX - rect.left, rect.width)); setSliderPosition((x / rect.width) * 100); };
  const getRelativeCoords = (e: any) => { if (!imageContainerRef.current) return { x: 0, y: 0 }; const rect = imageContainerRef.current.getBoundingClientRect(); const clientX = e.touches ? e.touches[0].clientX : e.clientX; const clientY = e.touches ? e.touches[0].clientY : e.clientY; const x = ((clientX - rect.left) / rect.width) * 100; const y = ((clientY - rect.top) / rect.height) * 100; return { x, y }; };
  const generateArrowPath = (x1: number, y1: number, x2: number, y2: number) => { let path = `M ${x1} ${y1} L ${x2} ${y2}`; const angle = Math.atan2(y2 - y1, x2 - x1); const headLength = 2; const x3 = x2 - headLength * Math.cos(angle - Math.PI / 6); const y3 = y2 - headLength * Math.sin(angle - Math.PI / 6); const x4 = x2 - headLength * Math.cos(angle + Math.PI / 6); const y4 = y2 - headLength * Math.sin(angle + Math.PI / 6); path += ` M ${x2} ${y2} L ${x3} ${y3} M ${x2} ${y2} L ${x4} ${y4}`; return path; };
  const generateRectPath = (x1: number, y1: number, x2: number, y2: number) => { return `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2} L ${x1} ${y2} Z`; };

  const handlePointerDown = (e: any) => {
    if (isComparing || isLocked || isMagnifierActive) return;
    if (isDrawingMode) { setIsDrawing(true); const { x, y } = getRelativeCoords(e); setStartPoint({ x, y }); if (activeTool === 'arrow') setCurrentPath(`M ${x} ${y} L ${x} ${y}`); else if (activeTool === 'rect') setCurrentPath(generateRectPath(x, y, x, y)); else setCurrentPath(`M ${x} ${y}`); e.preventDefault(); } 
    else { const { x, y } = getRelativeCoords(e); if (x >= 0 && x <= 100 && y >= 0 && y <= 100) { setNewCoords({ x: x/100, y: y/100 }); setTimeout(() => textareaRef.current?.focus(), 50); } }
  };

  const handlePointerMove = (e: any) => { 
      if (isMagnifierActive && imageContainerRef.current) { const rect = imageContainerRef.current.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top; if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) { setMagnifierState({ x, y, show: true }); } else { setMagnifierState(prev => ({ ...prev, show: false })); } }
      if (!isDrawing || !isDrawingMode) return; e.preventDefault(); const { x, y } = getRelativeCoords(e); if (startPoint) { if (activeTool === 'arrow') setCurrentPath(generateArrowPath(startPoint.x, startPoint.y, x, y)); else if (activeTool === 'rect') setCurrentPath(generateRectPath(startPoint.x, startPoint.y, x, y)); else setCurrentPath(prev => `${prev} L ${x} ${y}`); }
  };

  const handlePointerUp = () => { if (isDrawing && isDrawingMode && currentPath) { setTempDrawings(prev => [...prev, { path: currentPath, tool: activeTool, color: activeColor }]); setCurrentPath(""); } setIsDrawing(false); setStartPoint(null); };
  const handlePointerLeave = () => { setIsDrawing(false); setMagnifierState(prev => ({ ...prev, show: false })); setStartPoint(null); };

  const handleAddNote = async (isGeneral = false) => {
    if (!newNote && !newCoords && tempDrawings.length === 0) return alert("Escribe algo, marca un punto o dibuja."); setLoading(true); 
    let fileUrl = ""; 
    try { 
        if (selectedFile) { const sanitizedName = selectedFile.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_"); const fileName = `adjunto-${Date.now()}-${sanitizedName}`; const { error: uploadError } = await supabase.storage.from('FOLLETOS').upload(fileName, selectedFile); if (uploadError) throw uploadError; const { data } = supabase.storage.from('FOLLETOS').getPublicUrl(fileName); fileUrl = data.publicUrl; } 
        const drawingDataString = tempDrawings.length > 0 ? tempDrawings.map(d => d.path).join('|') : null; const usedTool = tempDrawings.length > 0 ? tempDrawings[tempDrawings.length-1].tool : 'pen'; 
        let finalX = newCoords?.x || null; let finalY = newCoords?.y || null;
        if ((finalX === null || finalY === null) && tempDrawings.length > 0) { const firstPath = tempDrawings[0].path; const parts = firstPath.trim().split(' '); if (parts.length >= 3 && parts[0] === 'M') { finalX = parseFloat(parts[1]) / 100; finalY = parseFloat(parts[2]) / 100; } }
        const { error: insertError } = await supabase.from('comments').insert([{ page_id: projectId, content: newNote, attachment_url: fileUrl, resolved: false, is_general: isGeneral, x: finalX, y: finalY, drawing_data: drawingDataString, drawing_tool: usedTool, color: activeColor, user_email: session?.user?.email || 'Anónimo' }]); 
        if (insertError) alert("Error al guardar: " + insertError.message); else { setNewNote(""); setSelectedFile(null); setNewCoords(null); setTempDrawings([]); setCurrentPath(""); } 
    } catch (err: any) { alert("Error: " + err.message); } finally { setLoading(false); }
  };

  const handleSendReply = async (commentId: string) => {
      if (!replyText.trim()) return; setSendingReply(true); const user = session?.user?.email || 'Anónimo';
      const { error } = await supabase.from('comment_replies').insert({ comment_id: commentId, content: replyText, user_email: user });
      if (error) { alert("Error al enviar respuesta: " + error.message); } else { setReplyText(""); setReplyingTo(null); loadData(); } setSendingReply(false);
  };

  const toggleCheck = async (id: string, currentResolved: boolean) => { setCorrections(prev => prev.map(c => c.id === id ? { ...c, resolved: !currentResolved } : c)); await supabase.from('comments').update({ resolved: !currentResolved }).eq('id', id); };
  const deleteComment = async (id: string) => { if (window.confirm("¿Seguro que quieres borrar esta nota?")) { const currentUser = session?.user?.email || "usuario_desconocido"; const timestamp = new Date().toISOString(); const { error } = await supabase.from('comments').update({ deleted_at: timestamp, deleted_by: currentUser }).eq('id', id); if (error) { alert("Error al borrar: " + error.message); } else { loadData(); } } };
  
  const getStrokeStyle = (tool: DrawingTool, color: string, isHovered: boolean, isResolved: boolean) => { 
      const isHighlighter = tool === 'highlighter'; let strokeWidth = isHighlighter ? "2" : "1"; let opacity = isHighlighter ? "0.5" : "1"; let finalColor = isResolved ? '#10b981' : color;
      if (isHighlighter && isHovered) { strokeWidth = "4"; opacity = "0.8"; } if ((tool === 'pen' || tool === 'arrow' || tool === 'rect') && isHovered) { strokeWidth = "3"; opacity = "0.8"; }
      return { color: finalColor, width: strokeWidth, opacity }; 
  };

  const visibleCorrections = isComparing ? historicalCorrections.filter(c => !c.deleted_at) : corrections.filter(c => { if (userRole === 'admin') return true; return !c.deleted_at; });
  const activeReplies = isComparing ? historicalReplies : replies;

  // --- FUNCIÓN RENDER MARKERS ---
  const renderMarkers = (list: any[]) => (
      <>
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
            {list.map((c, index) => c.drawing_data && (c.drawing_data.split('|').map((path: string, i: number) => {
                    const isHovered = hoveredId === c.id; 
                    const tool = c.drawing_tool || 'pen';
                    const color = c.color || '#ef4444'; 
                    const style = getStrokeStyle(tool as DrawingTool, color, isHovered, c.resolved);
                    return (<path key={`${c.id}-${i}`} d={path} stroke={style.color} strokeWidth={style.width} opacity={style.opacity} fill="none" strokeLinecap="round" strokeLinejoin="round" className={`transition-all duration-200 ${isHovered ? "drop-shadow-lg" : ""}`} />);
                })))}
            {!isComparing && tempDrawings.map((item, i) => { const style = getStrokeStyle(item.tool, item.color, false, false); return <path key={`temp-${i}`} d={item.path} stroke={style.color} strokeWidth={style.width} opacity={style.opacity} fill="none" strokeLinecap="round" strokeLinejoin="round" /> })}
            {!isComparing && currentPath && (<path d={currentPath} stroke={getStrokeStyle(activeTool, activeColor, false, false).color} strokeWidth={getStrokeStyle(activeTool, activeColor, false, false).width} opacity={getStrokeStyle(activeTool, activeColor, false, false).opacity} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
        </svg>
        {list.map((c, index) => c.x!=null && (
            <div key={c.id} className={`absolute w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center -translate-x-1/2 -translate-y-1/2 z-20 ${hoveredId===c.id? "scale-150 z-30" : "hover:scale-125"}`} style={{left:`${c.x*100}%`, top:`${c.y*100}%`, backgroundColor: c.resolved ? '#10b981' : (c.color || '#ef4444')}}>
                <span className="text-white text-[10px] font-bold">{index + 1}</span>
            </div>
        ))}
        {!isComparing && newCoords && <div className="absolute w-8 h-8 animate-pulse rounded-full border-2 border-white shadow-lg -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none" style={{left:`${newCoords.x*100}%`, top:`${newCoords.y*100}%`, backgroundColor: activeColor + '99'}}></div>}
      </>
  );

  if (!project) return <div className="h-screen flex items-center justify-center text-slate-300 font-black">CARGANDO...</div>;

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">
      {/* HEADER */}
      <div className="h-20 bg-white border-b border-slate-200 px-8 flex justify-between items-center shrink-0 z-50">
        <div className="flex gap-4 items-center">
          <button onClick={() => project?.parent_id ? navigate(`/folder/${project.parent_id}`) : navigate('/')} className="bg-slate-100 px-4 py-2 rounded-xl text-slate-600 font-bold text-xs hover:bg-slate-200 transition-colors">← VOLVER</button>
          <span className="text-xl font-black italic tracking-tighter text-slate-800 uppercase mr-4">DocCheck</span>
          <h2 className="text-xl font-black italic uppercase text-slate-800 tracking-tighter truncate max-w-md border-l border-slate-300 pl-4">{project.name}</h2>
        </div>
        
        <div className="flex gap-4 items-center">
            {onlineUsers.length > 0 && (<div className="flex -space-x-2 mr-2">{onlineUsers.map((user, index) => (<div key={index} className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] font-black uppercase shadow-sm" style={{ backgroundColor: stringToColor(user) }} title={user}>{getInitials(user)}</div>))}</div>)}
            
            <button onClick={togglePageApproval} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all shadow-md flex items-center gap-2 ${isPageApproved ? 'bg-emerald-500 text-white hover:bg-red-500' : 'bg-slate-800 text-white hover:bg-emerald-600'}`} title={isPageApproved ? "Click para reabrir" : "Click para finalizar"}>
                {isPageApproved ? (
                    <span className="group-hover:hidden flex items-center gap-1">
                        ✅ APROBADA <span className="opacity-70 text-[9px] font-normal truncate max-w-[100px] ml-1">por {approvedBy || 'Admin'}</span>
                    </span>
                ) : "👍 APROBAR PÁGINA"}
            </button>

            {corrections.length > 0 && (<button onClick={handleDownloadPDF} className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-slate-50 flex items-center gap-2 shadow-sm"><span>📄 PDF DE CORRECCIONES</span></button>)}
            
            {historicalVersions.length > 0 ? (
                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                    <button onClick={() => setIsComparing(!isComparing)} className={`px-3 py-1.5 rounded-lg font-black text-[10px] uppercase transition-all flex items-center gap-2 ${isComparing ? "bg-slate-800 text-white shadow-md" : "text-slate-500 hover:bg-white"}`}>{isComparing ? "Cerrar" : "⚖️ Comparar"}</button>
                    {isComparing && (
                        <>
                        <select value={compareTargetId} onChange={(e) => setCompareTargetId(e.target.value)} className="bg-white border border-slate-200 text-slate-700 text-[10px] font-bold py-1.5 px-2 rounded-lg focus:outline-none focus:border-rose-500 uppercase cursor-pointer">{historicalVersions.map((v: any) => (<option key={v.id} value={v.id}>V{v.version}</option>))}</select>
                        <div className="flex bg-slate-200 p-0.5 rounded-lg">
                            <button onClick={() => setComparisonMode('split')} title="Modo Cortinilla" className={`p-1.5 rounded-md transition-all ${comparisonMode === 'split' ? 'bg-white shadow text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h20M12 2v20"/></svg></button>
                            <button onClick={() => setComparisonMode('overlay')} title="Modo Transparencia (Piel de cebolla)" className={`p-1.5 rounded-md transition-all ${comparisonMode === 'overlay' ? 'bg-white shadow text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/><circle cx="12" cy="12" r="3"/></svg></button>
                        </div>
                        </>
                    )}
                </div>
            ) : (project.version > 1 && <span className="text-[9px] text-slate-300 font-bold border border-slate-100 px-2 py-1 rounded">SIN PREVIO ({currentIndex + 1})</span>)}
            
            <div className="flex items-center gap-2">
                <button onClick={() => { setIsMagnifierActive(!isMagnifierActive); setHideMarkers(false); }} className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border font-bold text-[10px] uppercase transition-all ${isMagnifierActive ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}><span>🔍</span> {isMagnifierActive ? "Lupa Activa" : "Lupa"}</button>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1.5 rounded-xl">
                    <span className="text-[9px] font-bold text-slate-400 uppercase hidden xl:block">Ocultar marcas</span>
                    <button onClick={() => setHideMarkers(!hideMarkers)} className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-300 relative ${hideMarkers ? 'bg-slate-700' : 'bg-slate-200'}`} title="Ocultar/Mostrar marcadores"><div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${hideMarkers ? 'translate-x-4' : 'translate-x-0'}`} /></button>
                </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setZoomLevel(Math.max(1, zoomLevel - 0.5))} className="w-8 h-8 flex items-center justify-center bg-white rounded-md font-bold text-slate-600">-</button>
                <span className="text-[10px] font-black w-12 text-center text-slate-500">{Math.round(zoomLevel * 100)}%</span>
                <button onClick={() => setZoomLevel(zoomLevel + 0.5)} className="w-8 h-8 flex items-center justify-center bg-white rounded-md font-bold text-slate-600">+</button>
            </div>
            
            {/* --- NUEVO SELECTOR DE VERSIONES --- */}
            <div className="relative">
                <select
                    value={project.id}
                    onChange={(e) => navigate(`/project/${e.target.value}`)}
                    className="appearance-none bg-rose-600 text-white pl-4 pr-8 py-1.5 rounded-lg text-[10px] font-black uppercase shadow-md shadow-rose-200 cursor-pointer focus:outline-none hover:bg-rose-700 transition-colors"
                >
                    {allPageVersions.map((v: any) => (
                        <option key={v.id} value={v.id} className="text-slate-800 bg-white">
                            V{v.version} {v.id === project.id ? '(Actual)' : ''}
                        </option>
                    ))}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
            </div>

        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* ZONA CENTRAL - IMAGEN */}
        <div className="flex-1 bg-slate-200/50 relative overflow-auto flex items-center justify-center p-8 select-none">
            {!isComparing && prevProject && (<button onClick={() => navigate(`/project/${prevProject.id}`)} className="fixed left-6 top-1/2 -translate-y-1/2 z-50 p-4 bg-slate-800/90 text-white rounded-full shadow-2xl hover:bg-rose-600 hover:scale-110 transition-all border-2 border-white/20"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg></button>)}
            
            {isComparing && compareProject ? (
                comparisonMode === 'split' ? (
                    <div ref={imageContainerRef} className="relative shadow-2xl bg-white cursor-col-resize group" onMouseMove={handleSliderMove} onTouchMove={handleSliderMove} onClick={handleSliderMove} style={{ width: zoomLevel===1?'auto':`${zoomLevel*100}%`, height: zoomLevel===1?'100%':'auto', aspectRatio:'3/4' }}>
                        <img src={project.image_url} className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none" />
                        <div className="absolute top-0 left-0 h-full overflow-hidden border-r-4 border-white shadow-xl" style={{ width: `${sliderPosition}%` }}><div className="relative w-full h-full" style={{ width: imageContainerRef.current ? `${imageContainerRef.current.clientWidth}px` : '100%' }}><img src={compareProject.image_url} className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none" /><div className="absolute top-4 left-4 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded opacity-80" style={{ opacity: sliderPosition < 10 ? 0 : 1, transition: 'opacity 0.2s' }}>V{compareProject.version} (Anterior)</div></div></div>
                        <div className="absolute top-0 bottom-0 w-1 bg-white cursor-col-resize z-30 flex items-center justify-center" style={{ left: `${sliderPosition}%` }}><div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow border border-slate-200"><span className="text-slate-400 text-[10px]">↔</span></div></div>
                        <div className="absolute top-4 right-4 bg-rose-600 text-white text-[10px] font-bold px-2 py-1 rounded opacity-80" style={{ opacity: sliderPosition > 90 ? 0 : 1, transition: 'opacity 0.2s' }}>V{project.version} (Actual)</div>
                        {/* MARCADORES EN MODO SPLIT (SOBREIMPRESOS) */}
                        {!hideMarkers && <div className="absolute inset-0 z-40 pointer-events-none">{renderMarkers(visibleCorrections)}</div>}
                    </div>
                ) : (
                    <div ref={imageContainerRef} className="relative shadow-2xl bg-white cursor-ew-resize group overflow-hidden" onMouseMove={handleSliderMove} onTouchMove={handleSliderMove} onClick={handleSliderMove} style={{ width: zoomLevel===1?'auto':`${zoomLevel*100}%`, height: zoomLevel===1?'100%':'auto', aspectRatio:'3/4' }}>
                          <img src={compareProject.image_url} className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none" />
                          <img src={project.image_url} className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none transition-opacity duration-75" style={{ opacity: sliderPosition / 100 }} />
                          <div className="absolute top-4 left-4 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded opacity-80 pointer-events-none">Fondo: V{compareProject.version}</div>
                          <div className="absolute top-4 right-4 bg-rose-600 text-white text-[10px] font-bold px-2 py-1 rounded opacity-80 pointer-events-none" style={{ opacity: Math.max(0.3, sliderPosition / 100) }}>Capa superior: V{project.version} ({Math.round(sliderPosition)}%)</div>
                          <div className="absolute bottom-0 left-0 h-1 bg-rose-600/50 z-30 pointer-events-none" style={{ width: `${sliderPosition}%` }}></div>
                          {/* MARCADORES EN MODO OVERLAY */}
                          {!hideMarkers && <div className="absolute inset-0 z-40 pointer-events-none">{renderMarkers(visibleCorrections)}</div>}
                    </div>
                )
            ) : (
                <div ref={imageContainerRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerLeave} className={`relative shadow-2xl bg-white group transition-transform duration-200 ease-out touch-none ${!isLocked && isDrawingMode ? (activeTool==='highlighter' ? 'cursor-text' : 'cursor-crosshair') : (isMagnifierActive ? 'cursor-none' : 'cursor-default')}`} style={{ width: zoomLevel===1?'auto':`${zoomLevel*100}%`, height: zoomLevel===1?'100%':'auto' }}>
                  {project.image_url ? <img src={project.image_url} className="w-full h-full object-contain block select-none pointer-events-none" draggable={false} /> : <div className="w-[500px] h-[700px] flex items-center justify-center">SIN IMAGEN</div>}
                  {isPageApproved && (<div className="absolute top-4 right-4 bg-emerald-500 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-lg z-50 pointer-events-none opacity-80 border-2 border-white">🔒 FINALIZADA</div>)}
                  {isDeadlinePassed && !isPageApproved && (<div className="absolute top-4 right-4 bg-orange-500 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-lg z-50 pointer-events-none opacity-90 border-2 border-white">⏳ PLAZO CERRADO</div>)}
                  {isMagnifierActive && magnifierState.show && imageContainerRef.current && (<div style={{ position: 'absolute', left: magnifierState.x - 75, top: magnifierState.y - 75, width: '150px', height: '150px', borderRadius: '50%', border: '4px solid white', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', pointerEvents: 'none', backgroundImage: `url(${project.image_url})`, backgroundRepeat: 'no-repeat', backgroundSize: `${imageContainerRef.current.clientWidth * 2.5}px ${imageContainerRef.current.clientHeight * 2.5}px`, backgroundPosition: `-${(magnifierState.x * 2.5) - 75}px -${(magnifierState.y * 2.5) - 75}px`, zIndex: 100, backgroundColor: 'white' }} />)}
                  {!hideMarkers && renderMarkers(visibleCorrections)}
                </div>
            )}
            {!isComparing && nextProject && (<button onClick={() => navigate(`/project/${nextProject.id}`)} className="fixed right-[430px] top-1/2 -translate-y-1/2 z-50 p-4 bg-slate-800/90 text-white rounded-full shadow-2xl hover:bg-rose-600 hover:scale-110 transition-all border-2 border-white/20"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></button>)}
        </div>

        {/* SIDEBAR DERECHA */}
        <div className={`w-[400px] bg-white border-l border-slate-200 flex flex-col shadow-xl z-20 transition-colors duration-300 ${isComparing ? 'bg-slate-100' : 'bg-white'}`}>
            {isComparing ? (
                <div className="p-6 border-b border-slate-200 bg-slate-100 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase"><span>👁️ VIENDO NOTAS DE LA V{compareProject?.version}</span></div>
                    <p className="text-[10px] text-slate-400 leading-tight">Estás consultando el historial para verificar cambios. Estas notas no se pueden editar.</p>
                </div>
            ) : (
                isLocked ? (
                  <div className={`p-6 border-b text-center flex flex-col items-center gap-2 ${isPageApproved ? 'bg-emerald-50 border-emerald-100' : 'bg-orange-50 border-orange-100'}`}>
                      <span className="text-3xl">{isPageApproved ? "🎉" : "⏳"}</span>
                      {isPageApproved ? (
                          <div><h3 className="font-black uppercase text-sm text-emerald-800">Página Aprobada</h3><p className="text-[10px] px-2 leading-tight mt-1 text-emerald-600">Edición bloqueada por aprobación.</p></div>
                      ) : (
                          // AVISO ESPECÍFICO PARA EL USUARIO BLOQUEADO
                          <div><h3 className="font-black uppercase text-sm text-orange-800">Plazo Finalizado</h3><p className="text-[10px] px-2 leading-tight mt-1 text-orange-600">El tiempo para correcciones ha terminado.</p></div>
                      )}
                  </div>
                ) : (
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                      {/* --- AVISO PARA EL ADMIN SI EL PLAZO CADUCÓ PERO ÉL PUEDE EDITAR --- */}
                      {isDeadlinePassed && userRole === 'admin' && (
                          <div className="mb-4 bg-orange-100 border border-orange-200 text-orange-800 px-3 py-2 rounded-lg text-[10px] font-bold flex items-center gap-2">
                              <span>⚠️</span>
                              <span>PLAZO CLIENTE CERRADO (Tú puedes editar)</span>
                          </div>
                      )}

                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nueva Nota</h3>
                        {isDrawingMode ? (<span className={`text-[9px] font-bold px-2 py-0.5 rounded animate-pulse bg-white border shadow-sm`} style={{ color: activeColor }}>{activeTool === 'highlighter' ? '🖍️ Subrayando...' : (activeTool === 'arrow' ? '↗ Dibujando flecha...' : (activeTool === 'rect' ? '⬜ Dibujando marco...' : '✏️ Dibujando...'))}</span>) : newCoords ? (<span className="text-[9px] font-bold text-white px-2 py-0.5 rounded animate-bounce" style={{ backgroundColor: activeColor }}>🎯 Punto marcado</span>) : null}
                      </div>
                      <textarea ref={textareaRef} value={newNote} onChange={(e) => setNewNote(e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm mb-3 min-h-[80px] resize-none focus:outline-none focus:border-rose-300" placeholder="Escribe corrección..." />
                      
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2 mb-1 justify-center">
                            {COLORS.map((c) => (<button key={c.hex} onClick={() => setActiveColor(c.hex)} className={`w-6 h-6 rounded-full border-2 transition-all ${activeColor === c.hex ? 'border-slate-600 scale-110 shadow-md' : 'border-transparent hover:scale-110'}`} style={{ backgroundColor: c.hex }} title={c.name} />))}
                        </div>
                        <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-lg">
                            <button onClick={() => { setIsDrawingMode(true); setActiveTool('pen'); setNewCoords(null); }} className={`p-2 rounded-md border transition-all text-[10px] font-bold flex flex-col items-center justify-center gap-1 ${isDrawingMode && activeTool === 'pen' ? 'bg-white text-slate-800 border-slate-200 shadow-sm' : 'text-slate-500 border-transparent hover:bg-white'}`} title="Bolígrafo"><span>✏️</span></button>
                            <button onClick={() => { setIsDrawingMode(true); setActiveTool('highlighter'); setNewCoords(null); }} className={`p-2 rounded-md border transition-all text-[10px] font-bold flex flex-col items-center justify-center gap-1 ${isDrawingMode && activeTool === 'highlighter' ? 'bg-white text-slate-800 border-slate-200 shadow-sm' : 'text-slate-500 border-transparent hover:bg-white'}`} title="Subrayador"><span>🖍️</span></button>
                            <button onClick={() => { setIsDrawingMode(true); setActiveTool('arrow'); setNewCoords(null); }} className={`p-2 rounded-md border transition-all text-[10px] font-bold flex flex-col items-center justify-center gap-1 ${isDrawingMode && activeTool === 'arrow' ? 'bg-white text-slate-800 border-slate-200 shadow-sm' : 'text-slate-500 border-transparent hover:bg-white'}`} title="Flecha"><span>↗</span></button>
                            <button onClick={() => { setIsDrawingMode(true); setActiveTool('rect'); setNewCoords(null); }} className={`p-2 rounded-md border transition-all text-[10px] font-bold flex flex-col items-center justify-center gap-1 ${isDrawingMode && activeTool === 'rect' ? 'bg-white text-slate-800 border-slate-200 shadow-sm' : 'text-slate-500 border-transparent hover:bg-white'}`} title="Marco Cuadrado"><span>⬜</span></button>
                        </div>
                        {isDrawingMode && <button onClick={() => setIsDrawingMode(false)} className="text-[10px] text-center text-slate-400 hover:text-slate-600 font-bold uppercase py-1">Cancelar dibujo ✕</button>}
                        <div className="flex gap-2 mt-1">
                            <input type="file" id="adjunto" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                            <label htmlFor="adjunto" className={`px-4 py-3 rounded-lg font-black text-[9px] cursor-pointer border flex items-center gap-2 ${selectedFile?"bg-emerald-50 text-emerald-600 border-emerald-200":"bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}><span>📎</span>{selectedFile ? "LISTO" : "ADJUNTAR"}</label>
                            {tempDrawings.length > 0 && (<button onClick={() => setTempDrawings(prev => prev.slice(0, -1))} className="px-3 py-3 bg-slate-200 text-slate-500 rounded-lg font-bold text-[10px] hover:bg-slate-300" title="Deshacer último trazo">↩</button>)}
                            <button onClick={() => handleAddNote(false)} disabled={loading} className={`flex-1 py-3 rounded-lg font-black text-[10px] uppercase text-white shadow-md transition-all ${loading?"bg-slate-400":"bg-rose-600 hover:bg-rose-700"}`} style={{ backgroundColor: loading ? undefined : activeColor }}>{loading ? "..." : "GUARDAR"}</button>
                        </div>
                        <button onClick={() => handleAddNote(true)} disabled={loading} className="w-full py-2 bg-blue-50 border border-blue-200 text-blue-600 rounded-lg font-black text-[10px] uppercase hover:bg-blue-100 transition-colors">MODIFICACIÓN GENERAL</button>
                        {selectedFile && <span className="text-[10px] font-bold text-emerald-600 text-center truncate">📄 {selectedFile.name}</span>}
                        {tempDrawings.length > 0 && <button onClick={() => setTempDrawings([])} className="text-[9px] text-rose-400 hover:text-rose-600 font-bold text-right underline">Borrar dibujo actual</button>}
                      </div>
                  </div>
                )
            )}
              
            <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${isComparing ? 'bg-slate-50 opacity-90' : 'bg-white'}`}>
                {visibleCorrections.length===0 && <div className="mt-10 text-center text-slate-300 text-xs font-bold uppercase italic">Sin correcciones visibles</div>}
                
                {visibleCorrections.map((c, i) => {
                  const myReplies = activeReplies.filter(r => r.comment_id === c.id);
                  return (
                    <div key={c.id} onMouseEnter={() => !c.deleted_at && setHoveredId(c.id)} onMouseLeave={() => setHoveredId(null)} className={`p-4 rounded-2xl border-2 transition-all ${c.deleted_at ? 'bg-slate-50 border-slate-200 opacity-70 grayscale' : (c.resolved ? 'bg-emerald-50 border-emerald-200 opacity-60' : (c.is_general ? 'bg-blue-50 border-blue-200' : 'bg-rose-50 border-rose-200'))} ${hoveredId===c.id && !c.deleted_at ? 'scale-[1.02] shadow-md':''}`}>
                        <div className="flex gap-3 items-start">
                        {!c.deleted_at && (<button onClick={() => !isComparing && userRole === 'admin' && toggleCheck(c.id, c.resolved)} className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shadow-sm ${!isComparing && userRole === 'admin' ? 'cursor-pointer hover:scale-110' : 'cursor-default'} ${c.resolved ? "bg-emerald-500 border-emerald-500 text-white" : (c.is_general ? "bg-white border-blue-400" : "bg-white border-rose-400")}`} title={isComparing ? "Modo lectura" : (userRole === 'admin' ? "Marcar como hecho/pendiente" : "Solo el administrador puede marcar esto")}>{c.resolved && "✓"}</button>)}
                        {c.deleted_at && <span className="text-xl">🗑️</span>}
                        <div className="flex-1">
                            <div className="flex justify-between"><span className={`text-[9px] font-black uppercase ${c.deleted_at ? 'text-slate-400 line-through' : (c.is_general ? 'text-blue-400' : 'text-purple-300')}`}>#{i+1} {c.is_general && "GENERAL"}</span><span className="text-[9px] text-slate-400 font-bold">{new Date(c.created_at).toLocaleString([], { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>
                            <span className="text-[8px] font-bold text-slate-500 uppercase block mt-0.5 mb-1">👤 {c.user_email || 'Anónimo'}</span>
                            <p className={`text-sm font-bold leading-snug mt-1 ${c.deleted_at ? "text-slate-500 line-through italic" : (c.resolved ? "text-emerald-800 line-through" : (c.is_general ? "text-blue-900" : "text-rose-900"))}`}>{c.content}</p>
                            {c.deleted_at && (<div className="mt-2 bg-red-100 text-red-600 text-[9px] font-bold p-2 rounded border border-red-200">❌ Borrado por: {c.deleted_by || 'Desconocido'} <br/>📅 {new Date(c.deleted_at).toLocaleString()}</div>)}
                            <div className="flex flex-wrap gap-2 mt-2 items-center">{c.attachment_url && <a href={c.attachment_url} target="_blank" rel="noreferrer" className="text-[8px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded uppercase hover:bg-slate-200 border border-slate-200">📎 Ver Adjunto</a>}</div>
                            {!c.deleted_at && (<div className="mt-4 flex flex-col gap-2">{myReplies.map(r => (<div key={r.id} className="bg-slate-100 p-2 rounded-lg border border-slate-200 ml-2 relative"><div className="absolute -left-2 top-3 w-2 h-[1px] bg-slate-300"></div><div className="flex justify-between items-baseline mb-1"><span className="text-[8px] font-black text-slate-500 uppercase">{r.user_email || 'Anónimo'}</span><span className="text-[7px] text-slate-400">{new Date(r.created_at).toLocaleString([], {hour: '2-digit', minute:'2-digit', day: 'numeric', month:'numeric'})}</span></div><p className="text-[10px] text-slate-700 font-medium leading-snug">{r.content}</p></div>))}{!isComparing && replyingTo === c.id ? (<div className="ml-2 mt-2 bg-white border border-slate-200 p-2 rounded-lg shadow-sm animate-fadeIn"><textarea autoFocus value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Escribe una respuesta..." className="w-full text-xs p-2 border border-slate-200 rounded-md focus:outline-none focus:border-rose-400 resize-none h-16 bg-slate-50" /><div className="flex justify-end gap-2 mt-2"><button onClick={() => setReplyingTo(null)} className="text-[9px] font-bold text-slate-400 uppercase hover:text-slate-600">Cancelar</button><button onClick={() => handleSendReply(c.id)} disabled={sendingReply || !replyText.trim()} className="bg-rose-600 text-white text-[9px] font-bold px-3 py-1 rounded uppercase hover:bg-rose-700 disabled:opacity-50">{sendingReply ? "Enviando..." : "Responder"}</button></div></div>) : null}</div>)}
                            {!isComparing && (<div className="mt-2 flex justify-end pt-2 border-t border-slate-200/50 gap-3">{!isLocked && !c.deleted_at && (<><button onClick={() => { setReplyingTo(c.id); setReplyText(""); }} className="text-[9px] font-black uppercase text-slate-400 hover:text-slate-700 flex items-center gap-1">💬 Responder</button><button onClick={() => deleteComment(c.id)} className={`text-[9px] font-black uppercase ${c.is_general ? 'text-blue-300 hover:text-blue-600' : 'text-rose-300 hover:text-rose-600'}`}>Borrar</button></>)}</div>)}
                        </div>
                        </div>
                    </div>
                  );
                })}
              </div>
            </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
