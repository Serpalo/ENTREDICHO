import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppNotification } from '../types';

interface NavbarProps {
  notifications: AppNotification[];
  markAllAsRead: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ notifications, markAllAsRead }) => {
  const [showNotifs, setShowNotifs] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <nav className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-[100] shadow-sm">
      <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
        <img 
            src="/logo.png?v=2" 
            alt="Logo" 
            className="h-12 w-auto object-contain"
            onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement?.querySelector('.fallback-logo')?.classList.remove('hidden');
            }} 
        />
        <div className="fallback-logo hidden flex items-center gap-2">
            {/* CAMBIO: bg-rose-600 */}
            <div className="bg-rose-600 text-white p-1.5 rounded-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <span className="font-black text-xl text-slate-800 tracking-tight">BrochureFlow</span>
        </div>
      </Link>

      <div className="flex items-center gap-6">
        <div className="relative">
          <button onClick={() => setShowNotifs(!showNotifs)} className="relative p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-all">
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                {unreadCount}
              </span>
            )}
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          </button>

          {showNotifs && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowNotifs(false)}></div>
              <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-bold text-sm text-slate-700">Notificaciones</h3>
                  {/* CAMBIO: text-rose-600 */}
                  {unreadCount > 0 && <button onClick={markAllAsRead} className="text-[10px] font-bold text-rose-600 hover:text-rose-700">Marcar leídas</button>}
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">No tienes notificaciones nuevas</div>
                  ) : (
                    notifications.map(n => (
                      /* CAMBIO: bg-rose-50 */
                      <div key={n.id} className={`p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors ${!n.read ? 'bg-rose-50/50' : ''}`}>
                        <div className="flex gap-3">
                           {/* CAMBIO: bg-rose-500 */}
                           <div className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${!n.read ? 'bg-rose-500' : 'bg-slate-200'}`}></div>
                           <div>
                             <p className="text-xs font-bold text-slate-800 mb-0.5">{n.title}</p>
                             <p className="text-xs text-slate-500 leading-snug">{n.message}</p>
                             <p className="text-[10px] text-slate-300 mt-2">{n.timestamp.toLocaleTimeString().slice(0,5)}</p>
                           </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-black text-xs border-2 border-white shadow-sm cursor-pointer hover:bg-slate-300 transition-colors">
          JS
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
