import { useEffect, useRef, useState, useCallback } from 'react';
import ePub from 'epubjs';

const PEN_COLORS = [
  { name: 'Negro', value: '#1a1a1a' },
  { name: 'Gris oscuro', value: '#4b5563' },
  { name: 'Gris', value: '#9ca3af' },
  { name: 'Blanco', value: '#ffffff' },
  { name: 'Rojo oscuro', value: '#991b1b' },
  { name: 'Rojo', value: '#dc2626' },
  { name: 'Rojo claro', value: '#f87171' },
  { name: 'Rosa', value: '#ec4899' },
  { name: 'Morado', value: '#9333ea' },
  { name: 'Azul oscuro', value: '#1e40af' },
  { name: 'Azul', value: '#2563eb' },
  { name: 'Azul claro', value: '#60a5fa' },
  { name: 'Celeste', value: '#22d3ee' },
  { name: 'Turquesa', value: '#14b8a6' },
  { name: 'Verde oscuro', value: '#166534' },
  { name: 'Verde', value: '#16a34a' },
  { name: 'Verde claro', value: '#4ade80' },
  { name: 'Amarillo', value: '#eab308' },
  { name: 'Naranja', value: '#ea580c' },
  { name: 'Marrón', value: '#a16207' },
];

const TOOLS = {
  PEN: 'pen',
  LINE: 'line',
  ERASER: 'eraser',
  PIVOT: 'pivot',
  FORMULA: 'formula',
};

function getUserId() {
  try {
    return JSON.parse(localStorage.getItem('kubika_local_user') || '{}')?.id || 'anon';
  } catch {
    return 'anon';
  }
}

function saveCanvasState(userId, bookId, cfi, dataUrl) {
  try {
    const key = `kubika_math_${userId}_${bookId}_${cfi}`;
    localStorage.setItem(key, dataUrl);
  } catch {}
}

function loadCanvasState(userId, bookId, cfi) {
  try {
    const key = `kubika_math_${userId}_${bookId}_${cfi}`;
    return localStorage.getItem(key) || null;
  } catch {
    return null;
  }
}

export default function EpubMathReader({ libro, onBack, startPage }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bookTitle, setBookTitle] = useState('');
  const [percentage, setPercentage] = useState(0);
  const [currentCfi, setCurrentCfi] = useState(null);

  const [activeTool, setActiveTool] = useState(TOOLS.PEN);
  const [penColor, setPenColor] = useState(PEN_COLORS[1].value);
  const [penSize, setPenSize] = useState(3);
  const [showToolbar, setShowToolbar] = useState(true);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFormulaInput, setShowFormulaInput] = useState(false);
  const [formulaText, setFormulaText] = useState('');

  const viewerRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const bookRef = useRef(null);
  const renditionRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef(null);
  const lineStart = useRef(null);

  const epubUrl = (() => {
    if (libro.epub.startsWith('http')) return libro.epub;
    const base = window.location.origin + window.location.pathname.replace(/\/$/, '');
    return base + '/' + libro.epub.replace(/^\//, '');
  })();

  const userId = getUserId();

  const saveProgress = (cfi, pct) => {
    try {
      const data = JSON.parse(localStorage.getItem('kubika_progress') || '{}');
      data[libro.id] = {
        cfi,
        pct,
        titulo: libro.titulo,
        portada: libro.portada,
        epub: libro.epub,
      };
      localStorage.setItem('kubika_progress', JSON.stringify(data));
      localStorage.setItem('kubika_last_book', String(libro.id));
    } catch {}
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (currentCfi) {
      saveCanvasState(userId, libro.id, currentCfi, canvas.toDataURL());
    }
  };

  const saveCurrentCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !currentCfi) return;
    saveCanvasState(userId, libro.id, currentCfi, canvas.toDataURL());
  };

  const loadCurrentCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentCfi) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const saved = loadCanvasState(userId, libro.id, currentCfi);
    if (saved) {
      const img = new Image();
      img.onload = () => {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = saved;
    }
  }, [userId, libro.id, currentCfi]);

  const getCanvasPoint = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startDrawing = (e) => {
    if (activeTool === TOOLS.FORMULA) return;
    e.preventDefault();
    isDrawing.current = true;
    const point = getCanvasPoint(e);
    lastPoint.current = point;

    if (activeTool === TOOLS.LINE || activeTool === TOOLS.PIVOT) {
      lineStart.current = point;
    }
  };

  const draw = (e) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const point = getCanvasPoint(e);

    if (activeTool === TOOLS.PEN) {
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(point.x, point.y);
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      lastPoint.current = point;
    } else if (activeTool === TOOLS.ERASER) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(point.x, point.y, penSize * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      lastPoint.current = point;
    } else if (activeTool === TOOLS.LINE || activeTool === TOOLS.PIVOT) {
      const saved = loadCanvasState(userId, libro.id, currentCfi);
      if (saved) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          drawLinePreview(ctx, lineStart.current, point);
        };
        img.src = saved;
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawLinePreview(ctx, lineStart.current, point);
      }
    }
  };

  const drawLinePreview = (ctx, from, to) => {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = activeTool === TOOLS.PIVOT ? '#9333ea' : penColor;
    ctx.lineWidth = activeTool === TOOLS.PIVOT ? 2 : penSize;
    ctx.setLineDash(activeTool === TOOLS.PIVOT ? [6, 4] : []);
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.setLineDash([]);

    if (activeTool === TOOLS.PIVOT) {
      ctx.beginPath();
      ctx.arc(from.x, from.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#9333ea';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(to.x, to.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const stopDrawing = (e) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const point = getCanvasPoint(e.changedTouches ? e.changedTouches[0] : e);

    if (activeTool === TOOLS.LINE || activeTool === TOOLS.PIVOT) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const saved = loadCanvasState(userId, libro.id, currentCfi);
      if (saved) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          drawLinePreview(ctx, lineStart.current, point);
          saveCurrentCanvas();
        };
        img.src = saved;
      } else {
        drawLinePreview(ctx, lineStart.current, point);
        saveCurrentCanvas();
      }
    } else {
      saveCurrentCanvas();
    }
    lastPoint.current = null;
    lineStart.current = null;
  };

  const insertFormula = () => {
    if (!formulaText.trim()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const x = canvas.width / 2;
    const y = canvas.height / 2;

    ctx.font = '20px "Times New Roman", serif';
    ctx.fillStyle = '#1a1a1a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lines = formulaText.split('\n');
    lines.forEach((line, i) => {
      ctx.fillText(line, x, y + i * 28);
    });

    saveCurrentCanvas();
    setFormulaText('');
    setShowFormulaInput(false);
  };

  useEffect(() => {
    if (!viewerRef.current) {
      console.error('[EpubMathReader] viewerRef.current is null, aborting');
      return;
    }
    let cancelled = false;
    let book = null;
    let rendition = null;

    setLoading(true);
    setError(null);

    console.log('[EpubMathReader] epubUrl:', epubUrl);

    (async () => {
      try {
        const res = await fetch(epubUrl);
        console.log('[EpubMathReader] fetch status:', res.status, res.url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const buffer = await res.arrayBuffer();
        if (cancelled) return;

        const blob = new Blob([buffer]);
        const cleanBuffer = await blob.arrayBuffer();

        book = ePub(cleanBuffer, { replacements: 'base64' });
        bookRef.current = book;

        try {
          book.spine.hooks.content.register((doc) => {
            try {
              doc.querySelectorAll('img, image, source').forEach(el => {
                const attr = el.tagName.toLowerCase() === 'image' ? 'xlink:href' : 'src';
                const val = el.getAttribute(attr);
                if (val && val.indexOf('%') > -1) {
                  try { el.setAttribute(attr, decodeURIComponent(val)); } catch {}
                }
              });
            } catch {}
          });
        } catch {}

        rendition = book.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          spread: 'none',
          allowScriptedContent: true,
        });
        renditionRef.current = rendition;

        await book.ready;
        await book.opened;
        if (cancelled) return;

        setBookTitle(book.packaging.metadata.title || libro.titulo);

        let startCfi;
        if (startPage > 0) {
          try {
            const data = JSON.parse(localStorage.getItem('kubika_progress') || '{}');
            startCfi = data[libro.id]?.cfi;
          } catch {}
        }

        if (startCfi) {
          await rendition.display(startCfi);
        } else {
          await rendition.display();
        }

        rendition.on('relocated', (location) => {
          if (cancelled) return;
          const cfi = location.start.cfi;
          const pct = book.locations?.percentageFromCfi(cfi) || 0;
          setCurrentCfi(cfi);
          setPercentage(Math.round(pct * 100));
          saveProgress(cfi, Math.round(pct * 100));

          setTimeout(() => loadCurrentCanvas(), 100);
        });

        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (rendition) {
        try { rendition.destroy(); } catch {}
      }
      if (book) {
        try { book.destroy(); } catch {}
      }
    };
  }, [epubUrl, libro.titulo, libro.id, startPage]);

  useEffect(() => {
    loadCurrentCanvas();
  }, [currentCfi, loadCurrentCanvas]);

  const goNext = () => renditionRef.current?.next();
  const goPrev = () => renditionRef.current?.prev();

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-white shrink-0 z-30">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
        <span className="text-xs text-slate-500 truncate max-w-[200px]">{bookTitle || libro.titulo}</span>
        <span className="text-xs text-slate-400">{percentage}%</span>
      </div>

      {/* Toolbar - only show when not loading/error */}
      {!loading && !error && showToolbar && (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-100 bg-slate-50 shrink-0 z-20 flex-wrap">
          <button
            onClick={() => setActiveTool(TOOLS.PEN)}
            className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${activeTool === TOOLS.PEN ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-200'}`}
            title="Plumón"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={() => setActiveTool(TOOLS.LINE)}
            className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${activeTool === TOOLS.LINE ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-200'}`}
            title="Línea"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 20L20 4" />
            </svg>
          </button>
          <button
            onClick={() => setActiveTool(TOOLS.PIVOT)}
            className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${activeTool === TOOLS.PIVOT ? 'bg-purple-100 text-purple-700' : 'text-slate-500 hover:bg-slate-200'}`}
            title="Pivote"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="5" />
            </svg>
          </button>
          <button
            onClick={() => setActiveTool(TOOLS.ERASER)}
            className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${activeTool === TOOLS.ERASER ? 'bg-red-100 text-red-700' : 'text-slate-500 hover:bg-slate-200'}`}
            title="Borrador"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>

          <div className="w-px h-5 bg-slate-200 mx-1" />

          {/* Color picker */}
          <div className="relative">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
              style={{ backgroundColor: penColor }}
              title="Color"
            />
            {showColorPicker && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border p-2 z-50" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', width: '160px' }}>
                {PEN_COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => { setPenColor(c.value); setShowColorPicker(false); }}
                    className="w-6 h-6 rounded-full border-2 hover:scale-110 transition-transform mx-auto"
                    style={{ backgroundColor: c.value, borderColor: penColor === c.value ? '#4f46e5' : '#e2e8f0' }}
                    title={c.name}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pen size */}
          <input
            type="range"
            min="1"
            max="8"
            value={penSize}
            onChange={(e) => setPenSize(Number(e.target.value))}
            className="w-16 h-1 accent-indigo-500"
            title="Grosor"
          />

          <div className="w-px h-5 bg-slate-200 mx-1" />

          <button
            onClick={() => setShowFormulaInput(!showFormulaInput)}
            className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${showFormulaInput ? 'bg-amber-100 text-amber-700' : 'text-slate-500 hover:bg-slate-200'}`}
            title="Fórmula"
          >
            <span className="font-serif italic text-sm">fx</span>
          </button>

          <button
            onClick={clearCanvas}
            className="p-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Limpiar todo"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Formula input */}
      {showFormulaInput && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border-b border-amber-200 shrink-0 z-20">
          <input
            type="text"
            value={formulaText}
            onChange={(e) => setFormulaText(e.target.value)}
            placeholder="Escribe la fórmula (ej: 1/2 + 3/4)"
            className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-300"
            onKeyDown={(e) => e.key === 'Enter' && insertFormula()}
          />
          <button onClick={insertFormula} className="px-3 py-1.5 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600">
            Insertar
          </button>
        </div>
      )}

      {/* EPUB + Canvas overlay — always rendered so viewerRef.current exists */}
      <div className="flex-1 relative overflow-hidden" ref={overlayRef}>
        <div ref={viewerRef} className="absolute inset-0" />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 z-10"
          style={{ touchAction: 'none', pointerEvents: loading ? 'none' : 'auto' }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/90">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500 mt-3">Cargando libro...</p>
          </div>
        )}
        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/90 gap-3">
            <p className="text-red-500 text-sm">{error}</p>
            <button onClick={onBack} className="text-sm text-indigo-600 underline">Volver</button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 bg-white shrink-0 z-30">
        <button onClick={goPrev} className="p-2 text-slate-400 hover:text-slate-700 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="w-full mx-4 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${percentage}%` }} />
        </div>
        <button onClick={goNext} className="p-2 text-slate-400 hover:text-slate-700 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Toggle toolbar */}
      {!loading && !error && (
        <button
          onClick={() => setShowToolbar(!showToolbar)}
          className="absolute top-12 right-2 z-40 p-1.5 rounded-full bg-white shadow-md border text-slate-500 hover:text-slate-700"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showToolbar ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </button>
      )}
    </div>
  );
}
