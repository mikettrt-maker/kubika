import { useEffect, useRef, useState, useCallback } from 'react';

export default function EpubReader({ libro, onBack }) {
  const viewerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [epubReady, setEpubReady] = useState(false);
  const [viewerHeight, setViewerHeight] = useState(600);
  const renditionRef = useRef(null);
  const bookRef = useRef(null);
  const containerRef = useRef(null);

  // Cargar epubjs desde CDN
  useEffect(() => {
    if (window.ePub) { setEpubReady(true); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/epubjs@0.3/dist/epub.min.js';
    script.onload = () => setEpubReady(true);
    script.onerror = () => setError('No se pudo cargar el lector EPUB');
    document.body.appendChild(script);
    return () => { if (script.parentNode) document.body.removeChild(script); };
  }, []);

  // Medir altura del contenedor
  const measureHeight = useCallback(() => {
    if (containerRef.current) {
      setViewerHeight(containerRef.current.clientHeight - 8);
    }
  }, []);

  useEffect(() => {
    measureHeight();
    window.addEventListener('resize', measureHeight);
    return () => window.removeEventListener('resize', measureHeight);
  }, [measureHeight]);

  useEffect(() => {
    if (!epubReady || !viewerRef.current || viewerHeight < 100) return;
    setLoading(true);
    setError(null);
    setProgress(0);

    try {
      const book = window.ePub(libro.epub);
      bookRef.current = book;

      const rendition = book.renderTo(viewerRef.current, {
        width: '100%',
        height: viewerHeight,
        spread: 'none',
        flow: 'paginated',
      });
      renditionRef.current = rendition;

      rendition.display().then(() => {
        setLoading(false);
      }).catch((err) => {
        setError('Error al cargar el libro: ' + (err.message || 'desconocido'));
        setLoading(false);
      });

      rendition.on('relocated', (location) => {
        if (location.start.percentage != null) {
          setProgress(Math.round(location.start.percentage * 100));
        }
      });
    } catch (err) {
      setError('Error al iniciar el libro: ' + (err.message || 'desconocido'));
      setLoading(false);
    }

    return () => {
      try { renditionRef.current?.destroy(); } catch {}
      try { bookRef.current?.destroy(); } catch {}
      renditionRef.current = null;
      bookRef.current = null;
    };
  }, [libro.epub, libro.id, epubReady, viewerHeight]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.contentRect.height - 100;
        if (h > 200) setViewerHeight(h);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handlePrev = () => renditionRef.current?.prev();
  const handleNext = () => renditionRef.current?.next();

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
        <div className="text-center">
          <h2 className="text-sm font-semibold text-slate-800 truncate max-w-[300px]">{libro.titulo}</h2>
          <p className="text-xs text-slate-400">{libro.autor}</p>
        </div>
        <a
          href={libro.epub}
          download
          className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          EPUB
        </a>
      </div>

      <div ref={containerRef} className="flex-1 overflow-hidden bg-slate-100 relative min-h-0">
        <div ref={viewerRef} className="absolute inset-0 flex items-center justify-center" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center gap-3 bg-slate-100 z-10">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Cargando libro...</p>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-100">
            <div className="text-center px-8 max-w-md">
              <p className="text-red-500 text-sm font-medium">{error}</p>
              <p className="text-xs text-slate-400 mt-1">Verificá que el archivo EPUB exista en la ruta indicada</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 shrink-0">
        <button
          onClick={handlePrev}
          className="px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          &lsaquo; Anterior
        </button>
        <span className="text-xs font-medium text-slate-500">{progress}%</span>
        <button
          onClick={handleNext}
          className="px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          Siguiente &rsaquo;
        </button>
      </div>
    </div>
  );
}
