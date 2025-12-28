import React, { useState } from 'react';
import { supabase } from '../supabase';

const Login = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    // Envia un "Magic Link" al correo
    const { error } = await supabase.auth.signInWithOtp({ email });
    
    if (error) {
      setMessage('Error: ' + error.message);
    } else {
      setMessage('¡Enlace enviado! Revisa tu correo electrónico para entrar.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 font-sans">
      <div className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-md text-center border border-slate-200">
        {/* Asegúrate de tener tu logo.png en la carpeta public, si no, borra esta línea */}
        <img src="/logo.png" alt="Logo" className="h-12 mx-auto mb-8 object-contain" />
        
        <h1 className="text-2xl font-black text-slate-800 uppercase italic mb-2">Acceso Correcciones</h1>
        <p className="text-sm text-slate-400 mb-8 font-bold">Introduce tu email para recibir el enlace de acceso.</p>
        
        {message ? (
          <div className="bg-emerald-50 text-emerald-600 p-4 rounded-xl font-bold text-sm border border-emerald-200 animate-pulse">
            {message}
          </div>
        ) : (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input 
              type="email" 
              placeholder="tu@email.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm font-bold focus:outline-none focus:border-rose-500 transition-colors"
              required 
            />
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-rose-600 text-white font-black uppercase py-4 rounded-xl shadow-lg hover:bg-rose-700 transition-transform active:scale-95 disabled:bg-slate-300"
            >
              {loading ? 'Enviando...' : 'Enviar Enlace Mágico ✨'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
