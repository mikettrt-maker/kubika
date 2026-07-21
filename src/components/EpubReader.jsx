import { useEffect, useRef, useState } from 'react';
import ePub from 'epubjs';

export default function EpubReader({ libro, onBack }) {
  const viewerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [viewerHeight, setViewerHeight] = useState(600);
  const renditionRef = useRef(null);
  const bookRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!viewerRef.current) return;
    setLoading(true);
    setError(null);
    setProgress(0);

    const book = ePub(libro.epub);
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
    }).catch(() => {
      setError('Error al cargar el libro');
      setLoading(false);
    });

    rendition.on('relocated', (location) => {
      if (location.start.percentage != null) {
        setProgress(Math.round(location.start.percentage * 100));
      }
    });

    return () => {
      try { rendition.destroy(); } catch {}
      try { book.destroy(); } catch {}
      renditionRef.current = null;
      bookRef.current = null;
    };
  }, [libro.epub, libro.id, viewerHeight]);

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

      <div ref={containerRef} className="flex-1 overflow-hidden bg-slate-100 flex items-center justify-center min-h-0">
        {loading && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Cargando libro...</p>
          </div>
        )}
        {error && (
          <div className="text-center px-8">
            <p className="text-red-500 text-sm font-medium">{error}</p>
            <p className="text-xs text-slate-400 mt-1">Verificá que el archivo EPUB exista en la ruta indicada</p>
          </div>
        )}
        <div ref={viewerRef} className={`${loading || error ? 'hidden' : ''} w-full flex items-center justify-center`} />
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
