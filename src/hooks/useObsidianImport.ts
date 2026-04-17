import { useState, useCallback } from 'react';
import { importObsidianVault, type ImportProgress, type ImportResult } from '@/lib/obsidian-importer';
import { supabase } from '@/integrations/supabase/client';

export function useObsidianImport(userId: string | undefined) {
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [syncMode, setSyncMode] = useState(false);
  const [existingCount, setExistingCount] = useState(0);

  /** Check if user already has obsidian notes (call before starting) */
  const detectSyncMode = useCallback(async () => {
    if (!userId) return false;
    const { count } = await supabase
      .from('notes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('node_type', 'obsidian');
    const n = count ?? 0;
    const isSync = n > 0;
    setSyncMode(isSync);
    setExistingCount(n);
    return isSync;
  }, [userId]);

  const run = useCallback(async (zipFile: File) => {
    if (!userId) return null;
    setRunning(true);
    setError(null);
    setResult(null);
    setProgress({ phase: 'unzip', current: 0, total: 1 });

    try {
      const res = await importObsidianVault(zipFile, userId, setProgress);
      setResult(res);
      setSyncMode(res.isSyncMode);
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Import failed';
      setError(msg);
      setProgress(prev => prev ? { ...prev, phase: 'error' } : null);
      return null;
    } finally {
      setRunning(false);
    }
  }, [userId]);

  const reset = useCallback(() => {
    setProgress(null);
    setResult(null);
    setError(null);
    setRunning(false);
  }, []);

  return { progress, result, error, running, run, reset, syncMode, existingCount, detectSyncMode };
}
