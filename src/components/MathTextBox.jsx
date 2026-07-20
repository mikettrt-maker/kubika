import { useState, useRef, useEffect } from 'react';
import katex from 'katex';

/**
 * Cuadro de texto matemático movible en el lienzo.
 * Usa KaTeX para renderizar LaTeX.
 * Doble clic para editar, clic fuera para cerrar.
 */
export default function MathTextBox({
  id,
  initialLatex = '',
  onPointerDown,
  onContextMenu,
  onUpdate,
  isSelected,
}) {
  const [latex, setLatex] = useState(initialLatex);
  const [isEditing, setIsEditing] = useState(!initialLatex);
  const [renderedHtml, setRenderedHtml] = useState('');
  const inputRef = useRef(null);
  const renderRef = useRef(null);

  // Renderizar LaTeX cuando cambia
  useEffect(() => {
    if (latex.trim()) {
      try {
        const html = katex.renderToString(latex, {
          throwOnError: false,
          displayMode: true,
          output: 'html',
        });
        setRenderedHtml(html);
      } catch {
        setRenderedHtml(`<span style="color: #ef4444; font-size: 12px;">Error en fórmula</span>`);
      }
    } else {
      setRenderedHtml('');
    }
  }, [latex]);

  // Focus en el input cuando se entra a edición
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (onUpdate) onUpdate(id, latex);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      setIsEditing(false);
      if (onUpdate) onUpdate(id, latex);
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
    }
    // Evitar que el evento se propague al lienzo
    e.stopPropagation();
  };

  // Botones rápidos de fórmulas comunes
  const quickInserts = [
    { label: 'a/b', latex: '\\frac{a}{b}', title: 'Fracción' },
    { label: 'x²', latex: 'x^{2}', title: 'Potencia' },
    { label: '√x', latex: '\\sqrt{x}', title: 'Raíz cuadrada' },
    { label: '∛x', latex: '\\sqrt[3]{x}', title: 'Raíz cúbica' },
    { label: '×', latex: '\\times', title: 'Multiplicación' },
    { label: '÷', latex: '\\div', title: 'División' },
  ];

  const insertLatex = (latexStr) => {
    const input = inputRef.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const newLatex = latex.slice(0, start) + latexStr + latex.slice(end);
    setLatex(newLatex);
    // Mover cursor después del texto insertado
    setTimeout(() => {
      input.selectionStart = input.selectionEnd = start + latexStr.length;
      input.focus();
    }, 0);
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
      style={{ zIndex: isSelected ? 100 : 2 }}
      onPointerDown={isEditing ? undefined : onPointerDown}
      onContextMenu={onContextMenu}
      onDoubleClick={handleDoubleClick}
      onClick={(e) => e.stopPropagation()}
    >
      {isEditing ? (
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
          {/* Barra de botones rápidos */}
          <div className="flex flex-wrap gap-1">
            {quickInserts.map((item) => (
              <button
                key={item.label}
                onMouseDown={(e) => {
                  e.preventDefault(); // Evita que el textarea pierda el foco
                  insertLatex(item.latex);
                }}
                title={item.title}
                className="px-2 py-1 text-xs font-mono bg-purple-50 text-purple-700
                         rounded-lg hover:bg-purple-100 transition-colors border border-purple-200/50"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Input de LaTeX */}
          <textarea
            ref={inputRef}
            value={latex}
            onChange={(e) => setLatex(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="Escribe LaTeX: \frac{1}{2}"
            className="math-input w-full px-3 py-2 border border-purple-200 rounded-lg
                     bg-white text-slate-700 focus:ring-2 focus:ring-purple-300 focus:border-transparent"
            rows={2}
          />

          {/* Vista previa en vivo */}
          {latex.trim() && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 mb-1 font-semibold uppercase">Vista previa</p>
              <div
                className="text-center"
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
            </div>
          )}
        </div>
      ) : (
        <div ref={renderRef}>
          {latex.trim() ? (
            <div
              className="katex-display-container"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          ) : (
            <p className="text-slate-400 text-sm italic">
              Doble clic para escribir fórmula...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
