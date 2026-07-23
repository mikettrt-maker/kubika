import { useEffect, useRef, useState } from 'react';

export default function EpubReader({ libro, onBack }) {
  const viewerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const renditionRef = useRef(null);
  const bookRef = useRef(null);
  const destroyedRef = useRef(false);

  const epubUrl = (() => {
    if (libro.epub.startsWith('http')) return libro.epub;
    const base = window.location.origin + window.location.pathname.replace(/\/$/, '');
    return base + '/' + libro.epub.replace(/^\//, '');
  })();

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (!window.ePub) {
      setError('El lector EPUB no está disponible');
      setLoading(false);
      return;
    }

    destroyedRef.current = false;
    setLoading(true);
    setError(null);
    setProgress(0);

    const h = viewer.clientHeight || 600;

    fetch(epubUrl)
      .then(res => {
        if (destroyedRef.current) return null;
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.arrayBuffer();
      })
      .then(buffer => {
        if (destroyedRef.current || !buffer) return;

        const book = window.ePub(buffer);
        bookRef.current = book;

        const rendition = book.renderTo(viewer, {
          width: '100%',
          height: h,
          spread: 'none',
          flow: 'paginated',
        });
        renditionRef.current = rendition;

        rendition.on('relocated', (location) => {
          if (location.start.percentage != null) {
            setProgress(Math.round(location.start.percentage * 100));
          }
        });

        return rendition.display();
      })
      .then(() => {
        if (!destroyedRef.current) setLoading(false);
      })
      .catch((err) => {
        if (!destroyedRef.current) {
          setError('Error: ' + (err.message || 'desconocido'));
          setLoading(false);
        }
      });

    return () => {
      destroyedRef.current = true;
      try { renditionRef.current?.destroy(); } catch {}
      try { bookRef.current?.destroy(); } catch {}
      renditionRef.current = null;
      bookRef.current = null;
    };
  }, [libro.epub, libro.id]);

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
          href={epubUrl}
          download
          className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          EPUB
        </a>
      </div>

      <div className="flex-1 overflow-hidden bg-slate-100 relative min-h-0">
        <div ref={viewerRef} className="absolute inset-0" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center gap-3 bg-slate-100 z-10">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Cargando libro...</p>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
            <div className="text-center px-8 max-w-md">
              <p className="text-red-500 text-sm font-medium">{error}</p>
              <p className="text-xs text-slate-400 mt-2">URL: {libro.epub}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 shrink-0">
        <button
          onClick={() => renditionRef.current?.prev()}
          className="px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          &lsaquo; Anterior
        </button>
        <span className="text-xs font-medium text-slate-500">{progress}%</span>
        <button
          onClick={() => renditionRef.current?.next()}
          className="px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          Siguiente &rsaquo;
        </button>
      </div>
    </div>
  );
}
