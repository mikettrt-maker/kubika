import { useState, useEffect, useRef } from 'react';

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
                      ? tip.steps.map((s, j) => (
                          <p key={j} className={j === 0 ? 'font-semibold text-purple-800' : ''}>
                            {s}
                          </p>
                        ))
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
