// ... (resto del código se mantiene)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // 1. SUBIMOS EL ARCHIVO REAL AL STORAGE
      const { error: uploadError } = await supabase.storage
        .from('folletos')
        .upload(filePath, file);

      if (uploadError) {
        console.error("Error subiendo imagen:", uploadError.message);
        continue;
      }

      // 2. OBTENEMOS LA URL PÚBLICA
      const { data: { publicUrl } } = supabase.storage
        .from('folletos')
        .getPublicUrl(filePath);

      // 3. GUARDAMOS LA REFERENCIA EN LA TABLA
      await supabase.from('projects').insert([{ 
        name: file.name, 
        parent_id: folderId ? parseInt(folderId) : null,
        image_url: publicUrl // Guardamos la ruta de la imagen
      }]);
    }

    if (onRefresh) onRefresh();
    alert("Archivos subidos con previsualización");
  };

// ... (en la parte de la tabla, donde pone Vista)
<td className="px-10 py-6">
  <div className="w-16 h-20 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden shadow-sm">
    {p.image_url ? (
      <img src={p.image_url} alt="Vista" className="w-full h-full object-cover" />
    ) : (
      <span className="text-[10px] text-slate-300">SIN IMG</span>
    )}
  </div>
</td>
// ...
