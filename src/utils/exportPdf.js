import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

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
 * Pre-renderiza cada fórmula KaTeX como imagen individual usando html-to-image.
 * html-to-image serializa el DOM a SVG, preservando fuentes web y layout CSS.
 */
async function preRenderAllKatex(katexEls) {
  const backups = [];
  for (const el of katexEls) {
    const origOuterHTML = el.outerHTML;
    backups.push({ el, origOuterHTML });
    try {
      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        backgroundColor: 'white',
        cacheBust: true,
        skipFonts: true,
        style: { overflow: 'visible' },
      });
      const img = document.createElement('img');
      img.src = dataUrl;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      img.style.cssText = `width:${w}px;height:${h}px;display:inline-block;vertical-align:middle;`;
      el.innerHTML = '';
      el.appendChild(img);
      el.style.overflow = 'visible';
    } catch {
      // Si falla, dejar el KaTeX original
    }
  }
  return backups;
}

/**
 * Exporta el contenido del lienzo a un archivo PDF.
 */
export async function exportToPdf(canvasElement, studentName = 'Alumno', workspaceName = 'Diseño sin título') {
  try {
    // Pre-renderizar KaTeX a imágenes antes de html2canvas principal
    const katexEls = canvasElement.querySelectorAll('.katex');
    const backups = await preRenderAllKatex(katexEls);

    // Capturar el lienzo como imagen
    const canvas = await html2canvas(canvasElement, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#f8f9fc',
      logging: false,
      ignoreElements: (element) => element.classList?.contains('no-print'),
    });

    // Restaurar KaTeX originales
    for (const { el, origOuterHTML } of backups) {
      el.outerHTML = origOuterHTML;
    }

    const imgData = canvas.toDataURL('image/png');

    // Crear PDF en formato carta horizontal (landscape)
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'letter',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Encabezado principal (Título del proyecto)
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(76, 110, 245);
    pdf.text(workspaceName, 10, 12);

    // Subtítulo (Alumno y Fecha)
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    const date = new Date().toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    pdf.text(`Alumno: ${studentName}  |  Fecha: ${date}`, 10, 18);

    // Línea separadora
    pdf.setDrawColor(76, 110, 245);
    pdf.setLineWidth(0.5);
    pdf.line(10, 20, pageWidth - 10, 20);

    // Calcular dimensiones de la imagen para ajustarla al PDF
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const maxImgHeight = pageHeight - 30;

    const finalWidth = imgHeight > maxImgHeight
      ? (canvas.width * maxImgHeight) / canvas.height
      : imgWidth;
    const finalHeight = imgHeight > maxImgHeight
      ? maxImgHeight
      : imgHeight;

    const xOffset = (pageWidth - finalWidth) / 2;
    const yOffset = 23;

    // Agregar marca de agua del logo en el centro del contenido
    const logoWatermark = await loadLogoWatermark(60);
    if (logoWatermark) {
      const wmX = xOffset + (finalWidth - logoWatermark.width * 0.264583) / 2;
      const wmY = yOffset + (finalHeight - logoWatermark.height * 0.264583) / 2;
      const wmWidthMm = logoWatermark.width * 0.264583;
      const wmHeightMm = logoWatermark.height * 0.264583;
      pdf.addImage(logoWatermark.canvas, 'PNG', wmX, wmY, wmWidthMm, wmHeightMm);
    }

    // Imagen del contenido del lienzo
    pdf.addImage(imgData, 'PNG', xOffset, yOffset, finalWidth, finalHeight);

    // Pie de página
    pdf.setFontSize(8);
    pdf.setTextColor(180, 180, 180);
    pdf.text('Generado con Kubika - Herramienta educativa de Regletas de Cuisenaire', pageWidth / 2, pageHeight - 5, { align: 'center' });

    // Descargar
    const fileName = `kubika-${studentName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`;
    pdf.save(fileName);

    return true;
  } catch (error) {
    console.error('Error al exportar PDF:', error);
    throw error;
  }
}
