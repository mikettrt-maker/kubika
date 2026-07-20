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
  // Estado del drag dentro del lienzo
  const [dragging, setDragging] = useState(null);
  // Elemento seleccionado actualmente
  const [selectedId, setSelectedId] = useState(null);
  // Ref interna del contenedor del lienzo
  const innerRef = useRef(null);

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
        setSelectedId(newRod.id);
      }
    } catch {
      // Ignorar datos inválidos
    }
  };

  // ========== MOVER ELEMENTOS (puntero) ==========
  const handlePointerDownOnRod = (e, rodId) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    setSelectedId(rodId);

    const rod = rods.find(r => r.id === rodId);
    if (!rod) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const origX = rod.x;
    const origY = rod.y;

    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const handleMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const snappedX = Math.round(Math.max(0, origX + dx) / GRID) * GRID;
      const snappedY = Math.round(Math.max(0, origY + dy) / GRID) * GRID;

      setRods(prev => prev.map(r => {
        if (r.id === rodId) {
          const tempRod = { ...r, x: snappedX, y: snappedY };
          return { ...tempRod, isInvalid: isOverlapping(tempRod, prev) };
        }
        return r;
      }));
    };

    const handleUp = () => {
      target.releasePointerCapture(e.pointerId);
      setRods(prev => prev.map(r => {
        if (r.id === rodId) {
          if (r.isInvalid) {
            return { ...r, x: origX, y: origY, isInvalid: false };
          }
          return { ...r, isInvalid: false };
        }
        return r;
      }));

      target.removeEventListener('pointermove', handleMove);
      target.removeEventListener('pointerup', handleUp);
    };

    target.addEventListener('pointermove', handleMove);
    target.addEventListener('pointerup', handleUp);
  };

  const handlePointerDownOnMath = (e, mathId) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    setSelectedId(mathId);

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

    setSelectedId(textId);

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

  // ========== MOVER ANTENA (pointer events) ==========
  const handlePointerDownOnAntenna = (e, antennaId) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    setSelectedId(antennaId);

    const antenna = antennas.find(a => a.id === antennaId);
    if (!antenna) return;

    const rect = innerRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = antenna.x;
    const origY = antenna.y;

    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const handleMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      onAntennaUpdate(antennaId, { x: Math.max(0, origX + dx), y: Math.max(0, origY + dy) });
    };

    const handleUp = () => {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener('pointermove', handleMove);
      target.removeEventListener('pointerup', handleUp);
    };

    target.addEventListener('pointermove', handleMove);
    target.addEventListener('pointerup', handleUp);
  };

  // ========== MENÚ CONTEXTUAL ==========
  const handleRodContextMenu = (e, rodId) => {
    e.preventDefault();
    e.stopPropagation();

    const rod = rods.find(r => r.id === rodId);
    if (!rod) return;

    setSelectedId(rodId);
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
            setSelectedId(null);
          },
        },
      ],
    });
  };

  const handleMathContextMenu = (e, mathId) => {
    e.preventDefault();
    e.stopPropagation();

    setSelectedId(mathId);
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
            setSelectedId(null);
          },
        },
      ],
    });
  };

  const handleFreeTextContextMenu = (e, textId) => {
    e.preventDefault();
    e.stopPropagation();

    setSelectedId(textId);
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
            setSelectedId(null);
          },
        },
      ],
    });
  };

  const handleAntennaContextMenu = (e, antennaId) => {
    e.preventDefault();
    e.stopPropagation();

    setSelectedId(antennaId);
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
            setSelectedId(null);
          },
        },
      ],
    });
  };

  // ========== CLIC EN EL LIENZO (deseleccionar) ==========
  const handleCanvasClick = (e) => {
    setSelectedId(null);
    if (onGeoCanvasClick) onGeoCanvasClick();
  };

  // ========== TECLADO ==========
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedId) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        setRods(prev => prev.filter(r => r.id !== selectedId));
        setMathTexts(prev => prev.filter(m => m.id !== selectedId));
        setFreeTexts(prev => prev.filter(t => t.id !== selectedId));
        if (onAntennaDelete) onAntennaDelete(selectedId);
        setSelectedId(null);
        return;
      }

      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? GRID : GRID;

        setRods(prev => prev.map(r => {
          if (r.id !== selectedId) return r;
          let dx = 0, dy = 0;
          if (e.key === 'ArrowLeft') dx = -step;
          if (e.key === 'ArrowRight') dx = step;
          if (e.key === 'ArrowUp') dy = -step;
          if (e.key === 'ArrowDown') dy = step;
          const newX = Math.max(0, r.x + dx);
          const newY = Math.max(0, r.y + dy);
          const tempRod = { ...r, x: newX, y: newY };
          if (isOverlapping(tempRod, prev)) return r;
          return { ...r, x: newX, y: newY };
        }));

        setMathTexts(prev => prev.map(m => {
          if (m.id !== selectedId) return m;
          let dx = 0, dy = 0;
          if (e.key === 'ArrowLeft') dx = -step;
          if (e.key === 'ArrowRight') dx = step;
          if (e.key === 'ArrowUp') dy = -step;
          if (e.key === 'ArrowDown') dy = step;
          return { ...m, x: Math.max(0, m.x + dx), y: Math.max(0, m.y + dy) };
        }));

        setFreeTexts(prev => prev.map(t => {
          if (t.id !== selectedId) return t;
          let dx = 0, dy = 0;
          if (e.key === 'ArrowLeft') dx = -step;
          if (e.key === 'ArrowRight') dx = step;
          if (e.key === 'ArrowUp') dy = -step;
          if (e.key === 'ArrowDown') dy = step;
          return { ...t, x: Math.max(0, t.x + dx), y: Math.max(0, t.y + dy) };
        }));

        const antenna = antennas.find(a => a.id === selectedId);
        if (antenna && onAntennaUpdate) {
          let dx = 0, dy = 0;
          if (e.key === 'ArrowLeft') dx = -step;
          if (e.key === 'ArrowRight') dx = step;
          if (e.key === 'ArrowUp') dy = -step;
          if (e.key === 'ArrowDown') dy = step;
          onAntennaUpdate(selectedId, {
            x: Math.max(0, antenna.x + dx),
            y: Math.max(0, antenna.y + dy),
          });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, onAntennaDelete, onAntennaUpdate]);

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

  const handleFreeTextUpdate = (id, text) => {
    setFreeTexts(prev => prev.map(t => t.id === id ? { ...t, text } : t));
  };

  return (
    <div
      className="relative flex-1 overflow-auto bg-slate-100"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleCanvasClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
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
                onPointerDown={(e) => handlePointerDownOnRod(e, rod.id)}
                onContextMenu={(e) => handleRodContextMenu(e, rod.id)}
                style={{
                  position: 'absolute',
                  left: `${rod.x}px`,
                  top: `${rod.y}px`,
                  touchAction: 'none',
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
          <Antenna
            key={antenna.id}
            antenna={antenna}
            isSelected={selectedId === antenna.id}
            onPointerDown={handlePointerDownOnAntenna}
            onContextMenu={handleAntennaContextMenu}
            onUpdate={onAntennaUpdate}
          />
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
