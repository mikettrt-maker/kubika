import { useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../config/supabase';

function getLocalKey(userId) {
  return `kubika_workspaces_${userId || 'local'}`;
}

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

  const saveWorkspace = useCallback(async (name, canvasState) => {
    setError(null);
    setLoading(true);

    const email = extractEmail(userId);

    if (isSupabaseConfigured && email) {
      try {
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
      } catch (_) {
        // fallback a localStorage
      }
    }

    try {
      const key = getLocalKey(userId);
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const workspace = {
        id: `ws-${Date.now()}`,
        name,
        canvas_state: canvasState,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      existing.push(workspace);
      localStorage.setItem(key, JSON.stringify(existing));
      setLoading(false);
      return { data: workspace, error: null };
    } catch (err) {
      setLoading(false);
      setError('Error al guardar localmente');
      return { data: null, error: err.message };
    }
  }, [userId]);

  const listWorkspaces = useCallback(async () => {
    setError(null);
    setLoading(true);

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
      } catch (_) {
        // fallback a localStorage
      }
    }

    const key = getLocalKey(userId);
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    setWorkspaces(stored);
    setLoading(false);
    return stored;
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
      } catch (_) {
        // fallback a localStorage
      }
    }

    const key = getLocalKey(userId);
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    const ws = stored.find(w => w.id === workspaceId);
    setLoading(false);
    return ws?.canvas_state || null;
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
      } catch (_) {
        // fallback a localStorage
      }
    }

    const key = getLocalKey(userId);
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    const filtered = stored.filter(w => w.id !== workspaceId);
    localStorage.setItem(key, JSON.stringify(filtered));
    setWorkspaces(filtered);
    return true;
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
