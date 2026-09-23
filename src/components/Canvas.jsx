import { useState, useRef, useCallback, useEffect } from 'react';
import DraggableRod from './DraggableRod';
import MathTextBox from './MathTextBox';
import FreeTextBox from './FreeTextBox';
import ContextMenu from './ContextMenu';
import GeoplanoOverlay from './GeoplanoOverlay';
import Antenna from './Antenna';
import { RODS, getRodWidth, generateRodId, generateMathId, UNIT_SIZE } from '../utils/rods';

const GRID = 40;

function formatSheetDate() {
  try {
    const s = new Date().toLocaleDateString('es-MX', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    const clean = s.replace(/^([^,]+),\s*/, '$1 ');
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  } catch {
    return new Date().toLocaleDateString('es-MX');
  }
}

function getBoundingBox(rod) {
  const L = rod.value;
  if (rod.rotation === 90) {
    return { left: rod.x, right: rod.x + GRID, top: rod.y, bottom: rod.y + L * GRID };
  } else {
    return { left: rod.x, right: rod.x + L * GRID, top: rod.y, bottom: rod.y + GRID };
  }
}

function checkCollision(box1, box2) {
  return !(
    box1.right <= box2.left ||
    box1.left >= box2.right ||
    box1.bottom <= box2.top ||
    box1.top >= box2.bottom
  );
}

function isOverlapping(newRod, allRods) {
  const box1 = getBoundingBox(newRod);
  for (const rod of allRods) {
    if (rod.id === newRod.id) continue;
    const box2 = getBoundingBox(rod);
    if (checkCollision(box1, box2)) return true;
  }
  return false;
}

/**
 * Canvas - Lienzo interactivo principal.
 * Gestiona las regletas colocadas, cajas de texto matemático y texto libre.
 */
export default function Canvas({ canvasRef, rods, setRods, mathTexts, setMathTexts, freeTexts, setFreeTexts, toolMode, geoPivots, geoBands, selectedPivotId, onGeoPivotClick, onGeoBandContext, onGeoCanvasClick, manualPivots, isInsertingPivot, onInsertPivot, onDeleteManualPivot, antennas, onAntennaUpdate, onAntennaDelete, quads, setQuads, polygons, setPolygons, activeTool, setActiveTool, quadFill, setQuadFill, genQuadId, genPolyId }) {
  // Estado del menú contextual
  const [contextMenu, setContextMenu] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const selectedRef = useRef(null);
  const innerRef = useRef(null);
  const containerRef = useRef(null);
  const copiedRodRef = useRef(null);
  const quadStart = useRef(null);
  const [quadPreview, setQuadPreview] = useState(null);
  const [polygonPoints, setPolygonPoints] = useState([]);

  const updateSelection = useCallback((id) => {
    setSelectedId(id);
    selectedRef.current = id;
  }, []);

  // Combinar refs
  const setCanvasRef = useCallback((node) => {
    innerRef.current = node;
    if (canvasRef) canvasRef.current = node;
  }, [canvasRef]);

  // ========== DRAG & DROP desde el panel lateral ==========
  const handleDragOver = (e) => {
    if (toolMode !== 'regletas') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e) => {
    if (toolMode !== 'regletas') return;
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (!data) return;

    try {
      const rodDef = JSON.parse(data);
      const rect = innerRef.current.getBoundingClientRect();
      // Snap to grid
      const rawX = e.clientX - rect.left - (getRodWidth(rodDef.value) / 2);
      const rawY = e.clientY - rect.top - (GRID / 2);
      
      const snappedX = Math.round(Math.max(0, rawX) / GRID) * GRID;
      const snappedY = Math.round(Math.max(0, rawY) / GRID) * GRID;

      const newRod = {
        id: generateRodId(),
        ...rodDef,
        x: snappedX,
        y: snappedY,
        rotation: 0,
        showValue: false,
        isInvalid: false,
      };

      if (!isOverlapping(newRod, rods)) {
        setRods(prev => [...prev, newRod]);
        updateSelection(newRod.id);
      }
    } catch {
      // Ignorar datos inválidos
    }
  };

  // ========== MOVER ELEMENTOS ==========
  const handleCanvasMouseDown = (e) => {
    if (e.button !== 0) return;

    const rodEl = e.target.closest('[data-rod-id]');
    if (rodEl) {
      const rodId = rodEl.getAttribute('data-rod-id');
      e.preventDefault();
      updateSelection(rodId);

      const rod = rods.find(r => r.id === rodId);
      if (!rod) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const origX = rod.x;
      const origY = rod.y;

      const handleMove = (moveEvent) => {
        const snappedX = Math.round(Math.max(0, origX + moveEvent.clientX - startX) / GRID) * GRID;
        const snappedY = Math.round(Math.max(0, origY + moveEvent.clientY - startY) / GRID) * GRID;
        setRods(prev => prev.map(r => {
          if (r.id !== rodId) return r;
          const tempRod = { ...r, x: snappedX, y: snappedY };
          return { ...tempRod, isInvalid: isOverlapping(tempRod, prev) };
        }));
      };

      const handleUp = () => {
        setRods(prev => prev.map(r => {
          if (r.id !== rodId) return r;
          if (r.isInvalid) return { ...r, x: origX, y: origY, isInvalid: false };
          return { ...r, isInvalid: false };
        }));
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      return;
    }

    const antennaEl = e.target.closest('[data-antenna-id]');
    if (antennaEl && onAntennaUpdate) {
      return;
    }

    // Quad creation: start drag
    if (activeTool === 'quad') {
      const rect = innerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      quadStart.current = { x, y };

      const handleMove = (moveEvent) => {
        const cx = moveEvent.clientX - rect.left;
        const cy = moveEvent.clientY - rect.top;
        setQuadPreview({
          x: Math.min(x, cx),
          y: Math.min(y, cy),
          width: Math.abs(cx - x),
          height: Math.abs(cy - y),
          fill: quadFill,
        });
      };

      const handleUp = (upEvent) => {
        const cx = upEvent.clientX - rect.left;
        const cy = upEvent.clientY - rect.top;
        const qw = Math.abs(cx - x);
        const qh = Math.abs(cy - y);
        if (qw > 5 && qh > 5) {
          const newId = genQuadId();
          setQuads(prev => [...prev, { id: newId, x: Math.min(x, cx), y: Math.min(y, cy), width: qw, height: qh, fill: quadFill, mode: toolMode }]);
          updateSelection(newId);
        }
        setQuadPreview(null);
        quadStart.current = null;
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      return;
    }
  };

  const handlePointerDownOnMath = (e, mathId) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    updateSelection(mathId);

    const mathBox = mathTexts.find(m => m.id === mathId);
    if (!mathBox) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const origX = mathBox.x;
    const origY = mathBox.y;

    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const handleMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      setMathTexts(prev => prev.map(m =>
        m.id === mathId
          ? { ...m, x: Math.max(0, origX + dx), y: Math.max(0, origY + dy) }
          : m
      ));
    };

    const handleUp = () => {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener('pointermove', handleMove);
      target.removeEventListener('pointerup', handleUp);
    };

    target.addEventListener('pointermove', handleMove);
    target.addEventListener('pointerup', handleUp);
  };

  const handlePointerDownOnFreeText = (e, textId) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    updateSelection(textId);

    const textBox = freeTexts.find(t => t.id === textId);
    if (!textBox) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const origX = textBox.x;
    const origY = textBox.y;

    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const handleMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      setFreeTexts(prev => prev.map(t =>
        t.id === textId
          ? { ...t, x: Math.max(0, origX + dx), y: Math.max(0, origY + dy) }
          : t
      ));
    };

    const handleUp = () => {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener('pointermove', handleMove);
      target.removeEventListener('pointerup', handleUp);
    };

    target.addEventListener('pointermove', handleMove);
    target.addEventListener('pointerup', handleUp);
  };

  // ========== MOVER ANTENA ==========
  const handleMouseDownOnAntenna = (e, antennaId) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    updateSelection(antennaId);

    const antenna = antennas.find(a => a.id === antennaId);
    if (!antenna || !onAntennaUpdate) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const origX = antenna.x;
    const origY = antenna.y;
    let dragStarted = false;

    const handleMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (!dragStarted) {
        if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        dragStarted = true;
      }
      onAntennaUpdate(antennaId, {
        x: Math.max(0, origX + dx),
        y: Math.max(0, origY + dy),
      });
    };

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  // ========== MENÚ CONTEXTUAL ==========
  const handleRodContextMenu = (e, rodId) => {
    e.preventDefault();
    e.stopPropagation();

    const rod = rods.find(r => r.id === rodId);
    if (!rod) return;

    updateSelection(rodId);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      options: [
        {
          icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
          label: 'Girar 90°',
          shortcut: 'R',
          action: () => {
            setRods(prev => {
              const r = prev.find(x => x.id === rodId);
              if (!r) return prev;
              const tempRod = { ...r, rotation: (r.rotation + 90) % 360 };
              if (isOverlapping(tempRod, prev)) return prev;
              return prev.map(x => x.id === rodId ? tempRod : x);
            });
          },
        },
        { separator: true },
        {
          icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
          label: 'Eliminar',
          shortcut: 'Del',
          danger: true,
          action: () => {
            setRods(prev => prev.filter(r => r.id !== rodId));
            updateSelection(null);
          },
        },
      ],
    });
  };

  const handleMathContextMenu = (e, mathId) => {
    e.preventDefault();
    e.stopPropagation();

    updateSelection(mathId);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      options: [
        {
          icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
          label: 'Editar fórmula',
          action: () => {},
        },
        { separator: true },
        {
          icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
          label: 'Eliminar',
          shortcut: 'Del',
          danger: true,
          action: () => {
            setMathTexts(prev => prev.filter(m => m.id !== mathId));
            updateSelection(null);
          },
        },
      ],
    });
  };

  const handleFreeTextContextMenu = (e, textId) => {
    e.preventDefault();
    e.stopPropagation();

    updateSelection(textId);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      options: [
        {
          icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
          label: 'Editar texto',
          action: () => {},
        },
        { separator: true },
        {
          icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
          label: 'Eliminar',
          shortcut: 'Del',
          danger: true,
          action: () => {
            setFreeTexts(prev => prev.filter(t => t.id !== textId));
            updateSelection(null);
          },
        },
      ],
    });
  };

  const handleAntennaContextMenu = (e, antennaId) => {
    e.preventDefault();
    e.stopPropagation();

    updateSelection(antennaId);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      options: [
        {
          icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
          label: 'Eliminar antena',
          shortcut: 'Del',
          danger: true,
          action: () => {
            if (onAntennaDelete) onAntennaDelete(antennaId);
            updateSelection(null);
          },
        },
      ],
    });
  };

  // ========== MENÚ CONTEXTUAL CUADRILÁTERO ==========
  const handleQuadContextMenu = (e, quadId) => {
    e.preventDefault();
    e.stopPropagation();
    updateSelection(quadId);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      options: [
        {
          icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
          label: 'Eliminar',
          shortcut: 'Del',
          danger: true,
          action: () => {
            setQuads(prev => prev.filter(q => q.id !== quadId));
            updateSelection(null);
          },
        },
      ],
    });
  };

  // ========== MENÚ CONTEXTUAL POLÍGONO ==========
  const handlePolygonContextMenu = (e, polyId) => {
    e.preventDefault();
    e.stopPropagation();
    updateSelection(polyId);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      options: [
        {
          icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
          label: 'Eliminar',
          shortcut: 'Del',
          danger: true,
          action: () => {
            setPolygons(prev => prev.filter(p => p.id !== polyId));
            updateSelection(null);
          },
        },
      ],
    });
  };

  // ========== CLIC EN EL LIENZO (deseleccionar / polígono) ==========
  const handleCanvasClick = (e) => {
    if (e.target.closest('[data-rod-id]')) return;
    if (e.target.closest('[data-antenna-id]')) return;
    if (e.target.closest('[data-quad-id]')) return;
    if (e.target.closest('[data-poly-id]')) return;

    if (activeTool === 'polygon') {
      const rect = innerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (polygonPoints.length >= 3) {
        const first = polygonPoints[0];
        const dist = Math.sqrt((x - first.x) ** 2 + (y - first.y) ** 2);
        if (dist < 15) {
          const newId = genPolyId();
          setPolygons(prev => [...prev, { id: newId, points: polygonPoints, fill: quadFill, mode: toolMode }]);
          setPolygonPoints([]);
          updateSelection(newId);
          setActiveTool('pen');
          return;
        }
      }
      setPolygonPoints(prev => [...prev, { x, y }]);
      return;
    }

    updateSelection(null);
    if (onGeoCanvasClick) onGeoCanvasClick();
  };

  // ========== MOVER CUADRILÁTERO ==========
  const handlePointerDownOnQuad = (e, quadId) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    updateSelection(quadId);
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
    };
    target.addEventListener('pointermove', handleMove);
    target.addEventListener('pointerup', handleUp);
  };

  // ========== REDIMENSIONAR CUADRILÁTERO ==========
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
    };
    target.addEventListener('pointermove', handleMove);
    target.addEventListener('pointerup', handleUp);
  };

  // ========== MOVER POLÍGONO ==========
  const handlePointerDownOnPolygon = (e, polyId) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    updateSelection(polyId);
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
    };
    target.addEventListener('pointermove', handleMove);
    target.addEventListener('pointerup', handleUp);
  };

  const getPolygonBounds = (points) => {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
  };

  // ========== REDIMENSIONAR POLÍGONO ==========
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
    };
    target.addEventListener('pointermove', handleMove);
    target.addEventListener('pointerup', handleUp);
  };

  // ========== TECLADO ==========
  useEffect(() => {
    const handleKeyDown = async (e) => {
      if (document.querySelector('[data-pdf-reader-open]')) return;
      const isEditingText = (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
      if (isEditingText) return;

      // Ctrl+C: copiar regleta, fórmula LaTeX o texto libre
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const id = selectedRef.current;
        if (id) {
          const rod = rods.find(r => r.id === id);
          if (rod) {
            copiedRodRef.current = { ...rod };
          } else {
            copiedRodRef.current = null;
            const mt = mathTexts.find(m => m.id === id);
            if (mt && mt.latex) {
              try {
                await navigator.clipboard.writeText(mt.latex);
              } catch (err) {
                console.warn('No se pudo copiar al portapapeles:', err);
              }
            } else {
              const ft = freeTexts.find(t => t.id === id);
              if (ft && ft.text) {
                try {
                  await navigator.clipboard.writeText(ft.text);
                } catch (err) {
                  console.warn('No se pudo copiar al portapapeles:', err);
                }
              }
            }
          }
        }
        return;
      }

      // Ctrl+V: pegar regleta copiada
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (copiedRodRef.current) {
          e.preventDefault();
          const copy = copiedRodRef.current;
          const newRod = {
            ...copy,
            id: generateRodId(),
            x: copy.x + 40,
            y: copy.y + 40,
          };
          setRods(prev => [...prev, newRod]);
          return;
        }
      }

      const id = selectedRef.current;
      if (!id) return;

      if (e.key === 'Escape') {
        if (activeTool === 'polygon') {
          setPolygonPoints([]);
          setActiveTool('pen');
        }
        updateSelection(null);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        setRods(prev => prev.filter(r => r.id !== id));
        setMathTexts(prev => prev.filter(m => m.id !== id));
        setFreeTexts(prev => prev.filter(t => t.id !== id));
        setQuads(prev => prev.filter(q => q.id !== id));
        setPolygons(prev => prev.filter(p => p.id !== id));
        if (onAntennaDelete) onAntennaDelete(id);
        updateSelection(null);
        return;
      }

      if (e.key.startsWith('Arrow')) {
        e.preventDefault();

        setRods(prev => prev.map(r => {
          if (r.id !== id) return r;
          let dx = 0, dy = 0;
          if (e.key === 'ArrowLeft') dx = -40;
          if (e.key === 'ArrowRight') dx = 40;
          if (e.key === 'ArrowUp') dy = -40;
          if (e.key === 'ArrowDown') dy = 40;
          const newX = Math.max(0, r.x + dx);
          const newY = Math.max(0, r.y + dy);
          const tempRod = { ...r, x: newX, y: newY };
          if (isOverlapping(tempRod, prev)) return r;
          return { ...r, x: newX, y: newY };
        }));

        setMathTexts(prev => prev.map(m => {
          if (m.id !== id) return m;
          let dx = 0, dy = 0;
          if (e.key === 'ArrowLeft') dx = -40;
          if (e.key === 'ArrowRight') dx = 40;
          if (e.key === 'ArrowUp') dy = -40;
          if (e.key === 'ArrowDown') dy = 40;
          return { ...m, x: Math.max(0, m.x + dx), y: Math.max(0, m.y + dy) };
        }));

        setFreeTexts(prev => prev.map(t => {
          if (t.id !== id) return t;
          if (e.key === 'ArrowLeft') return { ...t, x: Math.max(0, t.x - 40) };
          if (e.key === 'ArrowRight') return { ...t, x: t.x + 40 };
          if (e.key === 'ArrowUp') return { ...t, y: Math.max(0, t.y - 40) };
          if (e.key === 'ArrowDown') return { ...t, y: t.y + 40 };
          return t;
        }));

        const antenna = antennas.find(a => a.id === id);
        if (antenna && onAntennaUpdate) {
          let dx = 0, dy = 0;
          if (e.key === 'ArrowLeft') dx = -40;
          if (e.key === 'ArrowRight') dx = 40;
          if (e.key === 'ArrowUp') dy = -40;
          if (e.key === 'ArrowDown') dy = 40;
          onAntennaUpdate(id, {
            x: Math.max(0, antenna.x + dx),
            y: Math.max(0, antenna.y + dy),
          });
        }

        setQuads(prev => prev.map(q => {
          if (q.id !== id) return q;
          let dx = 0, dy = 0;
          if (e.key === 'ArrowLeft') dx = -40;
          if (e.key === 'ArrowRight') dx = 40;
          if (e.key === 'ArrowUp') dy = -40;
          if (e.key === 'ArrowDown') dy = 40;
          return { ...q, x: Math.max(0, q.x + dx), y: Math.max(0, q.y + dy) };
        }));

        setPolygons(prev => prev.map(p => {
          if (p.id !== id) return p;
          let dx = 0, dy = 0;
          if (e.key === 'ArrowLeft') dx = -40;
          if (e.key === 'ArrowRight') dx = 40;
          if (e.key === 'ArrowUp') dy = -40;
          if (e.key === 'ArrowDown') dy = 40;
          return { ...p, points: p.points.map(pt => ({ x: Math.max(0, pt.x + dx), y: Math.max(0, pt.y + dy) })) };
        }));
      }
    };
    const handlePasteGlobal = (e) => {
      if (document.querySelector('[data-pdf-reader-open]')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const text = e.clipboardData.getData('text');
      if (!text || !text.trim()) return;
      e.preventDefault();
      if (text.trim().startsWith('\\')) {
        setMathTexts(prev => [...prev, {
          id: generateMathId(),
          x: 100 + Math.random() * 200,
          y: 100 + Math.random() * 200,
          latex: text.trim(),
          mode: toolMode,
        }]);
      } else {
        setFreeTexts(prev => [...prev, {
          id: generateMathId(),
          x: 100 + Math.random() * 200,
          y: 200 + Math.random() * 200,
          text: text.trim(),
          color: '#1e293b',
          bold: false,
          mode: toolMode,
        }]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handlePasteGlobal);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handlePasteGlobal);
    };
  }, [onAntennaDelete, onAntennaUpdate, antennas, mathTexts, freeTexts, rods, quads, setQuads, polygons, setPolygons, activeTool, setActiveTool, setPolygonPoints, updateSelection, toolMode]);

  const handleKeyDown = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (!selectedId) return;

    if (e.key === 'r' || e.key === 'R') {
      setRods(prev => {
        const r = prev.find(x => x.id === selectedId);
        if (!r) return prev;
        const tempRod = { ...r, rotation: (r.rotation + 90) % 360 };
        if (isOverlapping(tempRod, prev)) return prev;
        return prev.map(x => x.id === selectedId ? tempRod : x);
      });
    }
  };

  // ========== ACTUALIZAR TEXTOS ==========
  const handleMathUpdate = (id, latex) => {
    setMathTexts(prev => prev.map(m => m.id === id ? { ...m, latex } : m));
  };

  const handleFreeTextUpdate = (id, data) => {
    setFreeTexts(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
  };

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text');
    if (text && text.trim().startsWith('\\')) {
      e.preventDefault();
      const newMath = {
        id: generateMathId(),
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200,
        latex: text.trim(),
        mode: toolMode,
      };
      setMathTexts(prev => [...prev, newMath]);
    }
  };

  // Elementos visibles en el modo activo (los antiguos sin mode se ven en ambos)
  const inActiveMode = (item) => !item.mode || item.mode === toolMode;
  const visibleMathTexts = mathTexts.filter(inActiveMode);
  const visibleFreeTexts = freeTexts.filter(inActiveMode);
  const visibleAntennas = antennas.filter(inActiveMode);
  const visibleQuads = quads.filter(inActiveMode);
  const visiblePolygons = polygons.filter(inActiveMode);

  // Al cambiar de modo, deseleccionar para no operar sobre un elemento oculto
  const prevToolModeRef = useRef(toolMode);
  useEffect(() => {
    if (prevToolModeRef.current !== toolMode) {
      prevToolModeRef.current = toolMode;
      updateSelection(null);
    }
  }, [toolMode, updateSelection]);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-auto bg-slate-100 canvas-inset-shadow"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseDown={(e) => { handleCanvasMouseDown(e); if (e.target.tagName !== 'INPUT') containerRef.current?.focus(); }}
      onClick={handleCanvasClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      style={{ outline: 'none', cursor: activeTool === 'quad' ? 'crosshair' : activeTool === 'polygon' ? 'crosshair' : undefined }}
    >
      {/* Contenedor interno grande para scrollear y capturar */}
      <div
        ref={setCanvasRef}
        data-canvas-inner
        className="canvas-grid relative shadow-sm"
        style={{ width: '2400px', height: '1600px', minWidth: '100%', minHeight: '100%' }}
      >
        {/* Encabezado fijo estilo libreta: fecha automática + materia (arriba a la izquierda) */}
        <div
          data-sheet-header
          className="absolute top-2 left-4 flex flex-col select-none pointer-events-none
                     border-b-[3px] border-slate-500 pb-1.5 pr-16"
          style={{ zIndex: 1 }}
        >
          <p className="text-[26px] font-bold text-slate-800 leading-snug tracking-wide">
            {formatSheetDate()}
          </p>
          <p className="text-[26px] font-extrabold text-slate-800 leading-snug tracking-wide">
            Saberes y pensamiento científico
          </p>
        </div>

        {/* Modo Regletas: regletas */}
        {toolMode === 'regletas' && (
          <>
            {rods.map((rod) => (
              <div
                key={rod.id}
                data-rod-id={rod.id}
                onContextMenu={(e) => handleRodContextMenu(e, rod.id)}
                style={{
                  position: 'absolute',
                  left: `${rod.x}px`,
                  top: `${rod.y}px`,
                  cursor: 'grab',
                }}
              >
                <DraggableRod
                  rod={rod}
                  showValue={rod.showValue}
                  rotation={rod.rotation}
                  isSelected={selectedId === rod.id}
                  onContextMenu={(e) => handleRodContextMenu(e, rod.id)}
                />
              </div>
            ))}
          </>
        )}

        {/* Textos (visibles según modo de creación) */}
        {visibleMathTexts.map((mt) => (
          <div
            key={mt.id}
            style={{
              position: 'absolute',
              left: `${mt.x}px`,
              top: `${mt.y}px`,
            }}
          >
            <MathTextBox
              id={mt.id}
              initialLatex={mt.latex}
              isSelected={selectedId === mt.id}
              onPointerDown={(e) => handlePointerDownOnMath(e, mt.id)}
              onContextMenu={(e) => handleMathContextMenu(e, mt.id)}
              onUpdate={handleMathUpdate}
            />
          </div>
        ))}

        {visibleFreeTexts.map((ft) => (
          <div
            key={ft.id}
            style={{
              position: 'absolute',
              left: `${ft.x}px`,
              top: `${ft.y}px`,
            }}
          >
            <FreeTextBox
              id={ft.id}
              initialText={ft.text}
              initialColor={ft.color || '#1e293b'}
              initialBold={ft.bold || false}
              isSelected={selectedId === ft.id}
              onPointerDown={(e) => handlePointerDownOnFreeText(e, ft.id)}
              onContextMenu={(e) => handleFreeTextContextMenu(e, ft.id)}
              onUpdate={handleFreeTextUpdate}
            />
          </div>
        ))}

        {/* Modo Geoplano: pivotes + bandas */}
        {toolMode === 'geoplano' && (
          <GeoplanoOverlay
            pivots={geoPivots}
            manualPivots={manualPivots || []}
            bands={geoBands || []}
            selectedPivotId={selectedPivotId}
            onPivotClick={onGeoPivotClick}
            onBandContextMenu={onGeoBandContext}
            onCanvasClick={handleCanvasClick}
            isInsertingPivot={isInsertingPivot}
            onInsertPivot={onInsertPivot}
            onDeleteManualPivot={onDeleteManualPivot}
          />
        )}

        {/* Antenas (visibles según modo de creación) */}
        {visibleAntennas.map((antenna) => (
          <div key={antenna.id} data-antenna-id={antenna.id}>
            <Antenna
              antenna={antenna}
              isSelected={selectedId === antenna.id}
              onMouseDown={handleMouseDownOnAntenna}
              onContextMenu={handleAntennaContextMenu}
              onUpdate={onAntennaUpdate}
            />
          </div>
        ))}

        {/* Quad preview during drag */}
        {quadPreview && quadPreview.width > 2 && quadPreview.height > 2 && (
          <div
            className="absolute z-20 pointer-events-none"
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

        {/* Cuadrilateros (visibles según modo de creación) */}
        {visibleQuads.map(q => (
          <div key={q.id}
            data-quad-id={q.id}
            className="absolute z-30"
            style={{ left: q.x, top: q.y, width: q.width, height: q.height, pointerEvents: 'auto' }}>
            <div
              onPointerDown={(e) => handlePointerDownOnQuad(e, q.id)}
              onContextMenu={(e) => handleQuadContextMenu(e, q.id)}
              className="w-full h-full cursor-grab active:cursor-grabbing"
              style={{
                backgroundColor: q.fill,
                opacity: 0.6,
                border: `2px solid ${q.fill}`,
                borderRadius: '2px',
              }}
            />
            {selectedId === q.id && (
              <>
                <div onPointerDown={(e) => handleQuadResize(e, q.id, 'nw')} className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-slate-500 rounded-sm cursor-nw-resize z-40" />
                <div onPointerDown={(e) => handleQuadResize(e, q.id, 'ne')} className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-slate-500 rounded-sm cursor-ne-resize z-40" />
                <div onPointerDown={(e) => handleQuadResize(e, q.id, 'sw')} className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-slate-500 rounded-sm cursor-sw-resize z-40" />
                <div onPointerDown={(e) => handleQuadResize(e, q.id, 'se')} className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-slate-500 rounded-sm cursor-se-resize z-40" />
                <div onPointerDown={(e) => handleQuadResize(e, q.id, 'n')} className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-white border-2 border-slate-400 rounded-sm cursor-n-resize z-40" />
                <div onPointerDown={(e) => handleQuadResize(e, q.id, 's')} className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-white border-2 border-slate-400 rounded-sm cursor-s-resize z-40" />
                <div onPointerDown={(e) => handleQuadResize(e, q.id, 'w')} className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-8 bg-white border-2 border-slate-400 rounded-sm cursor-w-resize z-40" />
                <div onPointerDown={(e) => handleQuadResize(e, q.id, 'e')} className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-8 bg-white border-2 border-slate-400 rounded-sm cursor-e-resize z-40" />
              </>
            )}
          </div>
        ))}

        {/* Poligonos (visibles según modo de creación) */}
        {visiblePolygons.map(p => {
          const bounds = getPolygonBounds(p.points);
          const w = bounds.maxX - bounds.minX;
          const h = bounds.maxY - bounds.minY;
          const pts = p.points.map(pt => `${pt.x - bounds.minX},${pt.y - bounds.minY}`).join(' ');
          return (
            <div key={p.id}
              data-poly-id={p.id}
              className="absolute z-30"
              style={{ left: bounds.minX, top: bounds.minY, width: w, height: h, pointerEvents: 'auto' }}>
              <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => handlePointerDownOnPolygon(e, p.id)}
                onContextMenu={(e) => handlePolygonContextMenu(e, p.id)}
                style={{ overflow: 'visible' }}>
                <polygon points={pts}
                  fill={p.fill} fillOpacity={0.6}
                  stroke={p.fill} strokeWidth={2} strokeLinejoin="round" />
              </svg>
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

        {/* Mensaje de bienvenida según el modo activo */}
        {((toolMode === 'regletas' && rods.length === 0 && visibleMathTexts.length === 0 && visibleFreeTexts.length === 0 && visibleAntennas.length === 0 && visibleQuads.length === 0 && visiblePolygons.length === 0) ||
          (toolMode === 'geoplano' && geoBands.length === 0 && (manualPivots || []).length === 0 && visibleMathTexts.length === 0 && visibleFreeTexts.length === 0 && visibleAntennas.length === 0 && visibleQuads.length === 0 && visiblePolygons.length === 0)) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center animate-pulse-soft">
              {toolMode === 'geoplano' ? (
                <>
                  <svg className="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                  <p className="text-slate-400 text-lg font-medium">
                    Haz clic en un pivote y luego en otro
                  </p>
                  <p className="text-slate-300 text-sm mt-1">
                    para crear bandas elásticas entre ellos, o usa la barra
                    de herramientas para agregar texto
                  </p>
                </>
              ) : (
                <>
                  <svg className="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                  </svg>
                  <p className="text-slate-400 text-lg font-medium">
                    Arrastra regletas aquí para comenzar
                  </p>
                  <p className="text-slate-300 text-sm mt-1">
                    o usa la barra de herramientas para agregar texto
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Menú contextual */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          options={contextMenu.options}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
