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

  const [isEditing, setIsEditing] = useState(false);
  const operationInputRef = useRef(null);

  const handleDoubleClick = useCallback((e) => {
    if (e.target.tagName === 'INPUT') return;
    e.preventDefault();
    e.stopPropagation();
    setIsEditing(prev => !prev);
  }, []);

  useEffect(() => {
    if (isEditing && operationInputRef.current) {
      operationInputRef.current.focus();
    }
  }, [isEditing]);

  const handleCellChange = (rowIndex, side, value) => {
    const newRows = rows.map((r, i) =>
      i === rowIndex ? { ...r, [side]: value } : r
    );
    onUpdate(id, { rows: newRows });
  };

  const handleOperationChange = (e) => {
    onUpdate(id, { operation: e.target.value });
  };

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    if (isEditing && e.target.tagName === 'INPUT') return;
    if (onMouseDown) onMouseDown(e, id);
  }, [onMouseDown, id, isEditing]);

  const handleContext = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onContextMenu) onContextMenu(e, id);
  }, [onContextMenu, id]);

  const inputBg = isEditing ? 'rgba(255,255,255,0.9)' : 'transparent';

  return (
    <div
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContext}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: totalWidth,
        height: totalHeight,
        cursor: isEditing ? 'text' : (isSelected ? 'grabbing' : 'grab'),
        userSelect: 'none',
        zIndex: isSelected ? 50 : 40,
      }}
    >
      {/* Líneas SVG de la T */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      >
        <line
          x1={0} y1={ANTENNA_TOP_HEIGHT / 2}
          x2={totalWidth} y2={ANTENNA_TOP_HEIGHT / 2}
          stroke={ANT_LINE_COLOR}
          strokeWidth={3}
        />
        <line
          x1={halfW} y1={ANTENNA_TOP_HEIGHT / 2}
          x2={halfW} y2={totalHeight - 4}
          stroke={ANT_LINE_COLOR}
          strokeWidth={3}
        />
      </svg>

      {/* Input de operación (arriba) */}
      {isEditing && (
        <input
          ref={operationInputRef}
          value={operation}
          onChange={handleOperationChange}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: ANTENNA_TOP_HEIGHT,
            background: inputBg,
            border: 'none',
            textAlign: 'center',
            fontSize: 15,
            fontWeight: 700,
            color: '#1e293b',
            outline: 'none',
            boxShadow: 'none',
            padding: 0,
            fontFamily: 'inherit',
          }}
        />
      )}

      {/* Celdas izquierda y derecha */}
      {isEditing && Array.from({ length: ROWS }).map((_, i) => {
        const yPos = ANTENNA_TOP_HEIGHT + i * ANTENNA_ROW_HEIGHT;
        const row = rows[i] || { left: '', right: '' };
        return (
          <div key={i} style={{ position: 'absolute', left: 0, top: yPos, width: '100%', height: ANTENNA_ROW_HEIGHT, display: 'flex' }}>
            <input
              value={row.left}
              onChange={(e) => handleCellChange(i, 'left', e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                width: halfW - 6,
                height: '100%',
                background: inputBg,
                border: 'none',
                textAlign: 'right',
                fontSize: 13,
                fontWeight: 500,
                color: '#334155',
                outline: 'none',
                boxShadow: 'none',
                padding: '0 8px 0 4px',
                fontFamily: 'inherit',
              }}
            />
            <input
              value={row.right}
              onChange={(e) => handleCellChange(i, 'right', e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                width: halfW - 6,
                height: '100%',
                background: inputBg,
                border: 'none',
                textAlign: 'left',
                fontSize: 13,
                fontWeight: 500,
                color: '#334155',
                outline: 'none',
                boxShadow: 'none',
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
