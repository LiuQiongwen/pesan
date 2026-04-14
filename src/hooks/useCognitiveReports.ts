import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CognitiveReport {
  id: string;
  user_id: string;
  notes_analyzed: number;
  dominant_themes: { theme: string; weight: number; note_count: number }[];
  blind_spots: string[];
  bias_signatures: string[];
  thinking_style: string;
  intellectual_diet: Record<string, number>;
  stagnation_alerts: string[];
  report_markdown: string;
  created_at: string;
}

export function useCognitiveReports(userId?: string) {
  const [latest, setLatest]   = useState<CognitiveReport | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('cognitive_reports')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setLatest(data as CognitiveReport | null);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const save = async (payload: Omit<CognitiveReport, 'id' | 'user_id' | 'created_at'>) => {
    if (!userId) return null;
    const { data, error } = await supabase.from('cognitive_reports').insert({ ...payload, user_id: userId }).select().maybeSingle();
    if (!error && data) setLatest(data as CognitiveReport);
    return error ? null : data;
  };

  return { latest, loading, save, refresh: fetch_ };
}
