import { getRodWidth, ROD_HEIGHT } from '../utils/rods';

/**
 * Regleta individual renderizada en el lienzo.
 * Soporta: arrastrar para mover, rotación (0° o 90°), mostrar/ocultar valor.
 */
export default function DraggableRod({
  rod,
  showValue,
  rotation,
  onPointerDown,
  onContextMenu,
  isSelected,
}) {
  const width = getRodWidth(rod.value);
  const height = ROD_HEIGHT;

  return (
    <div
      className={`rod-3d canvas-element ${rod.cssClass} absolute flex items-center justify-center
                 select-none touch-none
                 ${isSelected ? 'rod-selected' : ''}
                 ${rod.isInvalid ? 'rod-invalid' : ''}`}
      style={{
        backgroundColor: rod.color,
        width: `${width}px`,
        height: `${height}px`,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: '20px 20px',
        zIndex: isSelected || rod.isInvalid ? 100 : 1,
        userSelect: 'none',
      }}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      onDoubleClick={onContextMenu}
      onClick={(e) => e.stopPropagation()}
    >
    </div>
  );
}
