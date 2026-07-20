export const GEO_UNIT = 80;
export const GEO_ORIGIN_X = 100;
export const GEO_ORIGIN_Y = 100;
export const GEO_SIZE = 5;
export const PIVOT_RADIUS = 7;
export const CIRCLE_PIVOTS = 24;

let pivotIdCounter = 0;
export function generatePivotId() {
  return `gp_${++pivotIdCounter}_${Date.now()}`;
}

let bandIdCounter = 0;
export function generateBandId() {
  return `gb_${++bandIdCounter}_${Date.now()}`;
}

export function getRectPivots() {
  const pivots = [];
  for (let row = 0; row < GEO_SIZE; row++) {
    for (let col = 0; col < GEO_SIZE; col++) {
      pivots.push({
        id: generatePivotId(),
        x: GEO_ORIGIN_X + (col + 0.5) * GEO_UNIT,
        y: GEO_ORIGIN_Y + (row + 0.5) * GEO_UNIT,
        type: 'rect',
      });
    }
  }
  return pivots;
}

export function getCirclePivots() {
  const centerX = GEO_ORIGIN_X + (GEO_SIZE / 2) * GEO_UNIT;
  const centerY = GEO_ORIGIN_Y + (GEO_SIZE / 2) * GEO_UNIT;
  const radius = (GEO_SIZE / 2 - 0.5) * GEO_UNIT;
  const pivots = [];

  pivots.push({
    id: generatePivotId(),
    x: centerX,
    y: centerY,
    type: 'circle-center',
  });

  for (let i = 0; i < CIRCLE_PIVOTS; i++) {
    const angle = (i * 15 * Math.PI) / 180;
    pivots.push({
      id: generatePivotId(),
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      type: 'circle-perim',
      angle: i * 15,
    });
  }
  return pivots;
}

export const BAND_COLORS = [
  { name: 'Rojo', value: '#EF4444' },
  { name: 'Naranja', value: '#F97316' },
  { name: 'Ámbar', value: '#F59E0B' },
  { name: 'Amarillo', value: '#EAB308' },
  { name: 'Lima', value: '#84CC16' },
  { name: 'Verde', value: '#22C55E' },
  { name: 'Esmeralda', value: '#10B981' },
  { name: 'Cian', value: '#06B6D4' },
  { name: 'Celeste', value: '#0EA5E9' },
  { name: 'Azul', value: '#3B82F6' },
  { name: 'Índigo', value: '#6366F1' },
  { name: 'Violeta', value: '#8B5CF6' },
  { name: 'Púrpura', value: '#A855F7' },
  { name: 'Fucsia', value: '#D946EF' },
  { name: 'Rosa', value: '#EC4899' },
  { name: 'Blanco', value: '#FFFFFF' },
];

export function distanceBetween(p1, p2) {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

let manualPivotIdCounter = 0;
export function generateManualPivotId() {
  return `gmp_${++manualPivotIdCounter}_${Date.now()}`;
}


