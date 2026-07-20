import { useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../config/supabase';

/**
 * Hook para gestionar workspaces (guardar/cargar el estado del lienzo).
 * Soporta Supabase y modo local con localStorage.
 */
export function useWorkspace(userId) {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Guardar el estado actual del lienzo
   * @param {string} name - Nombre del workspace
   * @param {Object} canvasState - Estado del lienzo { rods: [...], mathTexts: [...] }
   */
  const saveWorkspace = useCallback(async (name, canvasState) => {
    setError(null);
    setLoading(true);

    if (!isSupabaseConfigured || !userId) {
      // Modo local con localStorage
      try {
        const key = `kubika_workspaces_${userId || 'local'}`;
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
    }

    try {
      const { data, error: dbError } = await supabase
        .from('workspaces')
        .insert({
          user_id: userId,
          name,
          canvas_state: canvasState,
        })
        .select()
        .single();

      if (dbError) {
        setError(dbError.message);
        setLoading(false);
        return { data: null, error: dbError.message };
      }

      setLoading(false);
      return { data, error: null };
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return { data: null, error: err.message };
    }
  }, [userId]);

  /**
   * Listar todos los workspaces del usuario
   */
  const listWorkspaces = useCallback(async () => {
    setError(null);
    setLoading(true);

    if (!isSupabaseConfigured || !userId) {
      const key = `kubika_workspaces_${userId || 'local'}`;
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      setWorkspaces(stored);
      setLoading(false);
      return stored;
    }

    try {
      const { data, error: dbError } = await supabase
        .from('workspaces')
        .select('id, name, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (dbError) {
        setError(dbError.message);
        setLoading(false);
        return [];
      }

      setWorkspaces(data || []);
      setLoading(false);
      return data || [];
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return [];
    }
  }, [userId]);

  /**
   * Cargar un workspace específico
   */
  const loadWorkspace = useCallback(async (workspaceId) => {
    setError(null);
    setLoading(true);

    if (!isSupabaseConfigured || !userId) {
      const key = `kubika_workspaces_${userId || 'local'}`;
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      const ws = stored.find(w => w.id === workspaceId);
      setLoading(false);
      return ws?.canvas_state || null;
    }

    try {
      const { data, error: dbError } = await supabase
        .from('workspaces')
        .select('canvas_state')
        .eq('id', workspaceId)
        .eq('user_id', userId)
        .single();

      if (dbError) {
        setError(dbError.message);
        setLoading(false);
        return null;
      }

      setLoading(false);
      return data?.canvas_state || null;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return null;
    }
  }, [userId]);

  /**
   * Eliminar un workspace
   */
  const deleteWorkspace = useCallback(async (workspaceId) => {
    setError(null);

    if (!isSupabaseConfigured || !userId) {
      const key = `kubika_workspaces_${userId || 'local'}`;
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      const filtered = stored.filter(w => w.id !== workspaceId);
      localStorage.setItem(key, JSON.stringify(filtered));
      setWorkspaces(filtered);
      return true;
    }

    try {
      const { error: dbError } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', workspaceId)
        .eq('user_id', userId);

      if (dbError) {
        setError(dbError.message);
        return false;
      }

      setWorkspaces(prev => prev.filter(w => w.id !== workspaceId));
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
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
