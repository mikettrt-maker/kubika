import { RODS, getRodWidth, ROD_HEIGHT } from '../utils/rods';

/**
 * Panel lateral con las 10 regletas de Cuisenaire.
 * Las regletas se arrastran desde aquí hacia el lienzo.
 */
export default function RodPanel({ onDragStart }) {

  const handleDragStart = (e, rod) => {
    // Datos de la regleta para el drop
    e.dataTransfer.setData('application/json', JSON.stringify(rod));
    e.dataTransfer.effectAllowed = 'copy';
    
    // Notificar al componente padre
    if (onDragStart) onDragStart(rod);
  };

  const handlePointerDragStart = (e, rod) => {
    // Para dispositivos táctiles, usamos un sistema de pointer events
    if (onDragStart) onDragStart(rod, e);
  };

  return (
    <div className="rod-panel w-64 h-full flex flex-col bg-slate-50/50 backdrop-blur-xl border-r border-slate-200/50 shadow-2xl shadow-slate-200/50">
      {/* Encabezado del panel */}
      <div className="p-5 border-b border-slate-200/50 bg-white/50">
        <h2 className="text-[13px] font-extrabold text-slate-800 flex items-center gap-3 tracking-tight">
          <span className="w-8 h-8 rounded-2xl bg-slate-900 flex items-center justify-center shadow-lg shadow-slate-900/20">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </span>
          BIBLIOTECA DE REGLETAS
        </h2>
      </div>

      {/* Lista de regletas */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {RODS.map((rod) => {
          const displayWidth = `${(rod.value / 10) * 100}%`;

          return (
            <div key={rod.value} className="group relative">
              {/* Etiqueta del nombre */}
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-600 transition-colors">
                  {rod.name}
                </span>
                <span className="text-[9px] font-bold text-slate-400 bg-slate-200/50 px-1.5 py-0.5 rounded-md">
                  {rod.value}
                </span>
              </div>

              {/* Regleta arrastrable */}
              <div
                draggable="true"
                onDragStart={(e) => handleDragStart(e, rod)}
                className={`rod-3d ${rod.cssClass} flex items-center justify-center rounded-lg
                           transition-all duration-300 cursor-grab active:cursor-grabbing
                           group-hover:translate-x-1`}
                style={{
                  backgroundColor: rod.color,
                  width: displayWidth,
                  minWidth: '40px',
                  height: '28px',
                  boxShadow: `0 4px 0 ${rod.color}80, inset 0 -2px 4px rgba(0,0,0,0.2)`,
                }}
                title={`${rod.name} (${rod.value})`}
              >
              </div>
            </div>
          );
        })}
      </div>

      {/* Leyenda de ayuda */}
      <div className="p-4 border-t border-slate-200/50 bg-white/30">
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-slate-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-kubika-400" />
            Arrastra para crear
          </p>
          <p className="text-[10px] font-bold text-slate-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            Doble clic para opciones
          </p>
        </div>
      </div>
    </div>
  );
}
