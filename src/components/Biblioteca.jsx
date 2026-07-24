import { useState, useEffect } from 'react';
import EpubReader from './EpubReader';

export default function Biblioteca({ onClose }) {
  const [libros, setLibros] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedLibro, setSelectedLibro] = useState(null);
  const [startPage, setStartPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [savedProgress, setSavedProgress] = useState(null);

  useEffect(() => {
    fetch('biblioteca/data.json?t=' + Date.now())
      .then(r => {
        if (!r.ok) throw new Error('No se pudo cargar el catálogo');
        return r.json();
      })
      .then(data => {
        setLibros(data);
        setLoading(false);
        // Leer progreso guardado
        try {
          const prog = JSON.parse(localStorage.getItem('kubika_progress') || '{}');
          const entries = Object.entries(prog);
          if (entries.length > 0) {
            const [id, info] = entries[entries.length - 1];
            const libroData = data.find(l => l.id == id);
            if (libroData) setSavedProgress({ ...libroData, page: info.page });
          }
        } catch {}
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  // Refrescar progreso al volver del lector
  useEffect(() => {
    if (!selectedLibro) {
      try {
        const prog = JSON.parse(localStorage.getItem('kubika_progress') || '{}');
        const entries = Object.entries(prog);
        if (entries.length > 0) {
          const [id, info] = entries[entries.length - 1];
          const libroData = libros.find(l => l.id == id);
          if (libroData) setSavedProgress({ ...libroData, page: info.page });
        } else {
          setSavedProgress(null);
        }
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

  if (selectedLibro) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col bg-white">
        <EpubReader libro={selectedLibro} onBack={() => { setSelectedLibro(null); setStartPage(0); }} startPage={startPage} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-white">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Cerrar
        </button>
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <h1 className="text-base font-bold text-slate-800">Biblioteca</h1>
        </div>
        <div className="w-16" />
      </header>

      {savedProgress && (
        <div className="px-4 pt-3 shrink-0">
          <button onClick={() => openBook(savedProgress, savedProgress.page)}
            className="w-full flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors text-left">
            <div className="w-10 h-14 rounded-lg overflow-hidden bg-amber-100 shrink-0">
              <img src={savedProgress.portada} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Continuar leyendo</p>
              <p className="text-sm font-semibold text-slate-800 truncate">{savedProgress.titulo}</p>
              <p className="text-xs text-slate-500">Página {savedProgress.page}</p>
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

        {!loading && !error && Object.entries(categorias).map(([categoria, librosCat]) => (
          <section key={categoria} className="mb-6">
            <div className="flex items-center gap-2 px-4 py-2">
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">{categoria}</h2>
              <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{librosCat.length}</span>
            </div>
            <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
              {librosCat.map(libro => (
                <div
                  key={libro.id}
                  onClick={() => openBook(libro)}
                  className="flex-shrink-0 w-[130px] cursor-pointer group"
                >
                  <div className="w-[130px] h-[185px] rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm group-hover:shadow-md transition-shadow">
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
                  </div>
                  <div className="mt-1.5 px-0.5">
                    <p className="text-xs font-semibold text-slate-700 truncate group-hover:text-indigo-600 transition-colors">{libro.titulo}</p>
                    <p className="text-[11px] text-slate-400 truncate">{libro.autor}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
