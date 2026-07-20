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
                 ${isSelected ? 'ring-2 ring-kubika-400 ring-offset-2 animate-glow' : ''}`}
      style={{
        backgroundColor: rod.color,
        width: `${width}px`,
        height: `${height}px`,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: '20px 20px',
        boxShadow: rod.isInvalid 
          ? '0 0 0 2px #ef4444, 0 4px 12px rgba(239, 68, 68, 0.5)'
          : isSelected
            ? '0 0 0 2px #4c6ef5, 0 4px 12px rgba(76, 110, 245, 0.35)'
            : '0 2px 6px rgba(0,0,0,0.2)',
        zIndex: isSelected || rod.isInvalid ? 100 : 1,
        cursor: rod.isInvalid ? 'not-allowed' : 'grab',
      }}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      onDoubleClick={onContextMenu}
      onClick={(e) => e.stopPropagation()}
    >
    </div>
  );
}
