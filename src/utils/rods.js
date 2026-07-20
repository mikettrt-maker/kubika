/**
 * Definiciones de las 10 Regletas de Cuisenaire
 * Cada regleta tiene un valor (1-10), un color oficial, nombre y tamaño proporcional.
 * La unidad base es 50px por cada valor.
 */

export const UNIT_SIZE = 40; // Tamaño en px por unidad (1 cm)
export const ROD_HEIGHT = 40; // Altura fija de cada regleta (1 cm)

export const RODS = [
  {
    value: 1,
    name: 'Blanco',
    color: '#FFFFFF',
    textColor: '#374151',
    cssClass: 'rod-white',
  },
  {
    value: 2,
    name: 'Rojo',
    color: '#E74C3C',
    textColor: '#FFFFFF',
    cssClass: '',
  },
  {
    value: 3,
    name: 'Verde claro',
    color: '#2ECC71',
    textColor: '#FFFFFF',
    cssClass: '',
  },
  {
    value: 4,
    name: 'Rosa',
    color: '#FF6B9D',
    textColor: '#FFFFFF',
    cssClass: '',
  },
  {
    value: 5,
    name: 'Amarillo',
    color: '#F1C40F',
    textColor: '#374151',
    cssClass: '',
  },
  {
    value: 6,
    name: 'Verde oscuro',
    color: '#27AE60',
    textColor: '#FFFFFF',
    cssClass: '',
  },
  {
    value: 7,
    name: 'Negro',
    color: '#2C3E50',
    textColor: '#FFFFFF',
    cssClass: 'rod-dark',
  },
  {
    value: 8,
    name: 'Café',
    color: '#8B4513',
    textColor: '#FFFFFF',
    cssClass: 'rod-dark',
  },
  {
    value: 9,
    name: 'Azul',
    color: '#3498DB',
    textColor: '#FFFFFF',
    cssClass: '',
  },
  {
    value: 10,
    name: 'Naranja',
    color: '#E67E22',
    textColor: '#FFFFFF',
    cssClass: '',
  },
];

/**
 * Calcula el ancho de una regleta según su valor
 */
export function getRodWidth(value) {
  return value * UNIT_SIZE;
}

/**
 * Genera un ID único para cada instancia de regleta en el lienzo
 */
export function generateRodId() {
  return `rod-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Genera un ID único para cada caja de texto matemático
 */
export function generateMathId() {
  return `math-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Genera un ID único para cada antena
 */
export function generateAntennaId() {
  return `ant-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Crea las filas iniciales para una antena (10 filas vacías)
 */
export function createAntennaRows(count = 10) {
  return Array.from({ length: count }, () => ({ left: '', right: '' }));
}

export const ANTENNA_ROW_HEIGHT = 30;
export const ANTENNA_COL_WIDTH = 64;
export const ANTENNA_TOP_HEIGHT = 36;
