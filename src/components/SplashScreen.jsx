import { useState, useEffect, useRef, useCallback } from 'react';

const MIN_DURATION = 2000;

export default function SplashScreen({ isLoading, onFinish }) {
  const [state, setState] = useState('entering');
  const startTime = useRef(Date.now());
  const finishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);

  onFinishRef.current = onFinish;

  useEffect(() => {
    if (!isLoading && !finishedRef.current) {
      finishedRef.current = true;
      const elapsed = Date.now() - startTime.current;
      const remaining = Math.max(0, MIN_DURATION - elapsed);

      const timer = setTimeout(() => setState('closing'), remaining);
      const hideTimer = setTimeout(() => {
        setState('hidden');
        if (onFinishRef.current) onFinishRef.current();
      }, remaining + 500);

      return () => { clearTimeout(timer); clearTimeout(hideTimer); };
    }
  }, [isLoading]);

  useEffect(() => {
    if (isLoading && finishedRef.current) {
      finishedRef.current = false;
      startTime.current = Date.now();
      setState('entering');
    }
  }, [isLoading]);

  if (state === 'hidden') return null;

  return (
    <div className={`splash-container ${state === 'closing' ? 'animate-fade-out' : ''}`}>
      {/* Gradientes decorativos de fondo */}
      <div className="absolute inset-0" style={{
        background: `
          radial-gradient(ellipse at 20% 50%, rgba(76, 110, 245, 0.12) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 50%, rgba(124, 58, 237, 0.12) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 0%, rgba(76, 110, 245, 0.06) 0%, transparent 50%)
        `
      }} />

      <div className="splash-logo flex flex-col items-center relative z-10">
        <div className="relative">
          <img
            src="logo.png"
            alt="Kubika"
            className="w-80 h-80 object-contain drop-shadow-2xl"
            id="splash-logo-img"
            onError={(e) => {
              e.target.style.display = 'none';
              const fallback = e.target.parentElement.querySelector('.splash-logo-fallback');
              if (fallback) fallback.style.display = 'flex';
            }}
          />
          <span className="splash-logo-fallback absolute inset-0 hidden items-center justify-center text-8xl font-display font-extrabold text-white drop-shadow-lg pointer-events-none">
            K
          </span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 mt-10 relative z-10">
        <div className="splash-progress-track">
          <div className="splash-progress-bar" />
        </div>

        <div className="splash-dots">
          <div className="splash-dot" />
          <div className="splash-dot" />
          <div className="splash-dot" />
        </div>
      </div>

      <p className="absolute bottom-12 text-xs text-white/15 font-medium tracking-widest uppercase">
        Cargando...
      </p>
    </div>
  );
}
