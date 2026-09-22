import { useState, useRef, useCallback, useEffect } from 'react';
import { ANTENNA_ROW_HEIGHT, ANTENNA_COL_WIDTH, ANTENNA_TOP_HEIGHT } from '../utils/rods';

const ANT_LINE_COLOR = '#ef4444';
const ROWS = 10;
const LINE_GAP = 4;

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
  const lineY = ANTENNA_TOP_HEIGHT - 2;

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
    if (onMouseDown) onMouseDown(e, id);
  }, [onMouseDown, id]);

  const handleContext = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onContextMenu) onContextMenu(e, id);
  }, [onContextMenu, id]);

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
        zIndex: isSelected ? 25 : 20,
        background: 'transparent',
      }}
    >
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      >
        <line
          x1={0} y1={lineY}
          x2={totalWidth} y2={lineY}
          stroke={ANT_LINE_COLOR}
          strokeWidth={3}
        />
        <line
          x1={halfW} y1={lineY}
          x2={halfW} y2={totalHeight - 4}
          stroke={ANT_LINE_COLOR}
          strokeWidth={3}
        />
      </svg>

      {isEditing && (
        <input
          ref={operationInputRef}
          value={operation}
          onChange={handleOperationChange}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            left: 2,
            top: 2,
            width: totalWidth - 4,
            height: lineY - 4,
            background: 'transparent',
            border: 'none',
            borderRadius: '4px',
            textAlign: 'center',
            fontSize: 18,
            fontWeight: 700,
            color: '#1e293b',
            outline: 'none',
            boxShadow: 'none',
            padding: 0,
            fontFamily: 'inherit',
            zIndex: 2,
          }}
        />
      )}

      {isEditing && Array.from({ length: ROWS }).map((_, i) => {
        const yPos = ANTENNA_TOP_HEIGHT + i * ANTENNA_ROW_HEIGHT;
        const row = rows[i] || { left: '', right: '' };
        return (
          <div key={i} style={{ position: 'absolute', left: 0, top: yPos, width: totalWidth, height: ANTENNA_ROW_HEIGHT, zIndex: 2 }}>
            <input
              value={row.left}
              onChange={(e) => handleCellChange(i, 'left', e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: halfW - LINE_GAP,
                height: '100%',
                background: 'transparent',
                border: 'none',
                borderRight: 'none',
                textAlign: 'right',
                fontSize: 15,
                fontWeight: 500,
                color: '#334155',
                outline: 'none',
                boxShadow: 'none',
                padding: '0 6px 0 4px',
                fontFamily: 'inherit',
              }}
            />
            <input
              value={row.right}
              onChange={(e) => handleCellChange(i, 'right', e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                left: halfW + LINE_GAP,
                top: 0,
                width: halfW - LINE_GAP,
                height: '100%',
                background: 'transparent',
                border: 'none',
                textAlign: 'left',
                fontSize: 15,
                fontWeight: 500,
                color: '#334155',
                outline: 'none',
                boxShadow: 'none',
                padding: '0 4px 0 6px',
                fontFamily: 'inherit',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
