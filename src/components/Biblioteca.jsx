import { useState, useEffect } from 'react';
import EpubReader from './EpubReader';
import { supabase, isSupabaseConfigured } from '../config/supabase';

function getUserId() {
  try {
    return JSON.parse(localStorage.getItem('kubika_local_user') || '{}')?.id || 'anon';
  } catch {
    return 'anon';
  }
}

function aggregateRatings(rows) {
  const agg = {};
  (rows || []).forEach(r => {
    const id = String(r.book_id);
    const s = Number(r.stars);
    if (!id || !s) return;
    agg[id] = agg[id] || { sum: 0, count: 0 };
    agg[id].sum += s;
    agg[id].count += 1;
  });
  Object.keys(agg).forEach(id => { agg[id].avg = agg[id].sum / agg[id].count; });
  return agg;
}

export default function Biblioteca({ onClose }) {
  const [libros, setLibros] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedLibro, setSelectedLibro] = useState(null);
  const [startPage, setStartPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [savedProgress, setSavedProgress] = useState(null);
  const [previewLibro, setPreviewLibro] = useState(null);
  const [progressMap, setProgressMap] = useState({});
  const [notesCounts, setNotesCounts] = useState({});
  const [ratingsMap, setRatingsMap] = useState({});
  const [globalRatings, setGlobalRatings] = useState({});

  const loadGlobalRatings = async () => {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('ratings')
          .select('book_id, stars');
        if (!error) {
          setGlobalRatings(aggregateRatings(data));
          return;
        }
        console.error('Supabase ratings falló:', error);
      } catch (err) {
        console.error('Supabase ratings error:', err);
      }
    }
    // Respaldo: usar las calificaciones locales del usuario como globales
    try {
      const r = JSON.parse(localStorage.getItem('kubika_ratings_' + getUserId()) || '{}');
      const rows = Object.entries(r).map(([book_id, stars]) => ({ book_id, stars }));
      setGlobalRatings(aggregateRatings(rows));
    } catch {
      setGlobalRatings({});
    }
  };

  const buildUserData = (data) => {
    const uid = getUserId();
    const progMap = {};
    const notesMap = {};
    try {
      const prog = JSON.parse(localStorage.getItem('kubika_progress') || '{}');
      Object.entries(prog).forEach(([id, info]) => {
        progMap[id] = { pct: info.pct || 0, finished: (info.pct || 0) >= 99 };
      });
    } catch {}
    try {
      (data || []).forEach(l => {
        try {
          const list = JSON.parse(localStorage.getItem('kubika_notes_' + uid + '_' + l.id) || '[]');
          if (Array.isArray(list) && list.length > 0) notesMap[l.id] = list.length;
        } catch {}
      });
    } catch {}
    try {
      const r = JSON.parse(localStorage.getItem('kubika_ratings_' + uid) || '{}');
      setRatingsMap(r && typeof r === 'object' ? r : {});
    } catch {
      setRatingsMap({});
    }
    setProgressMap(progMap);
    setNotesCounts(notesMap);
  };

  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    fetch(base + '/biblioteca/data.json?t=' + Date.now())
      .then(r => {
        if (!r.ok) throw new Error('No se pudo cargar el catálogo');
        return r.json();
      })
      .then(data => {
        setLibros(data);
        setLoading(false);
        buildUserData(data);
        loadGlobalRatings();
        // Leer progreso guardado
        try {
          const lastId = localStorage.getItem('kubika_last_book');
          if (lastId) {
            const prog = JSON.parse(localStorage.getItem('kubika_progress') || '{}');
            const info = prog[lastId];
            if (info) {
              const libroData = data.find(l => l.id == lastId);
              if (libroData) setSavedProgress({ ...libroData, cfi: info.cfi, pct: info.pct });
            }
          }
        } catch {}
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  // Refrescar progreso al volver del lector
  useEffect(() => {
    if (!selectedLibro) {
      buildUserData(libros);
      loadGlobalRatings();
      try {
        const lastId = localStorage.getItem('kubika_last_book');
        if (lastId) {
          const prog = JSON.parse(localStorage.getItem('kubika_progress') || '{}');
          const info = prog[lastId];
          if (info) {
            const libroData = libros.find(l => l.id == lastId);
            if (libroData) setSavedProgress({ ...libroData, cfi: info.cfi, pct: info.pct });
          } else { setSavedProgress(null); }
        } else { setSavedProgress(null); }
      } catch { setSavedProgress(null); }
    }
  }, [selectedLibro]);

  const openBook = (libro, page) => {
    setStartPage(page || 0);
    setSelectedLibro(libro);
  };

  const filtered = search.trim()
    ? libros.filter(l =>
        l.titulo.toLowerCase().includes(search.toLowerCase()) ||
        l.autor.toLowerCase().includes(search.toLowerCase())
      )
    : libros;

  const categorias = {};
  filtered.forEach(l => {
    const cat = l.edad || l.categoria || 'General';
    if (!categorias[cat]) categorias[cat] = [];
    categorias[cat].push(l);
  });

  const ratedBooks = libros
    .filter(l => globalRatings[l.id])
    .sort((a, b) => globalRatings[b.id].avg - globalRatings[a.id].avg);

  const renderBookCard = (libro) => {
    const prog = progressMap[libro.id] || null;
    const pct = prog?.pct || 0;
    const count = notesCounts[libro.id] || 0;
    const global = globalRatings[libro.id];
    const stars = global ? global.avg : (ratingsMap[libro.id] || 0);
    const starsCount = global?.count || 0;
    return (
      <div
        key={libro.id}
        onClick={() => setPreviewLibro(libro)}
        className="cursor-pointer group"
      >
        <div className="relative aspect-[130/185] rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm group-hover:shadow-md transition-shadow">
          {prog?.finished && (
            <span className="absolute top-1.5 left-1.5 z-10 text-[9px] font-bold text-white bg-emerald-500 px-1.5 py-0.5 rounded-full shadow-sm">
              Leído
            </span>
          )}
          {count > 0 && (
            <span className="absolute top-1.5 right-1.5 z-10 text-[9px] font-bold text-white bg-amber-400 px-1.5 py-0.5 rounded-full shadow-sm">
              {count} {count === 1 ? 'nota' : 'notas'}
            </span>
          )}
          <img
            src={libro.portada}
            alt={libro.titulo}
            className="w-full h-full object-cover"
            onError={e => {
              e.target.style.display = 'none';
              const parent = e.target.parentElement;
              const ph = document.createElement('div');
              ph.className = 'w-full h-full flex items-center justify-center text-slate-400 text-xs text-center p-2';
              ph.textContent = libro.titulo;
              parent.appendChild(ph);
            }}
          />
          {pct > 0 && !prog?.finished && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/70">
              <div className="h-full bg-indigo-500" style={{ width: pct + '%' }} />
            </div>
          )}
        </div>
        <div className="mt-1.5 px-0.5">
          <p className="text-xs font-semibold text-slate-700 leading-tight group-hover:text-indigo-600 transition-colors line-clamp-3">{libro.titulo}</p>
          <p className="text-[11px] text-slate-400 truncate mt-0.5">{libro.autor}</p>
          {stars > 0 && (
            <p className="text-amber-400 text-[11px] leading-none mt-0.5">
              {'★'.repeat(Math.round(stars))}
              {starsCount > 0 && (
                <span className="text-slate-400 ml-1">{stars.toFixed(1)} ({starsCount})</span>
              )}
            </p>
          )}
        </div>
      </div>
    );
  };

  if (selectedLibro) {
    return (
    <div className={onClose ? "fixed inset-0 z-[200] flex flex-col bg-white" : "flex flex-col bg-white h-full"}>
        <EpubReader libro={selectedLibro} onBack={() => { setSelectedLibro(null); setStartPage(0); }} startPage={startPage} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-white">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
        {onClose && (
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Cerrar
        </button>
        )}
        {!onClose && <div />}
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <h1 className="text-base font-bold text-slate-800">Biblioteca</h1>
        </div>
        <div className="w-16" />
      </header>

      {savedProgress && savedProgress.cfi && (
        <div className="px-4 pt-3 shrink-0">
          <button onClick={() => openBook(savedProgress, 1)}
            className="w-full flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors text-left">
            <div className="w-10 h-14 rounded-lg overflow-hidden bg-amber-100 shrink-0">
              <img src={savedProgress.portada} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Continuar leyendo</p>
              <p className="text-sm font-semibold text-slate-800 truncate">{savedProgress.titulo}</p>
              <p className="text-xs text-slate-500">{savedProgress.pct ? 'Has leído el ' + savedProgress.pct + '%' : 'Seguí desde donde lo dejaste'}</p>
            </div>
            <svg className="w-5 h-5 text-amber-500 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
      <div className="px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por título o autor..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Cargando catálogo...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-20 px-8">
            <p className="text-red-500 text-sm font-medium">{error}</p>
            <p className="text-xs text-slate-400 mt-1">Verificá que biblioteca/data.json exista</p>
          </div>
        )}

        {!loading && !error && Object.keys(categorias).length === 0 && (
          <div className="text-center py-20">
            <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <p className="text-sm text-slate-500">No se encontraron libros</p>
          </div>
        )}

        {!loading && !error && ratedBooks.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center gap-2 px-4 py-2">
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">★ Calificados</h2>
              <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{ratedBooks.length}</span>
            </div>
            <div className="grid grid-cols-8 gap-2 px-4 pb-2">
              {ratedBooks.map(libro => renderBookCard(libro))}
            </div>
          </section>
        )}

        {!loading && !error && Object.entries(categorias).map(([categoria, librosCat]) => (
          <section key={categoria} className="mb-6">
            <div className="flex items-center gap-2 px-4 py-2">
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">{categoria}</h2>
              <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{librosCat.length}</span>
            </div>
            <div className="grid grid-cols-8 gap-2 px-4 pb-2">
              {librosCat.map(libro => renderBookCard(libro))}
            </div>
          </section>
        ))}

        {/* Modal de previsualización */}
        {previewLibro && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-6" onClick={() => setPreviewLibro(null)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 relative" onClick={e => e.stopPropagation()}>
              <button onClick={() => setPreviewLibro(null)} className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="flex gap-4 mb-4">
                <div className="w-20 h-28 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                  <img src={previewLibro.portada} alt={previewLibro.titulo} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-800 leading-tight">{previewLibro.titulo}</h3>
                  <p className="text-xs text-slate-500 mt-1">{previewLibro.autor}</p>
                  <span className="inline-block mt-1.5 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{previewLibro.edad}</span>
                </div>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed mb-3">{previewLibro.descripcion}</p>

              {previewLibro.pregunta && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider mb-1">Para pensar</p>
                  <p className="text-sm text-amber-900 leading-relaxed">{previewLibro.pregunta}</p>
                </div>
              )}

              <button onClick={() => openBook(previewLibro)}
                className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors active:scale-[0.98]">
                Leer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
