// Función para CREAR carpeta (Asegúrate de que este bloque reemplace al anterior)
const handleCreateFolder = async () => {
  if (!newFolderName.trim()) {
    setShowNewFolder(false);
    return;
  }
  
  // Insertamos en la tabla 'folders' con el parent_id actual
  const { error } = await supabase
    .from('folders')
    .insert([{ 
      name: newFolderName, 
      parent_id: folderId || null 
    }]);
  
  if (error) {
    console.error("Error creando carpeta:", error.message);
    alert("No se pudo crear la carpeta. Revisa los permisos.");
  } else {
    setNewFolderName("");
    setShowNewFolder(false);
    onRefresh(); // Esto recarga la lista para que aparezca la nueva carpeta
  }
};

// Función para BORRAR (Asignada a la X roja)
const handleDelete = async (e: React.MouseEvent, table: string, id: string) => {
  e.stopPropagation(); // Evita que al borrar se entre en la carpeta
  
  if (window.confirm(`¿Seguro que quieres eliminar este elemento de forma permanente?`)) {
    // Si es un proyecto, primero borramos sus páginas para evitar errores de referencia
    if (table === 'projects') {
      await supabase.from('pages').delete().eq('project_id', id);
    }
    
    const { error } = await supabase.from(table).delete().eq('id', id);
    
    if (error) {
      console.error("Error al borrar:", error.message);
      alert("Error: " + error.message);
    } else {
      onRefresh(); // Actualiza la vista inmediatamente
    }
  }
};
