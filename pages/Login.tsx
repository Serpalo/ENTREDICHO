import React, { useState } from 'react';
import { supabase } from '../supabase';

const Login = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(''); // Para el mensaje de éxito (oculta el form)
  const [errorMsg, setErrorMsg] = useState(''); // Para errores de validación (no oculta el form)

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(''); // Limpiamos errores previos

    // 1. Normalizar el correo (minúsculas y sin espacios extra)
    const emailNormalizado = email.toLowerCase().trim();

    // 2. Lista de dominios permitidos
    const dominiosPermitidos = [
      'alcampo.es',
      'entredichocomunicacion.com',
      'entredicho.es'
    ];

    // 3. Comprobar si el correo termina en alguno de los dominios
    // Usamos 'some' para ver si cumple alguna de las condiciones
    const esValido = dominiosPermitidos.some(dominio => emailNormalizado.endsWith(`@${dominio}`));

    if (!esValido) {
      setErrorMsg('⛔ Acceso restringido. Solo se permiten correos de Alcampo o Entredicho.');
      setLoading(false);
      return; // Detenemos la función aquí, no llamamos a Supabase
    }

    // 4. Si pasa el filtro, enviamos el Magic Link
    const { error } = await supabase.auth.signInWithOtp({ email: emailNormalizado });
    
    if (error) {
      setErrorMsg('Error técnico: ' + error.message);
    } else {
      setMessage('¡Enlace enviado! Revisa tu correo electrónico para entrar.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 font-sans">
      <div className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-md text-center border border-slate-200">
        
        <img src="/logo.png" alt="Logo" className="h-12 mx-auto mb-8 object-contain" />
        
        <h1 className="text-2xl font-black text-slate-800 uppercase italic mb-2">Acceso Correcciones</h1>
        <p className="text-sm text-slate-400 mb-8 font-bold">Introduce tu email corporativo para acceder.</p>
        
        {/* Si hay mensaje de ÉXITO, mostramos solo esto */}
        {message ? (
          <div className="bg-emerald-50 text-emerald-600 p-6 rounded-xl font-bold text-sm border border-emerald-200 animate-pulse flex flex-col gap-2">
            <span className="text-2xl">✨</span>
            {message}
          </div>
        ) : (
          /* Si no, mostramos el formulario */
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            
            {/* Aviso de error en rojo si el dominio no es válido */}
            {errorMsg && (
              <div className="bg-rose-50 text-rose-600 p-3 rounded-xl text-xs font-black border border-rose-100 animate-[shake_0.5s_ease-in-out]">
                {errorMsg}
              </div>
            )}

            <input 
              type="email" 
              placeholder="nombre@alcampo.es" 
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrorMsg(''); // Borrar error cuando el usuario empiece a escribir de nuevo
              }}
              className={`w-full bg-slate-50 border rounded-xl px-4 py-4 text-sm font-bold focus:outline-none focus:border-rose-500 transition-colors ${errorMsg ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`}
              required 
            />
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-rose-600 text-white font-black uppercase py-4 rounded-xl shadow-lg hover:bg-rose-700 transition-transform active:scale-95 disabled:bg-slate-300 disabled:shadow-none"
            >
              {loading ? 'Verificando...' : 'Enviar Enlace Mágico ✨'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
