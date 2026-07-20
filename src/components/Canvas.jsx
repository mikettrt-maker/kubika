import { useState, useRef, useCallback, useEffect } from 'react';
import DraggableRod from './DraggableRod';
import MathTextBox from './MathTextBox';
import FreeTextBox from './FreeTextBox';
import ContextMenu from './ContextMenu';
import GeoplanoOverlay from './GeoplanoOverlay';
import Antenna from './Antenna';
import { RODS, getRodWidth, generateRodId, generateMathId, UNIT_SIZE } from '../utils/rods';

const GRID = 40;

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
export default function Canvas({ canvasRef, rods, setRods, mathTexts, setMathTexts, freeTexts, setFreeTexts, toolMode, geoPivots, geoBands, selectedPivotId, onGeoPivotClick, onGeoBandContext, onGeoCanvasClick, manualPivots, isInsertingPivot, onInsertPivot, onDeleteManualPivot, antennas, onAntennaUpdate, onAntennaDelete }) {
  // Estado del menú contextual
  const [contextMenu, setContextMenu] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const selectedRef = useRef(null);
  const innerRef = useRef(null);

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
      const antennaId = antennaEl.getAttribute('data-antenna-id');
      e.preventDefault();
      updateSelection(antennaId);

      const antenna = antennas.find(a => a.id === antennaId);
      if (!antenna) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const origX = antenna.x;
      const origY = antenna.y;

      const handleMove = (moveEvent) => {
        onAntennaUpdate(antennaId, {
          x: Math.max(0, origX + moveEvent.clientX - startX),
          y: Math.max(0, origY + moveEvent.clientY - startY),
        });
      };

      const handleUp = () => {
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

    const handleMove = (moveEvent) => {
      onAntennaUpdate(antennaId, {
        x: Math.max(0, origX + moveEvent.clientX - startX),
        y: Math.max(0, origY + moveEvent.clientY - startY),
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

  // ========== CLIC EN EL LIENZO (deseleccionar) ==========
  const handleCanvasClick = (e) => {
    if (e.target.closest('[data-rod-id]')) return;
    if (e.target.closest('[data-antenna-id]')) return;
    updateSelection(null);
    if (onGeoCanvasClick) onGeoCanvasClick();
  };

  // ========== TECLADO ==========
  useEffect(() => {
    const handleKeyDown = (e) => {
      const id = selectedRef.current;
      if (!id) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        setRods(prev => prev.filter(r => r.id !== id));
        setMathTexts(prev => prev.filter(m => m.id !== id));
        setFreeTexts(prev => prev.filter(t => t.id !== id));
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
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onAntennaDelete, onAntennaUpdate, antennas]);

  const handleKeyDown = (e) => {
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

  return (
    <div
      className="relative flex-1 overflow-auto bg-slate-100"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseDown={handleCanvasMouseDown}
      onClick={handleCanvasClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      style={{ outline: 'none' }}
    >
      {/* Contenedor interno grande para scrollear y capturar */}
      <div 
        ref={setCanvasRef}
        data-canvas-inner
        className="canvas-grid relative shadow-sm" 
        style={{ width: '2400px', height: '1600px', minWidth: '100%', minHeight: '100%' }}
      >
        {/* Modo Regletas: regletas + textos */}
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

            {mathTexts.map((mt) => (
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

            {freeTexts.map((ft) => (
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
          </>
        )}

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

        {/* Antenas (visibles en todos los modos) */}
        {antennas.map((antenna) => (
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

        {/* Mensaje de bienvenida según el modo activo */}
        {((toolMode === 'regletas' && rods.length === 0 && mathTexts.length === 0 && freeTexts.length === 0 && antennas.length === 0) ||
          (toolMode === 'geoplano' && geoBands.length === 0 && (manualPivots || []).length === 0 && antennas.length === 0)) && (
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
                    para crear bandas elásticas entre ellos
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
