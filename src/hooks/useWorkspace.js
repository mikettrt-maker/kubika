import { useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../config/supabase';

function extractEmail(userId) {
  if (!userId) return null;
  if (userId.startsWith('local-')) {
    return userId.replace('local-', '');
  }
  return userId;
}

const MAX_WORKSPACES = 50;

function localKey(email) {
  return 'kubika_workspaces_' + email;
}

function readLocal(email) {
  try {
    const list = JSON.parse(localStorage.getItem(localKey(email)) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeLocal(email, list) {
  try {
    localStorage.setItem(localKey(email), JSON.stringify(list));
  } catch (_) {}
}

export function useWorkspace(userId) {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const saveWorkspace = useCallback(async (name, canvasState) => {
    setError(null);
    setLoading(true);

    const email = extractEmail(userId);

    if (isSupabaseConfigured && email) {
      try {
        const { count, error: countError } = await supabase
          .from('workspaces')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', email);

        if (!countError && count >= MAX_WORKSPACES) {
          setLoading(false);
          setError(`Límite de ${MAX_WORKSPACES} trabajos alcanzado. Eliminá uno antes de guardar.`);
          return { data: null, error: 'Límite alcanzado' };
        }

        const { data, error: dbError } = await supabase
          .from('workspaces')
          .insert({
            user_id: email,
            name,
            canvas_state: canvasState,
          })
          .select()
          .single();

        if (!dbError) {
          setLoading(false);
          return { data, error: null };
        }
        console.error('Supabase insert falló, guardando local:', dbError);
      } catch (err) {
        console.error('Supabase error, guardando local:', err);
      }
    }

    // Respaldo local (localStorage) cuando Supabase no está configurado o falla
    if (email) {
      try {
        const list = readLocal(email);
        if (list.length >= MAX_WORKSPACES) {
          setLoading(false);
          setError(`Límite de ${MAX_WORKSPACES} trabajos alcanzado. Eliminá uno antes de guardar.`);
          return { data: null, error: 'Límite alcanzado' };
        }
        const now = new Date().toISOString();
        const item = {
          id: 'loc-' + Date.now(),
          name,
          canvas_state: canvasState,
          created_at: now,
          updated_at: now,
        };
        writeLocal(email, [item, ...list]);
        setLoading(false);
        return { data: item, error: null };
      } catch (err) {
        console.error('Guardado local falló:', err);
      }
    }

    setLoading(false);
    setError('Error al guardar');
    return { data: null, error: 'No se pudo guardar en el servidor' };
  }, [userId]);

  const listWorkspaces = useCallback(async () => {
    setError(null);
    setLoading(true);

    setWorkspaces([]);

    const email = extractEmail(userId);

    if (isSupabaseConfigured && email) {
      try {
        const { data, error: dbError } = await supabase
          .from('workspaces')
          .select('id, name, created_at, updated_at')
          .eq('user_id', email)
          .order('updated_at', { ascending: false });

        if (!dbError && data) {
          setWorkspaces(data);
          setLoading(false);
          return data;
        }
        console.error('Supabase list falló, listando local:', dbError);
      } catch (err) {
        console.error('Supabase error, listando local:', err);
      }
    }

    if (email) {
      const local = readLocal(email)
        .map(({ id, name, created_at, updated_at }) => ({ id, name, created_at, updated_at }))
        .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
      setWorkspaces(local);
      setLoading(false);
      return local;
    }

    setLoading(false);
    return [];
  }, [userId]);

  const loadWorkspace = useCallback(async (workspaceId) => {
    setError(null);
    setLoading(true);

    const email = extractEmail(userId);

    if (workspaceId && String(workspaceId).startsWith('loc-')) {
      const item = readLocal(email || '').find(w => w.id === workspaceId);
      setLoading(false);
      if (item) return item.canvas_state;
      setError('No se pudo cargar');
      return null;
    }

    if (isSupabaseConfigured && email) {
      try {
        const { data, error: dbError } = await supabase
          .from('workspaces')
          .select('canvas_state')
          .eq('id', workspaceId)
          .eq('user_id', email)
          .single();

        if (!dbError && data) {
          setLoading(false);
          return data.canvas_state;
        }
        console.error('Supabase load falló:', dbError);
      } catch (err) {
        console.error('Supabase error:', err);
      }
    }

    setLoading(false);
    setError('No se pudo cargar');
    return null;
  }, [userId]);

  const deleteWorkspace = useCallback(async (workspaceId) => {
    setError(null);

    const email = extractEmail(userId);

    if (workspaceId && String(workspaceId).startsWith('loc-')) {
      const list = readLocal(email || '').filter(w => w.id !== workspaceId);
      writeLocal(email || '', list);
      setWorkspaces(list.map(({ id, name, created_at, updated_at }) => ({ id, name, created_at, updated_at })));
      return true;
    }

    if (isSupabaseConfigured && email) {
      try {
        const { error: dbError } = await supabase
          .from('workspaces')
          .delete()
          .eq('id', workspaceId)
          .eq('user_id', email);

        if (!dbError) {
          setWorkspaces(prev => prev.filter(w => w.id !== workspaceId));
          return true;
        }
        console.error('Supabase delete falló:', dbError);
      } catch (err) {
        console.error('Supabase error:', err);
      }
    }

    setError('No se pudo eliminar');
    return false;
  }, [userId]);

  return {
    workspaces,
    loading,
    error,
    saveWorkspace,
    loadWorkspace,
    listWorkspaces,
    deleteWorkspace,
  };
}
