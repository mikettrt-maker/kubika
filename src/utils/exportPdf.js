import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

async function loadLogoWatermark(watermarkSize) {
  try {
    const img = new Image();
    img.src = 'logo.png';
    img.crossOrigin = 'Anonymous';
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
    const w = watermarkSize;
    const h = (img.naturalHeight * w) / img.naturalWidth;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const ctx = tempCanvas.getContext('2d');
    ctx.globalAlpha = 0.08;
    ctx.drawImage(img, 0, 0, w, h);
    return { canvas: tempCanvas, width: w, height: h };
  } catch { return null; }
}

let _katexCssBase64Cache = null;

async function getKatexCssWithFonts() {
  if (_katexCssBase64Cache) return _katexCssBase64Cache;
  let katexHref = '';
  for (const sheet of document.styleSheets) {
    if (sheet.href && sheet.href.includes('katex')) { katexHref = sheet.href; break; }
  }
  if (!katexHref) return '';
  try {
    const cssResp = await fetch(katexHref);
    let css = await cssResp.text();
    const cssBase = katexHref.split('/').slice(0, -1).join('/') + '/';
    const fontRegex = /url\(([^)]+)\)/g;
    const fonts = new Set();
    let m;
    while ((m = fontRegex.exec(css)) !== null) {
      const u = m[1].replace(/['"]/g, '');
      if (u.includes('fonts/') && !u.startsWith('data:')) fonts.add(u);
    }
    for (const u of fonts) {
      try {
        const fullUrl = u.startsWith('http') ? u : cssBase + u;
        const r = await fetch(fullUrl);
        const blob = await r.blob();
        const b64 = await new Promise(res => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result);
          reader.readAsDataURL(blob);
        });
        css = css.split(`url(${u})`).join(`url(${b64})`);
        css = css.split(`url('${u}')`).join(`url('${b64}')`);
        css = css.split(`url("${u}")`).join(`url("${b64}")`);
      } catch {}
    }
    _katexCssBase64Cache = css;
    return css;
  } catch { return ''; }
}

async function renderKatexToImage(el) {
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  if (w === 0 || h === 0) return null;
  try {
    const css = await getKatexCssWithFonts();
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml"><style>${css}</style>${el.outerHTML}</div></foreignObject></svg>`;
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise(r => { img.onload = r; img.onerror = r; img.src = url; });
    const off = document.createElement('canvas');
    off.width = w * 2;
    off.height = h * 2;
    const ctx = off.getContext('2d');
    ctx.scale(2, 2);
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    return { canvas: off, width: w, height: h };
  } catch { return null; }
}

/**
 * Calcula la caja que envuelve todo el contenido dibujado en el lienzo
 * (regletas, textos, figuras, antenas, encabezado) para capturar solo
 * esa región y que el trabajo llene la página del PDF.
 * Devuelve { x, y, width, height } en coordenadas del lienzo, o null.
 */
function computeContentBox(canvasElement) {
  const base = canvasElement.getBoundingClientRect();
  const selectors = '[data-sheet-header],[data-rod-id],[data-antenna-id],' +
    '[data-quad-id],[data-poly-id],[data-math-text],[data-free-text]';
  const candidates = canvasElement.querySelectorAll(selectors);

  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  const addRect = (r) => {
    if (r.width <= 0 || r.height <= 0) return;
    if (r.left < x1) x1 = r.left;
    if (r.top < y1) y1 = r.top;
    if (r.right > x2) x2 = r.right;
    if (r.bottom > y2) y2 = r.bottom;
  };

  for (const el of candidates) {
    addRect(el.getBoundingClientRect());
    for (const n of el.querySelectorAll('*')) {
      if (n.classList?.contains('no-print')) continue;
      addRect(n.getBoundingClientRect());
    }
  }

  if (!isFinite(x1)) return null;

  const M = 36; // margen alrededor del contenido
  const W = canvasElement.offsetWidth;
  const H = canvasElement.offsetHeight;
  const left = Math.max(0, Math.floor(x1 - base.left - M));
  const top = Math.max(0, Math.floor(y1 - base.top - M));
  const right = Math.min(W, Math.ceil(x2 - base.left + M));
  const bottom = Math.min(H, Math.ceil(y2 - base.top + M));
  const width = right - left;
  const height = bottom - top;
  if (width < 100 || height < 80) return null;
  return { x: left, y: top, width, height };
}

export async function exportToPdf(canvasElement, studentName = 'Alumno', workspaceName = 'Diseño sin título') {
  try {
    const area = computeContentBox(canvasElement);
    const captured = await html2canvas(canvasElement, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#f8f9fc',
      logging: false,
      ignoreElements: (element) => element.classList?.contains('no-print'),
      // En la captura se quita el brillo blanco de las regletas (pseudo-elementos
      // y sombras inset) para que el color sólido salga fiel en el PDF.
      onclone: (clonedDoc) => {
        const style = clonedDoc.createElement('style');
        style.textContent = `
          .rod-3d::before, .rod-3d::after { content: none !important; display: none !important; }
          .rod-3d, .rod-3d.rod-selected, .rod-3d.rod-invalid {
            animation: none !important;
            box-shadow: 0 3px 0 rgba(0,0,0,0.30), 0 4px 6px rgba(0,0,0,0.28) !important;
            border: 1px solid rgba(0,0,0,0.30) !important;
          }
          .rod-3d.rod-selected {
            box-shadow: 0 3px 0 rgba(0,0,0,0.30), 0 0 0 3px #4c6ef5 !important;
          }
          .rod-3d.rod-invalid {
            box-shadow: 0 3px 0 rgba(0,0,0,0.30), 0 0 0 2px #ef4444 !important;
          }
        `;
        clonedDoc.head.appendChild(style);
      },
      ...(area ? { x: area.x, y: area.y, width: area.width, height: area.height } : {}),
    });
    const imgData = captured.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(76, 110, 245);
    pdf.text(workspaceName, 10, 12);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    const date = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
    pdf.text(`Alumno: ${studentName}  |  Fecha: ${date}`, 10, 18);
    pdf.setDrawColor(76, 110, 245);
    pdf.setLineWidth(0.5);
    pdf.line(10, 20, pageWidth - 10, 20);
    const imgWidth = pageWidth - 20;
    const imgHeight = (captured.height * imgWidth) / captured.width;
    const maxImgHeight = pageHeight - 30;
    const finalWidth = imgHeight > maxImgHeight ? (captured.width * maxImgHeight) / captured.height : imgWidth;
    const finalHeight = imgHeight > maxImgHeight ? maxImgHeight : imgHeight;
    const xOffset = (pageWidth - finalWidth) / 2;
    const yOffset = 23;
    const logoWatermark = await loadLogoWatermark(60);
    if (logoWatermark) {
      const wmX = xOffset + (finalWidth - logoWatermark.width * 0.264583) / 2;
      const wmY = yOffset + (finalHeight - logoWatermark.height * 0.264583) / 2;
      pdf.addImage(logoWatermark.canvas, 'PNG', wmX, wmY, logoWatermark.width * 0.264583, logoWatermark.height * 0.264583);
    }
    pdf.addImage(imgData, 'PNG', xOffset, yOffset, finalWidth, finalHeight);
    pdf.setFontSize(8);
    pdf.setTextColor(180, 180, 180);
    pdf.text('Generado con Kubika - Herramienta educativa de Regletas de Cuisenaire', pageWidth / 2, pageHeight - 5, { align: 'center' });
    const fileName = `kubika-${studentName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`;
    pdf.save(fileName);
    return true;
  } catch (error) {
    console.error('Error al exportar PDF:', error);
    throw error;
  }
}
