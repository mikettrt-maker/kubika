// Generador de retos: 8 operaciones por (grado, operación, nivel)
// Practica los algoritmos escritos con alineación de cifras.
// Formato de números: dígitos puros, punto decimal (como en México).

export const OPERACIONES = [
  { id: 'suma', label: 'Suma', signo: '+' },
  { id: 'resta', label: 'Resta', signo: '−' },
  { id: 'multiplicacion', label: 'Multiplicación', signo: '×' },
  { id: 'division', label: 'División', signo: '÷' },
  { id: 'escritura', label: 'Escritura', signo: '✎' },
];

export const opLabel = (id) => (OPERACIONES.find(o => o.id === id) || {}).label || id;

export const nivelEtiqueta = (n) => (n <= 3 ? 'Básico' : n <= 6 ? 'Medio' : n <= 9 ? 'Avanzado' : 'Reto');

const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const digitStr = (d) => String(rnd(Math.pow(10, d - 1), Math.pow(10, d) - 1));
const decPart = (k) => String(rnd(0, Math.pow(10, k) - 1)).padStart(k, '0');
const num = (intStr, k) => (k > 0 ? `${intStr}.${decPart(k)}` : String(intStr));
const val = (s) => {
  const [i, d = ''] = String(s).split(/[,.]/);
  return Number(i) + (d ? Number(`0.${d}`) : 0);
};
const gb = (grado) => (grado >= 6 ? 2 : grado === 5 ? 1 : 0);
const cap = (d) => Math.min(d, 8);
const clampNivel = (n) => Math.max(1, Math.min(10, n));

// Par de sumandos sin llevar en ninguna columna (misma longitud, sin ceros a la izquierda)
function noCarry(d) {
  let a = '', b = '';
  for (let i = 0; i < d; i++) {
    const x = i === 0 ? rnd(1, 8) : rnd(0, 9);
    const y = rnd(i === 0 ? 1 : 0, 9 - x);
    a += x; b += y;
  }
  return [a, b];
}

// Par para resta sin prestar: cada cifra de b ≤ cifra de a y a > b
function noBorrow(d) {
  let a = '', b = '';
  for (let i = 0; i < d; i++) {
    if (i === 0) {
      const x = rnd(2, 9);
      a += x; b += rnd(1, x - 1);
    } else {
      const x = rnd(0, 9);
      a += x; b += rnd(0, x);
    }
  }
  return [a, b];
}

// Par a − b garantizando a > b (con decimales opcionales)
function restaPair(d1, d2, k1, k2) {
  for (let t = 0; t < 40; t++) {
    const a = num(digitStr(d1), k1);
    const b = num(digitStr(d2), k2);
    if (val(a) > val(b)) return [a, b];
    if (val(b) > val(a)) return [b, a];
  }
  return [num(digitStr(d1 + 1), k1), num(digitStr(1), k2)];
}

// Entero con al menos dos ceros intermedios
function withInteriorZeros(d) {
  const arr = digitStr(d).split('');
  arr[rnd(1, d - 2)] = '0';
  arr[rnd(1, d - 2)] = '0';
  if (arr[0] === '0') arr[0] = '1';
  return arr.join('');
}

// Cociente con un cero interno (salto en la división)
function quotientWithZero(d) {
  const arr = digitStr(d).split('');
  arr[rnd(1, d - 1)] = '0';
  if (arr[0] === '0') arr[0] = '1';
  return arr.join('');
}

// ===== SUMA =====
function genSuma(grado, nivel) {
  const g = gb(grado);
  const D = { 1: 5, 2: 5, 3: 6, 4: 5, 5: 6, 6: 7, 7: 5, 8: 5, 9: 6, 10: 7 };
  const d = cap(D[nivel] + g);
  switch (nivel) {
    case 1: {
      const [a, b] = noCarry(d);
      return [`${a} + ${b}`];
    }
    case 2:
    case 3: {
      const a = digitStr(d);
      const b = digitStr(d);
      return [`${a} + ${b}`];
    }
    case 4: {
      const a = digitStr(d), b = digitStr(d), c = digitStr(d);
      return [`${a} + ${b} + ${c}`];
    }
    case 5: {
      const a = digitStr(d);
      const b = digitStr(Math.max(3, d - rnd(1, 2)));
      return [`${a} + ${b}`];
    }
    case 6: {
      const a = digitStr(d);
      const b = digitStr(d);
      return [`${a} + ${b}`];
    }
    case 7: {
      const k1 = rnd(1, 2);
      const k2 = k1 === 1 ? 2 : 1;
      const a = num(digitStr(d), k1);
      const b = num(digitStr(Math.max(3, d - rnd(0, 1))), k2);
      return [`${a} + ${b}`];
    }
    case 8: {
      const a = num(digitStr(d), 1);
      const b = num(digitStr(rnd(2, 4)), 2);
      return [`${a} + ${b}`];
    }
    case 9: {
      const a = num(digitStr(d), 2);
      const b = num(digitStr(d), 1);
      const c = num(digitStr(Math.max(3, d - 1)), 2);
      return [`${a} + ${b} + ${c}`];
    }
    default: {
      const a = num(digitStr(d), 2);
      const b = num(digitStr(Math.max(3, d - rnd(1, 2))), 1);
      return [`${a} + ${b}`];
    }
  }
}

// ===== RESTA =====
function genResta(grado, nivel) {
  const g = gb(grado);
  const D = { 1: 5, 2: 5, 3: 6, 4: 6, 5: 6, 6: 7, 7: 5, 8: 5, 9: 6, 10: 7 };
  const d = cap(D[nivel] + g);
  switch (nivel) {
    case 1: {
      const [a, b] = noBorrow(d);
      return [`${a} − ${b}`];
    }
    case 2:
    case 3: {
      const [a, b] = restaPair(d, d, 0, 0);
      return [`${a} − ${b}`];
    }
    case 4: {
      let a = '', b = '';
      for (let t = 0; t < 40; t++) {
        a = withInteriorZeros(d);
        b = digitStr(d);
        if (val(a) > val(b)) break;
      }
      if (!(val(a) > val(b))) { const p = restaPair(d, d - 1, 0, 0); return [`${p[0]} − ${p[1]}`]; }
      return [`${a} − ${b}`];
    }
    case 5: {
      const a = digitStr(d);
      const b = digitStr(Math.max(3, d - rnd(1, 2)));
      return [`${a} − ${b}`];
    }
    case 6: {
      const [a, b] = restaPair(d, d, 0, 0);
      return [`${a} − ${b}`];
    }
    case 7: {
      const k1 = rnd(1, 2);
      const k2 = k1 === 1 ? 2 : 1;
      const [a, b] = restaPair(d, Math.max(3, d - rnd(0, 1)), k1, k2);
      return [`${a} − ${b}`];
    }
    case 8: {
      let a = '', b = '';
      for (let t = 0; t < 40; t++) {
        a = `${digitStr(d)}.00`;
        b = num(digitStr(rnd(3, d)), 2);
        if (val(a) > val(b)) break;
      }
      if (!(val(a) > val(b))) { const p = restaPair(d + 1, d, 2, 2); return [`${p[0]} − ${p[1]}`]; }
      return [`${a} − ${b}`];
    }
    case 9: {
      const [a, b] = restaPair(d, d, rnd(1, 2), 2);
      return [`${a} − ${b}`];
    }
    default: {
      const arr = digitStr(d).split('');
      arr[rnd(1, d - 2)] = '0';
      const a = `${arr.join('')}.00`;
      const b = num(digitStr(Math.max(3, d - 1)), 2);
      if (val(a) > val(b)) return [`${a} − ${b}`];
      const p = restaPair(d, d, 2, 2);
      return [`${p[0]} − ${p[1]}`];
    }
  }
}

// ===== MULTIPLICACIÓN =====
function genMult(grado, nivel) {
  const g = gb(grado);
  switch (nivel) {
    case 1: {
      const a = digitStr(cap(5 + g));
      return [`${a} × ${rnd(2, 9)}`];
    }
    case 2: {
      const a = withInteriorZeros(cap(5 + g));
      return [`${a} × ${rnd(3, 9)}`];
    }
    case 3: {
      const a = digitStr(cap(5 + g));
      return [`${a} × ${rnd(11, 99)}`];
    }
    case 4: {
      const a = digitStr(cap(6 + g));
      return [`${a} × ${rnd(11, 99)}`];
    }
    case 5: {
      const a = digitStr(cap(5 + g));
      return [`${a} × ${rnd(101, 999)}`];
    }
    case 6: {
      const a = digitStr(cap(7 + g));
      return [`${a} × ${rnd(101, 999)}`];
    }
    case 7: {
      const k1 = rnd(1, 2);
      const a = num(digitStr(cap(4 + g)), k1);
      return [`${a} × ${rnd(11, 999)}`];
    }
    case 8: {
      const k1 = rnd(1, 2);
      const k2 = k1 === 1 ? 2 : 1;
      const a = num(digitStr(cap(4 + g)), k1);
      const b = num(digitStr(rnd(2, 4)), k2);
      return [`${a} × ${b}`];
    }
    case 9: {
      const a = digitStr(cap(6 + g));
      return [`${a} × ${rnd(1001, 9999)}`];
    }
    default: {
      const k1 = rnd(1, 2);
      const a = num(digitStr(cap(6 + g)), k1);
      return [`${a} × ${rnd(101, 999)}`];
    }
  }
}

// ===== DIVISIÓN =====
function genDiv(grado, nivel) {
  const g = gb(grado);
  const divD = grado === 4 ? rnd(1, 2) : grado === 5 ? 2 : rnd(2, 3);
  const build = (divisorDigits, qDigits, exact, zeroInQ) => {
    const b = digitStr(divisorDigits);
    const q = zeroInQ ? quotientWithZero(qDigits) : digitStr(qDigits);
    let a = Number(b) * Number(q);
    if (!exact) a += rnd(1, Number(b) - 1);
    return [String(a), b];
  };
  let a, b;
  switch (nivel) {
    case 1:
      [a, b] = build(divD, divD === 1 ? 5 : 4, true, false);
      break;
    case 2:
      [a, b] = build(divD, divD === 1 ? 5 : 4, false, false);
      break;
    case 3:
      [a, b] = build(divD, 5, true, false);
      break;
    case 4:
      [a, b] = build(grado === 4 ? 2 : 3, 4, true, false);
      break;
    case 5:
      [a, b] = build(grado === 4 ? 2 : 3, 4, false, false);
      break;
    case 6:
      [a, b] = build(divD, 5, true, true);
      break;
    case 7:
      [a, b] = build(divD, 4, false, false);
      break;
    case 8: {
      b = digitStr(divD);
      a = `${digitStr(cap(5 + g))}.${decPart(rnd(1, 2))}`;
      break;
    }
    case 9: {
      b = num(digitStr(Math.max(2, divD)), rnd(1, 2));
      a = digitStr(cap(6));
      break;
    }
    default: {
      [a, b] = build(3, 4, false, false);
      break;
    }
  }
  return [`${a} ÷ ${b}`];
}

// ===== ESCRITURA DE NÚMEROS =====
// Números (hasta 12 cifras) para escribirlos con letra en el panel del Gimnasio.
// Separadores: coma para millares y punto decimal (formato mexicano).
// Decimales: 4°/5° hasta milésimos (3) en niveles altos; 6° hasta millonésimos (6) en los últimos niveles.
const E_D = { 1: 3, 2: 4, 3: 5, 4: 6, 5: 7, 6: 9, 7: 10, 8: 11, 9: 12, 10: 12 };
function escrituraDecK(grado, nivel) {
  if (nivel <= 6) return 0;
  if (grado === 6) return ({ 7: 2, 8: 3, 9: 6, 10: 6 })[nivel];
  return ({ 7: 1, 8: 2, 9: 3, 10: 3 })[nivel];
}
function genEscritura(grado, nivel) {
  const n = clampNivel(nivel);
  const k = escrituraDecK(grado, n);
  const d = Math.min(E_D[n] + gb(grado), 12);
  let intStr = digitStr(d);
  // Un cero interior para practicar grupos con ceros (45,730,008)
  if (d >= 5 && rnd(0, 1) === 1) {
    const arr = intStr.split('');
    arr[rnd(1, d - 2)] = '0';
    intStr = arr.join('');
  }
  let dec = '';
  if (k > 0) {
    for (let t = 0; t < 12; t++) {
      dec = decPart(k);
      if (!/0$/.test(dec)) break; // sin ceros finales: 0.750 sería ambiguo
    }
    if (dec && k >= 2 && rnd(0, 1) === 1) dec = '0' + dec.slice(1); // cero inicial: 0.045
    if (/0$/.test(dec)) dec = dec.replace(/0+$/, '') || dec;
  }
  const grouped = intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return [dec ? `${grouped}.${dec}` : grouped];
}

const GENS = { suma: genSuma, resta: genResta, multiplicacion: genMult, division: genDiv, escritura: genEscritura };

export function getChallenge(grado, op, nivel) {
  const gen = GENS[op] || genSuma;
  const n = clampNivel(nivel);
  const out = [];
  let guard = 0;
  while (out.length < 8 && guard++ < 300) {
    const [texto] = gen(grado, n);
    if (texto && !out.includes(texto)) out.push(texto);
  }
  return out;
}
