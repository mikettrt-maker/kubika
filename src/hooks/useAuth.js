import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../config/supabase';

/**
 * Hook de autenticación con Supabase.
 * Gestiona login/logout de los alumnos con cuentas pre-creadas.
 * En modo local (sin Supabase), permite simular un usuario.
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Escuchar cambios de sesión al montar
  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Modo local: revisar si hay un usuario simulado en localStorage
      const localUser = localStorage.getItem('kubika_local_user');
      if (localUser) {
        setUser(JSON.parse(localUser));
      }
      setLoading(false);
      return;
    }

    // Obtener sesión actual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listener de cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Iniciar sesión con email y contraseña
   * Los alumnos usarán cuentas pre-creadas tipo kubika.alumno01@kubika.app
   */
  const signIn = useCallback(async (email, password) => {
    setError(null);
    setLoading(true);

    if (!isSupabaseConfigured) {
      // Modo local: simular login
      const localUser = {
        id: 'local-' + email,
        email: email,
        user_metadata: { display_name: email.split('@')[0] },
      };
      localStorage.setItem('kubika_local_user', JSON.stringify(localUser));
      setUser(localUser);
      setLoading(false);
      return { user: localUser, error: null };
    }

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return { user: null, error: authError.message };
      }

      setUser(data.user);
      setLoading(false);
      return { user: data.user, error: null };
    } catch (err) {
      const msg = err.message || 'Error al iniciar sesión';
      setError(msg);
      setLoading(false);
      return { user: null, error: msg };
    }
  }, []);

  /**
   * Cerrar sesión
   */
  const signOut = useCallback(async () => {
    setError(null);

    if (!isSupabaseConfigured) {
      localStorage.removeItem('kubika_local_user');
      setUser(null);
      return;
    }

    await supabase.auth.signOut();
    setUser(null);
  }, []);

  /**
   * Obtener nombre de display del usuario
   */
  const displayName = user
    ? (user.user_metadata?.display_name || user.email?.split('@')[0] || 'Alumno')
    : '';

  return {
    user,
    loading,
    error,
    signIn,
    signOut,
    displayName,
    isConfigured: isSupabaseConfigured,
  };
}
