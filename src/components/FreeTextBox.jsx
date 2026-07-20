import { useState, useRef, useEffect } from 'react';

/**
 * Cuadro de texto libre con fuente manuscrita (Caveat).
 * Doble clic para editar, fondo transparente.
 */
export default function FreeTextBox({
  id,
  initialText = '',
  onPointerDown,
  onContextMenu,
  onUpdate,
  isSelected,
}) {
  const [text, setText] = useState(initialText);
  const [isEditing, setIsEditing] = useState(!initialText);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.selectionStart = inputRef.current.value.length;
      // Auto resize height
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = inputRef.current.scrollHeight + 'px';
    }
  }, [isEditing]);

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (onUpdate) onUpdate(id, text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      setIsEditing(false);
      if (onUpdate) onUpdate(id, text);
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
    }
    e.stopPropagation();
  };

  return (
    <div
      className={`absolute ${isEditing ? 'cursor-text' : 'cursor-grab'} 
                 ${isSelected ? 'ring-2 ring-kubika-400 ring-offset-2' : ''}
                 transition-all duration-200
                 ${isEditing
                   ? 'border border-dashed border-kubika-400 bg-white/50 backdrop-blur-sm p-2 rounded-lg'
                   : 'border border-transparent p-2 hover:border-slate-200/50 rounded-lg'
                 }`}
      style={{ zIndex: isSelected ? 100 : 2, minWidth: '80px', minHeight: '40px' }}
      onPointerDown={isEditing ? undefined : onPointerDown}
      onContextMenu={onContextMenu}
      onDoubleClick={handleDoubleClick}
      onClick={(e) => e.stopPropagation()}
    >
      {isEditing ? (
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Escribe una nota..."
          className="w-full bg-transparent outline-none resize-none font-handwriting text-3xl text-slate-800 leading-tight"
          rows={1}
          style={{ overflow: 'hidden', minWidth: '150px' }}
          onInput={(e) => {
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
        />
      ) : (
        <div className="font-handwriting text-3xl text-slate-800 whitespace-pre-wrap leading-tight pointer-events-none select-none">
          {text.trim() ? text : <span className="text-slate-400 italic text-2xl">Doble clic para escribir...</span>}
        </div>
      )}
    </div>
  );
}
