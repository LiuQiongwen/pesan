/**
 * useUniverses — CRUD operations for knowledge universes.
 * Used by CreateUniversePanel and UniverseSwitcher.
 */
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveUniverse, type Universe } from '@/contexts/UniverseContext';

interface CreateParams {
  name: string;
  description?: string;
  color_seed?: string;
  icon?: string;
}

export function useUniverses() {
  const { universes, loading, refetch, setActiveUniverseId, activeUniverseId } = useActiveUniverse();

  const createUniverse = useCallback(async (
    userId: string,
    params: CreateParams,
  ): Promise<Universe | null> => {
    const { data, error } = await supabase
      .from('universes')
      .insert({
        user_id: userId,
        name: params.name,
        description: params.description ?? null,
        color_seed: params.color_seed ?? 'blue',
        icon: params.icon ?? 'sparkles',
        is_default: false,
        sort_order: universes.length,
      })
      .select('*')
      .maybeSingle();

    if (error || !data) return null;
    await refetch();
    return data as Universe;
  }, [universes.length, refetch]);

  const deleteUniverse = useCallback(async (id: string) => {
    // Prevent deleting the default universe
    const u = universes.find(u => u.id === id);
    if (!u || u.is_default) return { error: 'Cannot delete default universe' };

    const { error } = await supabase.from('universes').delete().eq('id', id);
    if (!error) {
      // If we deleted the active one, switch to default
      if (activeUniverseId === id) {
        const def = universes.find(u => u.is_default);
        if (def) setActiveUniverseId(def.id);
      }
      await refetch();
    }
    return { error: error?.message ?? null };
  }, [universes, activeUniverseId, setActiveUniverseId, refetch]);

  const updateUniverse = useCallback(async (
    id: string,
    updates: Partial<Pick<Universe, 'name' | 'description' | 'color_seed' | 'icon'>>,
  ) => {
    const { error } = await supabase
      .from('universes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) await refetch();
    return { error: error?.message ?? null };
  }, [refetch]);

  return { universes, loading, createUniverse, deleteUniverse, updateUniverse };
}
