import { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';

export default function EpubReader({ libro, onBack, startPage }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [content, setContent] = useState('');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [bookTitle, setBookTitle] = useState('');
  const [bookAuthor, setBookAuthor] = useState('');
  const [showCover, setShowCover] = useState(true);
  const spineRef = useRef([]);
  const zipRef = useRef(null);
  const destroyedRef = useRef(false);
  const contentRef = useRef(null);

  useEffect(() => { contentRef.current?.scrollTo(0, 0); }, [currentIdx, showCover]);

  // Guardar progreso
  useEffect(() => {
    if (!showCover && currentIdx > 0) {
      try {
        const data = JSON.parse(localStorage.getItem('kubika_progress') || '{}');
        data[libro.id] = { page: currentIdx, titulo: libro.titulo, portada: libro.portada, epub: libro.epub, autor: libro.autor, categoria: libro.categoria, edad: libro.edad, descripcion: libro.descripcion };
        localStorage.setItem('kubika_progress', JSON.stringify(data));
      } catch {}
    }
  }, [currentIdx, showCover]);

  const epubUrl = (() => {
    if (libro.epub.startsWith('http')) return libro.epub;
    const base = window.location.origin + window.location.pathname.replace(/\/$/, '');
    return base + '/' + libro.epub.replace(/^\//, '');
  })();

  const portadaUrl = (() => {
    if (libro.portada.startsWith('http')) return libro.portada;
    const base = window.location.origin + window.location.pathname.replace(/\/$/, '');
    return base + '/' + libro.portada.replace(/^\//, '');
  })();

  useEffect(() => {
    destroyedRef.current = false;
    setLoading(true);
    setError(null);
    setContent('');
    setCurrentIdx(0);
    setTotalItems(0);
    setShowCover(true);

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

        const containerFile = zip.file('META-INF/container.xml');
        if (!containerFile) throw new Error('No se encontró META-INF/container.xml');
        const containerXml = await containerFile.async('string');
        if (cancelled) return;

        const opfMatch = containerXml.match(/rootfile\s+full-path\s*=\s*"([^"]+)"/i);
        if (!opfMatch) throw new Error('No se encontró rootfile en container.xml');
        const opfPath = opfMatch[1];

        const opfFile = zip.file(opfPath);
        if (!opfFile) throw new Error('No se encontró ' + opfPath);
        const opfXml = await opfFile.async('string');
        if (cancelled) return;

        const titleMatch = opfXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
        if (titleMatch) setBookTitle(titleMatch[1].trim());
        
        const authorMatch = opfXml.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
        if (authorMatch) setBookAuthor(authorMatch[1].trim());

        const manifest = {};
        const itemRegex = /<item\s[^>]*\/?>/gi;
        let m;
        while ((m = itemRegex.exec(opfXml)) !== null) {
          const idMatch = m[0].match(/id\s*=\s*"([^"]+)"/i);
          const hrefMatch = m[0].match(/href\s*=\s*"([^"]+)"/i);
          if (idMatch && hrefMatch) manifest[idMatch[1]] = hrefMatch[1];
        }

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

        if (startPage > 0) {
          await loadPage(startPage, zip, spine);
        } else {
          // Mostrar portada del catálogo como primera página
          setContent('<div class="flex items-center justify-center h-full min-h-[60vh]"><img src="' + portadaUrl + '" alt="' + libro.titulo + '" class="max-w-full max-h-[65vh] object-contain rounded-lg shadow-lg" /></div>');
          setCurrentIdx(0);
          setShowCover(true);
        }
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

    setShowCover(false);

    try {
      const filePath = spine[index];
      const file = zip.file(filePath);
      if (!file) {
        const nextIdx = index < spine.length - 1 ? index + 1 : index - 1;
        if (nextIdx !== index) loadPage(nextIdx, zip, spine);
        return;
      }

      let html = await file.async('string');

      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      let bodyContent = bodyMatch ? bodyMatch[1] : html;

      bodyContent = bodyContent.replace(/<img[^>]*>/gi, '');
      bodyContent = bodyContent.replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '');
      bodyContent = bodyContent.replace(/<a[^>]*>/gi, '');
      bodyContent = bodyContent.replace(/<\/a>/gi, '');

      const textContent = bodyContent.replace(/<[^>]+>/g, '').trim();
      if (!textContent && index < spine.length - 1) {
        loadPage(index + 1, zip, spine);
        return;
      }

      setContent(bodyContent);
      setCurrentIdx(index);
    } catch (err) {
      setContent('<p style="color:red;padding:20px">Error al cargar esta página.</p>');
    }
  };

  const goPrev = () => {
    if (showCover || currentIdx <= 0) return;
    let i = currentIdx - 1;
    const findPrev = (idx) => {
      if (idx < 0) return;
      const filePath = spineRef.current[idx];
      const file = zipRef.current.file(filePath);
      if (!file) { if (idx > 0) findPrev(idx - 1); return; }
      file.async('string').then(html => {
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        let body = bodyMatch ? bodyMatch[1] : html;
        body = body.replace(/<(img|svg|a)[^>]*>/gi, '').replace(/<\/(svg|a)>/gi, '').replace(/<[^>]+>/g, '').trim();
        if (body) loadPage(idx);
        else if (idx > 0) findPrev(idx - 1);
        else loadPage(0);
      });
    };
    findPrev(i);
  };
  const goNext = () => {
    if (showCover) {
      loadPage(0);
      return;
    }
    if (currentIdx >= spineRef.current.length - 1) return;
    loadPage(currentIdx + 1);
  };

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

      <div ref={contentRef} className="flex-1 overflow-y-auto bg-white px-6 py-8 leading-relaxed text-slate-800 text-2xl font-handwriting">
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
          <button onClick={goPrev} disabled={!showCover && currentIdx <= 0}
            className="px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:text-slate-300 disabled:cursor-default hover:bg-slate-100 rounded-lg transition-colors">
            &lsaquo; {showCover ? '' : 'Anterior'}
          </button>
          <span className="text-xs font-medium text-slate-500">{showCover ? 'Portada' : pct + '% · ' + (currentIdx + 1) + '/' + totalItems}</span>
          <button onClick={goNext} disabled={!showCover && currentIdx >= totalItems - 1}
            className="px-5 py-1.5 text-sm font-semibold text-white bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-default rounded-lg transition-colors">
            {showCover ? 'Comenzar a leer' : 'Siguiente'} &rsaquo;
          </button>
        </div>
      )}
    </div>
  );
}
