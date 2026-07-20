import { useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../config/supabase';

function extractEmail(userId) {
  if (!userId) return null;
  if (userId.startsWith('local-')) {
    return userId.replace('local-', '');
  }
  return userId;
}

export function useWorkspace(userId) {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const MAX_WORKSPACES = 50;

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
      } catch (_) {}
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
        setError(dbError?.message || 'Error al listar');
      } catch (err) {
        setError(err.message);
      }
    }

    setLoading(false);
    return [];
  }, [userId]);

  const loadWorkspace = useCallback(async (workspaceId) => {
    setError(null);
    setLoading(true);

    const email = extractEmail(userId);

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
      } catch (_) {}
    }

    setLoading(false);
    setError('No se pudo cargar');
    return null;
  }, [userId]);

  const deleteWorkspace = useCallback(async (workspaceId) => {
    setError(null);

    const email = extractEmail(userId);

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
      } catch (_) {}
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
