import { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';

function parseXml(xmlStr) {
  const parser = new DOMParser();
  return parser.parseFromString(xmlStr, 'text/xml');
}

function getTextContent(node) {
  return node?.textContent?.trim() || '';
}

export default function EpubReader({ libro, onBack }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [content, setContent] = useState('');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [bookTitle, setBookTitle] = useState('');
  const [bookAuthor, setBookAuthor] = useState('');
  const spineRef = useRef([]);
  const manifestRef = useRef({});
  const zipRef = useRef(null);
  const destroyedRef = useRef(false);

  const epubUrl = (() => {
    if (libro.epub.startsWith('http')) return libro.epub;
    const base = window.location.origin + window.location.pathname.replace(/\/$/, '');
    return base + '/' + libro.epub.replace(/^\//, '');
  })();

  useEffect(() => {
    destroyedRef.current = false;
    setLoading(true);
    setError(null);
    setContent('');
    setCurrentIdx(0);
    setTotalItems(0);

    const loadEPUB = async () => {
      try {
        const res = await fetch(epubUrl);
        if (!res.ok) throw new Error('HTTP ' + res.status);

        const buffer = await res.arrayBuffer();
        if (destroyedRef.current) return;

        const zip = await JSZip.loadAsync(buffer);
        zipRef.current = zip;

        // Encontrar OPF desde container.xml
        const containerXml = await zip.file('META-INF/container.xml').async('string');
        const containerDoc = parseXml(containerXml);
        const rootfileEl = containerDoc.querySelector('rootfile');
        if (!rootfileEl) throw new Error('No se encontró rootfile en container.xml');
        const opfPath = rootfileEl.getAttribute('full-path');

        // Cargar OPF
        const opfXml = await zip.file(opfPath).async('string');
        const opfDoc = parseXml(opfXml);

        // Obtener título
        const titleEl = opfDoc.querySelector('title') || opfDoc.querySelector('dc\\:title');
        if (titleEl) setBookTitle(getTextContent(titleEl));

        // Obtener autor
        const authorEl = opfDoc.querySelector('creator') || opfDoc.querySelector('dc\\:creator');
        if (authorEl) setBookAuthor(getTextContent(authorEl));

        // Construir manifest
        const manifest = {};
        opfDoc.querySelectorAll('item').forEach(item => {
          const id = item.getAttribute('id');
          const href = item.getAttribute('href');
          const mediaType = item.getAttribute('media-type');
          if (id && href) manifest[id] = { href, mediaType };
        });
        manifestRef.current = manifest;

        // Construir spine (orden de lectura)
        const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);
        const spine = [];
        opfDoc.querySelectorAll('itemref').forEach(ref => {
          const idref = ref.getAttribute('idref');
          if (idref && manifest[idref]) {
            spine.push(opfDir + manifest[idref].href);
          }
        });
        spineRef.current = spine;
        setTotalItems(spine.length);

        if (destroyedRef.current) return;

        // Mostrar primer item
        if (spine.length > 0) {
          await showItem(0, zip, spine);
        }
        setLoading(false);
      } catch (err) {
        console.error('EPUB error:', err);
        if (!destroyedRef.current) {
          setError('Error: ' + (err.message || 'desconocido'));
          setLoading(false);
        }
      }
    };

    loadEPUB();

    return () => { destroyedRef.current = true; zipRef.current = null; };
  }, [libro.epub, libro.id]);

  const showItem = async (index, zip, spine) => {
    spine = spine || spineRef.current;
    if (!zip) zip = zipRef.current;
    if (!zip || index < 0 || index >= spine.length) return;

    try {
      const filePath = spine[index];
      let html = await zip.file(filePath).async('string');

      // Extraer solo el contenido del body (sin head/body tags)
      const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      if (match) {
        html = match[1];
      } else {
        // Si no hay body, usar todo el contenido
        html = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      }

      // Resolver rutas de imágenes y CSS dentro del EPUB
      const basePath = filePath.substring(0, filePath.lastIndexOf('/') + 1);
      html = html.replace(/(src|href)="([^"]+)"/g, (m, attr, path) => {
        if (path.startsWith('http') || path.startsWith('data:')) return m;
        const resolved = basePath + path;
        return attr + '="' + resolved + '"';
      });

      setContent(html);
      setCurrentIdx(index);
    } catch (err) {
      setContent('<p style="color:red">Error al cargar esta página.</p>');
    }
  };

  const goPrev = () => {
    if (currentIdx > 0) showItem(currentIdx - 1);
  };

  const goNext = () => {
    if (currentIdx < spineRef.current.length - 1) showItem(currentIdx + 1);
  };

  const progress = totalItems > 0 ? Math.round(((currentIdx + 1) / totalItems) * 100) : 0;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
        <div className="text-center min-w-0 mx-2">
          <h2 className="text-sm font-semibold text-slate-800 truncate max-w-[260px]">{bookTitle || libro.titulo}</h2>
          <p className="text-xs text-slate-400 truncate max-w-[260px]">{bookAuthor || libro.autor}</p>
        </div>
        <a href={epubUrl} download
          className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          EPUB
        </a>
      </div>

      <div className="flex-1 overflow-y-auto bg-white px-6 py-8 leading-relaxed text-slate-800 text-base">
        {loading && (
          <div className="flex items-center justify-center gap-3 py-20">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Cargando libro...</p>
          </div>
        )}
        {error && (
          <div className="text-center py-20">
            <p className="text-red-500 text-sm font-medium">{error}</p>
          </div>
        )}
        {!loading && !error && (
          <div className="max-w-2xl mx-auto" dangerouslySetInnerHTML={{ __html: content }} />
        )}
      </div>

      {!loading && !error && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 shrink-0">
          <button onClick={goPrev} disabled={currentIdx === 0}
            className="px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:text-slate-300 disabled:cursor-default hover:bg-slate-100 rounded-lg transition-colors">
            &lsaquo; Anterior
          </button>
          <span className="text-xs font-medium text-slate-500">{progress}% &middot; Pág {currentIdx + 1}/{totalItems}</span>
          <button onClick={goNext} disabled={currentIdx >= totalItems - 1}
            className="px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:text-slate-300 disabled:cursor-default hover:bg-slate-100 rounded-lg transition-colors">
            Siguiente &rsaquo;
          </button>
        </div>
      )}
    </div>
  );
}
