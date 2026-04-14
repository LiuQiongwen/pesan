import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Distillation {
  id: string;
  user_id: string;
  note_id: string | null;
  title: string | null;
  source_text: string | null;
  source_label: string | null;
  confidence: number | null;
  key_insight: string | null;
  facts_markdown: string | null;
  opinions_markdown: string | null;
  methods_markdown: string | null;
  insights_markdown: string | null;
  actions_markdown: string | null;
  tags: string[];
  created_at: string;
}

export interface DistillResult {
  title: string;
  source_label: string;
  confidence: number;
  key_insight: string;
  tags: string[];
  facts_markdown: string;
  opinions_markdown: string;
  methods_markdown: string;
  insights_markdown: string;
  actions_markdown: string;
}

export function useDistillations(userId?: string) {
  const [saving, setSaving] = useState(false);

  const save = async (data: Omit<Distillation, 'id' | 'user_id' | 'created_at'>): Promise<Distillation | null> => {
    if (!userId) return null;
    setSaving(true);
    const { data: result, error } = await supabase
      .from('distillations')
      .insert({ ...data, user_id: userId })
      .select()
      .maybeSingle();
    setSaving(false);
    if (error) return null;
    return result as Distillation;
  };

  return { save, saving };
}
