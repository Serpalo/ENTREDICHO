import { useState, useEffect } from 'react';
// Usamos iconos SVG directos para no obligarte a instalar librerías extra
// Si ya tienes lucide-react, puedes sustituirlos por <ChevronLeft />

interface VisorPaginadoProps {
  paginas: string[]; // Array de URLs de las imágenes
  children?: React.ReactNode; // Aquí irán tus notas/pines para que no se pierdan
}

export default function VisorPaginado({ paginas, children }: VisorPaginadoProps) {
  const [indice, setIndice] = useState(0);

  // Funciones de navegación
  const anterior = () => indice > 0 && setIndice(indice - 1);
  const siguiente = () => indice < paginas.length - 1 && setIndice(indice + 1);

  // Teclado
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') anterior();
      if (e.key === 'ArrowRight') siguiente();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [indice, paginas.length]);

  if (!paginas || paginas.length === 0) return <div className="p-10 text-center">Cargando folleto...</div>;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-gray-100 overflow-hidden">
      
      {/* --- FLECHA IZQUIERDA --- */}
      <button
        onClick={anterior}
        disabled={indice === 0}
        className={`absolute left-4 z-20 p-3 rounded-full shadow-lg transition-all 
          ${indice === 0 ? 'opacity-0 pointer-events-none' : 'bg-white hover:bg-red-600 hover:text-white cursor-pointer'}`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      {/* --- CONTENEDOR DE LA IMAGEN Y NOTAS --- */}
      <div className="relative shadow-2xl bg-white transition-all duration-300">
        {/* La imagen cambia según el índice */}
        <img 
          src={paginas[indice]} 
          alt={`Pagina ${indice + 1}`} 
          className="max-h-[85vh] w-auto object-contain pointer-events-none select-none"
        />

        {/* --- TUS NOTAS ORIGINALES SE RENDERIZAN AQUÍ ENCIMA --- */}
        {/* Usamos un div absoluto para que tus notas se posicionen sobre la imagen */}
        <div className="absolute inset-0 w-full h-full">
            {children}
        </div>
      </div>

      {/* --- FLECHA DERECHA --- */}
      <button
        onClick={siguiente}
        disabled={indice === paginas.length - 1}
        className={`absolute right-4 z-20 p-3 rounded-full shadow-lg transition-all 
          ${indice === paginas.length - 1 ? 'opacity-0 pointer-events-none' : 'bg-white hover:bg-red-600 hover:text-white cursor-pointer'}`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      {/* Indicador inferior */}
      <div className="absolute bottom-4 bg-gray-800 text-white px-3 py-1 rounded-full text-xs">
        Página {indice + 1} de {paginas.length}
      </div>
    </div>
  );
}
