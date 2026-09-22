import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import jsPDF from 'jspdf';
import MathTextBox from './MathTextBox';
import FreeTextBox from './FreeTextBox';

import { RODS, generateRodId } from '../utils/rods';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

const QUAD_COLORS = RODS.map(r => ({ name: r.name, value: r.color }));

const PEN_COLORS = [
  { name: 'Negro', value: '#1a1a1a' },
  { name: 'Gris oscuro', value: '#4b5563' },
  { name: 'Gris', value: '#9ca3af' },
  { name: 'Blanco', value: '#ffffff' },
  { name: 'Rojo oscuro', value: '#991b1b' },
  { name: 'Rojo', value: '#dc2626' },
  { name: 'Rojo claro', value: '#f87171' },
  { name: 'Rosa', value: '#ec4899' },
  { name: 'Morado', value: '#9333ea' },
  { name: 'Azul oscuro', value: '#1e40af' },
  { name: 'Azul', value: '#2563eb' },
  { name: 'Azul claro', value: '#60a5fa' },
  { name: 'Celeste', value: '#22d3ee' },
  { name: 'Turquesa', value: '#14b8a6' },
  { name: 'Verde oscuro', value: '#166534' },
  { name: 'Verde', value: '#16a34a' },
  { name: 'Verde claro', value: '#4ade80' },
  { name: 'Amarillo', value: '#eab308' },
  { name: 'Naranja', value: '#ea580c' },
  { name: 'Marrón', value: '#a16207' },
];

function getUserId() {
  try {
    return JSON.parse(localStorage.getItem('kubika_local_user') || '{}')?.id || 'anon';
  } catch { return 'anon'; }
}

function savePageData(userId, bookId, page, data) {
  try {
    const key = `kubika_pdf_${userId}_${bookId}_p${page}`;
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

function loadPageData(userId, bookId, page) {
  try {
    const key = `kubika_pdf_${userId}_${bookId}_p${page}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

let idCounter = 0;
function genId() { return 'mp_' + Date.now() + '_' + (++idCounter); }

const PDF_ROD_UNIT = 34;
const PDF_ROD_HEIGHT = 34;
function getRodBoundingBox(rod) {
  const L = rod.value;
  if (rod.rotation === 90) {
    return { left: rod.x, right: rod.x + PDF_ROD_HEIGHT, top: rod.y, bottom: rod.y + L * PDF_ROD_UNIT };
  }
  return { left: rod.x, right: rod.x + L * PDF_ROD_UNIT, top: rod.y, bottom: rod.y + PDF_ROD_HEIGHT };
}
function checkRodCollision(a, b) {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}
function isRodOverlapping(newRod, allRods) {
  const box1 = getRodBoundingBox(newRod);
  for (const r of allRods) {
    if (r.id === newRod.id) continue;
    if (checkRodCollision(box1, getRodBoundingBox(r))) return true;
  }
  return false;
}

const KATEX_SYMBOLS = {
  '\\times': '×', '\\cdot': '·', '\\div': '÷', '\\pm': '±',
  '\\sqrt': '√', '\\infty': '∞', '\\pi': 'π', '\\alpha': 'α',
  '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ', '\\theta': 'θ',
  '\\neq': '≠', '\\leq': '≤', '\\geq': '≥', '\\approx': '≈',
  '\\frac{}{}': null,
};

function drawLatexOnCanvas(ctx, latex, x, y, fontSize) {
  const fs = fontSize || 22;
  ctx.save();
  ctx.textBaseline = 'middle';
  let cx = x;

  function measureSegment(text) {
    const prevAlign = ctx.textAlign;
    ctx.textAlign = 'left';
    const w = ctx.measureText(text).width;
    ctx.textAlign = prevAlign;
    return w;
  }

  function drawToken(token) {
    if (token.type === 'text') {
      ctx.textAlign = 'left';
      ctx.fillText(token.value, cx, y);
      cx += measureSegment(token.value);
    } else if (token.type === 'frac') {
      const gap = fs * 0.3;
      const numW = measureSegment(token.num);
      const denW = measureSegment(token.den);
      const fw = Math.max(numW, denW) + fs * 0.3;
      const lineY = y;
      const numY = lineY - gap - fs * 0.25;
      const denY = lineY + gap + fs * 0.25;
      const halfFw = fw / 2;
      ctx.textAlign = 'center';
      ctx.fillText(token.num, cx + halfFw, numY);
      ctx.strokeStyle = ctx.fillStyle || '#000';
      ctx.lineWidth = Math.max(1, fs * 0.06);
      ctx.beginPath();
      ctx.moveTo(cx + fs * 0.05, lineY);
      ctx.lineTo(cx + fw - fs * 0.05, lineY);
      ctx.stroke();
      ctx.fillText(token.den, cx + halfFw, denY);
      cx += fw;
    } else if (token.type === 'sqrt') {
      const innerW = measureSegment(token.value);
      ctx.textAlign = 'left';
      ctx.fillText(token.value, cx + fs * 0.5, y);
      ctx.strokeStyle = ctx.fillStyle || '#000';
      ctx.lineWidth = Math.max(1, fs * 0.05);
      ctx.beginPath();
      const top = y - fs * 0.4;
      const bot = y + fs * 0.4;
      ctx.moveTo(cx, y + fs * 0.15);
      ctx.lineTo(cx + fs * 0.2, y + fs * 0.15);
      ctx.lineTo(cx + fs * 0.4, top);
      ctx.lineTo(cx + fs * 0.4 + innerW + fs * 0.1, top);
      ctx.lineTo(cx + fs * 0.4 + innerW + fs * 0.1, bot);
      ctx.stroke();
      cx += fs * 0.5 + innerW + fs * 0.1;
    }
  }

  function tokenize(latex) {
    const tokens = [];
    let i = 0;
    while (i < latex.length) {
      if (latex[i] === '\\') {
        if (latex.substr(i, 5) === '\\frac') {
          const open1 = latex.indexOf('{', i + 5);
          const close1 = latex.indexOf('}', open1);
          const open2 = latex.indexOf('{', close1 + 1);
          const close2 = latex.indexOf('}', open2);
          if (open1 !== -1 && close1 !== -1 && open2 !== -1 && close2 !== -1) {
            tokens.push({ type: 'frac', num: latex.slice(open1 + 1, close1), den: latex.slice(open2 + 1, close2) });
            i = close2 + 1;
            continue;
          }
        }
        if (latex.substr(i, 5) === '\\sqrt') {
          const open = latex.indexOf('{', i + 5);
          const close = latex.indexOf('}', open);
          if (open !== -1 && close !== -1) {
            tokens.push({ type: 'sqrt', value: latex.slice(open + 1, close) });
            i = close + 1;
            continue;
          }
        }
        let sym = null;
        let matchLen = 1;
        for (const key of Object.keys(KATEX_SYMBOLS)) {
          if (key.startsWith('\\') && latex.substr(i, key.length) === key && key.length > matchLen) {
            sym = KATEX_SYMBOLS[key];
            matchLen = key.length;
          }
        }
        if (sym !== null) {
          tokens.push({ type: 'text', value: sym });
          i += matchLen;
        } else {
          let cmd = '\\';
          i++;
          while (i < latex.length && /[a-zA-Z]/.test(latex[i])) { cmd += latex[i]; i++; }
          tokens.push({ type: 'text', value: KATEX_SYMBOLS[cmd] || cmd });
        }
      } else {
        let text = '';
        while (i < latex.length && latex[i] !== '\\') { text += latex[i]; i++; }
        tokens.push({ type: 'text', value: text });
      }
    }
    return tokens;
  }

  const tokens = tokenize(latex);
  for (const t of tokens) drawToken(t);
  ctx.restore();
  return cx - x;
}

export default function PdfMathReader({ libro, onBack }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const scale = 1.2;

  const [activeTool, setActiveTool] = useState('pen');
  const [penColor, setPenColor] = useState(PEN_COLORS[1].value);
  const [penSize, setPenSize] = useState(3);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const [quadFill, setQuadFill] = useState(QUAD_COLORS[1].value);
  const [showQuadColorPicker, setShowQuadColorPicker] = useState(false);

  const [mathTexts, setMathTexts] = useState([]);
  const [freeTexts, setFreeTexts] = useState([]);
  const [quads, setQuads] = useState([]);
  const [quadPreview, setQuadPreview] = useState(null);
  const [polygons, setPolygons] = useState([]);
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedExportPages, setSelectedExportPages] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [rods, setRods] = useState([]);
  const [showRodPalette, setShowRodPalette] = useState(true);
  const [contextMenu, setContextMenu] = useState(null);

  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const drawCanvasRef = useRef(null);
  const pdfRef = useRef(null);
  const renderingRef = useRef(false);
  const isDrawing = useRef(false);
  const lastPoint = useRef(null);
  const lineStart = useRef(null);
  const quadStart = useRef(null);
  const userId = useRef(getUserId());
  const savedCanvasImage = useRef(null);
  const stateRef = useRef({ mathTexts: [], freeTexts: [], quads: [], polygons: [], rods: [], scale: 1.2, currentPage: 1 });
  const copiedRodRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragRafRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  const pdfUrl = (() => {
    const src = libro.pdf || libro.epub;
    if (!src) return '';
    if (src.startsWith('http')) return src;
    const base = window.location.origin + window.location.pathname.replace(/\/$/, '');
    return base + '/' + src.replace(/^\//, '');
  })();

  const saveCanvas = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    try {
      savePageData(userId.current, libro.id, currentPage, {
        canvas: canvas.toDataURL(),
        scale,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        mathTexts,
        freeTexts,
        quads,
        polygons,
        rods,
      });
    } catch {}
  }, [libro.id, currentPage, scale, mathTexts, freeTexts, quads, polygons, rods]);

  const loadCanvas = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    savedCanvasImage.current = null;
    const saved = loadPageData(userId.current, libro.id, currentPage);
    if (saved) {
      if (saved.canvas) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          savedCanvasImage.current = img;
        };
        img.src = saved.canvas;
      }
      const savedW = saved.canvasWidth || canvas.width;
      const savedH = saved.canvasHeight || canvas.height;
      const ratioX = savedW > 0 ? canvas.width / savedW : 1;
      const ratioY = savedH > 0 ? canvas.height / savedH : 1;
      const needsScale = (Math.abs(ratioX - 1) > 0.001 || Math.abs(ratioY - 1) > 0.001);
      const scaleX = (m) => needsScale ? Math.round(m.x * ratioX) : m.x;
      const scaleY = (m) => needsScale ? Math.round(m.y * ratioY) : m.y;
      const scaleW = (w) => needsScale ? Math.round(w * ratioX) : w;
      const scaleH = (h) => needsScale ? Math.round(h * ratioY) : h;
      setMathTexts((saved.mathTexts || []).map(m => ({ ...m, x: scaleX(m), y: scaleY(m), width: m.width ? scaleW(m.width) : undefined })));
      setFreeTexts((saved.freeTexts || []).map(t => ({ ...t, x: scaleX(t), y: scaleY(t) })));
      setQuads((saved.quads || []).map(q => ({ ...q, x: scaleX(q), y: scaleY(q), width: scaleW(q.width), height: scaleH(q.height) })));
      setPolygons((saved.polygons || []).map(p => ({
        ...p,
        points: p.points.map(pt => ({ x: Math.round(pt.x * ratioX), y: Math.round(pt.y * ratioY) })),
      })));
      setRods((saved.rods || []).map(r => ({ ...r, x: Math.round(r.x * ratioX), y: Math.round(r.y * ratioY) })));
    } else {
      setMathTexts([]);
      setFreeTexts([]);
      setQuads([]);
      setPolygons([]);
      setRods([]);
    }
  }, [libro.id, currentPage]);

  // Auto-save when texts/quads/polygons change
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (pdfRef.current && !loading) {
        const canvas = drawCanvasRef.current;
        if (canvas) {
          try {
            savePageData(userId.current, libro.id, currentPage, {
              canvas: canvas.toDataURL(),
              scale,
              canvasWidth: canvas.width,
              canvasHeight: canvas.height,
              mathTexts,
              freeTexts,
              quads,
              polygons,
              rods,
            });
          } catch {}
        }
      }
    }, 500);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [mathTexts, freeTexts, quads, polygons, rods, scale]);

  useEffect(() => {
    stateRef.current = { mathTexts, freeTexts, quads, polygons, rods, scale, currentPage };
  });

  useEffect(() => {
    return () => {
      const canvas = drawCanvasRef.current;
      if (!canvas) return;
      const { mathTexts: mt, freeTexts: ft, quads: q, polygons: pl, rods: r, scale: s, currentPage: cp } = stateRef.current;
      try {
        savePageData(userId.current, libro.id, cp, {
          canvas: canvas.toDataURL(),
          scale: s,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          mathTexts: mt,
          freeTexts: ft,
          quads: q,
          polygons: pl,
          rods: r,
        });
      } catch {}
    };
  }, [libro.id]);

  const renderPage = useCallback(async (pageNum) => {
    if (!pdfRef.current || renderingRef.current) return;
    renderingRef.current = true;
    try {
      const pdf = pdfRef.current;
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = viewport.width;
      tempCanvas.height = viewport.height;
      await page.render({ canvasContext: tempCanvas.getContext('2d'), viewport }).promise;
      const container = containerRef.current;
      if (!container) return;
      container.innerHTML = '';
      container.appendChild(tempCanvas);
      tempCanvas.style.display = 'block';
      const dc = drawCanvasRef.current;
      if (dc) {
        dc.width = viewport.width;
        dc.height = viewport.height;
        dc.style.width = viewport.width + 'px';
        dc.style.height = viewport.height + 'px';
      }
      loadCanvas();
    } catch (e) {
      console.error('Render page error:', e);
    } finally {
      renderingRef.current = false;
    }
  }, [scale, loadCanvas]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(pdfUrl);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.arrayBuffer();
        if (cancelled) return;
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        if (cancelled) { pdf.destroy(); return; }
        pdfRef.current = pdf;
        setTotalPages(pdf.numPages);
        const savedPage = loadPageData(userId.current, libro.id, '__lastPage');
        const startPage = savedPage?.page || 1;
        setCurrentPage(startPage);
        setLoading(false);
      } catch (e) {
        if (!cancelled) { setError(e.message); setLoading(false); }
      }
    })();
    return () => {
      cancelled = true;
      if (pdfRef.current) { try { pdfRef.current.destroy(); } catch {} pdfRef.current = null; }
    };
  }, [pdfUrl, libro.id]);

  useEffect(() => {
    if (pdfRef.current && currentPage > 0) {
      renderPage(currentPage);
      savePageData(userId.current, libro.id, '__lastPage', { page: currentPage });
    }
  }, [currentPage, pdfRef.current, renderPage]);

  const goNext = () => {
    if (currentPage < totalPages) {
      saveCanvas();
      setCurrentPage(p => p + 1);
    }
  };

  const goPrev = () => {
    if (currentPage > 1) {
      saveCanvas();
      setCurrentPage(p => p - 1);
    }
  };

  const getCanvasPoint = (e) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startDrawing = (e) => {
    if (activeTool === 'text' || activeTool === 'formula' || activeTool === 'polygon') return;
    e.preventDefault();
    e.stopPropagation();
    isDrawing.current = true;
    const point = getCanvasPoint(e);
    lastPoint.current = point;
    if (activeTool === 'line' || activeTool === 'pivot') {
      lineStart.current = point;
    }
    if (activeTool === 'quad') {
      quadStart.current = point;
    }
  };

  const draw = (e) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const point = getCanvasPoint(e);
    if (!point || !lastPoint.current) return;

    if (activeTool === 'pen') {
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(point.x, point.y);
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      lastPoint.current = point;
    } else if (activeTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(point.x, point.y, penSize * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      lastPoint.current = point;
    } else if (activeTool === 'line' || activeTool === 'pivot') {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (savedCanvasImage.current) {
        ctx.drawImage(savedCanvasImage.current, 0, 0, canvas.width, canvas.height);
      }
      drawLinePreview(ctx, lineStart.current, point);
    } else if (activeTool === 'quad' && quadStart.current) {
      const from = quadStart.current;
      setQuadPreview({
        x: Math.min(from.x, point.x),
        y: Math.min(from.y, point.y),
        width: Math.abs(point.x - from.x),
        height: Math.abs(point.y - from.y),
        fill: quadFill,
      });
    }
  };

  const drawLinePreview = (ctx, from, to) => {
    if (!from || !to) return;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = activeTool === 'pivot' ? '#9333ea' : penColor;
    ctx.lineWidth = activeTool === 'pivot' ? 2 : penSize;
    ctx.setLineDash(activeTool === 'pivot' ? [6, 4] : []);
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.setLineDash([]);
    if (activeTool === 'pivot') {
      ctx.beginPath();
      ctx.arc(from.x, from.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#9333ea';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(to.x, to.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const stopDrawing = (e) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (activeTool === 'line' || activeTool === 'pivot') {
      const raw = e.changedTouches ? e.changedTouches[0] : e;
      const point = getCanvasPoint(raw);
      if (!point || !lineStart.current) return;
      drawLinePreview(ctx, lineStart.current, point);
    }

    if (activeTool === 'quad') {
      const raw = e.changedTouches ? e.changedTouches[0] : e;
      const point = getCanvasPoint(raw);
      const from = quadStart.current;
      if (from && point) {
        const x = Math.min(from.x, point.x);
        const y = Math.min(from.y, point.y);
        const w = Math.abs(point.x - from.x);
        const h = Math.abs(point.y - from.y);
        if (w > 5 && h > 5) {
          const newId = genId();
          setQuads(prev => [...prev, { id: newId, x, y, width: w, height: h, fill: quadFill }]);
          setSelectedId(newId);
        }
      }
    }

    // Always cache the updated canvas so subsequent operations preserve all content
    try {
      const img = new Image();
      img.src = canvas.toDataURL();
      savedCanvasImage.current = img;
    } catch {}

    saveCanvas();
    lastPoint.current = null;
    lineStart.current = null;
    quadStart.current = null;
    setQuadPreview(null);
  };

  const handleOverlayClick = (e) => {
    if (activeTool === 'formula') {
      const point = getCanvasPoint(e);
      if (!point) return;
      const newId = genId();
      setMathTexts(prev => [...prev, { id: newId, x: point.x, y: point.y, latex: '', width: 150 }]);
      setActiveTool('pen');
      setSelectedId(newId);
    } else if (activeTool === 'text') {
      const point = getCanvasPoint(e);
      if (!point) return;
      const newId = genId();
      setFreeTexts(prev => [...prev, { id: newId, x: point.x, y: point.y, text: '', color: '#1e293b', bold: false }]);
      setActiveTool('pen');
      setSelectedId(newId);
    } else {
      setSelectedId(null);
    }
  };

  const clearCanvas = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    savedCanvasImage.current = null;
    setMathTexts([]);
    setFreeTexts([]);
    setQuads([]);
    setPolygons([]);
    setPolygonPoints([]);
    setRods([]);
    savePageData(userId.current, libro.id, currentPage, { canvas: '', scale, canvasWidth: 0, canvasHeight: 0, mathTexts: [], freeTexts: [], quads: [], polygons: [], rods: [] });
  };

  const renderPageToCanvas = useCallback(async (pageNum, pdfInstance) => {
    const pdf = pdfInstance || pdfRef.current;
    if (!pdf) return null;
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const c = document.createElement('canvas');
    c.width = viewport.width;
    c.height = viewport.height;
    await page.render({ canvasContext: c.getContext('2d'), viewport }).promise;
    const saved = loadPageData(userId.current, libro.id, pageNum);
    const ctx = c.getContext('2d');
    if (saved && saved.canvas) {
      try {
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error('Canvas image load failed'));
          img.src = saved.canvas;
          setTimeout(() => reject(new Error('Canvas image load timeout')), 5000);
        });
        ctx.drawImage(img, 0, 0, c.width, c.height);
      } catch (err) {
        console.warn(`Page ${pageNum}: canvas image failed:`, err.message);
      }
    }
    if (saved) {
      (saved.quads || []).forEach(q => {
        ctx.fillStyle = q.fill; ctx.globalAlpha = 0.6;
        ctx.fillRect(q.x, q.y, q.width, q.height);
        ctx.strokeStyle = q.fill; ctx.lineWidth = 2; ctx.globalAlpha = 1;
        ctx.strokeRect(q.x, q.y, q.width, q.height);
      });
      (saved.polygons || []).forEach(p => {
        if (!p.points || p.points.length < 2) return;
        ctx.beginPath(); ctx.moveTo(p.points[0].x, p.points[0].y);
        p.points.forEach(pt => ctx.lineTo(pt.x, pt.y)); ctx.closePath();
        ctx.fillStyle = p.fill; ctx.globalAlpha = 0.6; ctx.fill();
        ctx.globalAlpha = 1; ctx.strokeStyle = p.fill; ctx.lineWidth = 2; ctx.stroke();
      });
      for (const mt of (saved.mathTexts || [])) {
        if (!mt.latex) continue;
        try {
          const w = mt.width || 150;
          const fontSize = Math.max(14, Math.min(28, w / (mt.latex.length * 0.35)));
          drawLatexOnCanvas(ctx, mt.latex, mt.x, mt.y + fontSize / 2, fontSize);
        } catch (e) { console.warn('KaTeX render failed:', mt.latex, e); }
      }
      (saved.freeTexts || []).forEach(ft => {
        ctx.textBaseline = 'top';
        ctx.font = `${ft.bold ? 'bold ' : ''}30px Caveat, cursive`;
        ctx.fillStyle = ft.color || '#1e293b'; ctx.globalAlpha = 1;
        (ft.text || '').split('\n').forEach((l, i) => { ctx.fillText(l, ft.x + 8, ft.y + 8 + i * 36); });
      });
      (saved.rods || []).forEach(rod => {
        const rodW = rod.value * PDF_ROD_UNIT;
        const rodH = PDF_ROD_HEIGHT;
        ctx.save();
        ctx.translate(rod.x + (rod.rotation === 90 ? PDF_ROD_UNIT / 2 : rodW / 2), rod.y + (rod.rotation === 90 ? rodW / 2 : rodH / 2));
        ctx.rotate((rod.rotation || 0) * Math.PI / 180);
        ctx.fillStyle = rod.color;
        ctx.shadowColor = 'rgba(0,0,0,0.2)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
        ctx.fillRect(-rodW / 2, -rodH / 2, rodW, rodH);
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-rodW / 2, -rodH / 2, rodW, rodH);
        ctx.restore();
      });
      ctx.textBaseline = 'alphabetic';
    }
    ctx.globalAlpha = 1;
    return { canvas: c, viewport };
  }, [scale, libro.id]);

  const exportPageToPdf = async (pageNum) => {
    if (pageNum === currentPage) saveCanvas();
    await new Promise(r => setTimeout(r, 50));
    const result = await renderPageToCanvas(pageNum, pdfRef.current);
    if (!result) return;
    const { canvas: c, viewport } = result;
    try {
      const imgData = c.toDataURL('image/png');
      const orientation = viewport.width > viewport.height ? 'landscape' : 'portrait';
      const pdfDoc = new jsPDF({ orientation, unit: 'mm', format: 'letter' });
      const pW = pdfDoc.internal.pageSize.getWidth();
      const pH = pdfDoc.internal.pageSize.getHeight();
      const iW = pW - 10;
      const iH = (c.height * iW) / c.width;
      const fH = iH > pH - 10 ? (c.width * (pH - 10)) / c.height : iH;
      const fW = fH === iH ? iW : (c.width * fH) / c.height;
      pdfDoc.addImage(imgData, 'PNG', (pW - fW) / 2, (pH - fH) / 2, fW, fH);
      pdfDoc.save(`${libro.titulo || 'pagina'}-${pageNum}.pdf`);
    } catch (e) {
      console.error('Export error:', e);
      throw e;
    }
  };

  const handleExportCurrent = async () => {
    try { await exportPageToPdf(currentPage); } catch (e) { console.error('Export error:', e); }
  };

  const handleExportSelected = async () => {
    if (selectedExportPages.length === 0) return;
    setExporting(true);
    try {
      const pdf = pdfRef.current;
      if (!pdf) { console.warn('PDF not loaded'); setExporting(false); return; }
      saveCanvas();
      await new Promise(r => setTimeout(r, 50));
      const pages = [...selectedExportPages].sort((a, b) => a - b);
      const results = [];
      for (const p of pages) {
        try {
          results.push(await renderPageToCanvas(p, pdf));
        } catch (err) {
          console.warn(`Failed to render page ${p}:`, err);
          results.push(null);
        }
      }
      const first = results.find(r => r);
      if (!first) return;
      const orientation = first.viewport.width > first.viewport.height ? 'landscape' : 'portrait';
      const pdfDoc = new jsPDF({ orientation, unit: 'mm', format: 'letter' });
      const pW = pdfDoc.internal.pageSize.getWidth();
      const pH = pdfDoc.internal.pageSize.getHeight();
      const iW = pW - 10;
      const iH = (first.canvas.height * iW) / first.canvas.width;
      const fH = iH > pH - 10 ? (first.canvas.width * (pH - 10)) / first.canvas.height : iH;
      const fW = fH === iH ? iW : (first.canvas.width * fH) / first.canvas.height;
      const xO = (pW - fW) / 2;
      const yO = (pH - fH) / 2;
      let isFirstPage = true;
      results.forEach((r) => {
        if (!r) return;
        if (!isFirstPage) pdfDoc.addPage();
        pdfDoc.addImage(r.canvas.toDataURL('image/png'), 'PNG', xO, yO, fW, fH);
        isFirstPage = false;
      });
      pdfDoc.save(`${libro.titulo || 'paginas'}-${pages[0]}-${pages[pages.length - 1]}.pdf`);
      setShowExportModal(false);
      setSelectedExportPages([]);
    } catch (e) { console.error('Export error:', e); }
    setExporting(false);
  };

  const handleMathUpdate = (id, latex) => {
    setMathTexts(prev => prev.map(m => m.id === id ? { ...m, latex } : m));
  };

  const handleMathResize = (id, newWidth) => {
    setMathTexts(prev => prev.map(m => m.id === id ? { ...m, width: newWidth } : m));
  };

  const handleFreeTextUpdate = (id, data) => {
    setFreeTexts(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
  };

  const handlePointerDownOnMath = (e, mathId) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(mathId);
    const mb = mathTexts.find(m => m.id === mathId);
    if (!mb) return;
    const startX = e.clientX, startY = e.clientY;
    const origX = mb.x, origY = mb.y;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const handleMove = (ev) => {
      setMathTexts(prev => prev.map(m => m.id === mathId ? { ...m, x: Math.max(0, origX + ev.clientX - startX), y: Math.max(0, origY + ev.clientY - startY) } : m));
    };
    const handleUp = () => {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener('pointermove', handleMove);
      target.removeEventListener('pointerup', handleUp);
      saveCanvas();
    };
    target.addEventListener('pointermove', handleMove);
    target.addEventListener('pointerup', handleUp);
  };

  const handlePointerDownOnFreeText = (e, textId) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(textId);
    const tb = freeTexts.find(t => t.id === textId);
    if (!tb) return;
    const startX = e.clientX, startY = e.clientY;
    const origX = tb.x, origY = tb.y;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const handleMove = (ev) => {
      setFreeTexts(prev => prev.map(t => t.id === textId ? { ...t, x: Math.max(0, origX + ev.clientX - startX), y: Math.max(0, origY + ev.clientY - startY) } : t));
    };
    const handleUp = () => {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener('pointermove', handleMove);
      target.removeEventListener('pointerup', handleUp);
      saveCanvas();
    };
    target.addEventListener('pointermove', handleMove);
    target.addEventListener('pointerup', handleUp);
  };

  const handlePointerDownOnQuad = (e, quadId) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(quadId);
    const q = quads.find(q => q.id === quadId);
    if (!q) return;
    const startX = e.clientX, startY = e.clientY;
    const origX = q.x, origY = q.y;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const handleMove = (ev) => {
      setQuads(prev => prev.map(q => q.id === quadId ? { ...q, x: Math.max(0, origX + ev.clientX - startX), y: Math.max(0, origY + ev.clientY - startY) } : q));
    };
    const handleUp = () => {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener('pointermove', handleMove);
      target.removeEventListener('pointerup', handleUp);
      saveCanvas();
    };
    target.addEventListener('pointermove', handleMove);
    target.addEventListener('pointerup', handleUp);
  };

  const handleQuadResize = (e, quadId, handle) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const q = quads.find(q => q.id === quadId);
    if (!q) return;
    const startX = e.clientX, startY = e.clientY;
    const orig = { x: q.x, y: q.y, width: q.width, height: q.height };
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const handleMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let newX = orig.x, newY = orig.y, newW = orig.width, newH = orig.height;
      if (handle.includes('e')) { newW = Math.max(20, orig.width + dx); }
      if (handle.includes('w')) { newW = Math.max(20, orig.width - dx); newX = orig.x + orig.width - newW; }
      if (handle.includes('s')) { newH = Math.max(20, orig.height + dy); }
      if (handle.includes('n')) { newH = Math.max(20, orig.height - dy); newY = orig.y + orig.height - newH; }
      setQuads(prev => prev.map(q => q.id === quadId ? { ...q, x: newX, y: newY, width: newW, height: newH } : q));
    };
    const handleUp = () => {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener('pointermove', handleMove);
      target.removeEventListener('pointerup', handleUp);
      saveCanvas();
    };
    target.addEventListener('pointermove', handleMove);
    target.addEventListener('pointerup', handleUp);
  };

  const handlePolygonClick = (e) => {
    if (activeTool !== 'polygon') return;
    if (showQuadColorPicker) { setShowQuadColorPicker(false); return; }
    const point = getCanvasPoint(e);
    if (!point) return;
    const x = point.x;
    const y = point.y;

    if (polygonPoints.length >= 3) {
      const first = polygonPoints[0];
      const dist = Math.sqrt((x - first.x) ** 2 + (y - first.y) ** 2);
      if (dist < 15) {
        const newId = genId();
        setPolygons(prev => [...prev, { id: newId, points: polygonPoints, fill: quadFill }]);
        setPolygonPoints([]);
        setSelectedId(newId);
        return;
      }
    }

    setPolygonPoints(prev => [...prev, { x, y }]);
  };

  const handlePolygonDrag = (e, polyId) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(polyId);
    const p = polygons.find(p => p.id === polyId);
    if (!p) return;
    const startX = e.clientX, startY = e.clientY;
    const origPoints = p.points.map(pt => ({ ...pt }));
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const handleMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      setPolygons(prev => prev.map(p => p.id === polyId ? { ...p, points: origPoints.map(pt => ({ x: Math.max(0, pt.x + dx), y: Math.max(0, pt.y + dy) })) } : p));
    };
    const handleUp = () => {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener('pointermove', handleMove);
      target.removeEventListener('pointerup', handleUp);
      saveCanvas();
    };
    target.addEventListener('pointermove', handleMove);
    target.addEventListener('pointerup', handleUp);
  };

  const getPolygonBounds = (points) => {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
  };

  const handlePolygonResize = (e, polyId, handle) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const p = polygons.find(p => p.id === polyId);
    if (!p) return;
    const startX = e.clientX, startY = e.clientY;
    const origPoints = p.points.map(pt => ({ ...pt }));
    const bounds = getPolygonBounds(origPoints);
    const origW = bounds.maxX - bounds.minX || 1;
    const origH = bounds.maxY - bounds.minY || 1;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const handleMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let scaleX = 1, scaleY = 1, offsetX = 0, offsetY = 0;
      if (handle.includes('e')) { scaleX = Math.max(0.2, (origW + dx) / origW); }
      if (handle.includes('w')) { scaleX = Math.max(0.2, (origW - dx) / origW); offsetX = origW - origW * scaleX; }
      if (handle.includes('s')) { scaleY = Math.max(0.2, (origH + dy) / origH); }
      if (handle.includes('n')) { scaleY = Math.max(0.2, (origH - dy) / origH); offsetY = origH - origH * scaleY; }
      setPolygons(prev => prev.map(p => p.id === polyId ? {
        ...p,
        points: origPoints.map(pt => ({
          x: Math.max(0, bounds.minX + offsetX + (pt.x - bounds.minX) * scaleX),
          y: Math.max(0, bounds.minY + offsetY + (pt.y - bounds.minY) * scaleY),
        })),
      } : p));
    };
    const handleUp = () => {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener('pointermove', handleMove);
      target.removeEventListener('pointerup', handleUp);
      saveCanvas();
    };
    target.addEventListener('pointermove', handleMove);
    target.addEventListener('pointerup', handleUp);
  };

  // ========== RODS: drag & drop from palette ==========
  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
  const handleDrop = (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (!data) return;
    try {
      const rodDef = JSON.parse(data);
      const rect = viewerRef.current.getBoundingClientRect();
      const rawX = e.clientX - rect.left - (rodDef.value * PDF_ROD_UNIT / 2);
      const rawY = e.clientY - rect.top - (PDF_ROD_HEIGHT / 2);
      const snappedX = Math.round(Math.max(0, rawX) / PDF_ROD_UNIT) * PDF_ROD_UNIT;
      const snappedY = Math.round(Math.max(0, rawY) / PDF_ROD_UNIT) * PDF_ROD_UNIT;
      const newRod = { id: generateRodId(), ...rodDef, x: snappedX, y: snappedY, rotation: 0 };
      if (!isRodOverlapping(newRod, rods)) {
        setRods(prev => [...prev, newRod]);
        setSelectedId(newRod.id);
        saveCanvas();
      }
    } catch {}
  };

  // ========== RODS: move on canvas ==========
  const handleRodPointerDown = (e, rodId) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(rodId);
    const rod = rods.find(r => r.id === rodId);
    if (!rod) return;
    const startX = e.clientX, startY = e.clientY;
    const origX = rod.x, origY = rod.y;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    target.style.cursor = 'grabbing';
    isDraggingRef.current = true;

    const MAGNETIC_RANGE = 15;

    function findMagneticSnap(x, y, w, h, rotation, allRods, movingId) {
      let bestDx = 0, bestDy = 0, bestDist = MAGNETIC_RANGE + 1;
      for (const other of allRods) {
        if (other.id === movingId) continue;
        const ob = getRodBoundingBox(other);
        const mb = rotation === 90
          ? { left: x, right: x + PDF_ROD_HEIGHT, top: y, bottom: y + w }
          : { left: x, right: x + w, top: y, bottom: y + h };

        const sides = [
          { dx: ob.left - mb.right, dy: 0 },
          { dx: ob.right - mb.left, dy: 0 },
          { dx: 0, dy: ob.top - mb.bottom },
          { dx: 0, dy: ob.bottom - mb.top },
        ];
        for (const s of sides) {
          const nx = x + s.dx, ny = y + s.dy;
          const dist = Math.abs(s.dx) + Math.abs(s.dy);
          if (dist < bestDist) {
            const nb = rotation === 90
              ? { left: nx, right: nx + PDF_ROD_HEIGHT, top: ny, bottom: ny + w }
              : { left: nx, right: nx + w, top: ny, bottom: ny + h };
            let blocked = false;
            for (const check of allRods) {
              if (check.id === movingId || check.id === other.id) continue;
              if (checkRodCollision(nb, getRodBoundingBox(check))) { blocked = true; break; }
            }
            if (!blocked) { bestDist = dist; bestDx = s.dx; bestDy = s.dy; }
          }
        }
      }
      return { x: x + bestDx, y: y + bestDy };
    }

    const handleMove = (ev) => {
      const rawX = Math.max(0, origX + ev.clientX - startX);
      const rawY = Math.max(0, origY + ev.clientY - startY);
      const snappedX = Math.round(rawX / PDF_ROD_UNIT) * PDF_ROD_UNIT;
      const snappedY = Math.round(rawY / PDF_ROD_UNIT) * PDF_ROD_UNIT;
      if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = requestAnimationFrame(() => {
        const rw = rod.value * PDF_ROD_UNIT;
        const rh = PDF_ROD_HEIGHT;
        const rot = rod.rotation || 0;
        const snapped = findMagneticSnap(snappedX, snappedY, rw, rh, rot, rods, rodId);
        target.style.left = snapped.x + 'px';
        target.style.top = snapped.y + 'px';
        target.dataset.snapX = snapped.x;
        target.dataset.snapY = snapped.y;
      });
    };

    const handleUp = () => {
      isDraggingRef.current = false;
      target.style.cursor = 'grab';
      const finalX = parseFloat(target.dataset.snapX ?? origX);
      const finalY = parseFloat(target.dataset.snapY ?? origY);
      setRods(prev => prev.map(r => {
        if (r.id !== rodId) return r;
        const temp = { ...r, x: finalX, y: finalY };
        if (isRodOverlapping(temp, prev)) return { ...r, x: origX, y: origY, isInvalid: false };
        return { ...temp, isInvalid: false };
      }));
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener('pointermove', handleMove);
      target.removeEventListener('pointerup', handleUp);
      saveCanvas();
    };
    target.addEventListener('pointermove', handleMove);
    target.addEventListener('pointerup', handleUp);
  };

  // ========== RODS: context menu ==========
  const handleRodContextMenu = (e, rodId) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(rodId);
    setContextMenu({
      x: e.clientX, y: e.clientY,
      options: [
        { label: 'Girar 90°', shortcut: 'R', action: () => rotateRod(rodId) },
        { label: 'Eliminar', shortcut: 'Del', action: () => { setRods(prev => prev.filter(r => r.id !== rodId)); setSelectedId(null); saveCanvas(); } },
      ],
    });
  };

  const rotateRod = (rodId) => {
    setRods(prev => prev.map(r => {
      if (r.id !== rodId) return r;
      const newRot = r.rotation === 90 ? 0 : 90;
      const temp = { ...r, rotation: newRot };
      temp.isInvalid = isRodOverlapping(temp, prev);
      return temp;
    }));
    setContextMenu(null);
    saveCanvas();
  };

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close, { once: true });
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  useEffect(() => {
    const handleKeyDown = async (e) => {
      e.stopImmediatePropagation();
      const isEditingText = (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
      if (isEditingText) return;

      // R: rotate selected rod
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
        const isRod = rods.some(r => r.id === selectedId);
        if (isRod) { rotateRod(selectedId); return; }
      }

      // Ctrl+C: copy rod or formula/text
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedId) {
          const rod = rods.find(r => r.id === selectedId);
          if (rod) {
            copiedRodRef.current = { ...rod };
          } else {
            const mt = mathTexts.find(m => m.id === selectedId);
            if (mt && mt.latex) {
              try { await navigator.clipboard.writeText(mt.latex); } catch {}
            } else {
              const ft = freeTexts.find(t => t.id === selectedId);
              if (ft && ft.text) { try { await navigator.clipboard.writeText(ft.text); } catch {} }
            }
          }
        }
        return;
      }

      // Ctrl+V: paste rod
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (copiedRodRef.current) {
          const copy = { ...copiedRodRef.current, id: generateRodId(), x: copiedRodRef.current.x + PDF_ROD_UNIT, y: copiedRodRef.current.y + PDF_ROD_UNIT };
          if (!isRodOverlapping(copy, rods)) {
            setRods(prev => [...prev, copy]);
            setSelectedId(copy.id);
            copiedRodRef.current = { ...copy };
            saveCanvas();
          }
        }
        return;
      }

      if (!selectedId) return;
      const isRod = rods.some(r => r.id === selectedId);
      const step = isRod ? (e.shiftKey ? 1 : 4) : (e.shiftKey ? 1 : 5);

      if (e.key === 'Escape') { setSelectedId(null); setContextMenu(null); return; }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const isMath = mathTexts.some(m => m.id === selectedId);
        const isFree = freeTexts.some(t => t.id === selectedId);
        const isQuad = quads.some(q => q.id === selectedId);
        const isPoly = polygons.some(p => p.id === selectedId);
        const isRod = rods.some(r => r.id === selectedId);
        if (isMath) setMathTexts(prev => prev.filter(m => m.id !== selectedId));
        else if (isFree) setFreeTexts(prev => prev.filter(t => t.id !== selectedId));
        else if (isQuad) setQuads(prev => prev.filter(q => q.id !== selectedId));
        else if (isPoly) setPolygons(prev => prev.filter(p => p.id !== selectedId));
        else if (isRod) setRods(prev => prev.filter(r => r.id !== selectedId));
        setSelectedId(null);
        return;
      }

      if (isEditingText) return;

      let dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else return;

      e.preventDefault();
      const isMath = mathTexts.some(m => m.id === selectedId);
      const isFree = freeTexts.some(t => t.id === selectedId);
      const isQuad = quads.some(q => q.id === selectedId);
      const isPoly = polygons.some(p => p.id === selectedId);
      if (isMath) setMathTexts(prev => prev.map(m => m.id === selectedId ? { ...m, x: Math.max(0, m.x + dx), y: Math.max(0, m.y + dy) } : m));
      else if (isFree) setFreeTexts(prev => prev.map(t => t.id === selectedId ? { ...t, x: Math.max(0, t.x + dx), y: Math.max(0, t.y + dy) } : t));
      else if (isQuad) setQuads(prev => prev.map(q => q.id === selectedId ? { ...q, x: Math.max(0, q.x + dx), y: Math.max(0, q.y + dy) } : q));
      else if (isPoly) setPolygons(prev => prev.map(p => p.id === selectedId ? { ...p, points: p.points.map(pt => ({ x: Math.max(0, pt.x + dx), y: Math.max(0, pt.y + dy) })) } : p));
      else if (isRod) setRods(prev => prev.map(r => r.id === selectedId ? { ...r, x: Math.max(0, r.x + dx), y: Math.max(0, r.y + dy) } : r));
    };
    const handlePasteGlobal = (e) => {
      e.stopImmediatePropagation();
      const t = e.target;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      const text = e.clipboardData.getData('text');
      if (!text || !text.trim()) return;
      e.preventDefault();
      if (text.trim().startsWith('\\')) {
        const newMath = {
          id: genId(),
          x: 100 + Math.random() * 200,
          y: 100 + Math.random() * 200,
          latex: text.trim(),
          width: 220,
        };
        setMathTexts(prev => [...prev, newMath]);
      } else {
        const newFree = {
          id: genId(),
          x: 100 + Math.random() * 200,
          y: 200 + Math.random() * 200,
          text: text.trim(),
          color: '#1e293b',
          bold: false,
        };
        setFreeTexts(prev => [...prev, newFree]);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('paste', handlePasteGlobal, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('paste', handlePasteGlobal, true);
    };
  }, [selectedId, mathTexts, freeTexts, quads, polygons, rods]);

  const isDrawingTool = activeTool === 'pen' || activeTool === 'eraser' || activeTool === 'line' || activeTool === 'pivot' || activeTool === 'quad' || activeTool === 'polygon';
  const isPlacingText = activeTool === 'text' || activeTool === 'formula';

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-white">
        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            Cerrar
          </button>
          <h1 className="text-base font-bold text-slate-800">{libro.titulo}</h1>
          <div className="w-16" />
        </header>
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Cargando libro...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full bg-white">
        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            Cerrar
          </button>
          <h1 className="text-base font-bold text-slate-800">{libro.titulo}</h1>
          <div className="w-16" />
        </header>
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 gap-3">
          <p className="text-red-500 text-sm">{error}</p>
          <button onClick={onBack} className="text-sm text-indigo-600 underline">Volver</button>
        </div>
      </div>
    );
  }

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text');
    if (text && text.trim().startsWith('\\')) {
      e.preventDefault();
      const newMath = {
        id: genId(),
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200,
        latex: text.trim(),
        width: 220,
      };
      setMathTexts(prev => [...prev, newMath]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white" onPaste={handlePaste} data-pdf-reader-open>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          Cerrar
        </button>
        <h1 className="text-base font-bold text-slate-800">{libro.titulo}</h1>
        <span className="text-xs text-slate-400">{currentPage}/{totalPages}</span>
      </header>

      {/* Toolbar — idéntica a Regletas */}
      <div className="flex items-center justify-center gap-0.5 px-3 py-2 border-b border-slate-200 shrink-0 flex-wrap relative z-50">

        {/* Texto libre */}
        <div className="kubika-tooltip-wrapper">
          <button onClick={() => setActiveTool(activeTool === 'text' ? 'pen' : 'text')}
            className={`btn-icon btn-ripple flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 group ${activeTool === 'text' ? 'bg-indigo-100 text-indigo-700 shadow-sm ring-2 ring-indigo-300' : ''}`}>
            <svg className="w-6 h-6 text-kubika-500 group-hover:scale-125 group-hover:text-kubika-700 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <span className="kubika-tooltip">Texto libre</span>
        </div>

        {/* Fórmula */}
        <div className="kubika-tooltip-wrapper">
          <button onClick={() => setActiveTool(activeTool === 'formula' ? 'pen' : 'formula')}
            className={`btn-icon btn-ripple flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 group ${activeTool === 'formula' ? 'bg-purple-100 text-purple-700 shadow-sm ring-2 ring-purple-300' : ''}`}>
            <svg className="w-6 h-6 text-purple-500 group-hover:scale-125 group-hover:text-purple-700 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </button>
          <span className="kubika-tooltip">Fórmula LaTeX</span>
        </div>

        <div className="header-divider" />

        {/* Plumón */}
        <div className="kubika-tooltip-wrapper">
          <button onClick={() => setActiveTool('pen')}
            className={`btn-icon btn-ripple flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 group ${activeTool === 'pen' ? 'bg-indigo-100 text-indigo-700 shadow-sm ring-2 ring-indigo-300' : ''}`}>
            <svg className="w-6 h-6 text-kubika-500 group-hover:scale-125 group-hover:text-kubika-700 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <span className="kubika-tooltip">Plumón</span>
        </div>

        {/* Línea */}
        <div className="kubika-tooltip-wrapper">
          <button onClick={() => setActiveTool('line')}
            className={`btn-icon btn-ripple flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 group ${activeTool === 'line' ? 'bg-indigo-100 text-indigo-700 shadow-sm ring-2 ring-indigo-300' : ''}`}>
            <svg className="w-6 h-6 text-kubika-500 group-hover:scale-125 group-hover:text-kubika-700 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 20L20 4" />
            </svg>
          </button>
          <span className="kubika-tooltip">Línea</span>
        </div>

        {/* Pivote */}
        <div className="kubika-tooltip-wrapper">
          <button onClick={() => setActiveTool('pivot')}
            className={`btn-icon btn-ripple flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 group ${activeTool === 'pivot' ? 'bg-purple-100 text-purple-700 shadow-sm ring-2 ring-purple-300' : ''}`}>
            <svg className="w-6 h-6 text-purple-500 group-hover:scale-125 group-hover:text-purple-700 transition-all duration-200" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="5" />
            </svg>
          </button>
          <span className="kubika-tooltip">Pivote</span>
        </div>

        <div className="header-divider" />

        {/* Cuadrilátero */}
        <div className="kubika-tooltip-wrapper relative">
          <button onClick={() => setActiveTool(activeTool === 'quad' ? 'pen' : 'quad')}
            className={`btn-icon btn-ripple flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 group ${activeTool === 'quad' ? 'bg-amber-100 text-amber-700 shadow-sm ring-2 ring-amber-300' : ''}`}>
            <svg className="w-6 h-6 text-amber-500 group-hover:scale-125 group-hover:text-amber-700 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <rect x="4" y="6" width="16" height="12" strokeWidth={1.5} rx="1" />
            </svg>
          </button>
          <span className="kubika-tooltip">Cuadrilátero</span>
          {activeTool === 'quad' && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 p-2 z-50"
              onPointerDown={(e) => e.stopPropagation()}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', width: '156px' }}>
              {QUAD_COLORS.map(c => (
                <button key={c.value} onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setQuadFill(c.value); }}
                  className="w-6 h-6 rounded-full border-2 hover:scale-125 transition-transform mx-auto"
                  style={{ backgroundColor: c.value, borderColor: quadFill === c.value ? '#d97706' : '#e2e8f0' }}
                  title={c.name} />
              ))}
            </div>
          )}
        </div>

        {/* Polígono */}
        <div className="kubika-tooltip-wrapper relative">
          <button onClick={() => { setActiveTool(activeTool === 'polygon' ? 'pen' : 'polygon'); setPolygonPoints([]); }}
            className={`btn-icon btn-ripple flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 group ${activeTool === 'polygon' ? 'bg-emerald-100 text-emerald-700 shadow-sm ring-2 ring-emerald-300' : ''}`}>
            <svg className="w-6 h-6 text-emerald-500 group-hover:scale-125 group-hover:text-emerald-700 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <polygon points="12,3 21,10 18,20 6,20 3,10" strokeWidth={1.5} strokeLinejoin="round" />
            </svg>
          </button>
          <span className="kubika-tooltip">Polígono</span>
          {activeTool === 'polygon' && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 p-2 z-50"
              onPointerDown={(e) => e.stopPropagation()}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', width: '156px' }}>
              {QUAD_COLORS.map(c => (
                <button key={c.value} onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setQuadFill(c.value); }}
                  className="w-6 h-6 rounded-full border-2 hover:scale-125 transition-transform mx-auto"
                  style={{ backgroundColor: c.value, borderColor: quadFill === c.value ? '#059669' : '#e2e8f0' }}
                  title={c.name} />
              ))}
            </div>
          )}
        </div>

        <div className="header-divider" />

        {/* Borrador */}
        <div className="kubika-tooltip-wrapper">
          <button onClick={() => setActiveTool('eraser')}
            className={`btn-icon btn-ripple flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 group ${activeTool === 'eraser' ? 'bg-red-100 text-red-700 shadow-sm ring-2 ring-red-300' : ''}`}>
            <svg className="w-6 h-6 text-red-400 group-hover:scale-125 group-hover:text-red-600 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </button>
          <span className="kubika-tooltip">Borrador</span>
        </div>

        <div className="header-divider" />

        {/* Color */}
        <div className="kubika-tooltip-wrapper relative">
          <button onClick={() => setShowColorPicker(!showColorPicker)}
            className="btn-icon btn-ripple flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 group">
            <div className="w-5 h-5 rounded-full border-2 border-white shadow-md" style={{ backgroundColor: penColor }} />
          </button>
          <span className="kubika-tooltip">Color</span>
          {showColorPicker && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 p-3 z-50"
              onPointerDown={(e) => e.stopPropagation()}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', width: '176px' }}>
              {PEN_COLORS.map(c => (
                <button key={c.value} onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setPenColor(c.value); setShowColorPicker(false); }}
                  className="w-6 h-6 rounded-full border-2 hover:scale-125 transition-transform mx-auto"
                  style={{ backgroundColor: c.value, borderColor: penColor === c.value ? '#4f46e5' : '#e2e8f0' }}
                  title={c.name} />
              ))}
            </div>
          )}
        </div>

        {/* Grosor */}
        <input type="range" min="1" max="8" value={penSize}
          onChange={(e) => setPenSize(Number(e.target.value))}
          className="w-16 h-1 accent-indigo-500 mx-1" title="Grosor" />

        <div className="header-divider" />

        {/* Regletas toggle */}
        <div className="kubika-tooltip-wrapper">
          <button onClick={() => setShowRodPalette(!showRodPalette)}
            className={`btn-icon btn-ripple flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 group ${showRodPalette ? 'bg-amber-100 text-amber-700 shadow-sm ring-2 ring-amber-300' : ''}`}>
            <svg className="w-5 h-5 group-hover:scale-125 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <rect x="2" y="9" width="4" height="6" rx="1" fill="currentColor" opacity="0.5" />
              <rect x="7" y="7" width="6" height="10" rx="1" fill="currentColor" opacity="0.7" />
              <rect x="14" y="5" width="8" height="14" rx="1" fill="currentColor" />
            </svg>
          </button>
          <span className="kubika-tooltip">Regletas</span>
        </div>

        <div className="header-divider" />

        {/* Descargar página actual */}
        <div className="kubika-tooltip-wrapper">
          <button onClick={handleExportCurrent}
            className="btn-icon btn-ripple flex items-center justify-center w-9 h-9 rounded-xl hover:bg-emerald-50 transition-all duration-200 group">
            <svg className="w-6 h-6 text-emerald-500 group-hover:scale-125 group-hover:text-emerald-700 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <span className="kubika-tooltip">Descargar página</span>
        </div>

        {/* Seleccionar páginas para descargar */}
        <div className="kubika-tooltip-wrapper">
          <button onClick={() => setShowExportModal(true)}
            className="btn-icon btn-ripple flex items-center justify-center w-9 h-9 rounded-xl hover:bg-blue-50 transition-all duration-200 group">
            <svg className="w-6 h-6 text-blue-500 group-hover:scale-125 group-hover:text-blue-700 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <span className="kubika-tooltip">Seleccionar páginas</span>
        </div>
      </div>

      {/* Hint bar for text/formula tools */}
      {(activeTool === 'text' || activeTool === 'formula') && (
        <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 border-b border-purple-200 shrink-0 z-20">
          <p className="text-xs text-purple-700 font-medium">
            {activeTool === 'formula' ? 'Haz clic en el libro para insertar una fórmula LaTeX' : 'Haz clic en el libro para insertar texto libre'}
          </p>
          <button onClick={() => setActiveTool('pen')} className="ml-auto text-xs text-purple-500 underline">Cancelar</button>
        </div>
      )}

      {/* PDF + Canvas overlay + Text overlays */}
      <div className="flex-1 flex overflow-hidden bg-slate-100">
        {/* Rod Palette */}
        {showRodPalette && (
          <div className="w-56 shrink-0 bg-slate-50/80 backdrop-blur border-r border-slate-200/60 overflow-y-auto flex flex-col">
            <div className="p-3 border-b border-slate-200/60">
              <h3 className="text-xs font-extrabold text-slate-600 tracking-wider uppercase">Regletas</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {RODS.map((rod) => (
                <div key={rod.value} className="group">
                  <div className="flex items-center mb-1 px-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-600 transition-colors">
                      {rod.name}
                    </span>
                  </div>
                  <div
                    draggable="true"
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/json', JSON.stringify(rod));
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    className={`rod-3d ${rod.cssClass} flex items-center justify-center rounded-lg transition-all duration-300 cursor-grab active:cursor-grabbing group-hover:translate-x-1`}
                    style={{
                      backgroundColor: rod.color,
                      width: `${(rod.value / 10) * 100}%`,
                      minWidth: '40px',
                      height: '28px',
                      boxShadow: `0 4px 0 ${rod.color}80, inset 0 -2px 4px rgba(0,0,0,0.2)`,
                    }}
                    title={`${rod.name} — arrastra a la hoja`}
                  />
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-slate-200/60">
              <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Arrastra a la hoja
              </p>
              <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1.5 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                R = girar · Del = eliminar
              </p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto flex justify-center">
          <div ref={viewerRef}
            className="relative inline-block my-4 shadow-lg"
            onDragOver={handleDragOver}
            onDrop={handleDrop}>
          <div ref={containerRef} />

          {/* Drawing canvas — always present, receives pointer events for drawing tools AND text/formula placement */}
          <canvas
            ref={drawCanvasRef}
            className="absolute inset-0"
            style={{
              touchAction: 'none',
              pointerEvents: (isDrawingTool || isPlacingText) ? 'auto' : 'none',
              zIndex: (isDrawingTool || isPlacingText) ? 20 : 5,
              cursor: isPlacingText ? 'crosshair' : activeTool === 'eraser' ? 'cell' : 'default',
            }}
            onMouseDown={(e) => {
              if (isPlacingText) return;
              startDrawing(e);
            }}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={(e) => {
              if (isPlacingText) return;
              startDrawing(e);
            }}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            onClick={(e) => {
              setShowQuadColorPicker(false);
              if (isPlacingText) {
                handleOverlayClick(e);
              } else if (activeTool === 'polygon') {
                handlePolygonClick(e);
              } else {
                setSelectedId(null);
              }
            }}
          />

          {/* Math text overlays (KaTeX) */}
          {mathTexts.map(mt => (
            <div key={mt.id}
              className="absolute z-30"
              style={{ left: mt.x, top: mt.y, pointerEvents: 'auto' }}
              onPointerDown={(e) => handlePointerDownOnMath(e, mt.id)}>
              <MathTextBox
                id={mt.id}
                initialLatex={mt.latex}
                initialWidth={mt.width || 150}
                onUpdate={handleMathUpdate}
                onResize={handleMathResize}
                isSelected={selectedId === mt.id}
              />
            </div>
          ))}

          {/* Free text overlays */}
          {freeTexts.map(ft => (
            <div key={ft.id}
              className="absolute z-30"
              style={{ left: ft.x, top: ft.y, pointerEvents: 'auto' }}>
              <FreeTextBox
                id={ft.id}
                initialText={ft.text}
                initialColor={ft.color}
                initialBold={ft.bold}
                onUpdate={handleFreeTextUpdate}
                isSelected={selectedId === ft.id}
                onPointerDown={(e) => handlePointerDownOnFreeText(e, ft.id)}
              />
            </div>
          ))}

          {/* Quad preview during drag */}
          {quadPreview && quadPreview.width > 2 && quadPreview.height > 2 && (
            <div
              className="absolute z-30 pointer-events-none"
              style={{
                left: quadPreview.x,
                top: quadPreview.y,
                width: quadPreview.width,
                height: quadPreview.height,
                backgroundColor: quadPreview.fill,
                opacity: 0.6,
                border: `2px solid ${quadPreview.fill}`,
                borderRadius: '2px',
              }}
            />
          )}

          {/* Quad overlays */}
          {quads.map(q => (
            <div key={q.id}
              className="absolute z-30"
              style={{ left: q.x, top: q.y, width: q.width, height: q.height, pointerEvents: 'auto' }}>
              {/* Main quad body — drag to move */}
              <div
                onPointerDown={(e) => handlePointerDownOnQuad(e, q.id)}
                className="w-full h-full cursor-grab active:cursor-grabbing"
                style={{
                  backgroundColor: q.fill,
                  opacity: 0.6,
                  border: `2px solid ${q.fill}`,
                  borderRadius: '2px',
                }}
              />
              {/* Resize handles */}
              {selectedId === q.id && (
                <>
                  {/* Corners */}
                  <div onPointerDown={(e) => handleQuadResize(e, q.id, 'nw')} className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-slate-500 rounded-sm cursor-nw-resize z-40" />
                  <div onPointerDown={(e) => handleQuadResize(e, q.id, 'ne')} className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-slate-500 rounded-sm cursor-ne-resize z-40" />
                  <div onPointerDown={(e) => handleQuadResize(e, q.id, 'sw')} className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-slate-500 rounded-sm cursor-sw-resize z-40" />
                  <div onPointerDown={(e) => handleQuadResize(e, q.id, 'se')} className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-slate-500 rounded-sm cursor-se-resize z-40" />
                  {/* Edges */}
                  <div onPointerDown={(e) => handleQuadResize(e, q.id, 'n')} className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-white border-2 border-slate-400 rounded-sm cursor-n-resize z-40" />
                  <div onPointerDown={(e) => handleQuadResize(e, q.id, 's')} className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-white border-2 border-slate-400 rounded-sm cursor-s-resize z-40" />
                  <div onPointerDown={(e) => handleQuadResize(e, q.id, 'w')} className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-8 bg-white border-2 border-slate-400 rounded-sm cursor-w-resize z-40" />
                  <div onPointerDown={(e) => handleQuadResize(e, q.id, 'e')} className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-8 bg-white border-2 border-slate-400 rounded-sm cursor-e-resize z-40" />
                </>
              )}
            </div>
          ))}

          {/* Polygon overlays */}
          {polygons.map(p => {
            const bounds = getPolygonBounds(p.points);
            const w = bounds.maxX - bounds.minX;
            const h = bounds.maxY - bounds.minY;
            const pts = p.points.map(pt => `${pt.x - bounds.minX},${pt.y - bounds.minY}`).join(' ');
            return (
              <div key={p.id}
                className="absolute z-30"
                style={{ left: bounds.minX, top: bounds.minY, width: w, height: h, pointerEvents: 'auto' }}>
                <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full cursor-grab active:cursor-grabbing"
                  onPointerDown={(e) => handlePolygonDrag(e, p.id)}
                  style={{ overflow: 'visible' }}>
                  <polygon points={pts}
                    fill={p.fill} fillOpacity={0.6}
                    stroke={p.fill} strokeWidth={2} strokeLinejoin="round" />
                </svg>
                {/* Resize handles */}
                {selectedId === p.id && (
                  <>
                    <div onPointerDown={(e) => handlePolygonResize(e, p.id, 'nw')} className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-slate-500 rounded-sm cursor-nw-resize z-40" />
                    <div onPointerDown={(e) => handlePolygonResize(e, p.id, 'ne')} className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-slate-500 rounded-sm cursor-ne-resize z-40" />
                    <div onPointerDown={(e) => handlePolygonResize(e, p.id, 'sw')} className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-slate-500 rounded-sm cursor-sw-resize z-40" />
                    <div onPointerDown={(e) => handlePolygonResize(e, p.id, 'se')} className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-slate-500 rounded-sm cursor-se-resize z-40" />
                    <div onPointerDown={(e) => handlePolygonResize(e, p.id, 'n')} className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-white border-2 border-slate-400 rounded-sm cursor-n-resize z-40" />
                    <div onPointerDown={(e) => handlePolygonResize(e, p.id, 's')} className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-white border-2 border-slate-400 rounded-sm cursor-s-resize z-40" />
                    <div onPointerDown={(e) => handlePolygonResize(e, p.id, 'w')} className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-8 bg-white border-2 border-slate-400 rounded-sm cursor-w-resize z-40" />
                    <div onPointerDown={(e) => handlePolygonResize(e, p.id, 'e')} className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-8 bg-white border-2 border-slate-400 rounded-sm cursor-e-resize z-40" />
                  </>
                )}
              </div>
            );
          })}

          {/* Polygon drawing preview */}
          {activeTool === 'polygon' && polygonPoints.length > 0 && (
            <svg className="absolute inset-0 w-full h-full z-25 pointer-events-none"
              style={{ overflow: 'visible' }}>
              <polyline
                points={polygonPoints.map(pt => `${pt.x},${pt.y}`).join(' ')}
                fill="none" stroke={quadFill} strokeWidth={2} strokeDasharray="6,3" />
              {polygonPoints.map((pt, i) => (
                <circle key={i} cx={pt.x} cy={pt.y} r={i === 0 ? 6 : 4}
                  fill={i === 0 ? quadFill : 'white'} stroke={quadFill} strokeWidth={2}
                  style={i === 0 ? { cursor: 'pointer' } : {}} />
              ))}
            </svg>
          )}

          {/* Rods */}
          {rods.map(rod => {
            const rw = rod.value * PDF_ROD_UNIT;
            const rh = PDF_ROD_HEIGHT;
            return (
              <div key={rod.id}
                data-rod-id={rod.id}
                className="absolute z-30 select-none touch-none"
                style={{
                  left: rod.x, top: rod.y,
                  width: rw, height: rh,
                  pointerEvents: 'auto',
                  cursor: 'grab',
                  transform: `rotate(${rod.rotation || 0}deg)`,
                  transformOrigin: 'center center',
                  backgroundColor: rod.color,
                  borderRadius: '3px',
                  boxShadow: rod.isInvalid
                    ? '0 0 0 2px #ef4444, 0 2px 6px rgba(239,68,68,0.4)'
                    : selectedId === rod.id
                      ? '0 0 0 2px #4c6ef5, 0 2px 8px rgba(76,110,245,0.35)'
                      : '0 2px 4px rgba(0,0,0,0.2)',
                  border: '1.5px solid rgba(0,0,0,0.35)',
                }}
                onPointerDown={(e) => handleRodPointerDown(e, rod.id)}
                onContextMenu={(e) => handleRodContextMenu(e, rod.id)}
                onDoubleClick={(e) => handleRodContextMenu(e, rod.id)}
              />
            );
          })}
        </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 bg-white shrink-0">
        <button onClick={goPrev} disabled={currentPage <= 1}
          className="p-2 text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-30">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="w-full mx-4 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${(currentPage / totalPages) * 100}%` }} />
        </div>
        <button onClick={goNext} disabled={currentPage >= totalPages}
          className="p-2 text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-30">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Modal de selección de páginas para exportar */}
      {showExportModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40" onClick={() => { setShowExportModal(false); setSelectedExportPages([]); }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-800 mb-3">Seleccionar páginas</h3>
            <div className="flex gap-2 mb-3">
              <button onClick={() => setSelectedExportPages(Array.from({ length: totalPages }, (_, i) => i + 1))}
                className="text-xs text-indigo-600 underline">Todas</button>
              <button onClick={() => setSelectedExportPages([])}
                className="text-xs text-slate-400 underline">Ninguna</button>
              <button onClick={() => setSelectedExportPages(prev => prev.includes(currentPage) ? prev : [...prev, currentPage])}
                className="text-xs text-emerald-600 underline">Actual</button>
            </div>
            <div className="flex-1 overflow-auto space-y-1 mb-4">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <label key={p} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${selectedExportPages.includes(p) ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50'}`}>
                  <input type="checkbox" checked={selectedExportPages.includes(p)}
                    onChange={() => setSelectedExportPages(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                    className="accent-indigo-600" />
                  <span className="text-sm">Página {p}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowExportModal(false); setSelectedExportPages([]); }}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={handleExportSelected} disabled={selectedExportPages.length === 0 || exporting}
                className="flex-1 px-3 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed">
                {exporting ? 'Exportando...' : `Descargar (${selectedExportPages.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context menu for rods */}
      {contextMenu && (
        <div
          className="fixed z-[10001] bg-white rounded-xl shadow-2xl border border-slate-200 py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}>
          {contextMenu.options.map((opt, i) => (
            <button key={i}
              onClick={() => { opt.action(); setContextMenu(null); }}
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors">
              <span>{opt.label}</span>
              {opt.shortcut && <span className="text-[10px] text-slate-400 font-mono">{opt.shortcut}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
