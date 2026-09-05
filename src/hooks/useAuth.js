import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../config/supabase';

let cachedUsers = null;

function getGradeFromUsername(username) {
  if (!username) return null;
  const match = username.match(/alumno(\d+)/);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  if (num >= 1 && num <= 30) return 4;
  if (num >= 31 && num <= 60) return 5;
  if (num >= 61 && num <= 100) return 6;
  return null;
}

async function loadUsers() {
  if (cachedUsers) return cachedUsers;
  try {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const res = await fetch(base + '/kubika-usuarios.csv');
    const text = await res.text();
    const lines = text.split('\n').slice(1);
    cachedUsers = lines.map(line => {
      const [, username, email, password, rol, grado] = line.split(',');
      return { username, email, password, rol: rol?.trim() || 'alumno', grado: grado ? parseInt(grado.trim(), 10) : null };
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

    const users = await loadUsers();
    const matchedUser = users.find(u => u.email === email && u.password === password);
    if (!matchedUser) {
      setError('Usuario o contraseña incorrectos');
      setLoading(false);
      return { user: null, error: 'Usuario o contraseña incorrectos' };
    }

    const localUser = {
      id: 'local-' + email,
      email: email,
      user_metadata: { display_name: matchedUser.username },
      rol: matchedUser.rol,
      grado: matchedUser.grado || getGradeFromUsername(matchedUser.username),
    };
    localStorage.setItem('kubika_local_user', JSON.stringify(localUser));
    setUser(localUser);
    setLoading(false);
    return { user: localUser, error: null };
  }, []);

  /**
   * Cerrar sesión
   */
  const signOut = useCallback(async () => {
    setError(null);
    localStorage.removeItem('kubika_local_user');
    setUser(null);
  }, []);

  /**
   * Obtener nombre de display del usuario
   */
  const displayName = user
    ? (user.user_metadata?.display_name || user.email?.split('@')[0] || 'Alumno')
    : '';

  const userRole = user?.rol || 'alumno';
  const userGrado = user?.grado || getGradeFromUsername(displayName);

  return {
    user,
    loading,
    error,
    signIn,
    signOut,
    displayName,
    userRole,
    userGrado,
    isConfigured: isSupabaseConfigured,
  };
}
