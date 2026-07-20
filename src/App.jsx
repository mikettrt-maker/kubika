import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { useWorkspace } from './hooks/useWorkspace';
import AuthForm from './components/AuthForm';
import RodPanel from './components/RodPanel';
import Canvas from './components/Canvas';
import GeoplanoPanel from './components/GeoplanoPanel';
import Antenna from './components/Antenna';
import SaveLoadModal from './components/SaveLoadModal';
import SplashScreen from './components/SplashScreen';
import { generateMathId, generateAntennaId, createAntennaRows } from './utils/rods';
import { generatePivotId, generateBandId, generateManualPivotId, getRectPivots, getCirclePivots, BAND_COLORS } from './utils/geoplano';
import { exportToPdf } from './utils/exportPdf';

/**
 * App - Componente raíz de Kubika.
 * Gestiona la autenticación, el estado del workspace y el layout principal.
 */
export default function App() {
  const { user, loading: authLoading, error: authError, signIn, signOut, displayName, isConfigured } = useAuth();
  const { workspaces, loading: wsLoading, saveWorkspace, loadWorkspace, listWorkspaces, deleteWorkspace } = useWorkspace(user?.id);

  // Estado del lienzo
  const [rods, setRods] = useState([]);
  const [mathTexts, setMathTexts] = useState([]);
  const [freeTexts, setFreeTexts] = useState([]);
  const [antennas, setAntennas] = useState([]);
  const canvasRef = useRef(null);
  const [splashDone, setSplashDone] = useState(false);
  const [showLoginSplash, setShowLoginSplash] = useState(false);

  // Modo de herramienta: 'regletas' | 'geoplano'
  const [toolMode, setToolMode] = useState('regletas');

  // Estado del Geoplano
  const [geoMode, setGeoMode] = useState('rect');
  const [geoPivots, setGeoPivots] = useState(getRectPivots());
  const [geoBands, setGeoBands] = useState([]);
  const [selectedPivotId, setSelectedPivotId] = useState(null);
  const [activeBandColor, setActiveBandColor] = useState(BAND_COLORS[0].value);

  // Pivotes manuales (insertados por el usuario)
  const [manualPivots, setManualPivots] = useState([]);
  const [isInsertingPivot, setIsInsertingPivot] = useState(false);

  // Mostrar splash durante login/logout
  useEffect(() => {
    if (authLoading && splashDone && !showLoginSplash) {
      setShowLoginSplash(true);
    }
  }, [authLoading, splashDone, showLoginSplash]);

  // Cambiar modo del geoplano (rectilinear / circular)
  const handleGeoModeChange = useCallback((mode) => {
    setGeoMode(mode);
    setGeoPivots(mode === 'rect' ? getRectPivots() : getCirclePivots());
    setManualPivots([]);
    setSelectedPivotId(null);
  }, []);

  // Clic en un pivote o en el fondo del canvas
  const handlePivotClick = useCallback((pivotId) => {
    // pivotId = null significa clic en fondo (deseleccionar)
    if (!pivotId) {
      setSelectedPivotId(null);
      return;
    }
    setSelectedPivotId((prev) => {
      if (prev === null) {
        return pivotId;
      }
      if (prev !== pivotId) {
        setGeoBands((bands) => [
          ...bands,
          {
            id: generateBandId(),
            pivotId1: prev,
            pivotId2: pivotId,
            color: activeBandColor,
          },
        ]);
      }
      return null;
    });
  }, [activeBandColor]);

  // Eliminar banda desde menú contextual
  const handleBandContext = useCallback((e, bandId) => {
    e.preventDefault();
    if (confirm('¿Eliminar esta banda?')) {
      setGeoBands((prev) => prev.filter((b) => b.id !== bandId));
    }
  }, []);

  // Insertar pivote manual en el canvas
  const handleInsertPivot = useCallback((x, y) => {
    setManualPivots((prev) => [
      ...prev,
      { id: generateManualPivotId(), x: Math.round(x), y: Math.round(y) },
    ]);
  }, []);

  // Eliminar pivote manual (y sus bandas asociadas)
  const handleDeleteManualPivot = useCallback((pivotId) => {
    setManualPivots((prev) => prev.filter((p) => p.id !== pivotId));
    setGeoBands((prev) => prev.filter(
      (b) => b.pivotId1 !== pivotId && b.pivotId2 !== pivotId
    ));
    setSelectedPivotId((prev) => prev === pivotId ? null : prev);
  }, []);

  // Limpiar bandas
  const clearBands = useCallback(() => {
    if (geoBands.length === 0) return;
    if (confirm('¿Limpiar todas las bandas del geoplano?')) {
      setGeoBands([]);
      setSelectedPivotId(null);
    }
  }, [geoBands]);

  // Título tipo Canva
  const [workspaceName, setWorkspaceName] = useState('Diseño sin título');
  const [isEditingName, setIsEditingName] = useState(false);

  // Estado de los modales
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('save');
  const [notification, setNotification] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Mostrar notificación temporal
  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // ========== GUARDAR WORKSPACE ==========
  const handleSave = async (nameToSave = workspaceName) => {
    const finalName = nameToSave.trim() || 'Diseño sin título';
    if (nameToSave !== workspaceName) setWorkspaceName(finalName);

    const canvasState = {
      rods: rods.map(r => ({
        value: r.value,
        name: r.name,
        color: r.color,
        textColor: r.textColor,
        cssClass: r.cssClass,
        x: r.x,
        y: r.y,
        rotation: r.rotation,
        showValue: r.showValue,
        id: r.id,
      })),
      mathTexts: mathTexts.map(m => ({
        id: m.id,
        x: m.x,
        y: m.y,
        latex: m.latex,
      })),
      freeTexts: freeTexts.map(t => ({
        id: t.id,
        x: t.x,
        y: t.y,
        text: t.text,
      })),
      antennas: antennas.map(a => ({
        id: a.id,
        x: a.x,
        y: a.y,
        operation: a.operation,
        rows: a.rows.map(r => ({ left: r.left, right: r.right })),
      })),
      geoMode: geoMode,
      manualPivots: manualPivots.map(p => ({ id: p.id, x: p.x, y: p.y })),
      geoBands: geoBands.map(b => ({
        id: b.id,
        pivotId1: b.pivotId1,
        pivotId2: b.pivotId2,
        color: b.color,
      })),
    };

    const { error } = await saveWorkspace(finalName, canvasState);
    if (error) {
      showNotification('Error al guardar: ' + error, 'error');
    } else {
      showNotification('Trabajo guardado correctamente');
    }
  };

  // ========== CARGAR WORKSPACE ==========
  const handleLoad = async (workspaceId) => {
    // Al cargar, buscamos el nombre del workspace para actualizar el título
    const ws = workspaces.find(w => w.id === workspaceId);
    if (ws) setWorkspaceName(ws.name);

    const state = await loadWorkspace(workspaceId);
    if (state) {
      setRods(state.rods || []);
      setMathTexts(state.mathTexts || []);
      setFreeTexts(state.freeTexts || []);
      setAntennas(state.antennas || []);
      if (state.geoMode) {
        setGeoMode(state.geoMode);
        setGeoPivots(state.geoMode === 'rect' ? getRectPivots() : getCirclePivots());
        setGeoBands(state.geoBands || []);
        setManualPivots(state.manualPivots || []);
      } else {
        setGeoBands([]);
        setManualPivots([]);
        setSelectedPivotId(null);
      }
      showNotification('Trabajo cargado');
    } else {
      showNotification('Error al cargar el trabajo', 'error');
    }
  };

  // ========== ABRIR MODAL DE CARGAR ==========
  const openLoadModal = async () => {
    await listWorkspaces();
    setModalMode('load');
    setModalOpen(true);
  };

  // ========== AGREGAR TEXTO MATEMÁTICO ==========
  const addMathText = () => {
    const newMath = {
      id: generateMathId(),
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      latex: '',
    };
    setMathTexts(prev => [...prev, newMath]);
  };

  // ========== AGREGAR TEXTO LIBRE ==========
  const addFreeText = () => {
    const newText = {
      id: generateMathId(),
      x: 100 + Math.random() * 200,
      y: 200 + Math.random() * 200,
      text: '',
    };
    setFreeTexts(prev => [...prev, newText]);
  };

  // ========== AGREGAR ANTENA ==========
  const addAntenna = () => {
    const newAntenna = {
      id: generateAntennaId(),
      x: 150 + Math.random() * 300,
      y: 150 + Math.random() * 300,
      operation: '',
      rows: createAntennaRows(10),
    };
    setAntennas(prev => [...prev, newAntenna]);
  };

  // ========== ACTUALIZAR ANTENA ==========
  const handleAntennaUpdate = useCallback((id, changes) => {
    setAntennas(prev => prev.map(a =>
      a.id === id ? { ...a, ...changes } : a
    ));
  }, []);

  // ========== ELIMINAR ANTENA ==========
  const handleAntennaDelete = useCallback((id) => {
    setAntennas(prev => prev.filter(a => a.id !== id));
  }, []);

  // ========== EXPORTAR PDF ==========
  const handleExportPdf = async () => {
    if (!canvasRef.current) return;
    setPdfLoading(true);
    try {
      await exportToPdf(canvasRef.current, displayName, workspaceName);
      showNotification('PDF descargado');
    } catch {
      showNotification('Error al crear el PDF', 'error');
    }
    setPdfLoading(false);
  };

  // ========== LIMPIAR LIENZO ==========
  const handleClear = () => {
    if (rods.length === 0 && mathTexts.length === 0 && freeTexts.length === 0 && antennas.length === 0 && geoBands.length === 0 && manualPivots.length === 0) return;
    if (confirm('¿Limpiar todo el lienzo? Se perderán los cambios no guardados.')) {
      setRods([]);
      setMathTexts([]);
      setFreeTexts([]);
      setAntennas([]);
      setGeoBands([]);
      setManualPivots([]);
      setSelectedPivotId(null);
      setIsInsertingPivot(false);
      showNotification('Lienzo limpiado');
    }
  };

  // ========== SPLASH INICIAL ==========
  if (!splashDone) {
    return (
      <SplashScreen
        isLoading={authLoading}
        onFinish={() => setSplashDone(true)}
      />
    );
  }

  // ========== SPLASH DE LOGIN ==========
  if (showLoginSplash) {
    return (
      <SplashScreen
        isLoading={authLoading && !user}
        onFinish={() => setShowLoginSplash(false)}
      />
    );
  }

  // ========== PANTALLA DE LOGIN ==========
  if (!user) {
    return (
      <AuthForm
        onLogin={signIn}
        onLoginStart={() => setShowLoginSplash(true)}
        error={authError}
        isConfigured={isConfigured}
      />
    );
  }

  // ========== APLICACIÓN PRINCIPAL ==========
  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* ===== BARRA SUPERIOR ===== */}
      <header className="no-print animate-header-slide flex items-center justify-between px-2 py-1.5 bg-white/70 backdrop-blur-xl border-b border-slate-200/50 shadow-sm z-50">
        {/* Logo (izquierda) */}
        <div className="flex items-center flex-shrink-0 w-[160px]">
          <img 
            src="logo.png" 
            alt="Logo" 
            style={{ height: '95px', width: 'auto', maxWidth: '220px' }}
            className="object-contain"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <div className="hidden w-8 h-8 rounded-xl bg-gradient-to-br from-kubika-500 to-purple-600 items-center justify-center shadow-lg">
            <span className="text-base font-display font-extrabold text-white">K</span>
          </div>
        </div>

        {/* Herramientas (centro) */}
        <div className="flex items-center justify-center gap-0.5 flex-1 min-w-0">
          {/* Título tipo Canva */}
          <div className="mr-1 flex items-center shrink min-w-0 max-w-[120px]">
            {isEditingName ? (
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                onBlur={() => { setIsEditingName(false); handleSave(); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setIsEditingName(false);
                    handleSave();
                  }
                }}
                className="px-2 py-1 text-xs font-bold text-slate-800 bg-white border-2 border-kubika-400 rounded-lg outline-none w-24 shadow-sm"
                autoFocus
                placeholder="Nombre del diseño"
              />
            ) : (
              <div 
                onClick={() => setIsEditingName(true)}
                className="px-1.5 py-1 text-xs font-bold text-slate-800 hover:bg-slate-100 rounded-lg cursor-text transition-colors border border-transparent hover:border-slate-300 flex items-center gap-1 group truncate max-w-[110px]"
                title="Clic para renombrar"
              >
                <span className="truncate">{workspaceName || 'Diseño sin título'}</span>
                <svg className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
            )}
          </div>

          {/* Agregar texto libre */}
          <button
            onClick={addFreeText}
            className="btn-icon btn-ripple flex items-center justify-center w-9 h-9 rounded-xl hover:bg-kubika-50 transition-all duration-200 group"
            title="Agregar texto con estilo manuscrito"
          >
            <svg className="w-6 h-6 text-kubika-500 group-hover:scale-125 group-hover:text-kubika-700 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>

          {/* Agregar texto matemático */}
          <button
            onClick={addMathText}
            className="btn-icon btn-ripple flex items-center justify-center w-9 h-9 rounded-xl hover:bg-purple-50 transition-all duration-200 group"
            title="Agregar texto matemático"
          >
            <svg className="w-6 h-6 text-purple-500 group-hover:scale-125 group-hover:text-purple-700 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </button>

          {/* Antena */}
          <button
            onClick={addAntenna}
            className="btn-icon btn-ripple flex items-center justify-center w-9 h-9 rounded-xl hover:bg-orange-50 transition-all duration-200 group"
            title="Agregar antena para cálculo mental"
          >
            <svg className="w-6 h-6 text-orange-500 group-hover:scale-125 group-hover:text-orange-700 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4h18M3 12h18M3 20h12M3 12l4-4m-4 4l4 4" />
            </svg>
          </button>

          {/* Guardar */}
          <button
            onClick={() => handleSave()}
            className="btn-icon btn-ripple flex items-center justify-center w-9 h-9 rounded-xl hover:bg-emerald-50 transition-all duration-200 group"
            title="Guardar trabajo"
          >
            <svg className="w-6 h-6 text-emerald-500 group-hover:scale-125 group-hover:text-emerald-700 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
          </button>

          {/* Cargar */}
          <button
            onClick={openLoadModal}
            className="btn-icon btn-ripple flex items-center justify-center w-9 h-9 rounded-xl hover:bg-amber-50 transition-all duration-200 group"
            title="Cargar trabajo guardado"
          >
            <svg className="w-6 h-6 text-amber-500 group-hover:scale-125 group-hover:text-amber-700 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </button>

          {/* Exportar PDF */}
          <button
            onClick={handleExportPdf}
            disabled={pdfLoading}
            className="btn-icon btn-ripple flex items-center justify-center w-9 h-9 rounded-xl hover:bg-rose-50 transition-all duration-200 group disabled:opacity-50"
            title="Descargar como PDF"
          >
            {pdfLoading ? (
              <svg className="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-rose-500 group-hover:scale-125 group-hover:text-rose-700 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            )}
          </button>

          {/* Toggle: Regletas / Geoplano */}
          <button
            onClick={() => setToolMode(m => m === 'regletas' ? 'geoplano' : 'regletas')}
            className="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 active:scale-90 hover:bg-slate-100"
            style={{
              background: toolMode === 'geoplano'
                ? 'linear-gradient(135deg, #f59e0b, #ea580c)'
                : '#f1f5f9',
              color: toolMode === 'geoplano' ? '#fff' : '#64748b',
              boxShadow: toolMode === 'geoplano'
                ? '0 4px 12px rgba(245, 158, 11, 0.3)'
                : 'none',
            }}
            title={toolMode === 'regletas' ? 'Cambiar a Geoplano' : 'Cambiar a Regletas'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {toolMode === 'geoplano' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              )}
            </svg>
          </button>

          {/* Limpiar */}
          <button
            onClick={handleClear}
            className="btn-icon btn-ripple flex items-center justify-center w-9 h-9 rounded-xl hover:bg-red-50 transition-all duration-200 group"
            title="Limpiar lienzo"
          >
            <svg className="w-6 h-6 text-red-400 group-hover:scale-125 group-hover:text-red-600 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {/* Usuario (derecha) */}
        <div className="flex items-center gap-1.5 flex-shrink-0 w-[160px] justify-end">
          <div className="text-right max-w-[120px] truncate">
            <p className="text-xs font-semibold text-slate-700 truncate" title={displayName}>{displayName}</p>
            <p className="text-[10px] text-slate-400">Alumno</p>
          </div>
          <button
            onClick={signOut}
            className="btn-ripple flex items-center justify-center w-8 h-8 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all active:scale-90"
            title="Cerrar sesión"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* ===== CONTENIDO PRINCIPAL ===== */}
      <div className="flex-1 flex overflow-hidden">
        {/* Panel lateral condicional */}
        <aside className="no-print">
          {toolMode === 'regletas' ? (
            <RodPanel />
          ) : (
            <GeoplanoPanel
              geoMode={geoMode}
              onModeChange={handleGeoModeChange}
              activeColor={activeBandColor}
              onColorChange={setActiveBandColor}
              bands={geoBands}
              onClearBands={clearBands}
              isInsertingPivot={isInsertingPivot}
              onInsertingPivotChange={setIsInsertingPivot}
            />
          )}
        </aside>

        {/* Lienzo */}
        <Canvas
          canvasRef={canvasRef}
          rods={rods}
          setRods={setRods}
          mathTexts={mathTexts}
          setMathTexts={setMathTexts}
          freeTexts={freeTexts}
          setFreeTexts={setFreeTexts}
          toolMode={toolMode}
          geoPivots={geoPivots}
          geoBands={geoBands}
          selectedPivotId={selectedPivotId}
          onGeoPivotClick={handlePivotClick}
          onGeoBandContext={handleBandContext}
          onGeoCanvasClick={() => setSelectedPivotId(null)}
          manualPivots={manualPivots}
          antennas={antennas}
          onAntennaUpdate={handleAntennaUpdate}
          onAntennaDelete={handleAntennaDelete}
          isInsertingPivot={isInsertingPivot}
          onInsertPivot={handleInsertPivot}
          onDeleteManualPivot={handleDeleteManualPivot}
        />
      </div>

      {/* ===== MODAL CARGAR (Solo para cargar ahora) ===== */}
      <SaveLoadModal
        isOpen={modalOpen}
        mode="load"
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onLoad={handleLoad}
        onDelete={deleteWorkspace}
        workspaces={workspaces}
        loading={wsLoading}
      />

      {/* ===== NOTIFICACIONES ===== */}
      {notification && (
        <div className={`notification-toast fixed bottom-6 right-6 z-[10000] px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold
          flex items-center gap-2.5
          ${notification.type === 'error'
            ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-500/20'
            : 'bg-white text-slate-800 border border-slate-200/80 shadow-slate-200/50'
          }`}
        >
          {notification.type !== 'error' && (
            <span className="w-5 h-5 rounded-full bg-kubika-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-kubika-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </span>
          )}
          {notification.message}
        </div>
      )}
    </div>
  );
}
