import { useState, useRef, useEffect } from 'react';
import katex from 'katex';

/**
 * Cuadro de texto matemático movible y redimensionable en el lienzo.
 * Usa KaTeX para renderizar LaTeX.
 * Doble clic para editar, clic fuera para cerrar.
 * Arrastrar la esquina inferior derecha para redimensionar.
 */
export default function MathTextBox({
  id,
  initialLatex = '',
  initialWidth = 150,
  onPointerDown,
  onContextMenu,
  onUpdate,
  onResize,
  isSelected,
}) {
  const [latex, setLatex] = useState(initialLatex);
  const [isEditing, setIsEditing] = useState(!initialLatex);
  const [renderedHtml, setRenderedHtml] = useState('');
  const [width, setWidth] = useState(initialWidth);
  const inputRef = useRef(null);
  const latexRef = useRef(initialLatex);
  const widthRef = useRef(initialWidth);
  const isBlurBlocked = useRef(false);

  useEffect(() => { latexRef.current = latex; }, [latex]);
  useEffect(() => { widthRef.current = width; }, [width]);

  useEffect(() => {
    if (latex.trim()) {
      try {
        const html = katex.renderToString(latex, {
          throwOnError: false,
          displayMode: false,
          output: 'html',
        });
        setRenderedHtml(html);
      } catch {
        setRenderedHtml('<span style="color: #ef4444; font-size: 12px;">Error en fórmula</span>');
      }
    } else {
      setRenderedHtml('');
    }
  }, [latex]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleBlur = () => {
    if (isBlurBlocked.current) return;
    setIsEditing(false);
    if (onUpdate) onUpdate(id, latexRef.current);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      setIsEditing(false);
      if (onUpdate) onUpdate(id, latexRef.current);
    }
    if (e.key === 'Escape') setIsEditing(false);
    e.stopPropagation();
  };

  const quickInserts = [
    { label: 'a/b', latex: '\\frac{a}{b}', title: 'Fracción' },
    { label: 'x²', latex: 'x^{2}', title: 'Potencia' },
    { label: '√x', latex: '\\sqrt{x}', title: 'Raíz cuadrada' },
    { label: '∛x', latex: '\\sqrt[3]{x}', title: 'Raíz cúbica' },
    { label: '×', latex: '\\times', title: 'Multiplicación' },
    { label: '÷', latex: '\\div', title: 'División' },
    { label: '[ ]', latex: '[', title: 'Corchete izquierdo' },
    { label: ']', latex: ']', title: 'Corchete derecho' },
    { label: '{ }', latex: '\\{', title: 'Llave izquierda' },
    { label: '}', latex: '\\}', title: 'Llave derecha' },
  ];

  const insertLatex = (latexStr) => {
    const input = inputRef.current;
    if (!input) {
      const newLatex = latexRef.current + latexStr;
      latexRef.current = newLatex;
      setLatex(newLatex);
      return;
    }
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const current = latexRef.current;
    const newLatex = current.slice(0, start) + latexStr + current.slice(end);
    latexRef.current = newLatex;
    setLatex(newLatex);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.selectionStart = inputRef.current.selectionEnd = start + latexStr.length;
        inputRef.current.focus();
      }
    }, 0);
  };

  const handleResizePointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = widthRef.current;
    const onMove = (ev) => {
      const delta = ev.clientX - startX;
      const newW = Math.max(80, startWidth + delta);
      setWidth(newW);
      widthRef.current = newW;
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (onResize) onResize(id, widthRef.current);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div
      className={`math-box absolute ${isEditing ? 'math-box-editing' : ''}
                 ${isSelected ? 'ring-2 ring-purple-400 ring-offset-2' : ''}
                 rounded-xl border transition-all duration-200
                 ${isEditing
                   ? 'border-purple-400 shadow-lg shadow-purple-100 p-3 bg-white/90 backdrop-blur-sm'
                   : 'border-transparent shadow-none p-3 hover:border-slate-200 bg-transparent'
                 }`}
      style={{ zIndex: isSelected ? 100 : 2, width }}
      onPointerDown={isEditing ? undefined : onPointerDown}
      onContextMenu={onContextMenu}
      onDoubleClick={handleDoubleClick}
      onClick={(e) => e.stopPropagation()}
    >
      {isEditing ? (
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-wrap gap-1">
            {quickInserts.map((item) => (
              <button
                key={item.label}
                onPointerDown={(e) => {
                  e.preventDefault();
                  isBlurBlocked.current = true;
                  insertLatex(item.latex);
                  setTimeout(() => { isBlurBlocked.current = false; }, 50);
                }}
                title={item.title}
                className="px-2 py-1 text-xs font-mono bg-purple-50 text-purple-700
                         rounded-lg hover:bg-purple-100 transition-colors border border-purple-200/50"
              >
                {item.label}
              </button>
            ))}
          </div>
          <textarea
            ref={inputRef}
            value={latex}
            onChange={(e) => { latexRef.current = e.target.value; setLatex(e.target.value); }}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="Escribe LaTeX: \frac{1}{2}"
            className="math-input w-full px-3 py-2 border border-purple-200 rounded-lg
                     bg-white text-slate-700 focus:ring-2 focus:ring-purple-300 focus:border-transparent"
            rows={2}
            style={{ fontSize: '14px' }}
          />
          {latex.trim() && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 mb-1 font-semibold uppercase">Vista previa</p>
              <div className="text-center" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
            </div>
          )}
        </div>
      ) : (
        <div ref={inputRef}>
          {latex.trim() ? (
            <div
              className="katex-display-container text-lg overflow-hidden"
              style={{ fontSize: '16px', lineHeight: 1.4 }}
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          ) : (
            <p className="text-slate-400 text-sm italic">Doble clic para escribir fórmula...</p>
          )}
        </div>
      )}

      {/* Resize handle */}
      {isSelected && !isEditing && (
        <div
          onPointerDown={handleResizePointerDown}
          className="absolute bottom-1 right-1 w-4 h-4 cursor-se-resize
                   opacity-40 hover:opacity-100 transition-opacity"
          style={{ touchAction: 'none' }}
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-full h-full text-slate-500">
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="8" cy="12" r="1.5" />
            <circle cx="12" cy="8" r="1.5" />
            <circle cx="4" cy="12" r="1.5" />
            <circle cx="8" cy="8" r="1.5" />
            <circle cx="12" cy="4" r="1.5" />
          </svg>
        </div>
      )}
    </div>
  );
}
