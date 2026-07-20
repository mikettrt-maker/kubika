import { BAND_COLORS } from '../utils/geoplano';

export default function GeoplanoPanel({
  geoMode,
  onModeChange,
  activeColor,
  onColorChange,
  bands,
  onClearBands,
  isInsertingPivot,
  onInsertingPivotChange,
}) {
  return (
    <div className="w-64 h-full flex flex-col bg-white/60 backdrop-blur-md border-r border-slate-200/50 shadow-sm">
      {/* Encabezado */}
      <div className="p-4 border-b border-slate-200/50 bg-gradient-to-r from-amber-50/50 to-transparent">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/20">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </span>
          Geoplano CIME
        </h2>
        <p className="text-[11px] text-slate-400 mt-1.5 ml-9">Pivotes al centro de cada celda</p>
      </div>

      {/* Insertar pivote manual */}
      <div className="p-3 border-b border-amber-200/40 bg-gradient-to-r from-amber-50/60 to-transparent">
        <button
          onClick={() => onInsertingPivotChange(!isInsertingPivot)}
          className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 ${
            isInsertingPivot
              ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-md shadow-violet-500/20 ring-2 ring-violet-300'
              : 'bg-white text-slate-600 border border-slate-200 hover:border-violet-300 hover:text-violet-600'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          {isInsertingPivot ? 'Insertando… (clic en canvas)' : 'Insertar pivote'}
        </button>
        <p className="text-[10px] text-slate-400 mt-1 text-center">
          Clic derecho sobre un pivote manual para eliminarlo
        </p>
      </div>

      {/* Selector de modo: Rectilíneo / Circular */}
      <div className="p-4 border-b border-slate-200/50">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Tipo</p>
        <div className="flex gap-2">
          <button
            onClick={() => onModeChange('rect')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 ${
              geoMode === 'rect'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/20'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            Rectilíneo
          </button>
          <button
            onClick={() => onModeChange('circle')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 ${
              geoMode === 'circle'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/20'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            Circular
          </button>
        </div>
      </div>

      {/* Paleta de colores */}
      <div className="p-4 border-b border-slate-200/50">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Color de banda</p>
        <div className="grid grid-cols-4 gap-1.5">
          {BAND_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => onColorChange(c.value)}
              className={`w-full aspect-square rounded-lg transition-all duration-150 active:scale-90 ${
                activeColor === c.value
                  ? 'ring-2 ring-offset-1 ring-slate-400 scale-110'
                  : 'hover:scale-105'
              }`}
              style={{ backgroundColor: c.value }}
              title={c.name}
            />
          ))}
        </div>
      </div>

      {/* Información de bandas */}
      <div className="flex-1 p-4 overflow-y-auto">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Bandas ({bands.length})
        </p>
        {bands.length === 0 ? (
          <p className="text-xs text-slate-400 italic">
            Haz clic en un pivote y luego en otro para crear una banda
          </p>
        ) : (
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {bands.map((band, i) => (
              <div
                key={band.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50 text-xs"
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: band.color }}
                />
                <span className="text-slate-600">Banda {i + 1}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="p-3 border-t border-slate-200/50 bg-slate-50/80 space-y-1.5">
        <button
          onClick={onClearBands}
          disabled={bands.length === 0}
          className="btn-ripple w-full py-2 rounded-xl text-xs font-bold bg-white text-slate-600 border border-slate-200
                     hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all duration-200
                     active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
        >
          Limpiar bandas
        </button>
      </div>
    </div>
  );
}
