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

const ALIGN_OPTIONS = [
  {
    value: 'left',
    label: 'Alinear a la izquierda',
    d: 'M4 6h16M4 12h10M4 18h13',
  },
  {
    value: 'center',
    label: 'Centrar',
    d: 'M6 6h12M8 12h8M7 18h10',
  },
  {
    value: 'right',
    label: 'Alinear a la derecha',
    d: 'M4 6h16M10 12h10M7 18h13',
  },
  {
    value: 'justify',
    label: 'Justificar',
    d: 'M4 6h16M4 12h16M4 18h16',
  },
];

const MIN_WIDTH = 120;
const MAX_WIDTH = 900;

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
  initialWidth = 260,
  initialAlign = 'left',
  onPointerDown,
  onContextMenu,
  onUpdate,
  isSelected,
}) {
  const [text, setText] = useState(initialText);
  const [color, setColor] = useState(initialColor);
  const [bold, setBold] = useState(initialBold);
  const [width, setWidth] = useState(initialWidth || 260);
  const [align, setAlign] = useState(initialAlign || 'left');
  const [isEditing, setIsEditing] = useState(!initialText);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef(null);
  const stateRef = useRef({ text, color, bold, width, align });
  const isBlurBlocked = useRef(false);

  useEffect(() => {
    stateRef.current = { text, color, bold, width, align };
  }, [text, color, bold, width, align]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.selectionStart = inputRef.current.value.length;
    }
  }, [isEditing]);

  useEffect(() => {
    const ta = inputRef.current;
    if (isEditing && ta) {
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    }
  }, [isEditing, text, width]);

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
    if (e.key === 'Escape') {
      e.preventDefault();
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
    setBold(!bold);
    isBlurBlocked.current = true;
    setTimeout(() => { isBlurBlocked.current = false; }, 50);
  };

  const handleAlignChange = (a) => {
    setAlign(a);
    isBlurBlocked.current = true;
    setTimeout(() => { isBlurBlocked.current = false; }, 50);
  };

  const startResize = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = width;
    const onMove = (mv) => {
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW + (mv.clientX - startX))));
    };
    const onUp = (uv) => {
      const finalW = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW + (uv.clientX - startX)));
      setWidth(finalW);
      if (onUpdate) onUpdate(id, { ...stateRef.current, width: finalW });
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const showResize = !isEditing && (isSelected || hovered);

  return (
    <div
      className={`absolute ${isEditing ? 'cursor-text' : 'cursor-grab'}
                 ${isSelected ? 'ring-2 ring-kubika-400 ring-offset-2' : ''}
                 transition-all duration-200
                 ${isEditing
                   ? 'border border-dashed border-kubika-400 bg-white/50 backdrop-blur-sm p-2 rounded-lg'
                   : 'border border-transparent p-2 hover:border-slate-200/50 rounded-lg'
                 }`}
      style={{
        zIndex: isSelected ? 100 : 2,
        width: `${width}px`,
        boxSizing: 'border-box',
        minHeight: '40px',
      }}
      onPointerDown={isEditing ? undefined : onPointerDown}
      onContextMenu={onContextMenu}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => e.stopPropagation()}
    >
      {isSelected && !isEditing && text.trim() && (
        <CopyButton text={text} />
      )}
      {isEditing ? (
        <div className="flex flex-col gap-2">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="Escribe o pega tu texto aquí..."
            rows={2}
            className="w-full bg-transparent outline-none font-handwriting text-3xl leading-tight resize-none overflow-hidden"
            style={{ color, fontWeight: bold ? 700 : 500, textAlign: align }}
          />
          <div className="flex items-center gap-1.5 flex-wrap">
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
            <div className="flex items-center gap-0.5 ml-1 pl-1 border-l border-slate-300">
              {ALIGN_OPTIONS.map((a) => (
                <button
                  key={a.value}
                  onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); handleAlignChange(a.value); }}
                  className={`p-1 rounded border transition-all ${align === a.value ? 'bg-kubika-600 border-kubika-600 text-white' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-100'}`}
                  title={a.label}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                    <path d={a.d} />
                  </svg>
                </button>
              ))}
            </div>
            <span className="text-[10px] text-slate-400 ml-auto no-print">Esc para cerrar</span>
          </div>
        </div>
      ) : (
        <div
          className="font-handwriting text-3xl leading-tight pointer-events-none select-none"
          style={{
            color,
            fontWeight: bold ? 700 : 500,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            textAlign: align,
          }}
        >
          {text.trim() ? text : <span className="text-slate-400 italic text-2xl">Doble clic para escribir...</span>}
        </div>
      )}
      {showResize && (
        <div
          className="absolute -right-1.5 -bottom-1.5 w-4 h-4 rounded-br-md border border-kubika-400 bg-white shadow-sm cursor-nwse-resize no-print flex items-end justify-end p-0.5"
          style={{ background: 'radial-gradient(circle at 70% 70%, #a855f7 0 3px, #fff 3px)' }}
          onPointerDown={startResize}
          title="Arrastra para ajustar el ancho"
        >
          <svg className="w-2.5 h-2.5 text-kubika-600" viewBox="0 0 10 10" fill="currentColor">
            <rect x="0" y="7" width="3" height="3" rx="0.5" />
            <rect x="4" y="5" width="3" height="3" rx="0.5" />
            <rect x="4" y="9" width="3" height="1" rx="0.5" />
          </svg>
        </div>
      )}
    </div>
  );
}
