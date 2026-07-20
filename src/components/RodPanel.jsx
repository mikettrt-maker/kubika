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
    <div className="rod-panel w-64 h-full flex flex-col bg-white/60 backdrop-blur-md border-r border-slate-200/50 shadow-sm">
      {/* Encabezado del panel */}
      <div className="p-4 border-b border-slate-200/50 bg-gradient-to-r from-kubika-50/50 to-transparent">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-kubika-500 to-purple-500 flex items-center justify-center shadow-md shadow-kubika-500/20">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </span>
          Regletas
        </h2>
        <p className="text-[11px] text-slate-400 mt-1.5 ml-9">Arrastra al lienzo</p>
      </div>

      {/* Lista de regletas */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {RODS.map((rod) => {
          const displayWidth = `${(rod.value / 10) * 100}%`;

          return (
            <div key={rod.value} className="group rounded-xl hover:bg-slate-50/80 transition-all duration-200 px-2 py-1 -mx-2">
              {/* Etiqueta del nombre */}
              <div className="flex items-center mb-1.5 px-0.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest group-hover:text-kubika-600 transition-colors">
                  {rod.name}
                </span>
              </div>

              {/* Regleta arrastrable */}
              <div
                draggable="true"
                onDragStart={(e) => handleDragStart(e, rod)}
                className={`rod-3d ${rod.cssClass} flex items-center justify-center
                           transition-all duration-200 cursor-grab active:cursor-grabbing
                           group-hover:shadow-rod-hover group-hover:-translate-y-0.5`}
                style={{
                  backgroundColor: rod.color,
                  width: displayWidth,
                  minWidth: '32px',
                  height: `${ROD_HEIGHT - 4}px`,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.3)',
                }}
                title={`${rod.name} (${rod.value})`}
              >
              </div>
            </div>
          );
        })}
      </div>

      {/* Leyenda de ayuda */}
      <div className="p-3 border-t border-slate-200/50 bg-slate-50/80">
        <div className="space-y-1.5">
          <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
            <svg className="w-3 h-3 text-kubika-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
            Doble clic = opciones
          </p>
          <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
            <svg className="w-3 h-3 text-kubika-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Girar, eliminar, valor
          </p>
        </div>
      </div>
    </div>
  );
}
