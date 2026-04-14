import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AnticipationItem {
  id: string;
  user_id: string;
  item_type: 'open_question' | 'predicted_need' | 'emerging_tension';
  content: string;
  reasoning: string | null;
  confidence: 'high' | 'medium' | 'low';
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  related_note_ids: string[];
  created_at: string;
}

export function useAnticipationItems(userId?: string) {
  const [items, setItems]     = useState<AnticipationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('anticipation_items')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'dismissed')
      .order('created_at', { ascending: false });
    setItems((data as AnticipationItem[]) || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const saveMany = async (incoming: Omit<AnticipationItem, 'id' | 'user_id' | 'created_at' | 'status'>[]) => {
    if (!userId || !incoming.length) return;
    await supabase.from('anticipation_items').delete().eq('user_id', userId).eq('status', 'open');
    const rows = incoming.map(i => ({ ...i, user_id: userId, status: 'open' }));
    await supabase.from('anticipation_items').insert(rows);
    fetch_();
  };

  const updateStatus = async (id: string, status: AnticipationItem['status']) => {
    await supabase.from('anticipation_items').update({ status }).eq('id', id);
    setItems(p => p.map(i => i.id === id ? { ...i, status } : i));
  };

  return { items, loading, saveMany, updateStatus, refresh: fetch_ };
}
