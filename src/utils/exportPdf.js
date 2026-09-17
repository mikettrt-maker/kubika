import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

async function loadLogoWatermark(watermarkSize) {
  try {
    const img = new Image();
    img.src = 'logo.png';
    img.crossOrigin = 'Anonymous';

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const w = watermarkSize;
    const h = (img.naturalHeight * w) / img.naturalWidth;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const ctx = tempCanvas.getContext('2d');
    ctx.globalAlpha = 0.08;
    ctx.drawImage(img, 0, 0, w, h);

    return { canvas: tempCanvas, width: w, height: h };
  } catch {
    return null;
  }
}

/**
 * Renderiza un elemento KaTeX a una imagen usando SVG foreignObject.
 * Misma técnica que PdfMathReader.renderPageToCanvas para math texts.
 */
async function renderKatexToImage(el) {
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  if (w === 0 || h === 0) return null;

  try {
    const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    fo.setAttribute('width', w);
    fo.setAttribute('height', h);
    fo.innerHTML = `<div xmlns="http://www.w3.org/1999/xhtml" style="font-size:16px;line-height:1.4;padding:4px;">${el.innerHTML}</div>`;

    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${fo.outerHTML}</svg>`;
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; img.src = url; });

    const offscreen = document.createElement('canvas');
    offscreen.width = w * 2;
    offscreen.height = h * 2;
    const ctx = offscreen.getContext('2d');
    ctx.scale(2, 2);
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);

    return { dataUrl: offscreen.toDataURL('image/png'), width: w, height: h };
  } catch {
    return null;
  }
}

/**
 * Exporta el contenido del lienzo a un archivo PDF.
 */
export async function exportToPdf(canvasElement, studentName = 'Alumno', workspaceName = 'Diseño sin título') {
  try {
    // 1. Capturar el lienzo (las fórmulas KaTeX no se renderizan bien con html2canvas)
    const mainCanvas = await html2canvas(canvasElement, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#f8f9fc',
      logging: false,
      ignoreElements: (element) => element.classList?.contains('no-print'),
    });

    // 2. Buscar contenedores KaTeX y renderizar cada uno encima del canvas capturado
    const katexContainers = canvasElement.querySelectorAll('.katex-display-container');
    const mainCtx = mainCanvas.getContext('2d');
    const canvasRect = canvasElement.getBoundingClientRect();

    for (const container of katexContainers) {
      const katexEl = container.querySelector('.katex');
      if (!katexEl) continue;

      const result = await renderKatexToImage(katexEl);
      if (!result) continue;

      const containerRect = container.getBoundingClientRect();
      const x = (containerRect.left - canvasRect.left) * 2;
      const y = (containerRect.top - canvasRect.top) * 2;

      const img = new Image();
      await new Promise((resolve) => { img.onload = resolve; img.src = result.dataUrl; });
      mainCtx.drawImage(img, x, y, result.width * 2, result.height * 2);
    }

    const imgData = mainCanvas.toDataURL('image/png');

    // 3. Crear PDF en formato carta horizontal (landscape)
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'letter',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(76, 110, 245);
    pdf.text(workspaceName, 10, 12);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    const date = new Date().toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    pdf.text(`Alumno: ${studentName}  |  Fecha: ${date}`, 10, 18);

    pdf.setDrawColor(76, 110, 245);
    pdf.setLineWidth(0.5);
    pdf.line(10, 20, pageWidth - 10, 20);

    const imgWidth = pageWidth - 20;
    const imgHeight = (mainCanvas.height * imgWidth) / mainCanvas.width;
    const maxImgHeight = pageHeight - 30;

    const finalWidth = imgHeight > maxImgHeight
      ? (mainCanvas.width * maxImgHeight) / mainCanvas.height
      : imgWidth;
    const finalHeight = imgHeight > maxImgHeight
      ? maxImgHeight
      : imgHeight;

    const xOffset = (pageWidth - finalWidth) / 2;
    const yOffset = 23;

    const logoWatermark = await loadLogoWatermark(60);
    if (logoWatermark) {
      const wmX = xOffset + (finalWidth - logoWatermark.width * 0.264583) / 2;
      const wmY = yOffset + (finalHeight - logoWatermark.height * 0.264583) / 2;
      const wmWidthMm = logoWatermark.width * 0.264583;
      const wmHeightMm = logoWatermark.height * 0.264583;
      pdf.addImage(logoWatermark.canvas, 'PNG', wmX, wmY, wmWidthMm, wmHeightMm);
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
