import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../config/supabase';

let cachedUsers = null;

async function loadUsers() {
  if (cachedUsers) return cachedUsers;
  try {
    const res = await fetch('/kubika/kubika-usuarios.csv');
    const text = await res.text();
    const lines = text.split('\n').slice(1);
    cachedUsers = lines.map(line => {
      const [, username, email, password] = line.split(',');
      return { username, email, password };
    }).filter(u => u.email);
    return cachedUsers;
  } catch {
    return [];
  }
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      const localUser = localStorage.getItem('kubika_local_user');
      if (localUser) {
        setUser(JSON.parse(localUser));
      }
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email, password) => {
    setError(null);
    setLoading(true);

    if (!isSupabaseConfigured) {
      const users = await loadUsers();
      const user = users.find(u => u.email === email && u.password === password);
      if (!user) {
        setError('Usuario o contraseña incorrectos');
        setLoading(false);
        return { user: null, error: 'Usuario o contraseña incorrectos' };
      }
      const localUser = {
        id: 'local-' + email,
        email: email,
        user_metadata: { display_name: user.username },
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
