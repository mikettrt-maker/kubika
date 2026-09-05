import { useEffect, useRef, useState } from 'react';
import ePub from 'epubjs';
import { jsPDF } from 'jspdf';

const COLORS = [
  { name: 'Amarillo', value: '#FFE066' },
  { name: 'Rosa', value: '#FFB3C1' },
  { name: 'Verde', value: '#B7E4C7' },
  { name: 'Celeste', value: '#A9D7F5' },
];

function getUserId() {
  try {
    return JSON.parse(localStorage.getItem('kubika_local_user') || '{}')?.id || 'anon';
  } catch {
    return 'anon';
  }
}

function getStudentName() {
  try {
    const u = JSON.parse(localStorage.getItem('kubika_local_user') || '{}');
    return u?.user_metadata?.display_name || (u?.email || '').split('@')[0] || 'Alumno';
  } catch {
    return 'Alumno';
  }
}

function notesStorageKey(userId, libroId) {
  return 'kubika_notes_' + userId + '_' + String(libroId);
}

function loadNotes(userId, libroId) {
  try {
    const data = JSON.parse(localStorage.getItem(notesStorageKey(userId, libroId)) || '[]');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function persistNotes(userId, libroId, list) {
  try {
    localStorage.setItem(notesStorageKey(userId, libroId), JSON.stringify(list));
  } catch {}
}

function ratingsKey() {
  return 'kubika_ratings_' + getUserId();
}

function loadRatings() {
  try {
    const r = JSON.parse(localStorage.getItem(ratingsKey()) || '{}');
    return r && typeof r === 'object' ? r : {};
  } catch {
    return {};
  }
}

async function saveRating(bookId, stars) {
  try {
    const r = loadRatings();
    r[String(bookId)] = stars;
    localStorage.setItem(ratingsKey(), JSON.stringify(r));
  } catch {}
  try {
    const { supabase, isSupabaseConfigured } = await import('../config/supabase');
    if (isSupabaseConfigured) {
      await supabase
        .from('ratings')
        .upsert({
          user_id: getUserId(),
          book_id: String(bookId),
          stars,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,book_id' });
    }
  } catch (err) {
    console.error('Supabase rating falló:', err);
  }
}

export default function EpubReader({ libro, onBack, startPage, userId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bookTitle, setBookTitle] = useState('');
  const [bookAuthor, setBookAuthor] = useState('');
  const [percentage, setPercentage] = useState(0);
  const [currentCfi, setCurrentCfi] = useState(null);
  const [notes, setNotes] = useState([]);
  const [showNotes, setShowNotes] = useState(false);
  const [draft, setDraft] = useState(null);
  const [showFinish, setShowFinish] = useState(false);
  const [rating, setRating] = useState(0);

  const viewerRef = useRef(null);
  const bookRef = useRef(null);
  const renditionRef = useRef(null);
  const notesRef = useRef([]);

  const epubUrl = (() => {
    if (libro.epub.startsWith('http')) return libro.epub;
    const base = window.location.origin + window.location.pathname.replace(/\/$/, '');
    return base + '/' + libro.epub.replace(/^\//, '');
  })();

  const saveProgress = (cfi, pct) => {
    try {
      const data = JSON.parse(localStorage.getItem('kubika_progress') || '{}');
      data[libro.id] = {
        cfi,
        pct,
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
  };

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

        // Tipografía homogénea: fuente manuscrita (Caveat), un mismo tamaño en todo el libro
        // y fondo papel para dar forma de libro a la página
        rendition.themes.registerUrl('default', 'https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap');
        rendition.themes.default({
          body: {
            'font-family': "'Caveat', cursive",
            'font-size': '1.2rem',
            'line-height': '1.65',
            'background': '#ffffff',
            'color': '#33322e',
            'padding': '1.5rem 2.2rem',
          },
          '*': {
            'font-family': "'Caveat', cursive !important",
            'font-size': '1.2rem !important',
            'line-height': '1.65 !important',
            'color': '#33322e !important',
          },
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
        let finishedShown = false;
        rendition.on('relocated', (loc) => {
          setCurrentCfi(loc.start.cfi);
          if (book.locations.length() > 0) {
            const pct = Math.round((book.locations.percentageFromCfi(loc.start.cfi) || 0) * 100);
            setPercentage(pct);
            if (loc.atEnd) {
              // Terminó el libro: marcar 100% y mostrar pregunta de reflexión
              saveProgress(loc.start.cfi, 100);
              if (!finishedShown) {
                finishedShown = true;
                setShowFinish(true);
                setRating(loadRatings()[String(libro.id)] || 0);
                setPercentage(100);
              }
            } else {
              saveProgress(loc.start.cfi, pct);
            }
          }
        });

        rendition.on('rendered', () => {
          if (!cancelled) setLoading(false);
        });

        rendition.on('keydown', (e) => {
          if (e.key === 'ArrowLeft') rendition.prev();
          if (e.key === 'ArrowRight') rendition.next();
        });

        // Marca texto: al seleccionar texto se abre el formulario de resaltado
        rendition.on('selected', (cfiRange, contents) => {
          if (!cfiRange) return;
          let text = '';
          try {
            text = (contents?.window?.getSelection()?.toString() || '').trim();
          } catch (e) {}
          setDraft({ cfi: cfiRange, color: '#FFE066', note: '', text });
        });

        // Clic sobre un resaltado: abre la nota existente para editarla
        rendition.on('markClicked', (cfiRange, data) => {
          if (!cfiRange) return;
          const existing = notesRef.current.find(n => n.cfi === cfiRange);
          if (existing) {
            setDraft({ cfi: existing.cfi, color: existing.color, note: existing.note, text: existing.text });
          } else {
            setDraft({ cfi: cfiRange, color: data?.color || '#FFE066', note: data?.note || '', text: data?.text || '' });
          }
        });

        // Mostrar el libro
        await rendition.display(startCfi || undefined);
        if (cancelled) return;

        // Restaurar resaltados guardados del alumno
        const saved = loadNotes(getUserId(), libro.id);
        notesRef.current = saved;
        setNotes(saved);
        saved.forEach(n => {
          try {
            rendition.annotations.highlight(
              n.cfi,
              { color: n.color, note: n.note || '', text: n.text || '' },
              null,
              'epubjs-hl',
              { fill: n.color || '#FFE066', 'fill-opacity': '0.45' }
            );
          } catch (e) {}
        });

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

  const saveDraft = () => {
    if (!draft?.cfi) return;
    const userId = getUserId();
    const list = notesRef.current.filter(n => n.cfi !== draft.cfi);
    const newNote = {
      cfi: draft.cfi,
      color: draft.color,
      note: (draft.note || '').trim(),
      text: draft.text || '',
      ts: Date.now(),
    };
    list.push(newNote);
    notesRef.current = list;
    setNotes(list);
    persistNotes(userId, libro.id, list);
    try {
      renditionRef.current?.annotations.remove(draft.cfi, 'highlight');
    } catch (e) {}
    try {
      renditionRef.current?.annotations.highlight(
        newNote.cfi,
        { color: newNote.color, note: newNote.note, text: newNote.text },
        null,
        'epubjs-hl',
        { fill: newNote.color, 'fill-opacity': '0.45' }
      );
    } catch (e) {}
    setDraft(null);
  };

  const deleteNote = (cfi) => {
    const userId = getUserId();
    const list = notesRef.current.filter(n => n.cfi !== cfi);
    notesRef.current = list;
    setNotes(list);
    persistNotes(userId, libro.id, list);
    try {
      renditionRef.current?.annotations.remove(cfi, 'highlight');
    } catch (e) {}
  };

  const deleteDraftNote = () => {
    if (!draft?.cfi) return;
    deleteNote(draft.cfi);
    setDraft(null);
  };

  const goToNote = (cfi) => {
    setShowNotes(false);
    try {
      renditionRef.current?.display(cfi).catch(() => {});
    } catch (e) {}
  };

  const restartBook = () => {
    setShowFinish(false);
    try {
      renditionRef.current?.display().catch(() => {});
    } catch (e) {}
  };

  const exportNotesPdf = () => {
    try {
      const pdf = new jsPDF({ unit: 'mm', format: 'letter' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      // Encabezado
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor(76, 110, 245);
      pdf.text('Mis notas de lectura', 15, 20);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      const student = getStudentName();
      const date = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
      pdf.text(`Alumno: ${student}`, 15, 27);
      pdf.text(`Libro: ${bookTitle || libro.titulo}`, 15, 33);
      pdf.text(`Fecha: ${date}  |  ${notes.length} ${notes.length === 1 ? 'nota' : 'notas'}`, 80, 33);
      pdf.setDrawColor(76, 110, 245);
      pdf.setLineWidth(0.5);
      pdf.line(15, 36, pageW - 15, 36);

      if (notes.length === 0) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(11);
        pdf.setTextColor(80, 80, 80);
        pdf.text('Todavía no hay notas para este libro.', 15, 48);
      }

      let y = 48;
      const bottom = pageH - 25;
      notes.slice().reverse().forEach(n => {
        pdf.setFillColor(n.color || '#FFE066');
        pdf.roundedRect(15, y - 2.5, 4, 4, 1, 1, 'F');
        if (n.text) {
          pdf.setFont('helvetica', 'italic');
          pdf.setFontSize(10);
          pdf.setTextColor(70, 70, 70);
          const lines = pdf.splitTextToSize(`“${n.text}”`, pageW - 45);
          for (const ln of lines) {
            if (y > bottom) { pdf.addPage(); y = 25; }
            pdf.text(ln, 23, y);
            y += 4.3;
          }
          y += 1;
        }
        if (n.note) {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10);
          pdf.setTextColor(30, 30, 30);
          const lines = pdf.splitTextToSize(n.note, pageW - 45);
          for (const ln of lines) {
            if (y > bottom) { pdf.addPage(); y = 25; }
            pdf.text(ln, 23, y);
            y += 4.5;
          }
          y += 1;
        }
        y += 4;
      });

      pdf.setFontSize(8);
      pdf.setTextColor(180, 180, 180);
      pdf.text('Generado con Kubika', pageW / 2, pageH - 10, { align: 'center' });

      const fname = 'kubika-notas-' + (bookTitle || libro.titulo).toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
      pdf.save(fname);
    } catch (e) {
      console.error('Error al exportar PDF:', e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
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

      <div className="flex-1 overflow-hidden relative min-h-0 bg-slate-200">
        <div className="absolute inset-0 flex items-center justify-center p-4 md:p-8">
          <div
            ref={viewerRef}
            className="w-full h-full max-w-[860px] rounded-lg shadow-2xl border border-slate-300"
            style={{ backgroundColor: '#ffffff' }}
          />
        </div>

        {showNotes && !loading && !error && (
          <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[85%] bg-white border-l border-slate-200 shadow-2xl z-30 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
              <h3 className="text-sm font-bold text-slate-800">Mis notas</h3>
              <button
                onClick={() => setShowNotes(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="px-3 pt-2 pb-1 shrink-0">
              <button
                onClick={exportNotesPdf}
                className="w-full py-2 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition-colors"
              >
                Exportar notas a PDF
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {notes.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-8">
                  Todavía no marcaste nada. Seleccioná texto en el libro para resaltarlo.
                </p>
              )}
              {notes.map(n => (
                <div key={n.cfi} className="border border-slate-100 rounded-xl p-3 bg-slate-50">
                  <div className="flex items-start gap-2">
                    <span className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: n.color }} />
                    <div className="min-w-0 flex-1">
                      {n.text && (
                        <p className="text-xs text-slate-600 italic line-clamp-3">&ldquo;{n.text}&rdquo;</p>
                      )}
                      {n.note && (
                        <p className="text-xs text-slate-800 mt-1 whitespace-pre-wrap">{n.note}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => goToNote(n.cfi)}
                      className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      Ir al texto
                    </button>
                    <button
                      onClick={() => deleteNote(n.cfi)}
                      className="text-[11px] font-medium text-red-500 hover:text-red-700 transition-colors"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {draft && (
          <div
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/30 p-6"
            onClick={() => setDraft(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-sm font-bold text-slate-800 mb-1">Resaltar texto</h3>
              {draft.text && (
                <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 mb-3 max-h-24 overflow-y-auto">
                  &ldquo;{draft.text}&rdquo;
                </p>
              )}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-slate-500 mr-1">Color:</span>
                {COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setDraft(d => ({ ...d, color: c.value }))}
                    title={c.name}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${
                      draft.color === c.value
                        ? 'border-indigo-500 scale-110'
                        : 'border-transparent hover:scale-110'
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
              <textarea
                value={draft.note}
                onChange={e => setDraft(d => ({ ...d, note: e.target.value }))}
                placeholder="Escribí una nota (opcional)..."
                rows={3}
                autoFocus
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
              <div className="flex items-center justify-between gap-2">
                {notes.some(n => n.cfi === draft.cfi) ? (
                  <button
                    onClick={deleteDraftNote}
                    className="px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Quitar
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setDraft(null)}
                    className="px-4 py-1.5 text-sm text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={saveDraft}
                    className="px-4 py-1.5 text-sm font-semibold text-white bg-amber-400 hover:bg-amber-500 rounded-lg transition-colors"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showFinish && (
          <div
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 p-6"
            onClick={() => setShowFinish(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-800 text-center mb-1">
                ¡Terminaste el libro!
              </h3>
              <p className="text-xs text-slate-500 text-center mb-4">
                Felicitaciones por leer {bookTitle || libro.titulo} por completo.
              </p>
              {libro.pregunta && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider mb-1">
                    Para pensar
                  </p>
                  <p className="text-sm text-amber-900 leading-relaxed">{libro.pregunta}</p>
                </div>
              )}
              <div className="mb-4 text-center">
                <p className="text-xs font-semibold text-slate-600 mb-1">
                  ¿Cuántas estrellas le das a este libro?
                </p>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button
                      key={s}
                      onClick={() => {
                        saveRating(libro.id, s);
                        setRating(s);
                      }}
                      className={`text-3xl leading-none transition-transform hover:scale-125 ${
                        s <= rating ? 'text-amber-400' : 'text-slate-200'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <p className="text-[11px] font-medium text-emerald-600 mt-1.5">
                    ¡Gracias por calificar!
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowFinish(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition-colors"
                >
                  Cerrar
                </button>
                <button
                  onClick={restartBook}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors"
                >
                  Releer desde el inicio
                </button>
              </div>
            </div>
          </div>
        )}

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
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNotes(v => !v)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                showNotes
                  ? 'bg-amber-100 text-amber-800'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Mis notas{notes.length > 0 ? ` (${notes.length})` : ''}
            </button>
            <span className="text-xs font-medium text-slate-500 tabular-nums">
              {percentage}%
            </span>
          </div>
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