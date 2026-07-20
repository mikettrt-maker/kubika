import { useState } from 'react';
import { PIVOT_RADIUS, GEO_SIZE, GEO_UNIT, GEO_ORIGIN_X, GEO_ORIGIN_Y } from '../utils/geoplano';

export default function GeoplanoOverlay({
  pivots,
  manualPivots,
  bands,
  selectedPivotId,
  onPivotClick,
  onBandContextMenu,
  onCanvasClick,
  isInsertingPivot,
  onInsertPivot,
  onDeleteManualPivot,
}) {
  const [contextMenu, setContextMenu] = useState(null);

  const handlePivotClick = (e, pivotId) => {
    e.stopPropagation();
    if (onPivotClick) onPivotClick(pivotId);
  };

  const handleBandContext = (e, bandId) => {
    e.preventDefault();
    e.stopPropagation();
    if (onBandContextMenu) onBandContextMenu(e, bandId);
  };

  const handleCanvasBgClick = (e) => {
    if (isInsertingPivot && onInsertPivot) {
      const rect = e.currentTarget.closest('[data-canvas-inner]')?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        onInsertPivot(x, y);
      }
      return;
    }
    if (onCanvasClick) onCanvasClick();
  };

  const handleManualPivotContext = (e, pivotId) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      pivotId,
    });
  };

  const allPivots = [...pivots, ...(manualPivots || [])];
  const manualPivotIds = new Set((manualPivots || []).map(p => p.id));

  const extent = GEO_SIZE * GEO_UNIT;
  const gridTop = GEO_ORIGIN_Y - 20;
  const gridLeft = GEO_ORIGIN_X - 20;
  const gridWidth = extent + 40;
  const gridHeight = extent + 40;

  return (
    <>
      {/* Overlay clickeable del canvas (para insertar pivotes o deseleccionar) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          cursor: isInsertingPivot ? 'crosshair' : 'default',
          zIndex: isInsertingPivot ? 25 : 0,
        }}
        onClick={handleCanvasBgClick}
      />

      {/* Fondo del área del geoplano */}
      <div
        style={{
          position: 'absolute',
          left: gridLeft,
          top: gridTop,
          width: gridWidth,
          height: gridHeight,
          borderRadius: 12,
          background: 'rgba(254, 243, 199, 0.55)',
          border: '1.5px solid rgba(217, 119, 6, 0.25)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.6), 0 4px 20px rgba(0,0,0,0.06)',
          backdropFilter: 'blur(2px)',
          pointerEvents: 'none',
        }}
      />

      {/* Líneas de cuadrícula */}
      <svg
        style={{
          position: 'absolute',
          left: GEO_ORIGIN_X,
          top: GEO_ORIGIN_Y,
          width: extent,
          height: extent,
          pointerEvents: 'none',
        }}
      >
        {Array.from({ length: GEO_SIZE + 1 }).map((_, i) => (
          <g key={i}>
            <line
              x1={i * GEO_UNIT}
              y1={0}
              x2={i * GEO_UNIT}
              y2={extent}
              stroke="rgba(180, 130, 60, 0.3)"
              strokeWidth={1}
            />
            <line
              x1={0}
              y1={i * GEO_UNIT}
              x2={extent}
              y2={i * GEO_UNIT}
              stroke="rgba(180, 130, 60, 0.3)"
              strokeWidth={1}
            />
          </g>
        ))}
      </svg>

      {/* Bandas elásticas */}
      <svg
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        {bands.map((band) => {
          const p1 = allPivots.find(p => p.id === band.pivotId1);
          const p2 = allPivots.find(p => p.id === band.pivotId2);
          if (!p1 || !p2) return null;
          return (
            <line
              key={band.id}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={band.color}
              strokeWidth={3}
              strokeLinecap="round"
              style={{ pointerEvents: 'stroke' }}
              onContextMenu={(e) => handleBandContext(e, band.id)}
              onClick={(e) => handleBandContext(e, band.id)}
            />
          );
        })}
      </svg>

      {/* Pivotes fijos del geoplano */}
      {pivots.map((pivot) => {
        const isSelected = selectedPivotId === pivot.id;
        return (
          <div
            key={pivot.id}
            style={{
              position: 'absolute',
              left: pivot.x - PIVOT_RADIUS,
              top: pivot.y - PIVOT_RADIUS,
              width: PIVOT_RADIUS * 2,
              height: PIVOT_RADIUS * 2,
              borderRadius: '50%',
              background: isSelected
                ? 'linear-gradient(135deg, #4c6ef5, #7c3aed)'
                : 'radial-gradient(circle at 35% 35%, #64748b, #475569)',
              border: isSelected
                ? '2px solid #fff'
                : '2px solid rgba(255,255,255,0.5)',
              boxShadow: isSelected
                ? '0 0 12px rgba(76,110,245,0.6), inset 0 1px 0 rgba(255,255,255,0.3)'
                : '0 2px 6px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.2)',
              cursor: isInsertingPivot ? 'crosshair' : 'pointer',
              zIndex: isSelected ? 20 : 10,
              transition: 'all 0.15s ease',
            }}
            onClick={(e) => handlePivotClick(e, pivot.id)}
            title={`Pivote (${Math.round(pivot.x)}, ${Math.round(pivot.y)})`}
          />
        );
      })}

      {/* Pivotes manuales (forma de diamante) */}
      {(manualPivots || []).map((pivot) => {
        const isSelected = selectedPivotId === pivot.id;
        const s = PIVOT_RADIUS;
        return (
          <div
            key={pivot.id}
            style={{
              position: 'absolute',
              left: pivot.x - s,
              top: pivot.y - s,
              width: s * 2,
              height: s * 2,
              cursor: isInsertingPivot ? 'crosshair' : 'pointer',
              zIndex: isSelected ? 20 : 10,
              transition: 'all 0.15s ease',
            }}
            onClick={(e) => handlePivotClick(e, pivot.id)}
            onContextMenu={(e) => handleManualPivotContext(e, pivot.id)}
            title={`Pivote manual (${Math.round(pivot.x)}, ${Math.round(pivot.y)})`}
          >
            <svg viewBox="0 0 24 24" width="100%" height="100%">
              <rect
                x="7"
                y="7"
                width="10"
                height="10"
                rx="2"
                fill={isSelected ? '#8b5cf6' : '#f59e0b'}
                stroke={isSelected ? '#fff' : '#d97706'}
                strokeWidth={2}
                style={{
                  filter: isSelected
                    ? 'drop-shadow(0 0 6px rgba(139, 92, 246, 0.6))'
                    : 'drop-shadow(0 1px 3px rgba(0,0,0,0.3))',
                }}
              />
            </svg>
          </div>
        );
      })}

      {/* Menú contextual para pivote manual */}
      {contextMenu && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
          />
          <div
            className="fixed z-[9999] min-w-[200px] py-1.5 bg-white rounded-xl shadow-2xl border border-slate-200/60 overflow-hidden animate-scale-in"
            style={{
              left: `${Math.min(contextMenu.x, window.innerWidth - 220)}px`,
              top: `${Math.min(contextMenu.y, window.innerHeight - 220)}px`,
              transformOrigin: 'top left',
            }}
          >
            <button
              onClick={() => {
                if (onDeleteManualPivot) onDeleteManualPivot(contextMenu.pivotId);
                setContextMenu(null);
              }}
              className="w-full px-4 py-2.5 text-left text-sm font-medium flex items-center gap-3
                         transition-all duration-150 active:scale-[0.98]
                         text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Eliminar pivote manual
            </button>
          </div>
        </>
      )}
    </>
  );
}
