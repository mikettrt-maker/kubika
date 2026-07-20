import { useState, useCallback } from 'react';

export function useWorkspace(userId) {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getKey = () => `kubika_workspaces_${userId || 'local'}`;

  const saveWorkspace = useCallback(async (name, canvasState) => {
    setError(null);
    setLoading(true);
    try {
      const key = getKey();
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
    const key = getKey();
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    setWorkspaces(stored);
    setLoading(false);
    return stored;
  }, [userId]);

  const loadWorkspace = useCallback(async (workspaceId) => {
    setError(null);
    setLoading(true);
    const key = getKey();
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    const ws = stored.find(w => w.id === workspaceId);
    setLoading(false);
    return ws?.canvas_state || null;
  }, [userId]);

  const deleteWorkspace = useCallback(async (workspaceId) => {
    setError(null);
    const key = getKey();
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
