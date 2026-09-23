import { useState, useRef, useEffect } from 'react';

const TEXT_COLORS = [
  { label: 'Negro', value: '#1e293b' },
  { label: 'Rojo', value: '#dc2626' },
  { label: 'Azul', value: '#2563eb' },
  { label: 'Verde', value: '#16a34a' },
  { label: 'Naranja', value: '#ea580c' },
  { label: 'Morado', value: '#9333ea' },
  { label: 'Rosa', value: '#db2777' },
  { label: 'Gris', value: '#64748b' },
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:0;top:0;opacity:0;';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };
  return (
    <button
      onPointerDown={(e) => e.stopPropagation()}
      onClick={handleCopy}
      className={`absolute -top-9 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-medium
                 rounded-full shadow-md transition-colors no-print whitespace-nowrap
                 ${copied ? 'bg-green-500 text-white' : 'bg-kubika-600 text-white hover:bg-kubika-700'}`}
      title="Copiar texto al portapapeles"
    >
      {copied ? 'Copiado!' : 'Copiar texto'}
    </button>
  );
}

export default function FreeTextBox({
  id,
  initialText = '',
  initialColor = '#1e293b',
  initialBold = false,
  onPointerDown,
  onContextMenu,
  onUpdate,
  isSelected,
}) {
  const [text, setText] = useState(initialText);
  const [color, setColor] = useState(initialColor);
  const [bold, setBold] = useState(initialBold);
  const [isEditing, setIsEditing] = useState(!initialText);
  const inputRef = useRef(null);
  const stateRef = useRef({ text, color, bold });
  const isBlurBlocked = useRef(false);

  useEffect(() => {
    stateRef.current = { text, color, bold };
  }, [text, color, bold]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.selectionStart = inputRef.current.value.length;
    }
  }, [isEditing]);

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleBlur = () => {
    if (isBlurBlocked.current) return;
    setIsEditing(false);
    if (onUpdate) onUpdate(id, { ...stateRef.current });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setIsEditing(false);
      if (onUpdate) onUpdate(id, { ...stateRef.current });
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      if (onUpdate) onUpdate(id, { ...stateRef.current });
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'v')) return;
    e.stopPropagation();
  };

  const handleColorChange = (c) => {
    setColor(c);
    isBlurBlocked.current = true;
    setTimeout(() => { isBlurBlocked.current = false; }, 50);
  };

  const toggleBold = () => {
    const newBold = !bold;
    setBold(newBold);
    isBlurBlocked.current = true;
    setTimeout(() => { isBlurBlocked.current = false; }, 50);
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
      {isSelected && !isEditing && text.trim() && (
        <CopyButton text={text} />
      )}
      {isEditing ? (
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="Escribe una nota..."
            className="w-full bg-transparent outline-none font-handwriting text-3xl leading-tight"
            style={{ color, fontWeight: bold ? 700 : 500, minWidth: '150px' }}
          />
          <div className="flex items-center gap-1.5">
            {TEXT_COLORS.map((c) => (
              <button
                key={c.value}
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); handleColorChange(c.value); }}
                className={`w-5 h-5 rounded-full border-2 transition-all ${color === c.value ? 'border-slate-800 scale-125' : 'border-transparent'}`}
                style={{ backgroundColor: c.value }}
                title={c.label}
              />
            ))}
            <button
              onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleBold(); }}
              className={`ml-1 px-2 py-0.5 text-xs rounded font-bold border transition-all ${bold ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'}`}
              title="Negrita"
            >
              B
            </button>
          </div>
        </div>
      ) : (
        <div
          className="font-handwriting text-3xl whitespace-nowrap leading-tight pointer-events-none select-none"
          style={{ color, fontWeight: bold ? 700 : 500 }}
        >
          {text.trim() ? text : <span className="text-slate-400 italic text-2xl">Doble clic para escribir...</span>}
        </div>
      )}
    </div>
  );
}
