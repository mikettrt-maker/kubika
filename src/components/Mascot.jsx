import { useState, useEffect, useRef } from 'react';

const MIN_KEY = 'kubika_mascot_min';

/**
 * Asistente flotante (esquina inferior derecha).
 * Recibe `message` = { text, id } y muestra el globo 5 segundos.
 */
export default function Mascot({ message }) {
  const [minimized, setMinimized] = useState(() => {
    try { return localStorage.getItem(MIN_KEY) === '1'; } catch { return false; }
  });
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

  const toggle = () => {
    setMinimized(m => {
      const next = !m;
      try { localStorage.setItem(MIN_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
    setBubble(null);
  };

  return (
    <div
      className="fixed bottom-4 right-4 z-[900] no-print flex flex-col items-end gap-2 select-none"
    >
      {/* Globo de mensaje */}
      {bubble && !minimized && (
        <div
          key={bubble.id}
          className="animate-scale-in max-w-[240px] bg-white border-2 border-purple-200
                     rounded-2xl rounded-br-sm px-4 py-2.5 text-sm font-semibold text-slate-700
                     shadow-lg shadow-purple-100/60"
        >
          {bubble.text}
        </div>
      )}

      {minimized ? (
        /* Botón para restaurar */
        <button
          onClick={toggle}
          title="Mostrar asistente"
          className="w-16 h-16 rounded-full bg-white border-2 border-purple-300 shadow-md
                     flex items-center justify-center hover:scale-110 transition-transform active:scale-95"
        >
          {imgOk ? (
            <img
              src="mascota.png"
              alt=""
              className="w-11 h-11 object-contain"
              onError={() => setImgOk(false)}
            />
          ) : (
            <span className="text-lg">💡</span>
          )}
        </button>
      ) : (
        /* Mascota */
        <button
          onClick={toggle}
          title="Minimizar asistente"
          className={`relative block group ${pop ? 'animate-bounce-in' : 'animate-float'}`}
          style={{ animationDuration: pop ? undefined : '3s' }}
        >
          <img
            src="mascota.png"
            alt="Asistente Kubika"
            className="w-[150px] h-[150px] object-contain drop-shadow-xl
                       hover:scale-110 transition-transform"
            onError={() => setImgOk(false)}
          />
          {!imgOk && (
            <span className="text-5xl">💡</span>
          )}
          {/* Punto de minimizar */}
          <span
            className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-slate-700 text-white
                       text-xs font-bold items-center justify-center shadow
                       opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ display: 'flex' }}
          >
            –
          </span>
        </button>
      )}
    </div>
  );
}
