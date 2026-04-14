import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Action {
  id: string;
  user_id: string;
  note_id: string | null;
  distillation_id: string | null;
  content: string;
  status: 'pending' | 'in_progress' | 'done' | 'dropped';
  priority: 'high' | 'normal' | 'low';
  source_context: string | null;
  outcome_note: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export function useActions(userId?: string) {
  const [actions, setActions]   = useState<Action[]>([]);
  const [loading, setLoading]   = useState(true);

  const fetch_ = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('actions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setActions((data as Action[]) || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const create = async (payload: Partial<Action>) => {
    if (!userId) return null;
    const { data, error } = await supabase.from('actions').insert({ ...payload, user_id: userId }).select().maybeSingle();
    if (!error && data) setActions(p => [data as Action, ...p]);
    return error ? null : data;
  };

  const update = async (id: string, patch: Partial<Action>) => {
    const { data, error } = await supabase.from('actions').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().maybeSingle();
    if (!error && data) setActions(p => p.map(a => a.id === id ? data as Action : a));
    return error ? null : data;
  };

  const remove = async (id: string) => {
    await supabase.from('actions').delete().eq('id', id);
    setActions(p => p.filter(a => a.id !== id));
  };

  return { actions, loading, create, update, remove, refresh: fetch_ };
}
