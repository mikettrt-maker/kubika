import { useEffect, useRef, useState } from 'react';
import ePub from 'epubjs';

export default function EpubReader({ libro, onBack, startPage }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bookTitle, setBookTitle] = useState('');
  const [bookAuthor, setBookAuthor] = useState('');
  const [percentage, setPercentage] = useState(0);
  const [currentCfi, setCurrentCfi] = useState(null);

  const viewerRef = useRef(null);
  const bookRef = useRef(null);
  const renditionRef = useRef(null);

  // Construir URL absoluta del EPUB
  const epubUrl = (() => {
    if (libro.epub.startsWith('http')) return libro.epub;
    const base = window.location.origin + window.location.pathname.replace(/\/$/, '');
    return base + '/' + libro.epub.replace(/^\//, '');
  })();

  // Guardar progreso en localStorage (usando CFI, más preciso que índice)
  useEffect(() => {
    if (currentCfi && libro?.id) {
      try {
        const data = JSON.parse(localStorage.getItem('kubika_progress') || '{}');
        data[libro.id] = {
          cfi: currentCfi,
          pct: percentage,
          titulo: libro.titulo,
          portada: libro.portada,
          epub: libro.epub,
          autor: libro.autor,
          categoria: libro.categoria,
          edad: libro.edad,
          descripcion: libro.descripcion,
        };
        localStorage.setItem('kubika_progress', JSON.stringify(data));
        localStorage.setItem('kubika_last_book', String(libro.id));
      } catch (e) {
        // silencioso
      }
    }
  }, [currentCfi, percentage, libro?.id]);

  // Cargar y renderizar el libro con epub.js
  useEffect(() => {
    if (!viewerRef.current) return;

    let cancelled = false;
    let book = null;
    let rendition = null;

    setLoading(true);
    setError(null);
    setPercentage(0);
    setCurrentCfi(null);

    (async () => {
      try {
        // 1) Descargamos el EPUB como ArrayBuffer (clave para que las imágenes
        //    funcionen: así epub.js sabe que es un ZIP y convierte src a blob:/base64:)
        const res = await fetch(epubUrl);
        if (!res.ok) throw new Error('HTTP ' + res.status + ' al descargar el libro');
        const buffer = await res.arrayBuffer();
        if (cancelled) return;

        // 2) Abrimos el libro forzando el tipo 'epub' y reemplazos en base64.
        book = ePub(buffer, { openAs: 'epub', replacements: 'base64' });
        bookRef.current = book;

        rendition = book.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          spread: 'none',
        });
        renditionRef.current = rendition;

        // Estilos globales para que las imágenes no desborden el ancho
        rendition.themes.default({
          body: {
            'font-size': '1rem',
            'line-height': '1.7',
          },
          img: {
            'max-width': '100% !important',
            height: 'auto',
          },
        });

        // 3) Recuperar progreso guardado si hay startPage > 0
        let startCfi;
        if (startPage > 0) {
          try {
            const data = JSON.parse(localStorage.getItem('kubika_progress') || '{}');
            startCfi = data[libro.id]?.cfi;
          } catch (e) {
            startCfi = null;
          }
        }

        await book.ready;
        if (cancelled) return;

        setBookTitle(book.packaging.metadata.title || libro.titulo);
        setBookAuthor(book.packaging.metadata.creator || libro.autor);

        // Evento: ubicación actual cambia (usado para progreso y %)
        rendition.on('relocated', (loc) => {
          setCurrentCfi(loc.start.cfi);
          try {
            if (book.locations && book.locations.length() > 0) {
              const pct = book.locations.percentageFromCfi(loc.start.cfi);
              setPercentage(Math.round((pct || 0) * 100));
            }
          } catch (e) {
            // locations aún no generadas
          }
        });

        // Evento: capítulo renderizado
        rendition.on('rendered', () => {
          if (!cancelled) setLoading(false);
        });

        // Navegación con teclado (flechas izquierda/derecha)
        rendition.on('keydown', (e) => {
          if (e.key === 'ArrowLeft') rendition.prev();
          if (e.key === 'ArrowRight') rendition.next();
        });

        // Mostrar el libro (desde el progreso guardado o desde el inicio)
        rendition.display(startCfi || undefined);

        // Generar ubicaciones en segundo plano (para calcular porcentaje)
        book.locations.generate(1600).catch(() => {});
      } catch (err) {
        console.error('EPUB error:', err);
        if (!cancelled) {
          setError(err.message || 'Error al cargar el libro');
          setLoading(false);
        }
      }
    })();

    // Cleanup al desmontar o cambiar de libro
    return () => {
      cancelled = true;
      try {
        rendition?.destroy();
      } catch (e) {}
      try {
        book?.destroy();
      } catch (e) {}
      bookRef.current = null;
      renditionRef.current = null;
    };
  }, [libro?.epub, libro?.id, startPage]);

  const goPrev = () => {
    renditionRef.current?.prev();
  };

  const goNext = () => {
    renditionRef.current?.next();
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Barra superior */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Volver
        </button>
        <div className="text-center min-w-0 mx-2">
          <h2 className="text-sm font-semibold text-slate-800 truncate max-w-[260px]">
            {bookTitle || libro.titulo}
          </h2>
          <p className="text-xs text-slate-400 truncate max-w-[260px]">
            {bookAuthor || libro.autor}
          </p>
        </div>
        <div className="w-16" />
      </div>

      {/* Visor del libro */}
      <div className="flex-1 overflow-hidden bg-white relative min-h-0">
        <div ref={viewerRef} className="w-full h-full" />

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center gap-3 bg-white/80 z-10">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Cargando libro...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
            <div className="text-center px-6">
              <p className="text-red-500 text-sm font-medium mb-2">Error al cargar el libro</p>
              <p className="text-slate-500 text-xs">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Barra inferior */}
      {!loading && !error && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 shrink-0">
          <button
            onClick={goPrev}
            className="px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            &lsaquo; Anterior
          </button>
          <span className="text-xs font-medium text-slate-500 tabular-nums">
            {percentage}%
          </span>
          <button
            onClick={goNext}
            className="px-5 py-1.5 text-sm font-semibold text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors"
          >
            Siguiente &rsaquo;
          </button>
        </div>
      )}
    </div>
  );
}
