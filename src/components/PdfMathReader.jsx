import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import MathTextBox from './MathTextBox';
import FreeTextBox from './FreeTextBox';

import { RODS } from '../utils/rods';

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

export default function PdfMathReader({ libro, onBack }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);

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

  const containerRef = useRef(null);
  const drawCanvasRef = useRef(null);
  const pdfRef = useRef(null);
  const renderingRef = useRef(false);
  const isDrawing = useRef(false);
  const lastPoint = useRef(null);
  const lineStart = useRef(null);
  const quadStart = useRef(null);
  const userId = useRef(getUserId());
  const savedCanvasImage = useRef(null);

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
        mathTexts,
        freeTexts,
        quads,
        polygons,
      });
    } catch {}
  }, [libro.id, currentPage, mathTexts, freeTexts, quads, polygons]);

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
      setMathTexts(saved.mathTexts || []);
      setFreeTexts(saved.freeTexts || []);
      setQuads(saved.quads || []);
      setPolygons(saved.polygons || []);
    } else {
      setMathTexts([]);
      setFreeTexts([]);
      setQuads([]);
      setPolygons([]);
    }
  }, [libro.id, currentPage]);

  // Auto-save when texts/quads/polygons change
  useEffect(() => {
    if (pdfRef.current && !loading) {
      const canvas = drawCanvasRef.current;
      if (canvas) {
        try {
          savePageData(userId.current, libro.id, currentPage, {
            canvas: canvas.toDataURL(),
            mathTexts,
            freeTexts,
            quads,
            polygons,
          });
        } catch {}
      }
    }
  }, [mathTexts, freeTexts, quads, polygons]);

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
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const newId = genId();
      setMathTexts(prev => [...prev, { id: newId, x, y, latex: '', width: 150 }]);
      setActiveTool('pen');
      setSelectedId(newId);
    } else if (activeTool === 'text') {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const newId = genId();
      setFreeTexts(prev => [...prev, { id: newId, x, y, text: '', color: '#1e293b', bold: false }]);
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
    savePageData(userId.current, libro.id, currentPage, { canvas: '', mathTexts: [], freeTexts: [], quads: [], polygons: [] });
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
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedId) return;

      const isEditingText = (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
      const step = e.shiftKey ? 1 : 5;

      if (e.key === 'Escape') {
        setSelectedId(null);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const isMath = mathTexts.some(m => m.id === selectedId);
        const isFree = freeTexts.some(t => t.id === selectedId);
        const isQuad = quads.some(q => q.id === selectedId);
        const isPoly = polygons.some(p => p.id === selectedId);
        if (isMath) {
          setMathTexts(prev => prev.filter(m => m.id !== selectedId));
        } else if (isFree) {
          setFreeTexts(prev => prev.filter(t => t.id !== selectedId));
        } else if (isQuad) {
          setQuads(prev => prev.filter(q => q.id !== selectedId));
        } else if (isPoly) {
          setPolygons(prev => prev.filter(p => p.id !== selectedId));
        }
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
      if (isMath) {
        setMathTexts(prev => prev.map(m => m.id === selectedId ? { ...m, x: Math.max(0, m.x + dx), y: Math.max(0, m.y + dy) } : m));
      } else if (isFree) {
        setFreeTexts(prev => prev.map(t => t.id === selectedId ? { ...t, x: Math.max(0, t.x + dx), y: Math.max(0, t.y + dy) } : t));
      } else if (isQuad) {
        setQuads(prev => prev.map(q => q.id === selectedId ? { ...q, x: Math.max(0, q.x + dx), y: Math.max(0, q.y + dy) } : q));
      } else if (isPoly) {
        setPolygons(prev => prev.map(p => p.id === selectedId ? { ...p, points: p.points.map(pt => ({ x: Math.max(0, pt.x + dx), y: Math.max(0, pt.y + dy) })) } : p));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, mathTexts, freeTexts, quads, polygons]);

  const isDrawingTool = activeTool === 'pen' || activeTool === 'eraser' || activeTool === 'line' || activeTool === 'pivot' || activeTool === 'quad' || activeTool === 'polygon';

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

  return (
    <div className="flex flex-col h-full bg-white">
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

        {/* Limpiar */}
        <div className="kubika-tooltip-wrapper">
          <button onClick={clearCanvas}
            className="btn-icon btn-ripple flex items-center justify-center w-9 h-9 rounded-xl hover:bg-red-50 transition-all duration-200 group">
            <svg className="w-6 h-6 text-red-400 group-hover:scale-125 group-hover:text-red-600 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <span className="kubika-tooltip">Limpiar todo</span>
        </div>

        <div className="header-divider" />

        {/* Zoom */}
        <div className="kubika-tooltip-wrapper">
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
            className="btn-icon btn-ripple flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 group">
            <svg className="w-5 h-5 text-slate-500 group-hover:scale-125 group-hover:text-slate-700 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
            </svg>
          </button>
          <span className="kubika-tooltip">Reducir</span>
        </div>

        <span className="text-[10px] text-slate-400 font-medium select-none">{Math.round(scale * 100)}%</span>

        <div className="kubika-tooltip-wrapper">
          <button onClick={() => setScale(s => Math.min(3, s + 0.2))}
            className="btn-icon btn-ripple flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 group">
            <svg className="w-5 h-5 text-slate-500 group-hover:scale-125 group-hover:text-slate-700 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
            </svg>
          </button>
          <span className="kubika-tooltip">Aumentar</span>
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
      <div className="flex-1 overflow-auto flex justify-center bg-slate-100">
        <div className="relative inline-block my-4 shadow-lg">
          <div ref={containerRef} />

          {/* Drawing canvas — always present, receives pointer events only for drawing tools */}
          <canvas
            ref={drawCanvasRef}
            className="absolute inset-0"
            style={{
              touchAction: 'none',
              pointerEvents: isDrawingTool ? 'auto' : 'none',
              zIndex: isDrawingTool ? 20 : 5,
              cursor: activeTool === 'eraser' ? 'cell' : 'default',
            }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            onClick={(e) => {
              setShowQuadColorPicker(false);
              if (activeTool === 'polygon') {
                handlePolygonClick(e);
              } else {
                setSelectedId(null);
              }
            }}
          />

          {/* Click-through layer for text/formula placement */}
          {activeTool === 'text' || activeTool === 'formula' ? (
            <div
              className="absolute inset-0"
              style={{ zIndex: 20, cursor: 'crosshair' }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={handleOverlayClick}
            />
          ) : null}

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
              style={{ left: ft.x, top: ft.y, pointerEvents: 'auto' }}
              onPointerDown={(e) => handlePointerDownOnFreeText(e, ft.id)}>
              <FreeTextBox
                id={ft.id}
                initialText={ft.text}
                initialColor={ft.color}
                initialBold={ft.bold}
                onUpdate={handleFreeTextUpdate}
                isSelected={selectedId === ft.id}
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
    </div>
  );
}
