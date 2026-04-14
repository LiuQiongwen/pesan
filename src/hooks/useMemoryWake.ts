import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MemoryWakeItem {
  noteId: string;
  title: string;
  summary: string | null;
  reason: string;
  relevance: 'high' | 'medium' | 'low';
}

export function useMemoryWake(userId?: string) {
  const [items, setItems]       = useState<MemoryWakeItem[]>([]);
  const [loading, setLoading]   = useState(false);
  const [checkedFor, setCheckedFor] = useState<string | null>(null);

  const checkForNote = useCallback(async (
    currentNote: { id: string; title: string; summary: string | null; tags: string[] },
    allNotes: { id: string; title: string; summary: string | null; tags: string[]; created_at: string }[]
  ) => {
    if (!userId || checkedFor === currentNote.id) return;
    setCheckedFor(currentNote.id);
    setItems([]);

    // Candidates: notes older than current, not the current note itself
    const candidates = allNotes
      .filter(n => n.id !== currentNote.id)
      .slice(0, 20);

    if (candidates.length === 0) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('memory-wake', {
        body: { currentNote, candidates },
      });
      if (error || !data?.success) return;

      const related = (data.related || []) as { id: string; reason: string; relevance: string }[];
      const enriched = related
        .map(r => {
          const note = allNotes.find(n => n.id === r.id);
          if (!note) return null;
          return { noteId: note.id, title: note.title, summary: note.summary, reason: r.reason, relevance: r.relevance as 'high' | 'medium' | 'low' };
        })
        .filter(Boolean) as MemoryWakeItem[];

      setItems(enriched);
    } finally {
      setLoading(false);
    }
  }, [userId, checkedFor]);

  const dismiss = () => setItems([]);

  return { items, loading, checkForNote, dismiss };
}
