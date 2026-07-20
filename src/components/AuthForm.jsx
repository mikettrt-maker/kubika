import { useState } from 'react';

/**
 * Formulario de Login para alumnos.
 * Solo login (no registro) - las cuentas están pre-creadas.
 * Acepta usuario tipo "kubika.alumno01" y lo convierte a email.
 */
export default function AuthForm({ onLogin, onLoginStart, error: externalError, isConfigured }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!username.trim() || !password.trim()) {
      setError('Por favor ingresa tu usuario y contraseña');
      setLoading(false);
      return;
    }

    // Convertir username a email si no tiene @
    const email = username.includes('@')
      ? username.trim()
      : `${username.trim()}@kubika.app`;

    // Notificar a App para que muestre el splash de login
    if (onLoginStart) onLoginStart();

    const result = await onLogin(email, password);
    
    if (result?.error) {
      // Traducir mensajes de error comunes
      const errorMessages = {
        'Invalid login credentials': 'Usuario o contraseña incorrectos',
        'Email not confirmed': 'La cuenta no ha sido confirmada',
        'Too many requests': 'Demasiados intentos. Espera un momento.',
      };
      setError(errorMessages[result.error] || result.error);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-kubika-950 via-kubika-900 to-purple-900 p-4">
      {/* Fondo decorativo con regletas flotantes animadas */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="floating-rod top-[10%] left-[5%] w-32 h-8 bg-rod-red/20" style={{ animationDelay: '0s', animationDuration: '7s' }} />
        <div className="floating-rod top-[25%] right-[10%] w-48 h-8 bg-rod-yellow/20" style={{ animationDelay: '0.8s', animationDuration: '8s' }} />
        <div className="floating-rod bottom-[30%] left-[15%] w-24 h-8 bg-rod-blue/20" style={{ animationDelay: '1.6s', animationDuration: '6s' }} />
        <div className="floating-rod bottom-[15%] right-[20%] w-40 h-8 bg-rod-orange/20" style={{ animationDelay: '2.4s', animationDuration: '9s' }} />
        <div className="floating-rod top-[50%] left-[40%] w-20 h-8 bg-rod-light-green/20" style={{ animationDelay: '3.2s', animationDuration: '7.5s' }} />
        <div className="floating-rod top-[70%] left-[60%] w-36 h-8 bg-rod-pink/20" style={{ animationDelay: '1.2s', animationDuration: '8.5s' }} />
        <div className="floating-rod top-[15%] left-[50%] w-16 h-8 bg-rod-brown/20" style={{ animationDelay: '4s', animationDuration: '6.5s' }} />
        <div className="floating-rod top-[80%] left-[8%] w-28 h-8 bg-rod-dark-green/20" style={{ animationDelay: '2s', animationDuration: '7s' }} />
      </div>

      <div className="login-card relative z-10 w-full max-w-md">
        {/* Logo y título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-kubika-400 to-purple-500 shadow-2xl shadow-kubika-500/20 mb-4 overflow-hidden relative">
            <img
              src="logo.png"
              alt="Kubika"
              className="w-full h-full object-contain p-1.5"
              onError={(e) => {
                e.target.style.display = 'none';
                const fb = e.target.parentElement.querySelector('.auth-logo-fallback');
                if (fb) fb.style.display = 'flex';
              }}
            />
            <span className="auth-logo-fallback absolute inset-0 hidden items-center justify-center text-4xl font-display font-extrabold text-white">
              K
            </span>
          </div>
          <h1 className="text-4xl font-display font-extrabold text-white tracking-tight">
            Kubika
          </h1>
          <p className="mt-2 text-kubika-200 text-sm font-medium">
            Regletas de Cuisenaire Interactivas
          </p>
        </div>

        {/* Card del formulario */}
        <div className="glass rounded-3xl p-8 shadow-glass-lg">
          <h2 className="text-xl font-bold text-slate-700 mb-1">
            Bienvenido
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Ingresa con el usuario y contraseña que te dieron
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo de usuario */}
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-slate-600 mb-1.5">
                Usuario
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="kubika.alumno01"
                  className="input-field pl-10"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            {/* Campo de contraseña */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-600 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="input-field pl-10"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Mensajes de error */}
            {(error || externalError) && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium animate-slide-up">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error || externalError}
              </div>
            )}

            {/* Botón de login */}
            <button
              type="submit"
              disabled={loading}
              className="btn-ripple w-full py-3.5 bg-gradient-to-r from-kubika-600 to-purple-600 text-white rounded-xl
                         font-bold text-base shadow-lg hover:shadow-xl shadow-purple-500/20
                         hover:from-kubika-500 hover:to-purple-500 hover:shadow-purple-500/30
                         active:scale-[0.98] transition-all duration-200
                         disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <span className="relative flex w-5 h-5">
                    <span className="animate-ping absolute inset-0 rounded-full bg-white/40" />
                    <span className="relative rounded-full w-5 h-5 bg-white/80 flex items-center justify-center">
                      <span className="text-[10px] font-black text-kubika-700">K</span>
                    </span>
                  </span>
                  <span>Entrando...</span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  Entrar a Kubika
                </span>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-kubika-300/60 text-xs mt-6">
          Kubika © {new Date().getFullYear()} · Herramienta educativa
        </p>
      </div>
    </div>
  );
}
