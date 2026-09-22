import { useState, useRef, useCallback, useEffect } from 'react';
import { ANTENNA_ROW_HEIGHT, ANTENNA_COL_WIDTH, ANTENNA_TOP_HEIGHT } from '../utils/rods';

const ANT_LINE_COLOR = '#ef4444';
const ROWS = 10;

export default function Antenna({
  antenna,
  isSelected,
  onMouseDown,
  onContextMenu,
  onUpdate,
}) {
  const { id, x, y, operation, rows } = antenna;
  const totalHeight = ANTENNA_TOP_HEIGHT + ROWS * ANTENNA_ROW_HEIGHT;
  const halfW = ANTENNA_COL_WIDTH + 4;
  const totalWidth = halfW * 2;

  const operationInputRef = useRef(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current && operationInputRef.current) {
      mountedRef.current = true;
      setTimeout(() => operationInputRef.current?.focus(), 50);
    }
  }, []);

  const handleCellChange = (rowIndex, side, value) => {
    const newRows = rows.map((r, i) =>
      i === rowIndex ? { ...r, [side]: value } : r
    );
    onUpdate(id, { rows: newRows });
  };

  const handleOperationChange = (e) => {
    onUpdate(id, { operation: e.target.value });
  };

  const dragHandleRef = useRef(null);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    if (e.target.tagName === 'INPUT') return;
    if (onMouseDown) onMouseDown(e, id);
  }, [onMouseDown, id]);

  const handleContext = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onContextMenu) onContextMenu(e, id);
  }, [onContextMenu, id]);

  return (
    <div
      ref={dragHandleRef}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContext}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: totalWidth,
        height: totalHeight,
        cursor: isSelected ? 'grabbing' : 'grab',
        userSelect: 'none',
        zIndex: isSelected ? 50 : 40,
      }}
    >
      {/* Líneas SVG de la T */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      >
        {/* Línea horizontal superior */}
        <line
          x1={0} y1={ANTENNA_TOP_HEIGHT / 2}
          x2={totalWidth} y2={ANTENNA_TOP_HEIGHT / 2}
          stroke={ANT_LINE_COLOR}
          strokeWidth={3}
        />
        {/* Línea vertical central */}
        <line
          x1={halfW} y1={ANTENNA_TOP_HEIGHT / 2}
          x2={halfW} y2={totalHeight - 4}
          stroke={ANT_LINE_COLOR}
          strokeWidth={3}
        />
      </svg>

      {/* Input de operación (arriba) */}
      <input
        ref={operationInputRef}
        value={operation}
        onChange={handleOperationChange}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: ANTENNA_TOP_HEIGHT,
          background: 'rgba(239, 68, 68, 0.08)',
          border: 'none',
          textAlign: 'center',
          fontSize: 15,
          fontWeight: 700,
          color: '#1e293b',
          outline: 'none',
          boxShadow: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          padding: 0,
          fontFamily: 'inherit',
        }}
      />

      {/* Celdas izquierda y derecha */}
      {Array.from({ length: ROWS }).map((_, i) => {
        const yPos = ANTENNA_TOP_HEIGHT + i * ANTENNA_ROW_HEIGHT;
        const row = rows[i] || { left: '', right: '' };
        return (
          <div key={i} style={{ position: 'absolute', left: 0, top: yPos, width: '100%', height: ANTENNA_ROW_HEIGHT, display: 'flex' }}>
            {/* Input izquierdo */}
            <input
              value={row.left}
              onChange={(e) => handleCellChange(i, 'left', e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: halfW - 6,
                height: '100%',
                background: 'rgba(239, 68, 68, 0.08)',
                border: 'none',
                textAlign: 'right',
                fontSize: 13,
                fontWeight: 500,
                color: '#334155',
                outline: 'none',
                boxShadow: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                padding: '0 8px 0 4px',
                fontFamily: 'inherit',
              }}
            />
            {/* Input derecho */}
            <input
              value={row.right}
              onChange={(e) => handleCellChange(i, 'right', e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: halfW - 6,
                height: '100%',
                background: 'rgba(239, 68, 68, 0.08)',
                border: 'none',
                textAlign: 'left',
                fontSize: 13,
                fontWeight: 500,
                color: '#334155',
                outline: 'none',
                boxShadow: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                padding: '0 4px 0 8px',
                fontFamily: 'inherit',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
