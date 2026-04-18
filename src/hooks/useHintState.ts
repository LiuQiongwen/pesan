/**
 * useHintState — unified one-time hint state backed by localStorage.
 * Each hint has a unique key; once dismissed it never shows again
 * (unless user resets via Guide Center).
 */
import { useState, useCallback, useEffect } from 'react';

const LS_KEY = 'pesta_hints';

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(set: Set<string>) {
  localStorage.setItem(LS_KEY, JSON.stringify([...set]));
}

export function useHintState() {
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed);

  // Sync across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY) setDismissed(loadDismissed());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const dismiss = useCallback((key: string) => {
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(key);
      saveDismissed(next);
      return next;
    });
  }, []);

  const shouldShow = useCallback((key: string) => {
    return !dismissed.has('all-disabled') && !dismissed.has(key);
  }, [dismissed]);

  const resetAll = useCallback(() => {
    localStorage.removeItem(LS_KEY);
    setDismissed(new Set());
  }, []);

  const disableAll = useCallback(() => {
    const next = new Set(dismissed);
    next.add('all-disabled');
    saveDismissed(next);
    setDismissed(next);
  }, [dismissed]);

  return { shouldShow, dismiss, resetAll, disableAll };
}
