/**
 * UniverseContext — global state for the active knowledge universe.
 * Handles initialization: ensures at least one default universe exists,
 * restores last-used universe from localStorage, validates it still exists.
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'cosmos_active_universe';

export interface Universe {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color_seed: string;
  icon: string;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface UniverseCtx {
  activeUniverseId: string | null;
  activeUniverse: Universe | null;
  universes: Universe[];
  loading: boolean;
  setActiveUniverseId: (id: string) => void;
  refetch: () => Promise<void>;
}

const Ctx = createContext<UniverseCtx>({
  activeUniverseId: null,
  activeUniverse: null,
  universes: [],
  loading: true,
  setActiveUniverseId: () => {},
  refetch: async () => {},
});

export function useActiveUniverse() {
  return useContext(Ctx);
}

interface ProviderProps {
  userId: string | undefined;
  children: ReactNode;
}

export function UniverseProvider({ userId, children }: ProviderProps) {
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUniverses = useCallback(async () => {
    if (!userId) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('universes')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true });

    let list = (data ?? []) as Universe[];

    // If no universes exist, create a default one
    if (list.length === 0 && !error) {
      const { data: created } = await supabase
        .from('universes')
        .insert({ user_id: userId, name: '默认宇宙', is_default: true })
        .select('*')
        .maybeSingle();
      if (created) list = [created as Universe];
    }

    setUniverses(list);

    // Restore last active from localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    const valid = list.find(u => u.id === stored);
    const fallback = list.find(u => u.is_default) ?? list[0];
    const chosen = valid ?? fallback;

    if (chosen) {
      setActiveId(chosen.id);
      localStorage.setItem(STORAGE_KEY, chosen.id);
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    fetchUniverses();
  }, [fetchUniverses]);

  // Realtime: listen for universe changes
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`universes:user:${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'universes',
        filter: `user_id=eq.${userId}`,
      }, () => { fetchUniverses(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchUniverses]);

  const setActiveUniverseId = useCallback((id: string) => {
    setActiveId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const activeUniverse = universes.find(u => u.id === activeId) ?? null;

  return (
    <Ctx.Provider value={{
      activeUniverseId: activeId,
      activeUniverse,
      universes,
      loading,
      setActiveUniverseId,
      refetch: fetchUniverses,
    }}>
      {children}
    </Ctx.Provider>
  );
}
