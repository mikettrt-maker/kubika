// Validación de respuestas numéricas del Gimnasio (v3.8.0).
// Formato México: coma para millares, punto decimal.
// Divisiones: el resultado se escribe hasta décimos (1 decimal) y SOLO se
// acepta esa forma (100 ÷ 3 → 33.3). Las demás operaciones se aceptan con
// tolerancia mínima (1e-6) para ruido de coma flotante.

const esDiv = (expr) => String(expr).includes('÷');

/** "45,730.25" → 45730.25 · "33.3" → 33.3 · basura → null */
export function parseNum(texto) {
  let s = String(texto ?? '').trim().replace(/−/g, '-').replace(/\s+/g, '');
  if (!s) return null;
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');
  if (!/^-?(\d+(\.\d+)?|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Resultado esperado de la expresión; ÷ redondeado a décimos. */
export function esperada(expr) {
  // Las comas de millares (si las hubiera) no forman parte de los operandos
  const toks = String(expr).replace(/,/g, '').match(/-?\d+(?:\.\d+)?|[+\-−×÷]/g);
  if (!toks) return null;
  let acc = null;
  let op = '+';
  for (const t of toks) {
    if (/^[+\-−×÷]$/.test(t)) { op = t; continue; }
    const v = parseNum(t);
    if (v === null) return null;
    if (acc === null) { acc = v; continue; }
    if (op === '+') acc += v;
    else if (op === '-' || op === '−') acc -= v;
    else if (op === '×') acc *= v;
    else if (op === '÷') acc /= v;
  }
  if (acc === null || !Number.isFinite(acc)) return null;
  if (esDiv(expr)) return Math.round(acc * 10) / 10;
  return Math.round(acc * 1e6) / 1e6;
}

/** Número → texto con coma de millares y sin ceros sobrantes (45,742,353 · 148.2). */
export function formatoNum(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  const neg = n < 0;
  let [i, d = ''] = String(Math.abs(n)).split('.');
  i = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  d = d.replace(/0+$/, '');
  return (neg ? '−' : '') + i + (d ? '.' + d : '');
}

/** Compara la respuesta del alumno con el resultado esperado.
 *  → { estado: 'ok' | 'mal' | 'falta', esperado } (esperado ya formateado). */
export function comparaRespuesta(expr, texto) {
  const exp = esperada(expr);
  const esp = exp === null ? '' : formatoNum(exp);
  const raw = String(texto ?? '').trim();
  if (!raw || exp === null) return { estado: 'falta', esperado: esp };
  const n = parseNum(raw);
  if (n === null) return { estado: 'mal', esperado: esp };
  const tol = esDiv(expr) ? 0.0005 : 1e-6;
  return { estado: Math.abs(n - exp) <= tol ? 'ok' : 'mal', esperado: esp };
}
