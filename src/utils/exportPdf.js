import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import katex from 'katex';

/**
 * Carga el logo y lo devuelve como un canvas con opacidad reducida.
 */
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
 * Renderiza un elemento KaTeX a un canvas usando html2canvas
 * sobre un div temporal (sin contaminar el canvas principal).
 */
async function renderKatexToCanvas(el) {
  try {
    const tmpDiv = document.createElement('div');
    tmpDiv.style.cssText = 'position:fixed;left:-9999px;top:0;visibility:hidden;font-size:16px;line-height:1.4;padding:8px;display:inline-block;';
    tmpDiv.innerHTML = el.outerHTML;
    document.body.appendChild(tmpDiv);
    const c = await html2canvas(tmpDiv, { scale: 2, backgroundColor: null, useCORS: true, logging: false });
    document.body.removeChild(tmpDiv);
    return c;
  } catch {
    return null;
  }
}

/**
 * Exporta el contenido del lienzo a un archivo PDF.
 */
export async function exportToPdf(canvasElement, studentName = 'Alumno', workspaceName = 'Diseño sin título') {
  try {
    // 1. Capturar el lienzo (sin KaTeX)
    const mainCanvas = await html2canvas(canvasElement, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#f8f9fc',
      logging: false,
      ignoreElements: (element) => element.classList?.contains('no-print') || element.classList?.contains('katex'),
    });

    // 2. Buscar contenedores KaTeX y renderizar cada uno encima del canvas capturado
    const katexContainers = canvasElement.querySelectorAll('.katex-display-container');
    const mainCtx = mainCanvas.getContext('2d');
    const canvasRect = canvasElement.getBoundingClientRect();

    for (const container of katexContainers) {
      const katexEl = container.querySelector('.katex');
      if (!katexEl) continue;

      const katexCanvas = await renderKatexToCanvas(katexEl);
      if (!katexCanvas) continue;

      const containerRect = container.getBoundingClientRect();
      const x = containerRect.left - canvasRect.left;
      const y = containerRect.top - canvasRect.top;

      mainCtx.drawImage(katexCanvas, x * 2, y * 2);
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
