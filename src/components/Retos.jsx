import { useState, useRef, useEffect } from 'react';
import { OPERACIONES, opLabel, nivelEtiqueta } from '../utils/retosGenerator';

const GRADOS = [4, 5, 6];

function StepTitle({ n, children }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-black flex items-center justify-center">{n}</span>
      <h2 className="text-sm font-black text-slate-700 uppercase tracking-wide">{children}</h2>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  );
}

// ===== Panel flotante con las 8 operaciones del reto activo =====
export function RetoPanel({ reto, onTerminate, onNew }) {
  const [min, setMin] = useState(false);
  const [pos, setPos] = useState(() => ({
    x: Math.max(12, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 350),
    y: 84,
  }));
  const dragRef = useRef(null);

  useEffect(() => {
    const move = (e) => {
      if (!dragRef.current) return;
      const { dx, dy } = dragRef.current;
      setPos({
        x: Math.max(4, Math.min(window.innerWidth - 140, e.clientX - dx)),
        y: Math.max(4, Math.min(window.innerHeight - 48, e.clientY - dy)),
      });
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  const headDown = (e) => {
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  };

  const headBtn = (fn, title, children) => (
    <button
      onPointerDown={(e) => e.stopPropagation()}
      onClick={fn}
      title={title}
      className="h-6 min-w-[26px] px-1.5 rounded-md bg-white/20 hover:bg-white/35 border border-white/40 text-white text-xs font-bold transition-all"
    >
      {children}
    </button>
  );

  return (
    <div
      className="fixed z-[9999] w-[318px] bg-white rounded-2xl shadow-2xl border border-amber-200 overflow-hidden select-none"
      style={{ left: pos.x, top: pos.y }}
      data-reto-panel
    >
      <div
        onPointerDown={headDown}
        className="flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing text-white"
        style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}
      >
        <span className="text-sm font-black whitespace-nowrap">
          {reto.grado}° · {opLabel(reto.op)} · Nivel {reto.nivel}
        </span>
        <div className="flex-1" />
        {headBtn(onNew, 'Elegir otro reto', 'Otro')}
        {headBtn(() => setMin(m => !m), min ? 'Mostrar operaciones' : 'Minimizar', min ? '▲' : '−')}
        {headBtn(onTerminate, 'Terminar el reto', '×')}
      </div>
      {!min && (
        <div className="p-3 max-h-[52vh] overflow-auto">
          <p className="text-[11px] text-slate-500 mb-2 leading-snug">
            Copia cada operación en la cuadrícula, respeta la alineación de las cifras y resuélvela a tu ritmo.
          </p>
          <ol className="space-y-1.5">
            {(reto.ejercicios || []).map((t, i) => (
              <li key={i} className="flex items-baseline gap-2 text-sm">
                <span className="text-amber-600 font-black w-4 text-right shrink-0">{i + 1}</span>
                <span className="font-bold text-slate-800 whitespace-nowrap tracking-wide">{t}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ===== Selector de reto: grado → operación → nivel =====
export default function Retos({ onClose, onLaunch, userGrado, retoActivo }) {
  const [grado, setGrado] = useState(GRADOS.includes(userGrado) ? userGrado : 4);
  const [op, setOp] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => { try { rootRef.current?.focus(); } catch {} }, []);

  const pickLevel = (n) => {
    if (!op) return;
    onLaunch(grado, op, n);
  };

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[9999] flex flex-col bg-slate-100 outline-none"
      data-retos-open
    >
      {/* Encabezado */}
      <div
        className="no-print flex items-center gap-4 px-5 py-3 text-white shadow-lg shrink-0"
        style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="5" />
              <circle cx="12" cy="12" r="1.4" fill="currentColor" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-extrabold leading-tight">Retos Matemáticos</h1>
            <p className="text-[11px] text-white/80">8 operaciones por nivel · practica los algoritmos de 4°, 5° y 6°</p>
          </div>
        </div>
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 border border-white/30 flex items-center justify-center transition-all"
          title="Cerrar retos"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-auto py-6 px-5">
        <div className="max-w-3xl mx-auto">
          {retoActivo && (
            <div className="mb-5 flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <span className="font-bold">
                Reto activo: {retoActivo.grado}° · {opLabel(retoActivo.op)} · Nivel {retoActivo.nivel}
              </span>
              <span className="flex-1" />
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all"
              >
                Volver al reto
              </button>
            </div>
          )}

          {/* 1. Grado */}
          <StepTitle n="1">Grado</StepTitle>
          <div className="flex gap-3 mb-7">
            {GRADOS.map(g => (
              <button
                key={g}
                onClick={() => setGrado(g)}
                className={`flex-1 py-3.5 rounded-xl border-2 text-base font-black transition-all ${
                  grado === g
                    ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-md scale-[1.02]'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-amber-300'
                }`}
              >
                {g}° de primaria
              </button>
            ))}
          </div>

          {/* 2. Operación */}
          <StepTitle n="2">Operación</StepTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
            {OPERACIONES.map(o => (
              <button
                key={o.id}
                onClick={() => setOp(o.id)}
                className={`py-4 rounded-xl border-2 flex flex-col items-center gap-0.5 transition-all ${
                  op === o.id
                    ? 'bg-amber-50 border-amber-500 shadow-md scale-[1.02]'
                    : 'bg-white border-slate-200 hover:border-amber-300'
                }`}
              >
                <span className={`text-2xl font-black ${op === o.id ? 'text-amber-600' : 'text-slate-600'}`}>{o.signo}</span>
                <span className={`text-xs font-bold ${op === o.id ? 'text-amber-700' : 'text-slate-500'}`}>{o.label}</span>
              </button>
            ))}
          </div>

          {/* 3. Nivel */}
          <StepTitle n="3">Nivel</StepTitle>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => pickLevel(n)}
                title={`${nivelEtiqueta(n)} — 8 operaciones`}
                className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center transition-all active:scale-95 ${
                  op
                    ? 'bg-white border-slate-200 hover:border-amber-500 hover:bg-amber-50'
                    : 'bg-slate-50 border-slate-200 opacity-60'
                }`}
              >
                <span className="text-lg font-black text-slate-700 leading-none">{n}</span>
                <span className="text-[9px] font-bold text-slate-400 leading-none mt-0.5">{nivelEtiqueta(n)}</span>
              </button>
            ))}
          </div>

          <p className="mt-6 text-xs text-slate-400 text-center leading-relaxed">
            Al lanzar un nivel se te preguntará si limpiar la cuadrícula · resuelve a tu ritmo y descarga el PDF
            para que el profe revise tu trabajo.
          </p>
        </div>
      </div>
    </div>
  );
}
