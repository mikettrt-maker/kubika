import { useEffect } from 'react';
import { getChallenge, nivelEtiqueta } from '../utils/retosGenerator';

const GRADOS = [4, 5, 6];
const EMPTY = ['', '', '', '', '', '', '', ''];

/**
 * Herramienta "Escritura de números" — lado derecho de la cuadrícula del Gimnasio.
 * Muestra 8 números (hasta 12 cifras, con decimales según grado/nivel) y el alumno
 * los escribe con letra en un textarea SIN autocorrector; el profe revisa con el PDF.
 * Estado persistido en value.escritura = { grado, nivel, nums, texts }.
 */
export default function EscrituraPanel({ value, onChange, reto, onOpenRetos, defaultGrado }) {
  const state = value.escritura;
  const esRetoActivo = reto?.op === 'escritura';

  // Sincronizar con el reto del profe o generar una tanda inicial
  useEffect(() => {
    if (esRetoActivo) {
      if (!state || JSON.stringify(state.nums) !== JSON.stringify(reto.ejercicios)) {
        onChange(prev => ({
          ...prev,
          escritura: { grado: reto.grado, nivel: reto.nivel, nums: reto.ejercicios, texts: [...EMPTY] },
        }));
      }
    } else if (!state) {
      const g = GRADOS.includes(defaultGrado) ? defaultGrado : 4;
      onChange(prev => prev.escritura ? prev : ({
        ...prev,
        escritura: { grado: g, nivel: 1, nums: getChallenge(g, 'escritura', 1), texts: [...EMPTY] },
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, reto, esRetoActivo, defaultGrado]);

  if (!state) return null;

  const hasText = (state.texts || []).some(t => t && t.trim());

  const regen = (grado, nivel) => {
    if (hasText && !confirm('¿Generar otros números? Se borrarán tus respuestas de escritura.')) return;
    onChange(prev => ({
      ...prev,
      escritura: { grado, nivel, nums: getChallenge(grado, 'escritura', nivel), texts: [...EMPTY] },
    }));
  };

  const clearTexts = () => {
    if (!hasText) return;
    if (!confirm('¿Borrar tus respuestas de escritura?')) return;
    onChange(prev => ({ ...prev, escritura: { ...prev.escritura, texts: [...EMPTY] } }));
  };

  const setText = (i, v) => {
    onChange(prev => {
      const st = prev.escritura;
      if (!st) return prev;
      const texts = (st.texts || []).slice();
      while (texts.length <= i) texts.push('');
      texts[i] = v;
      return { ...prev, escritura: { ...st, texts } };
    });
  };

  const nums = state.nums || [];

  return (
    <aside
      className="w-[336px] shrink-0 bg-white rounded-lg shadow-xl p-3 self-start"
      data-escritura-panel
    >
      {/* Controles (fuera del PDF) */}
      <div className="no-print mb-2.5 pb-2.5 border-b border-slate-200">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base leading-none">✍️</span>
          <span className="text-[13px] font-black text-slate-700">Escritura de números</span>
          <div className="flex-1" />
          {esRetoActivo && onOpenRetos && (
            <button
              onClick={onOpenRetos}
              className="h-6 px-2 rounded-md bg-amber-100 hover:bg-amber-200 border border-amber-300 text-[10px] font-black text-amber-700 transition-all"
              title="Elegir otro reto"
            >
              Otro reto
            </button>
          )}
        </div>

        {esRetoActivo ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-black text-amber-700">
              Reto del profe: {state.grado}° · Nivel {state.nivel}
            </span>
            <button
              onClick={clearTexts}
              className="h-6 px-2 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-[10px] font-black text-slate-500 transition-all"
              title="Borrar todas las respuestas"
            >
              Limpiar
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Grado</span>
              {GRADOS.map(g => (
                <button
                  key={g}
                  onClick={() => regen(g, state.nivel)}
                  className={`h-6 min-w-[30px] px-1 rounded-md border text-[11px] font-black transition-all ${
                    state.grado === g
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'
                  }`}
                >
                  {g}°
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nivel</span>
              <select
                value={state.nivel}
                onChange={(e) => regen(state.grado, Number(e.target.value))}
                className="h-6 rounded-md border border-slate-200 bg-white px-1 text-[11px] font-bold text-slate-600 outline-none focus:border-indigo-400"
                title="Nivel del reto de escritura"
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n} · {nivelEtiqueta(n)}</option>
                ))}
              </select>
            </div>
            <div className="flex-1" />
            <button
              onClick={() => regen(state.grado, state.nivel)}
              className="h-6 px-2 rounded-md bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-[10px] font-black text-indigo-600 transition-all"
              title="Generar otros 8 números"
            >
              Nuevo
            </button>
            <button
              onClick={clearTexts}
              className="h-6 px-2 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-[10px] font-black text-slate-500 transition-all"
              title="Borrar todas las respuestas"
            >
              Limpiar
            </button>
          </div>
        )}

        <p className="mt-2 text-[10px] leading-snug text-slate-400">
          Escribe cada número con letra. El autocorrector está apagado: escribe tal cual lo lees.
        </p>
      </div>

      {/* Ejercicios (sí van al PDF) */}
      <ol className="space-y-2">
        {nums.map((n, i) => (
          <li key={i}>
            <div className="flex items-baseline gap-1.5">
              <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[9px] font-black flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="text-[13px] font-black text-slate-800 tracking-wide">{n}</span>
            </div>
            <textarea
              data-escritura-input
              rows={3}
              value={(state.texts || [])[i] || ''}
              onChange={(e) => setText(i, e.target.value)}
              placeholder="Escríbelo con letra…"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              autoComplete="off"
              className="mt-0.5 w-full rounded-md border border-slate-200 px-1.5 py-1 text-[12px] leading-snug text-slate-800 outline-none focus:border-indigo-400 resize-none placeholder:text-slate-300"
              style={{ background: '#fff' }}
            />
          </li>
        ))}
      </ol>
    </aside>
  );
}
