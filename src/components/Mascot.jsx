import { useState, useEffect, useRef } from 'react';
import { RODS } from '../utils/rods';

/** Regleta miniatura (CSS puro) para las figuras de los consejos. */
function MiniRod({ v, unit = 8, h = 14 }) {
  const rod = RODS[v - 1];
  if (!rod) return null;
  return (
    <span
      className="inline-block rounded-[2px] border border-black/25"
      style={{
        width: v * unit,
        height: h,
        backgroundColor: rod.color,
        boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.5)',
      }}
      title={rod.name}
    />
  );
}

/** Contenedor de figura con etiqueta. */
function Fig({ label, children }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {children}
      <span className="text-[9px] font-bold text-purple-600">{label}</span>
    </div>
  );
}

const TIPS = [
  {
    id: 'antena',
    title: '¿Cómo se llena una antena matemática?',
    steps: [
      'a) Primero calcula x1: es tu valor base, el punto de partida.',
      'b) Enseguida calcula x10: solo agrega un cero al resultado de x1. ¡Por qué! Multiplicar por 10 significa correr una posición el decimal, es decir, agregar un 0 al final.',
      'c) Ahora calcula la mitad de x10, o sea 5. 5 es la mitad de 10, por lo tanto el resultado de ×5 es la mitad del resultado de ×10.',
      'd) Vamos por el doble de x1: es x2. El resultado lo duplicamos (×2).',
      'e) Ese resultado lo duplicamos otra vez y obtenemos el resultado de ×4.',
      'f) Lo duplicamos una vez más y es el resultado de ×8.',
      'g) Calcula x3: es la suma del resultado de ×2 + ×1, porque 3 = 2 + 1.',
      'h) Duplica ese resultado y es el resultado de ×6, porque 6 = 3 × 2.',
      'i) Calcula x7: es la suma del resultado de ×6 + ×1, porque 7 = 6 + 1.',
      '¡Y por último x9! Es el resultado de ×8 + ×1, porque 9 = 8 + 1.',
    ],
  },
  {
    id: 'ops',
    title: 'Solo usas 3 operaciones',
    steps: [
      '×10 → agregar un cero.',
      '÷2 → sacar la mitad (para llegar a ×5).',
      '×2 → dobles consecutivos (×2, ×4, ×8).',
      'Los impares (×3, ×7, ×9) son sumas de resultados anteriores.',
    ],
  },
  {
    id: 'productos',
    title: '✨ Entender los productos (guía completa)',
    steps: [
      {
        text: 'PASO 1 — De la suma al tren especial: un tren normal (3 + 2 + 1) es una suma. Si todos los vagones valen lo mismo (6 + 6 + 6), eso es multiplicación — a esos trenes de igual valor los libros llaman trenes especiales.',
        fig: (
          <div className="flex flex-col gap-1.5 w-full">
            <div className="flex items-center gap-1.5">
              <MiniRod v={3} /><MiniRod v={2} /><MiniRod v={1} />
              <span className="text-[9px] text-slate-500 font-semibold">distintos = suma</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MiniRod v={6} /><MiniRod v={6} /><MiniRod v={6} />
              <span className="text-[9px] font-bold text-purple-700">iguales = 3 × 6</span>
            </div>
          </div>
        ),
      },
      {
        text: 'PASO 2 — El producto es un área: cada tren especial se convierte en un rectángulo: 3 filas de 6 = área 18. La multiplicación no es solo decir tablas, es construir figuras con las regletas.',
        fig: (
          <Fig label="3 filas × 6 = área 18">
            <div className="flex flex-col gap-0.5 items-start">
              <MiniRod v={6} /><MiniRod v={6} /><MiniRod v={6} />
            </div>
          </Fig>
        ),
      },
      {
        text: 'PASO 3 — Los factores son los lados: si conoces el área pero no los lados, buscas qué rectángulos caben exacto. Cada par que funcione son los factores — encontrarlos se llama factorizar.',
        fig: (
          <div className="flex items-end gap-4 justify-center flex-wrap">
            <Fig label="1 × 18">
              <div className="flex"><MiniRod v={10} /><MiniRod v={8} /></div>
            </Fig>
            <Fig label="2 × 9">
              <div className="flex flex-col gap-0.5 items-start"><MiniRod v={9} /><MiniRod v={9} /></div>
            </Fig>
            <Fig label="3 × 6">
              <div className="flex flex-col gap-0.5 items-start"><MiniRod v={6} /><MiniRod v={6} /><MiniRod v={6} /></div>
            </Fig>
          </div>
        ),
      },
      {
        text: 'PASO 4 — Casos especiales del rectángulo: cuando los lados son iguales hay cuadrado: 4 × 4 = 16 → 4² (números cuadrados: 1, 4, 9, 16, 25…). Si apilas capas del cuadrado hay cubo: 2 × 2 × 2 = 8 → 2³ (números cúbicos: 8, 27, 64…). El 64 es especial: es 8² y 4³ al mismo tiempo.',
        fig: (
          <div className="flex items-end gap-5 justify-center flex-wrap">
            <Fig label="4² = 16 (cuadrado)">
              <div className="flex flex-col gap-0.5 items-start">
                <MiniRod v={4} unit={11} h={11} /><MiniRod v={4} unit={11} h={11} />
                <MiniRod v={4} unit={11} h={11} /><MiniRod v={4} unit={11} h={11} />
              </div>
            </Fig>
            <Fig label="2³ = 8 (2 capas de 2×2)">
              <div className="flex flex-col gap-1">
                {[0, 1].map(i => (
                  <div key={i} className="grid grid-cols-2 gap-0.5 p-0.5 bg-white border border-red-300 rounded-[3px]">
                    <span className="block w-[13px] h-[13px] bg-[#E74C3C] rounded-[1px]" />
                    <span className="block w-[13px] h-[13px] bg-[#E74C3C] rounded-[1px]" />
                    <span className="block w-[13px] h-[13px] bg-[#E74C3C] rounded-[1px]" />
                    <span className="block w-[13px] h-[13px] bg-[#E74C3C] rounded-[1px]" />
                  </div>
                ))}
              </div>
            </Fig>
          </div>
        ),
      },
      {
        text: 'PASO 5 — Todo conecta: tren especial → rectángulo → factores → fracciones → cuadrados → cubos. Una sola idea lo une todo: repetir y medir.',
        fig: (
          <div className="flex flex-wrap items-center justify-center gap-1 text-[9px] font-bold text-slate-600">
            {['🚂 tren', '▭ área', '🔍 factores', '½ fracciones', '□ cuadrado', '📦 cubo'].map((s, i, arr) => (
              <span key={s} className="flex items-center gap-1">
                <span className="px-1.5 py-0.5 bg-purple-50 border border-purple-200 rounded-full">{s}</span>
                {i < arr.length - 1 && <span className="text-purple-400">➜</span>}
              </span>
            ))}
          </div>
        ),
      },
    ],
  },
  {
    id: 'copiar',
    title: 'Copiar y pegar',
    text: 'Selecciona un texto o fórmula y usa Ctrl+C para copiar, Ctrl+V para pegar.',
  },
  {
    id: 'doble',
    title: 'Editar un texto',
    text: 'Dale doble clic a cualquier texto de tu hoja para editarlo.',
  },
  {
    id: 'flechas',
    title: 'Mover con el teclado',
    text: 'Con un elemento seleccionado, usa las teclas flecha para moverlo con precisión.',
  },
  {
    id: 'guardar',
    title: 'No pierdas tu trabajo',
    text: 'Pulsa Guardar para que tu diseño quede guardado en tu cuenta.',
  },
];

/**
 * Asistente flotante (esquina inferior derecha).
 * Recibe `message` = { text, id } y muestra el globo 5 segundos.
 * Clic → mini menú flotante de consejos (acordeón).
 */
export default function Mascot({ message }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [bubble, setBubble] = useState(null);
  const [imgOk, setImgOk] = useState(true);
  const hideTimer = useRef(null);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    if (!message?.text) return;
    setBubble(message);
    setPop(true);
    const popTimer = setTimeout(() => setPop(false), 600);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setBubble(null), 5000);
    return () => {
      clearTimeout(popTimer);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [message]);

  const toggleMenu = () => {
    setMenuOpen(o => !o);
    setExpanded(null);
    setBubble(null);
  };

  return (
    <div
      className="fixed bottom-4 right-4 z-[900] no-print flex flex-col items-end gap-2 select-none"
    >
      {/* ===== MINI MENÚ DE CONSEJOS ===== */}
      {menuOpen && (
        <div
          key="menu"
          className="animate-scale-in w-[320px] max-h-[65vh] overflow-y-auto
                     bg-white border-2 border-purple-200 rounded-2xl rounded-br-sm
                     shadow-xl shadow-purple-100/60 select-text"
        >
          {/* Encabezado */}
          <div className="sticky top-0 flex items-center justify-between px-4 py-3
                          bg-gradient-to-r from-purple-50 to-pink-50
                          border-b border-purple-100 rounded-t-2xl">
            <span className="font-display font-bold text-purple-700 text-sm">
              💡 Consejos de tu asistente
            </span>
            <button
              onClick={toggleMenu}
              className="w-7 h-7 rounded-full bg-white border border-purple-200
                         text-slate-500 hover:text-slate-800 hover:bg-purple-50
                         flex items-center justify-center text-sm font-bold transition-colors"
              title="Cerrar"
            >
              ✕
            </button>
          </div>

          {/* Lista de consejos */}
          <ul className="p-2 space-y-1.5">
            {TIPS.map((tip, i) => (
              <li key={tip.id}>
                <button
                  onClick={() => setExpanded(e => e === tip.id ? null : tip.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold
                     transition-colors flex items-start gap-2
                     ${expanded === tip.id
                       ? 'bg-purple-600 text-white'
                       : 'bg-slate-50 text-slate-700 hover:bg-purple-50'
                     }`}
                >
                  <span className="shrink-0 mt-0.5">{expanded === tip.id ? '▾' : '▸'}</span>
                  <span>{i + 1}. {tip.title}</span>
                </button>

                {/* Contenido expandido */}
                {expanded === tip.id && (
                  <div className="mt-1 mx-1 mb-1 px-3 py-3 rounded-xl bg-purple-50/70
                                  border border-purple-100 text-[13px] leading-relaxed text-slate-700
                                  animate-scale-in space-y-2">
                    {tip.steps
                      ? tip.steps.map((s, j) => {
                          const txt = typeof s === 'string' ? s : s.text;
                          const fig = typeof s === 'string' ? null : s.fig;
                          return (
                            <div key={j}>
                              <p className={j === 0 ? 'font-semibold text-purple-800' : ''}>
                                {txt}
                              </p>
                              {fig && (
                                <div className="my-2 px-2 py-2.5 bg-white/80 rounded-lg border border-purple-100
                                                flex items-center justify-center flex-wrap gap-3">
                                  {fig}
                                </div>
                              )}
                            </div>
                          );
                        })
                      : <p>{tip.text}</p>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Globo de mensaje (saludos, felicitaciones) */}
      {bubble && !menuOpen && (
        <div
          key={bubble.id}
          className="animate-scale-in max-w-[240px] bg-white border-2 border-purple-200
                     rounded-2xl rounded-br-sm px-4 py-2.5 text-sm font-semibold text-slate-700
                     shadow-lg shadow-purple-100/60"
        >
          {bubble.text}
        </div>
      )}

      {/* Mascota */}
      <button
        onClick={toggleMenu}
        title={menuOpen ? 'Cerrar consejos' : 'Abrir consejos'}
        className={`relative block ${pop ? 'animate-bounce-in' : 'animate-float'}`}
        style={{ animationDuration: pop ? undefined : '3s' }}
      >
        <img
          src="mascota.png"
          alt="Asistente Kubika"
          className={`w-[175px] h-[175px] object-contain drop-shadow-xl transition-transform
                     ${menuOpen ? 'scale-105' : 'hover:scale-110'}`}
          onError={() => setImgOk(false)}
        />
        {!imgOk && (
          <span className="text-5xl">💡</span>
        )}
        {/* Indicador de menú */}
        <span
          className="absolute top-1 right-1 min-w-[26px] h-6 px-1 rounded-full
                     bg-purple-600 text-white text-[11px] font-bold shadow
                     flex items-center justify-center"
        >
          {menuOpen ? '✕' : '💡+'}
        </span>
      </button>
    </div>
  );
}
