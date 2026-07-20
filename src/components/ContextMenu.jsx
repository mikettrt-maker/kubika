/**
 * Menú contextual que aparece al hacer doble clic o clic derecho sobre un elemento.
 * Opciones: Girar 90°, Eliminar, Mostrar/Ocultar valor
 */
export default function ContextMenu({ x, y, onClose, options }) {
  return (
    <>
      {/* Overlay transparente para cerrar al hacer clic fuera */}
      <div
        className="fixed inset-0 z-[9998]"
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />

      {/* Menú flotante */}
      <div
        className="fixed z-[9999] min-w-[200px] py-1.5 bg-white rounded-xl shadow-2xl border border-slate-200/60 overflow-hidden animate-scale-in"
        style={{
          left: `${Math.min(x, window.innerWidth - 220)}px`,
          top: `${Math.min(y, window.innerHeight - 220)}px`,
          transformOrigin: 'top left',
        }}
      >
        {options.map((option, index) => (
          option.separator ? (
            <div key={index} className="my-1 border-t border-slate-100" />
          ) : (
            <button
              key={index}
              onClick={() => {
                option.action();
                onClose();
              }}
              className={`w-full px-4 py-2.5 text-left text-sm font-medium flex items-center gap-3
                         transition-all duration-150 active:scale-[0.98]
                         ${option.danger
                           ? 'text-red-600 hover:bg-red-50 hover:text-red-700'
                           : 'text-slate-700 hover:bg-kubika-50 hover:text-kubika-700'
                         }`}
            >
              {typeof option.icon === 'string' ? (
                <span className="text-base w-5 text-center">{option.icon}</span>
              ) : (
                <span className="w-5 h-5 flex items-center justify-center text-kubika-500">{option.icon}</span>
              )}
              <span>{option.label}</span>
              {option.shortcut && (
                <span className="ml-auto text-[10px] text-slate-400 font-mono">
                  {option.shortcut}
                </span>
              )}
            </button>
          )
        ))}
      </div>
    </>
  );
}
