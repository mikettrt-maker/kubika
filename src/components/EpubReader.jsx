import { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';

export default function EpubReader({ libro, onBack }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [content, setContent] = useState('');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [bookTitle, setBookTitle] = useState('');
  const [bookAuthor, setBookAuthor] = useState('');
  const spineRef = useRef([]);
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

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(epubUrl);
        if (!res.ok) throw new Error('HTTP ' + res.status + ' al descargar el libro');
        const buffer = await res.arrayBuffer();
        if (cancelled || destroyedRef.current) return;

        const zip = await JSZip.loadAsync(buffer);
        if (cancelled || destroyedRef.current) return;
        zipRef.current = zip;

        // Leer container.xml
        const containerFile = zip.file('META-INF/container.xml');
        if (!containerFile) throw new Error('No se encontró META-INF/container.xml');
        const containerXml = await containerFile.async('string');
        if (cancelled) return;

        // Extraer ruta del OPF
        const opfMatch = containerXml.match(/rootfile\s+full-path\s*=\s*"([^"]+)"/i);
        if (!opfMatch) throw new Error('No se encontró rootfile en container.xml');
        const opfPath = opfMatch[1];

        // Leer OPF
        const opfFile = zip.file(opfPath);
        if (!opfFile) throw new Error('No se encontró ' + opfPath);
        const opfXml = await opfFile.async('string');
        if (cancelled) return;

        // Extraer título
        const titleMatch = opfXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
        if (titleMatch) setBookTitle(titleMatch[1].trim());
        
        // Extraer autor
        const authorMatch = opfXml.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
        if (authorMatch) setBookAuthor(authorMatch[1].trim());

        // Extraer manifest (id -> href)
        const manifest = {};
        const itemRegex = /<item\s[^>]*\/?>/gi;
        let m;
        while ((m = itemRegex.exec(opfXml)) !== null) {
          const idMatch = m[0].match(/id\s*=\s*"([^"]+)"/i);
          const hrefMatch = m[0].match(/href\s*=\s*"([^"]+)"/i);
          if (idMatch && hrefMatch) manifest[idMatch[1]] = hrefMatch[1];
        }

        // Extraer spine (orden de lectura)
        const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);
        const spine = [];
        const itemrefRegex = /<itemref\s[^>]*\/?>/gi;
        while ((m = itemrefRegex.exec(opfXml)) !== null) {
          const idrefMatch = m[0].match(/idref\s*=\s*"([^"]+)"/i);
          if (idrefMatch && manifest[idrefMatch[1]]) {
            spine.push(opfDir + manifest[idrefMatch[1]]);
          }
        }

        if (spine.length === 0) throw new Error('No se encontraron páginas en el libro');
        spineRef.current = spine;
        setTotalItems(spine.length);

        if (cancelled || destroyedRef.current) return;

        // Mostrar primera página
        await loadPage(0, zip, spine);
        if (!cancelled && !destroyedRef.current) setLoading(false);
      } catch (err) {
        console.error('EPUB error:', err);
        if (!cancelled && !destroyedRef.current) {
          setError(err.message || 'Error desconocido');
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; destroyedRef.current = true; zipRef.current = null; };
  }, [libro.epub, libro.id]);

  const loadPage = async (index, zip, spine) => {
    spine = spine || spineRef.current;
    zip = zip || zipRef.current;
    if (!zip || index < 0 || index >= spine.length) return;

    try {
      const filePath = spine[index];
      const file = zip.file(filePath);
      if (!file) throw new Error('Archivo no encontrado: ' + filePath);

      let html = await file.async('string');

      // Extraer contenido del body
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const bodyContent = bodyMatch ? bodyMatch[1] : html;

      // Resolver rutas relativas de imágenes
      const basePath = filePath.substring(0, filePath.lastIndexOf('/') + 1);
      const resolved = bodyContent.replace(/(src|href)\s*=\s*"([^"]+)"/gi, (m, attr, path) => {
        if (path.startsWith('http') || path.startsWith('data:') || path.startsWith('#')) return m;
        const fullPath = basePath + path;
        return attr + '="' + fullPath + '"';
      });

      setContent(resolved);
      setCurrentIdx(index);
    } catch (err) {
      setContent('<p style="color:red;padding:20px">Error al cargar esta página.</p>');
    }
  };

  const goPrev = () => { if (currentIdx > 0) loadPage(currentIdx - 1); };
  const goNext = () => { if (currentIdx < spineRef.current.length - 1) loadPage(currentIdx + 1); };

  const pct = totalItems > 0 ? Math.round(((currentIdx + 1) / totalItems) * 100) : 0;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg> Volver
        </button>
        <div className="text-center min-w-0 mx-2">
          <h2 className="text-sm font-semibold text-slate-800 truncate max-w-[260px]">{bookTitle || libro.titulo}</h2>
          <p className="text-xs text-slate-400 truncate max-w-[260px]">{bookAuthor || libro.autor}</p>
        </div>
        <a href={epubUrl} download
          className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg> EPUB
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
          <span className="text-xs font-medium text-slate-500">{pct}% &middot; {currentIdx + 1}/{totalItems}</span>
          <button onClick={goNext} disabled={currentIdx >= totalItems - 1}
            className="px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:text-slate-300 disabled:cursor-default hover:bg-slate-100 rounded-lg transition-colors">
            Siguiente &rsaquo;
          </button>
        </div>
      )}
    </div>
  );
}
