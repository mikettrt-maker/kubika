import { useRef, useEffect } from 'react';
import { getChallenge, nivelEtiqueta, opLabel } from '../utils/retosGenerator';
import { comparaRespuesta } from '../utils/validacion';
import { comparaLetras, numeroALetras } from '../utils/numeroALetras';

const GRADOS = [4, 5, 6];
const EMPTY = ['', '', '', '', '', '', '', ''];
const N = 8;

const estadoEsc = (num, txt) => (!txt || !txt.trim() ? 'falta' : (comparaLetras(num, txt) ? 'ok' : 'mal'));

function Mark({ estado }) {
  if (estado === 'ok') return <span className="text-emerald-600 font-black text-lg leading-none">✓</span>;
  if (estado === 'mal') return <span className="text-red-500 font-black text-lg leading-none">✗</span>;
  return <span className="text-amber-500 font-black text-lg leading-none">?</span>;
}

/**
 * Panel derecho unificado del Gimnasio (v3.8.0, intentos v3.9.0).
 * Modo reto de operaciones: 8 recuadros de respuesta con validación automática.
 * Modo escritura (reto o libre): 8 números con letra, también con validación.
 * La validación se lanza con el botón Validar (solo con las 8 respuestas
 * llenas); después las marcas y el resultado se recalculan en vivo y las
 * respuestas correctas se revelan debajo de cada fallo (y van al PDF).
 * Cada Validar cuenta un intento con su puntaje (intentos = [6, 8]); si el
 * alumno corrige respuestas se marca "pendiente" y Validar registra otro.
 */
export default function PanelReto({ value, onChange, reto, onOpenRetos, defaultGrado, onPatchReto, onTerminate }) {
  const state = value.escritura;
  const esRetoEsc = reto?.op === 'escritura';
  const esOps = !!(reto && reto.op && !esRetoEsc);
  const inpRefs = useRef([]);

  // Sincronizar escritura con el reto del profe o generar una tanda inicial
  useEffect(() => {
    if (esRetoEsc) {
      if (!state || JSON.stringify(state.nums) !== JSON.stringify(reto.ejercicios)) {
        onChange(prev => ({
          ...prev,
          escritura: { grado: reto.grado, nivel: reto.nivel, nums: reto.ejercicios, texts: [...EMPTY], validado: false, pendiente: false, intentos: [] },
        }));
      }
    } else if (!reto && !state) {
      const g = GRADOS.includes(defaultGrado) ? defaultGrado : 4;
      onChange(prev => prev.escritura ? prev : ({
        ...prev,
        escritura: { grado: g, nivel: 1, nums: getChallenge(g, 'escritura', 1), texts: [...EMPTY], validado: false, pendiente: false, intentos: [] },
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, reto, esRetoEsc, defaultGrado]);

  const ej = (reto?.ejercicios || []).slice(0, N);
  const resp = esOps ? (reto.respuestas && reto.respuestas.length ? reto.respuestas : [...EMPTY]) : [];
  const texts = (state?.texts || []).length ? state.texts : EMPTY;
  const nums = state?.nums || [];
  const validado = esOps ? !!reto.validado : !!state?.validado;
  const pendiente = esOps ? !!reto.pendiente : !!state?.pendiente;
  const intentos = (esOps ? reto.intentos : state?.intentos) || [];

  const faltan = esOps
    ? ej.slice(0, N).filter((_, i) => !(resp[i] || '').trim()).length
    : nums.slice(0, N).filter((_, i) => !(texts[i] || '').trim()).length;
  const total = esOps ? ej.length : nums.length;
  const complete = total === N && faltan === 0;

  let okCount = 0;
  if (esOps) ej.forEach((e, i) => { if (comparaRespuesta(e, resp[i] || '').estado === 'ok') okCount++; });
  else nums.forEach((n, i) => { if (estadoEsc(n, texts[i]) === 'ok') okCount++; });

  const validar = () => {
    if (!complete) return;
    if (validado && !pendiente) return; // ya validado sin cambios: no cuenta doble
    if (esOps) {
      onPatchReto?.({ validado: true, pendiente: false, intentos: [...intentos, okCount] });
    } else {
      onChange(prev => ({
        ...prev,
        escritura: { ...prev.escritura, validado: true, pendiente: false, intentos: [...(prev.escritura?.intentos || []), okCount] },
      }));
    }
  };

  const setResp = (i, v) => {
    const next = resp.slice(0, N);
    while (next.length < N) next.push('');
    next[i] = v;
    onPatchReto?.({ respuestas: next, ...(reto.validado ? { pendiente: true } : {}) });
  };

  const setText = (i, v) => {
    onChange(prev => {
      const st = prev.escritura;
      if (!st) return prev;
      const t = (st.texts || []).slice();
      while (t.length <= i) t.push('');
      t[i] = v;
      return { ...prev, escritura: { ...st, texts: t, pendiente: !!st.validado } };
    });
  };

  const clearAnswers = () => {
    if (faltan === total) return;
    if (!confirm('¿Borrar tus respuestas?')) return;
    if (esOps) onPatchReto?.({ respuestas: [...EMPTY], validado: false, pendiente: false });
    else onChange(prev => ({ ...prev, escritura: { ...prev.escritura, texts: [...EMPTY], validado: false, pendiente: false } }));
  };

  const regen = (grado, nivel) => {
    const hasText = texts.some(t => t && t.trim());
    if (hasText && !confirm('¿Generar otros números? Se borrarán tus respuestas y los intentos.')) return;
    onChange(prev => ({
      ...prev,
      escritura: { grado, nivel, nums: getChallenge(grado, 'escritura', nivel), texts: [...EMPTY], validado: false, pendiente: false, intentos: [] },
    }));
  };

  if (!esOps && !state) return null;

  const titulo = esOps
    ? `${reto.grado}° · ${opLabel(reto.op)} · Nivel ${reto.nivel}`
    : esRetoEsc
      ? `Escritura · ${state.grado}° · Nivel ${state.nivel}`
      : 'Escritura de números';

  const hint = esOps
    ? (reto.op === 'division'
      ? 'Escribe el cociente hasta décimos (1 decimal): 100 ÷ 3 = 33.3.'
      : 'Escribe solo el resultado en el recuadro. Usa punto para los decimales.')
    : 'Escribe cada número con letra. El autocorrector está apagado: escribe tal cual lo lees.';

  const btn = (onClick, title, children) => (
    <button
      onClick={onClick}
      title={title}
      className="h-7 px-3 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-xs font-black text-slate-500 transition-all"
    >
      {children}
    </button>
  );

  return (
    <aside
      className="w-[420px] max-w-[85vw] shrink-0 bg-white rounded-lg shadow-xl p-4 self-start"
      data-panel-reto
    >
      {/* Fila 1: título + Validar (fuera del PDF) */}
      <div className="no-print mb-3 pb-3 border-b border-slate-200 flex items-center gap-2">
        <span className="text-xl leading-none">{esOps ? '📝' : '✍️'}</span>
        <span className="text-[15px] font-black text-slate-700 leading-tight">{titulo}</span>
        <div className="flex-1" />
        {faltan > 0 && (
          <span className="px-2 py-1 rounded-md bg-amber-100 border border-amber-300 text-xs font-black text-amber-700">
            faltan {faltan}
          </span>
        )}
        <button
          onClick={validar}
          disabled={!complete || (validado && !pendiente)}
          title={
            !complete
              ? 'Faltan respuestas por escribir'
              : validado && !pendiente
                ? 'Ya validado: corrige una respuesta para contar otro intento'
                : 'Revisar las respuestas y contar un intento'
          }
          className={`h-9 px-4 rounded-lg border text-[13px] font-black transition-all ${
            validado && !pendiente
              ? 'bg-emerald-50 border-emerald-300 text-emerald-600'
              : complete
                ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 shadow-md'
                : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          {validado && !pendiente ? '✓ Validado' : 'Validar'}
        </button>
      </div>

      {/* Fila 2: controles del modo (fuera del PDF) */}
      <div className="no-print mb-3 flex items-center gap-2 flex-wrap">
        {reto ? (
          <>
            {onOpenRetos && btn(onOpenRetos, 'Elegir otro reto', 'Otro reto')}
            {onTerminate && btn(onTerminate, 'Terminar el reto', 'Terminar')}
            {btn(clearAnswers, 'Borrar todas las respuestas', 'Limpiar')}
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Grado</span>
              {GRADOS.map(g => (
                <button
                  key={g}
                  onClick={() => regen(g, state.nivel)}
                  className={`h-8 min-w-[36px] px-2 rounded-md border text-xs font-black transition-all ${
                    state.grado === g
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'
                  }`}
                >
                  {g}°
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Nivel</span>
              <select
                value={state.nivel}
                onChange={(e) => regen(state.grado, Number(e.target.value))}
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 outline-none focus:border-indigo-400"
                title="Nivel del reto de escritura"
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n} · {nivelEtiqueta(n)}</option>
                ))}
              </select>
            </div>
            <div className="flex-1" />
            {btn(() => regen(state.grado, state.nivel), 'Generar otros 8 números', 'Nuevo')}
            {btn(clearAnswers, 'Borrar todas las respuestas', 'Limpiar')}
          </>
        )}
      </div>

      {/* Fila 3: resumen con intentos (imprimible) o pista (no imprime) */}
      {validado ? (
        <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[13px] font-black text-emerald-700">
          <div>
            Resultado: {okCount}/{total} correctas
            {pendiente && <span className="font-bold text-amber-600"> · cambios sin validar</span>}
          </div>
          {intentos.length > 0 && (
            <div className="font-bold text-emerald-600">
              Intentos: {intentos.length}
              {intentos.length === 1 && intentos[0] === total
                ? ' (a la primera)'
                : ` · ${intentos.map(x => `${x}/${total}`).join(' · ')}`}
            </div>
          )}
        </div>
      ) : (
        <p className="no-print mb-3 text-xs leading-snug text-slate-400">{hint}</p>
      )}

      {/* Ejercicios (sí van al PDF) */}
      {esOps ? (
        ej.length === 0 ? (
          <p className="text-[11px] text-slate-400">Este reto no tiene ejercicios. Pulsa Terminar.</p>
        ) : (
          <ol className="space-y-2.5">
            {ej.map((expr, i) => {
              const r = comparaRespuesta(expr, resp[i] || '');
              return (
                <li key={i}>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-black flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm font-black text-slate-800 tracking-wide flex-1 leading-tight break-words">{expr}</span>
                    <span className="text-slate-400 font-bold text-sm">=</span>
                    <input
                      data-answer-input
                      ref={(el) => { inpRefs.current[i] = el; }}
                      value={resp[i] || ''}
                      onChange={(e) => setResp(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const nx = inpRefs.current[i + 1];
                          if (nx) nx.focus();
                        }
                      }}
                      inputMode="decimal"
                      placeholder="…"
                      spellCheck={false}
                      autoCorrect="off"
                      autoCapitalize="off"
                      autoComplete="off"
                      className="w-[104px] shrink-0 rounded-md border border-slate-200 px-2 py-1.5 text-[15px] font-bold text-slate-800 text-center outline-none focus:border-indigo-400 placeholder:text-slate-300"
                      style={{ background: '#fff' }}
                    />
                    {validado && <span className="w-5 flex justify-center shrink-0"><Mark estado={r.estado} /></span>}
                  </div>
                  {validado && r.estado !== 'ok' && (
                    <div className="text-xs font-bold text-red-500" style={{ paddingLeft: 28 }}>
                      → {r.esperado}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )
      ) : (
        <ol className="space-y-3">
          {nums.slice(0, N).map((n, i) => {
            const estado = estadoEsc(n, texts[i]);
            return (
              <li key={i}>
                <div className="flex items-baseline gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-black flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-[15px] font-black text-slate-800 tracking-wide">{n}</span>
                  {validado && <span className="ml-auto shrink-0"><Mark estado={estado} /></span>}
                </div>
                <textarea
                  data-answer-input
                  rows={4}
                  value={texts[i] || ''}
                  onChange={(e) => setText(i, e.target.value)}
                  placeholder="Escríbelo con letra…"
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                  autoComplete="off"
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[14px] leading-snug text-slate-800 outline-none focus:border-indigo-400 resize-none placeholder:text-slate-300"
                  style={{ background: '#fff' }}
                />
                {validado && estado !== 'ok' && (
                  <div className="text-xs font-bold text-red-500 leading-snug">
                    → {numeroALetras(n)}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}
