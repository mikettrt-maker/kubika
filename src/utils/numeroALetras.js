// Número → letras (español, formato México) y comparación flexible
// para validar la escritura de números del Gimnasio.
// Acepta variantes razonables: sin acentos, sin "y", cien/ciento,
// docientos/doscientos, apócopes (uno/un), género de las órdenes
// decimales y lectura "con ..." o "punto ...".

const UNI = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const DEC = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CEN = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
  'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
// Orden según el TOTAL de decimales: 1, 2, 3 y 6 (los que genera el Gimnasio)
const ORD = { 1: ['décima', 'décimas'], 2: ['centésima', 'centésimas'], 3: ['milésima', 'milésimas'], 6: ['millonésima', 'millonésimas'] };

// 1..999 con letra; apocope del "uno" cuando la escala sigue detrás
function lee999(n, apocope) {
  if (n === 0) return '';
  if (n === 100) return 'cien';
  let s = '';
  const c = Math.floor(n / 100), r = n % 100;
  if (c > 0) s += (c === 1 ? 'ciento' : CEN[c]);
  if (r > 0) {
    if (s) s += ' ';
    if (r < 30) s += UNI[r]; // dieciséis…veintinueve (UNI ya los trae listos)
    else {
      const d = Math.floor(r / 10), u = r % 10;
      s += DEC[d];
      if (u > 0) s += ' y ' + UNI[u];
    }
  }
  if (apocope) {
    if (s === 'veintiuno') s = 'veintiún';
    else if (s.endsWith('uno')) s = s.slice(0, -3) + 'un';
  }
  return s;
}

// Entero de 1 a 12 cifras (sin comas) → letras
function leeEntero(str) {
  if (!str || /^0+$/.test(str)) return 'cero';
  const groups = [];
  let s = str;
  while (s.length > 0) { groups.unshift(s.slice(-3)); s = s.slice(0, -3); }
  const ESC = ['', 'mil', 'millones', 'mil millones', 'billones'];
  const partes = [];
  groups.forEach((g, idx) => {
    const v = parseInt(g, 10);
    if (!v) return; // grupo de ceros: no se lee
    const esc = groups.length - 1 - idx; // 0 = unidades
    if (esc === 1 && v === 1) { partes.push('mil'); return; } // "mil", nunca "un mil"
    if ((esc === 2 || esc === 4) && v === 1) { partes.push(esc === 2 ? 'un millón' : 'un billón'); return; }
    const txt = lee999(v, esc > 0);
    partes.push(esc > 0 ? `${txt} ${ESC[esc] ?? ''}`.trim() : txt);
  });
  return partes.length ? partes.join(' ') : 'cero';
}

/** Forma canónica (se usa para revelar la respuesta correcta). */
export function numeroALetras(str) {
  const s = String(str).trim();
  const [intPart, decRaw = ''] = s.split('.');
  const intWords = leeEntero(intPart.replace(/,/g, ''));
  if (!decRaw) return intWords;
  const k = decRaw.length;
  const decVal = parseInt(decRaw, 10);
  if (!decVal) return intWords; // sin parte decimal legible
  const decWords = leeEntero(String(decVal));
  const ord = ORD[k];
  if (ord) {
    let fem = decWords;
    if (fem.endsWith('uno')) fem = fem.slice(0, -3) + 'una'; // uno/veintiuno → una/veintiuna
    const sing = decVal === 1;
    return `${intWords} con ${fem} ${sing ? ord[0] : ord[1]}`;
  }
  return `${intWords} punto ${decWords}`;
}

/** Variantes aceptadas: lectura "con ... órdenes" y lectura "punto ...". */
export function variantesLetras(str) {
  const s = String(str).trim();
  const [intPart, decRaw = ''] = s.split('.');
  const out = [];
  const canon = numeroALetras(s);
  if (canon) out.push(canon);
  if (decRaw && parseInt(decRaw, 10)) {
    const intWords = leeEntero(intPart.replace(/,/g, ''));
    out.push(`${intWords} punto ${leeEntero(String(parseInt(decRaw, 10)))}`);
  }
  return [...new Set(out)];
}

/** Normalización flexible: minúsculas, sin acentos/puntuación, "y"/"cero"
 *  opcionales, ciento→cien, docientos→doscientos, uno→un, género libre de
 *  las órdenes decimales. Se aplica IGUAL a ambos lados de la comparación. */
export function normalizaFlexible(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\b(y|cero)\b/g, ' ')
    .replace(/\bciento\b/g, 'cien')
    .replace(/\bdocientos\b/g, 'doscientos')
    .replace(/\bmillones\b/g, 'millon')
    .replace(/\bbillones\b/g, 'billon')
    .replace(/uno\b/g, 'un')
    .replace(/\b(decimas|decimos)\b/g, 'decim')
    .replace(/\b(centesimas|centesimos)\b/g, 'centesim')
    .replace(/\b(milesimas|milesimos)\b/g, 'milesim')
    .replace(/\b(millonesimas|millonesimos)\b/g, 'millonesim')
    .replace(/\s+/g, ' ')
    .trim();
}

/** ¿El texto escrito por el alumno significa el número? (comparación flexible) */
export function comparaLetras(numStr, texto) {
  const t = normalizaFlexible(texto);
  if (!t) return false;
  return variantesLetras(numStr).some(v => normalizaFlexible(v) === t);
}
