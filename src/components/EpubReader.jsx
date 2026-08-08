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

  const epubUrl = (() => {
    if (libro.epub.startsWith('http')) return libro.epub;
    const base = window.location.origin + window.location.pathname.replace(/\/$/, '');
    return base + '/' + libro.epub.replace(/^\//, '');
  })();

  useEffect(() => {
    if (currentCfi && libro?.id) {
      try {
        const data = JSON.parse(localStorage.getItem('kubika_progress') || '{}');
        data[libro.id] = {
          cfi: currentCfi,
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
      } catch (e) {}
    }
  }, [currentCfi, libro?.id]);

  useEffect(() => {
    if (!viewerRef.current) return;

    let cancelled = false;
    let book = null;
    let rendition = null;

    setLoading(true);
    setError(null);

    (async () => {
      try {
        // Descargar el EPUB
        const res = await fetch(epubUrl);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        
        const buffer = await res.arrayBuffer();
        if (cancelled) return;

        // SOLUCIÓN: Crear un nuevo ArrayBuffer "limpio" desde un Blob
        // Esto evita problemas con bundlers que transforman ArrayBuffers
        const blob = new Blob([buffer]);
        const cleanBuffer = await blob.arrayBuffer();

        // Crear el libro directamente con el buffer (sin .open())
        // epub.js detecta automáticamente que es un ArrayBuffer y lo trata como ZIP
        book = ePub(cleanBuffer, {
          replacements: 'base64',
        });
        
        bookRef.current = book;

        // Fix rutas con %20: muchos EPUB (ej. Capitán Calzoncillos) guardan
        // src como "../images/las%20aventuras....jpg" pero epubjs sustituye
        // comparando cadenas con espacios literales del manifest, así que no
        // reemplaza las imágenes y quedan en 404. Este hook decodifica los
        // atributos src antes de la serialización/sustitución.
        try {
          book.spine.hooks.content.register((doc) => {
            try {
              doc.querySelectorAll('img, image, source, audio, video').forEach(el => {
                const attr = el.tagName.toLowerCase() === 'image' ? 'xlink:href' : 'src';
                const val = el.getAttribute(attr);
                if (val && val.indexOf('%') > -1) {
                  try {
                    el.setAttribute(attr, decodeURIComponent(val));
                  } catch (e) {}
                }
              });
            } catch (e) {}
          });
        } catch (e) {}

        // Crear el rendition
        rendition = book.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          spread: 'none',
          allowScriptedContent: true,
        });
        
        renditionRef.current = rendition;

        // Estilos para que las imágenes no desborden
        rendition.themes.default({
          body: { 'font-size': '1rem', 'line-height': '1.7' },
          img: { 'max-width': '100% !important', height: 'auto' },
        });

        // Recuperar progreso guardado
        let startCfi;
        if (startPage > 0) {
          try {
            const data = JSON.parse(localStorage.getItem('kubika_progress') || '{}');
            startCfi = data[libro.id]?.cfi;
          } catch (e) {}
        }

        await book.ready;
        // book.opened se resuelve DESPUÉS de que epub.js genera los
        // reemplazos base64 de imágenes/CSS desde el zip. Sin esperarlo,
        // el texto se muestra pero las imágenes quedan con rutas 404.
        await book.opened;
        if (cancelled) return;

        setBookTitle(book.packaging.metadata.title || libro.titulo);
        setBookAuthor(book.packaging.metadata.creator || libro.autor);

        // Eventos
        rendition.on('relocated', (loc) => {
          setCurrentCfi(loc.start.cfi);
          if (book.locations.length() > 0) {
            const pct = book.locations.percentageFromCfi(loc.start.cfi);
            setPercentage(Math.round((pct || 0) * 100));
          }
        });

        rendition.on('rendered', () => {
          if (!cancelled) setLoading(false);
        });

        rendition.on('keydown', (e) => {
          if (e.key === 'ArrowLeft') rendition.prev();
          if (e.key === 'ArrowRight') rendition.next();
        });

        // Mostrar el libro
        rendition.display(startCfi || undefined);

        // Generar ubicaciones para el porcentaje
        book.locations.generate(1600).catch(() => {});
      } catch (err) {
        console.error('EPUB error:', err);
        if (!cancelled) {
          // err.message puede ser un ArrayBuffer (404 page) → convertir a string
          const msg = err && err.message ? String(err.message) : 'Error al cargar el libro';
          setError(msg);
          setLoading(false);
        }
      }
    })();

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

  const goPrev = () => renditionRef.current?.prev();
  const goNext = () => renditionRef.current?.next();

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