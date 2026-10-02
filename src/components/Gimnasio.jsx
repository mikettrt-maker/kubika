import { useState, useRef, useEffect } from 'react';
import { exportToPdf } from '../utils/exportPdf';
import { opLabel } from '../utils/retosGenerator';
import EscrituraPanel from './EscrituraPanel';

const CELL_H = 30;
const CELL_W = 38;
const MAX_COLS = 20; // columna T: la herramienta de escritura va a la derecha
const DARK = '2px solid #0f172a';
const LIGHT = '1px solid #e2e8f0';
const TRANSPARENT = '1px solid transparent';
const DEFAULT_COLOR = '#1e293b';
const TEXT_COLORS = ['#1e293b', '#dc2626', '#2563eb', '#16a34a', '#ea580c', '#9333ea', '#db2777', '#64748b'];
const INT_LABELS = ['U', 'D', 'C', 'UM', 'DM', 'CM', 'UMM', 'CMM'];
const DEC_LABELS = ['', 'd', 'c', 'm', 'mm'];

const norm = (s) => ({
  r1: Math.min(s.r1, s.r2),
  r2: Math.max(s.r1, s.r2),
  c1: Math.min(s.c1, s.c2),
  c2: Math.max(s.c1, s.c2),
});

function ToolBtn({ onClick, active, title, children, danger }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`h-8 min-w-[32px] px-2 rounded-lg border text-sm font-bold transition-all
        ${active
          ? 'bg-indigo-600 border-indigo-600 text-white shadow-md scale-105'
          : danger
            ? 'bg-white border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-500'
            : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'}`}
    >
      {children}
    </button>
  );
}

function BorderIcon({ side }) {
  const paths = {
    t: 'M4 7h16',
    b: 'M4 17h16',
    l: 'M7 4v16',
    r: 'M17 4v16',
    all: 'M4 4h16v16H4z',
    none: 'M6 6l12 12M18 6L6 18',
  };
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
      <path strokeLinecap="round" strokeLinejoin="round" d={paths[side]} />
    </svg>
  );
}

function GroupLabel({ children }) {
  return <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider select-none">{children}</span>;
}

export default function Gimnasio({ value, onChange, onClose, displayName, workspaceName, onNotify, reto, onOpenRetos, userGrado }) {
  const [sel, setSel] = useState(null);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const wasSelectedRef = useRef(false);
  const editRef = useRef(null);
  const rootRef = useRef(null);
  const sheetRef = useRef(null);

  const rows = value.rows || 10;
  const cols = Math.min(value.cols || 16, MAX_COLS);
  const cells = value.cells || {};
  const borders = value.borders || {};
  const colors = value.colors || {};
  const guideMode = value.guides === 'valor' ? 'valor' : 'letters';
  const unitsCol = Number.isInteger(value.unitsCol) ? Math.max(0, Math.min(cols - 1, value.unitsCol)) : cols - 1;

  const colLabel = (c) => {
    if (guideMode !== 'valor') return String.fromCharCode(65 + c);
    const pos = c - unitsCol;
    if (pos === 0) return 'U';
    if (pos < 0) return INT_LABELS[-pos - 1] || '·';
    return DEC_LABELS[pos] || '·';
  };

  const focusGrid = () => { try { rootRef.current?.focus(); } catch {} };

  useEffect(() => { focusGrid(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Selección por arrastre vía elementFromPoint (ratón y táctil)
  useEffect(() => {
    const move = (ev) => {
      if (!draggingRef.current) return;
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const cellEl = el && el.closest ? el.closest('[data-cell]') : null;
      if (!cellEl) return;
      const [r, c] = cellEl.getAttribute('data-cell').split(',').map(Number);
      setSel(prev => {
        if (!prev || (prev.r2 === r && prev.c2 === c)) return prev;
        movedRef.current = true;
        return { ...prev, r2: r, c2: c };
      });
    };
    const up = () => { draggingRef.current = false; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  // Flechas del teclado aunque el foco haya quedado en el body (tras editar, clic en zona no enfocable, etc.)
  useEffect(() => {
    const onKey = (e) => {
      const ae = document.activeElement;
      const tag = ae && ae.tagName;
      if (tag && tag !== 'BODY' && tag !== 'HTML') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!e.key.startsWith('Arrow')) return;
      e.preventDefault();
      if (e.key === 'ArrowUp') moveSel(-1, 0);
      else if (e.key === 'ArrowDown') moveSel(1, 0);
      else if (e.key === 'ArrowLeft') moveSel(0, -1);
      else if (e.key === 'ArrowRight') moveSel(0, 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, rows, cols]);

  const selectCell = (r, c) => setSel({ r1: r, c1: c, r2: r, c2: c });

  const startEdit = (r, c, initial) => {
    const text = initial !== undefined ? initial : (cells[`${r},${c}`] || '');
    editRef.current = { r, c, draft: text, selectAll: initial === undefined };
    setEditing({ r, c });
    setDraft(text);
    selectCell(r, c);
  };

  const commit = () => {
    const ed = editRef.current;
    if (!ed) return;
    editRef.current = null;
    const { r, c, draft: d } = ed;
    onChange(prev => ({ ...prev, cells: { ...(prev.cells || {}), [`${r},${c}`]: d } }));
    setEditing(null);
    focusGrid();
  };

  const cancelEdit = () => { editRef.current = null; setEditing(null); focusGrid(); };

  const onCellPointerDown = (r, c) => {
    if (editing && editing.r === r && editing.c === c) return;
    wasSelectedRef.current = !!(sel && sel.r1 === r && sel.r2 === r && sel.c1 === c && sel.c2 === c);
    movedRef.current = false;
    draggingRef.current = true;
    if (editRef.current) commit();
    selectCell(r, c);
    focusGrid();
  };

  const onCellClick = (r, c) => {
    if (!movedRef.current && wasSelectedRef.current) startEdit(r, c);
    wasSelectedRef.current = false;
  };

  const inRange = (r, c) =>
    sel && r >= Math.min(sel.r1, sel.r2) && r <= Math.max(sel.r1, sel.r2) &&
    c >= Math.min(sel.c1, sel.c2) && c <= Math.max(sel.c1, sel.c2);

  // ===== Bordes estilo Excel (toggle según la celda ancla) =====
  const forEachSelected = (fn) => {
    if (!sel) return;
    const n = norm(sel);
    for (let r = n.r1; r <= n.r2; r++)
      for (let c = n.c1; c <= n.c2; c++) fn(`${r},${c}`);
  };

  const applySide = (side) => {
    if (!sel) { onNotify('Primero selecciona celdas', 'error'); return; }
    const anchor = `${sel.r1},${sel.c1}`;
    const remove = (borders[anchor] || '').includes(side);
    onChange(prev => {
      const b = { ...(prev.borders || {}) };
      forEachSelected(k => {
        let s = b[k] || '';
        if (remove) s = s.replace(side, '');
        else if (!s.includes(side)) s += side;
        if (s) b[k] = s; else delete b[k];
      });
      return { ...prev, borders: b };
    });
    focusGrid();
  };

  const applyAllBorders = () => {
    if (!sel) { onNotify('Primero selecciona celdas', 'error'); return; }
    onChange(prev => {
      const b = { ...(prev.borders || {}) };
      forEachSelected(k => { b[k] = 'trbl'; });
      return { ...prev, borders: b };
    });
    focusGrid();
  };

  const clearBorders = () => {
    if (!sel) { onNotify('Primero selecciona celdas', 'error'); return; }
    onChange(prev => {
      const b = { ...(prev.borders || {}) };
      forEachSelected(k => { delete b[k]; });
      return { ...prev, borders: b };
    });
    focusGrid();
  };

  // ===== Signos =====
  const putSign = (sym) => {
    if (!sel) { onNotify('Primero selecciona una celda', 'error'); return; }
    const { r1, c1 } = norm(sel);
    onChange(prev => ({ ...prev, cells: { ...(prev.cells || {}), [`${r1},${c1}`]: sym } }));
    focusGrid();
  };

  // ===== Color del número (aplicado al rango seleccionado) =====
  const applyColor = (hex) => {
    if (!sel) { onNotify('Primero selecciona celdas', 'error'); return; }
    onChange(prev => {
      const cm = { ...(prev.colors || {}) };
      forEachSelected(k => {
        if (hex === DEFAULT_COLOR) delete cm[k];
        else cm[k] = hex;
      });
      return { ...prev, colors: cm };
    });
    focusGrid();
  };

  // ===== Galera de división larga (vertical + barra superior) =====
  const drawGalera = () => {
    if (!sel) { onNotify('Selecciona el divisor y el dividendo', 'error'); return; }
    const n = norm(sel);
    if (n.c2 - n.c1 < 1) { onNotify('Selecciona al menos 2 celdas: divisor y dividendo', 'error'); return; }
    onChange(prev => {
      const b = { ...(prev.borders || {}) };
      const add = (k, side) => {
        let s = b[k] || '';
        if (!s.includes(side)) s += side;
        b[k] = s;
      };
      add(`${n.r1},${n.c1}`, 'r');
      for (let c = n.c1 + 1; c <= n.c2; c++) add(`${n.r1},${c}`, 't');
      return { ...prev, borders: b };
    });
    focusGrid();
  };

  // ===== Contenido =====
  const clearSelectionContent = () => {
    if (!sel) return;
    onChange(prev => {
      const cs = { ...(prev.cells || {}) };
      forEachSelected(k => { delete cs[k]; });
      return { ...prev, cells: cs };
    });
    focusGrid();
  };

  const clearAll = () => {
    if (Object.keys(cells).length === 0 && Object.keys(borders).length === 0) return;
    if (!confirm('¿Limpiar toda la cuadrícula? Se borrarán operaciones, respuestas y bordes.')) return;
    onChange(prev => ({ ...prev, cells: {}, borders: {} }));
    setSel(null);
    focusGrid();
  };

  const setDim = (key, delta) => {
    const min = 4, max = key === 'rows' ? 30 : MAX_COLS;
    onChange(prev => ({ ...prev, [key]: Math.max(min, Math.min(max, (prev[key] || 0) + delta)) }));
    focusGrid();
  };

  // ===== Navegación con teclado =====
  const moveSel = (dr, dc) => {
    const base = sel || { r1: 0, c1: 0 };
    const r = Math.max(0, Math.min(rows - 1, base.r1 + dr));
    const c = Math.max(0, Math.min(cols - 1, base.c1 + dc));
    selectCell(r, c);
    const el = document.querySelector(`[data-cell="${r},${c}"]`);
    if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  const handleGridKeyDown = (e) => {
    e.stopPropagation();
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (editing) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const { key } = e;
    if (tag === 'BUTTON' && !key.startsWith('Arrow')) return;
    if (key.length === 1) {
      e.preventDefault();
      const n = sel ? norm(sel) : { r1: 0, c1: 0 };
      startEdit(n.r1, n.c1, key);
    } else if (key === 'Enter') {
      e.preventDefault();
      if (sel) { const n = norm(sel); startEdit(n.r1, n.c1); }
    } else if (key === 'Backspace' || key === 'Delete') {
      e.preventDefault();
      clearSelectionContent();
    } else if (key.startsWith('Arrow')) {
      e.preventDefault();
      if (key === 'ArrowUp') moveSel(-1, 0);
      if (key === 'ArrowDown') moveSel(1, 0);
      if (key === 'ArrowLeft') moveSel(0, -1);
      if (key === 'ArrowRight') moveSel(0, 1);
    }
  };

  // ===== PDF =====
  const handlePdf = async () => {
    if (!sheetRef.current || pdfLoading) return;
    setPdfLoading(true);
    const prevSel = sel;
    setSel(null);
    try {
      await new Promise(r => setTimeout(r, 80));
      await exportToPdf(sheetRef.current, displayName || 'Alumno', workspaceName || 'Gimnasio Matemático');
      onNotify('PDF descargado');
    } catch {
      onNotify('Error al crear el PDF', 'error');
    }
    setSel(prevSel);
    setPdfLoading(false);
    focusGrid();
  };

  const anchorKey = sel ? `${sel.r1},${sel.c1}` : '';
  const anchorBorders = borders[anchorKey] || '';

  const cellBorders = (r, c) => {
    const b = borders[`${r},${c}`] || '';
    const right = c < cols - 1 && !(borders[`${r},${c + 1}`] || '').includes('l');
    const down = r < rows - 1 && !(borders[`${r + 1},${c}`] || '').includes('t');
    return {
      borderTop: b.includes('t') ? DARK : TRANSPARENT,
      borderLeft: b.includes('l') ? DARK : TRANSPARENT,
      borderRight: b.includes('r') ? DARK : (right ? LIGHT : TRANSPARENT),
      borderBottom: b.includes('b') ? DARK : (down ? LIGHT : TRANSPARENT),
    };
  };

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={handleGridKeyDown}
      className="fixed inset-0 z-[9999] flex flex-col bg-slate-100 outline-none"
      data-gimnasio-open
    >
      {/* Encabezado */}
      <div
        className="no-print flex items-center gap-4 px-5 py-3 text-white shadow-lg shrink-0"
        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 15h6v4h-6z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-extrabold leading-tight">Gimnasio Matemático</h1>
            <p className="text-[11px] text-white/80">Mecaniza operaciones y escribe números con letra · 4°, 5° y 6°</p>
          </div>
        </div>
        <div className="flex-1" />
        {onOpenRetos && (
          <button
            onClick={onOpenRetos}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-white/15 hover:bg-white/25 border border-white/30 transition-all"
            title="Elegir un reto matemático"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="5" />
              <circle cx="12" cy="12" r="1.4" fill="currentColor" />
            </svg>
            Retos
          </button>
        )}
        <button
          onClick={handlePdf}
          disabled={pdfLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-white/15 hover:bg-white/25 border border-white/30 transition-all disabled:opacity-60"
          title="Descargar la cuadrícula en PDF"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
          </svg>
          {pdfLoading ? 'Generando…' : 'PDF'}
        </button>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 border border-white/30 flex items-center justify-center transition-all"
          title="Cerrar gimnasio"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Barra de herramientas */}
      <div className="no-print flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2 bg-white border-b border-slate-200 shadow-sm shrink-0">
        <div className="flex items-center gap-1.5">
          <GroupLabel>Bordes</GroupLabel>
          <ToolBtn onClick={() => applySide('t')} active={anchorBorders.includes('t')} title="Borde superior (barra sobre el dividendo)"><BorderIcon side="t" /></ToolBtn>
          <ToolBtn onClick={() => applySide('b')} active={anchorBorders.includes('b')} title="Borde inferior (la rayita de la operación)"><BorderIcon side="b" /></ToolBtn>
          <ToolBtn onClick={() => applySide('l')} active={anchorBorders.includes('l')} title="Borde izquierdo"><BorderIcon side="l" /></ToolBtn>
          <ToolBtn onClick={() => applySide('r')} active={anchorBorders.includes('r')} title="Borde derecho"><BorderIcon side="r" /></ToolBtn>
          <ToolBtn onClick={applyAllBorders} title="Borde en todo el rango seleccionado"><BorderIcon side="all" /></ToolBtn>
          <ToolBtn onClick={clearBorders} title="Quitar bordes del rango seleccionado" danger><BorderIcon side="none" /></ToolBtn>
        </div>

        <div className="w-px h-6 bg-slate-200" />

        <div className="flex items-center gap-1.5">
          <GroupLabel>Signos</GroupLabel>
          <ToolBtn onClick={() => putSign('+')} active={cells[anchorKey] === '+'} title="Suma">+</ToolBtn>
          <ToolBtn onClick={() => putSign('−')} active={cells[anchorKey] === '−'} title="Resta">−</ToolBtn>
          <ToolBtn onClick={() => putSign('×')} active={cells[anchorKey] === '×'} title="Multiplicación">×</ToolBtn>
          <ToolBtn onClick={() => putSign('÷')} active={cells[anchorKey] === '÷'} title="División">÷</ToolBtn>
          <ToolBtn onClick={() => putSign('=')} active={cells[anchorKey] === '='} title="Igual">=</ToolBtn>
          <button
            onClick={drawGalera}
            title="Galera de división larga: selecciona divisor + dividendo en una fila"
            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center gap-1.5 text-sm font-bold"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M7 4h13" />
            </svg>
            Galera
          </button>
        </div>

        <div className="w-px h-6 bg-slate-200" />

        <div className="flex items-center gap-1.5">
          <GroupLabel>Color</GroupLabel>
          {TEXT_COLORS.map(hex => (
            <button
              key={hex}
              onClick={() => applyColor(hex)}
              title="Poner el color del número en las celdas seleccionadas"
              className="w-5 h-5 rounded-full border-2 transition-all hover:scale-110"
              style={{
                backgroundColor: hex,
                borderColor: (colors[anchorKey] || DEFAULT_COLOR) === hex ? '#0f172a' : 'transparent',
                boxShadow: '0 0 0 1px #cbd5e1',
              }}
            />
          ))}
        </div>

        <div className="w-px h-6 bg-slate-200" />

        <div className="flex items-center gap-1.5">
          <GroupLabel>Guías</GroupLabel>
          <ToolBtn
            onClick={() => onChange(prev => ({ ...prev, guides: (prev.guides || 'letters') === 'letters' ? 'valor' : 'letters' }))}
            active={guideMode === 'valor'}
            title="Guías de columna: letras (A, B, C…) o valores posicionales (UM, C, DM, U, D, C, d, c). En modo valor, clic sobre la guía para marcar la columna de UNIDADES"
          >
            {guideMode === 'valor' ? 'U·D·C' : 'A·B·C'}
          </ToolBtn>
        </div>

        <div className="w-px h-6 bg-slate-200" />

        <div className="flex items-center gap-1.5">
          <GroupLabel>Edición</GroupLabel>
          <ToolBtn onClick={clearSelectionContent} title="Borrar el texto de las celdas seleccionadas (Supr)">Borrar</ToolBtn>
          <ToolBtn onClick={clearAll} title="Vaciar toda la cuadrícula" danger>Limpiar todo</ToolBtn>
        </div>

        <div className="w-px h-6 bg-slate-200" />

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <GroupLabel>Filas</GroupLabel>
            <ToolBtn onClick={() => setDim('rows', -1)} title="Quitar fila">−</ToolBtn>
            <span className="text-sm font-black text-slate-700 w-5 text-center">{rows}</span>
            <ToolBtn onClick={() => setDim('rows', 1)} title="Agregar fila">+</ToolBtn>
          </div>
          <div className="flex items-center gap-1">
            <GroupLabel>Columnas</GroupLabel>
            <ToolBtn onClick={() => setDim('cols', -1)} title="Quitar columna">−</ToolBtn>
            <span className="text-sm font-black text-slate-700 w-5 text-center">{cols}</span>
            <ToolBtn onClick={() => setDim('cols', 1)} title="Agregar columna">+</ToolBtn>
          </div>
        </div>
      </div>

      {/* Cuadrícula + herramienta de escritura */}
      <div className="flex-1 overflow-auto pt-6 px-6 pb-[240px]">
        <div className="inline-flex flex-col items-start mx-auto">
          <div ref={sheetRef} className="flex gap-4 items-start">
            <div className="flex">
            {/* Guías de fila */}
            <div className="flex flex-col shrink-0 no-print" style={{ width: 28 }}>
              <div style={{ height: 18 }} />
              {Array.from({ length: rows }, (_, r) => (
                <div key={r} className="flex items-center justify-center text-[10px] font-bold text-slate-400" style={{ height: CELL_H }}>
                  {r + 1}
                </div>
              ))}
            </div>

            <div className="flex flex-col">
              {/* Guías de columna */}
              <div className="flex no-print" style={{ height: 18 }}>
                {Array.from({ length: cols }, (_, c) => (
                  <div
                    key={c}
                    onClick={guideMode === 'valor' ? () => onChange(prev => ({ ...prev, unitsCol: c })) : undefined}
                    title={guideMode === 'valor' ? 'Clic: marcar esta columna como UNIDADES' : undefined}
                    className={`flex items-center justify-center text-[10px] font-bold select-none ${
                      guideMode === 'valor' ? 'text-slate-500 cursor-pointer hover:text-indigo-600' : 'text-slate-400'
                    }`}
                    style={{ width: CELL_W, color: guideMode === 'valor' && c === unitsCol ? '#6366f1' : undefined }}
                  >
                    {colLabel(c)}
                  </div>
                ))}
              </div>

              {/* Hoja */}
              <div className="bg-white rounded-lg shadow-xl p-2">
                {reto && (
                  <div className="mb-1.5 pb-1 border-b border-slate-200 flex items-center justify-between gap-4 text-[11px] font-bold text-slate-700">
                    <span>Reto: {reto.grado}° · {opLabel(reto.op)} · Nivel {reto.nivel}</span>
                    <span className="font-semibold text-slate-500">
                      Nombre: {displayName || '____________'} · Fecha: {new Date().toLocaleDateString('es-MX')}
                    </span>
                  </div>
                )}
                <div
                  style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, ${CELL_W}px)` }}
                >
                {Array.from({ length: rows * cols }, (_, i) => {
                  const r = Math.floor(i / cols);
                  const c = i % cols;
                  const key = `${r},${c}`;
                  const text = cells[key] || '';
                  const isEditing = editing && editing.r === r && editing.c === c;
                  const selected = inRange(r, c);
                  const isAnchor = sel && sel.r1 === r && sel.c1 === c;
                  const cellColor = colors[key] || DEFAULT_COLOR;
                  return (
                    <div
                      key={key}
                      data-cell={key}
                      className="relative flex items-center px-1.5 select-none cursor-cell"
                      style={{
                        height: CELL_H,
                        backgroundColor: selected ? (isAnchor ? 'rgba(99,102,241,0.20)' : 'rgba(99,102,241,0.07)') : '#fff',
                        ...cellBorders(r, c),
                      }}
                      onPointerDown={() => onCellPointerDown(r, c)}
                      onClick={() => onCellClick(r, c)}
                      onDoubleClick={() => startEdit(r, c)}
                    >
                      {isEditing ? (
                        <input
                          ref={(el) => {
                            if (el) {
                              el.focus();
                              if (editRef.current && editRef.current.selectAll) el.select();
                              else { el.selectionStart = el.selectionEnd = el.value.length; }
                            }
                          }}
                          value={draft}
                          onChange={(e) => { setDraft(e.target.value); if (editRef.current) editRef.current.draft = e.target.value; }}
                          onBlur={commit}
                          spellCheck={false}
                          autoCorrect="off"
                          autoCapitalize="off"
                          autoComplete="off"
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                            else if (e.key === 'Enter') {
                              e.preventDefault();
                              commit();
                              selectCell(Math.min(rows - 1, r + 1), c);
                            } else if (e.key === 'Tab') {
                              e.preventDefault();
                              commit();
                              selectCell(r, e.shiftKey ? Math.max(0, c - 1) : Math.min(cols - 1, c + 1));
                            }
                          }}
                          className="absolute inset-0 w-full h-full px-1 text-center text-sm font-bold outline-none bg-white"
                          style={{ color: cellColor, caretColor: '#6366f1', boxShadow: 'inset 0 0 0 2px #6366f1' }}
                        />
                      ) : text ? (
                        <span
                          className="w-full whitespace-nowrap text-sm font-bold overflow-visible"
                          style={{ color: cellColor, textAlign: 'center' }}
                        >
                          {text}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
                </div>
              </div>
            </div>
          </div>

          <EscrituraPanel value={value} onChange={onChange} reto={reto} onOpenRetos={onOpenRetos} defaultGrado={userGrado} />
          </div>

          <p className="text-xs text-slate-400 mt-4 text-center no-print" style={{ maxWidth: cols * CELL_W + 440 }}>
            Clic para seleccionar · arrastra para elegir un rango · escribe para responder · doble clic para editar · Enter baja, Tab pasa a la siguiente · flechas para moverte entre celdas · guías A-T o de valor posicional · a la derecha escribe números con letra
          </p>
        </div>
      </div>
    </div>
  );
}
