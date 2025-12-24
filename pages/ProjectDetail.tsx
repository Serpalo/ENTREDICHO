const handleGenerateReport = async () => {
    if (!activeVersion || !activeVersion.pages || activeVersion.pages.length === 0) return;
    
    const pageIds = activeVersion.pages.map(p => p.id);

    // Buscamos los comentarios vinculando directamente con los IDs de página de la versión activa
    const { data: comments, error } = await supabase
      .from('comments')
      .select('content, created_at, page_id')
      .in('page_id', pageIds)
      .eq('resolved', false) // Solo pendientes
      .order('created_at', { ascending: true });

    if (error) {
      console.error("Error al obtener comentarios:", error);
      return;
    }

    if (!comments || comments.length === 0) {
      alert("No hay correcciones pendientes en esta versión actual.");
      return;
    }

    // Mapeamos para añadir el número de página correcto visualmente
    const reportData = comments.map(c => {
      const pageInfo = activeVersion.pages.find(p => p.id === c.page_id);
      return {
        ...c,
        pageNumber: pageInfo ? pageInfo.pageNumber : '?'
      };
    });

    const reportWindow = window.open('', '_blank');
    if (reportWindow) {
      const html = `
        <html>
          <head>
            <title>Informe de Correcciones - ${project?.name}</title>
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 50px; color: #1e293b; line-height: 1.6; }
              .header { border-bottom: 4px solid #4f46e5; margin-bottom: 30px; padding-bottom: 20px; }
              h1 { margin: 0; font-size: 24px; color: #0f172a; }
              .project-info { color: #64748b; font-size: 14px; margin-top: 5px; font-weight: bold; }
              .item { background: #f8fafc; border-left: 4px solid #ef4444; padding: 20px; margin-bottom: 15px; border-radius: 0 12px 12px 0; }
              .page-badge { background: #4f46e5; color: white; padding: 4px 10px; rounded-md; font-size: 11px; font-weight: 900; border-radius: 6px; margin-right: 12px; }
              .content { font-size: 16px; font-weight: 500; }
              .date { font-size: 11px; color: #94a3b8; margin-top: 8px; display: block; text-transform: uppercase; }
              @media print { .no-print { display: none; } }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Informe de Correcciones Pendientes</h1>
              <div class="project-info">${project?.name} — Versión ${activeVersionNumber}</div>
            </div>
            ${reportData.map(c => `
              <div class="item">
                <span class="page-badge">PÁGINA ${c.pageNumber}</span>
                <span class="content">${c.content}</span>
                <span class="date">Registrado el ${new Date(c.created_at).toLocaleString()}</span>
              </div>
            `).join('')}
            <script>setTimeout(() => { window.print(); }, 500);</script>
          </body>
        </html>
      `;
      reportWindow.document.write(html);
      reportWindow.document.close();
    }
  };
