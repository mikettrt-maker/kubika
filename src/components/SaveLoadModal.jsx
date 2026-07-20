import { useState, useEffect } from 'react';

/**
 * Modal para guardar y cargar workspaces.
 */
export default function SaveLoadModal({
  isOpen,
  mode, // 'save' | 'load'
  onClose,
  onSave,
  onLoad,
  onDelete,
  workspaces,
  loading,
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setName('');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave(name.trim());
    setSaving(false);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
        <div className="animate-scale-in w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-white/20">
          {/* Header */}
          <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-kubika-50/50 to-transparent flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              {mode === 'save' ? (
                <>
                  <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-kubika-500 to-purple-500 flex items-center justify-center shadow-md shadow-kubika-500/20">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                  </span>
                  Guardar trabajo
                </>
              ) : (
                <>
                  <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md shadow-purple-500/20">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </span>
                  Cargar trabajo
                </>
              )}
            </h3>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all active:scale-90"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Contenido */}
          <div className="p-5">
            {mode === 'save' ? (
              /* Formulario de guardado */
              <div className="space-y-4">
                <div>
                  <label htmlFor="workspace-name" className="block text-sm font-semibold text-slate-600 mb-1.5">
                    Nombre del trabajo
                  </label>
                  <input
                    id="workspace-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ej: Ejercicio fracciones"
                    className="input-field"
                    autoFocus
                    maxLength={50}
                  />
                </div>

                <button
                  onClick={handleSave}
                  disabled={!name.trim() || saving}
                  className="btn-primary btn-ripple w-full py-3 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Guardando...
                    </span>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                      Guardar
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* Lista de workspaces para cargar */
              <div className="space-y-2">
                {loading ? (
                  <div className="text-center py-8 text-slate-400">
                    <svg className="animate-spin w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Cargando...
                  </div>
                ) : workspaces.length === 0 ? (
                  <div className="text-center py-8">
                    <span className="text-4xl mb-3 block">📭</span>
                    <p className="text-slate-500 font-medium">No tienes trabajos guardados</p>
                    <p className="text-slate-400 text-sm mt-1">Guarda tu trabajo primero</p>
                  </div>
                ) : (
                  <div className="max-h-[300px] overflow-y-auto space-y-2">
                    {workspaces.map((ws) => (
                      <div
                        key={ws.id}
                        className="card-elevate flex items-center gap-3 p-3 rounded-xl border border-slate-100
                                 hover:bg-kubika-50 hover:border-kubika-200 bg-white group"
                      >
                        <div className="flex-1 cursor-pointer" onClick={() => { onLoad(ws.id); onClose(); }}>
                          <p className="text-sm font-semibold text-slate-700 group-hover:text-kubika-700">
                            {ws.name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {new Date(ws.created_at).toLocaleDateString('es-MX', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('¿Eliminar este trabajo?')) onDelete(ws.id);
                          }}
                          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100
                                   text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                          title="Eliminar"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
