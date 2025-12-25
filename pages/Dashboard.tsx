// ... (resto del código igual hasta el mapeo de proyectos)
{currentProjects.map((p: any) => (
  p.versions.map((v: any) => (
    <div 
      key={`${p.id}-${v.versionNumber}`} 
      /* CAMBIO: Ahora enviamos el número de versión en la URL */
      onClick={() => navigate(`/project/${p.id}?v=${v.versionNumber}`)}
      className="group bg-white p-5 rounded-[2.5rem] border-2 border-slate-100 hover:shadow-2xl cursor-pointer transition-all hover:-translate-y-2 hover:border-rose-100"
    >
      <div className="aspect-[3/4] bg-slate-50 rounded-[2rem] mb-6 overflow-hidden border border-slate-50 shadow-inner relative">
        {v.pages[0]?.imageUrl ? (
          <img src={v.pages[0].imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300 font-black text-[10px] uppercase italic">Sin previa</div>
        )}
        <div className="absolute top-4 right-4 bg-slate-900 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase">
          V{v.versionNumber}
        </div>
      </div>

      <h3 className="font-black text-sm truncate text-slate-800 uppercase px-2 mb-2 tracking-tighter">
        {p.name}
      </h3>
      
      <div className="flex items-center gap-2 px-2">
        <div className={`w-2 h-2 rounded-full ${v.versionNumber === p.versions.length ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
          {getCorrectionName(v.versionNumber)}
        </span>
      </div>
    </div>
  ))
))}
// ...
