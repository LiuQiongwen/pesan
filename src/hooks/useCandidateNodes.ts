/**
 * useCandidateNodes — CRUD + realtime for candidate_nodes staging table.
 * Candidates live here until user reviews and publishes to main star map.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { NodeType } from '@/types';

export type CandidateSource = 'ocr' | 'ai' | 'import';
export type CandidateType = 'topic' | 'keypoint' | 'action';

export interface CandidateNode {
  id: string;
  user_id: string;
  universe_id: string;
  source: CandidateSource;
  candidate_type: CandidateType;
  title: string;
  summary: string;
  tags: string[];
  raw_text: string | null;
  created_at: string;
}

const TYPE_TO_NODE: Record<CandidateType, NodeType> = {
  topic: 'capture',
  keypoint: 'summary',
  action: 'action',
};

export function useCandidateNodes(userId?: string, universeId?: string | null) {
  const [candidates, setCandidates] = useState<CandidateNode[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCandidates = useCallback(async () => {
    if (!userId || !universeId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('candidate_nodes')
      .select('*')
      .eq('user_id', userId)
      .eq('universe_id', universeId)
      .order('created_at', { ascending: false });
    if (data) setCandidates(data as unknown as CandidateNode[]);
    setLoading(false);
  }, [userId, universeId]);

  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`candidates:${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'candidate_nodes',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as unknown as CandidateNode;
          setCandidates(prev => prev.some(c => c.id === row.id) ? prev : [row, ...prev]);
        } else if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id: string }).id;
          setCandidates(prev => prev.filter(c => c.id !== id));
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new as unknown as CandidateNode;
          setCandidates(prev => prev.map(c => c.id === row.id ? row : c));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const insertBatch = useCallback(async (
    items: { candidate_type: CandidateType; title: string; summary: string; tags: string[]; source: CandidateSource; raw_text?: string }[]
  ) => {
    if (!userId || !universeId) return;
    const rows = items.map(i => ({
      user_id: userId,
      universe_id: universeId,
      source: i.source,
      candidate_type: i.candidate_type,
      title: i.title,
      summary: i.summary,
      tags: i.tags,
      raw_text: i.raw_text ?? null,
    }));
    await supabase.from('candidate_nodes').insert(rows);
  }, [userId, universeId]);

  const updateCandidate = useCallback(async (
    id: string,
    updates: Partial<Pick<CandidateNode, 'title' | 'summary' | 'candidate_type' | 'tags'>>
  ) => {
    await supabase.from('candidate_nodes').update(updates).eq('id', id);
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const deleteCandidate = useCallback(async (id: string) => {
    await supabase.from('candidate_nodes').delete().eq('id', id);
    setCandidates(prev => prev.filter(c => c.id !== id));
  }, []);

  const deleteBatch = useCallback(async (ids: string[]) => {
    await supabase.from('candidate_nodes').delete().in('id', ids);
    setCandidates(prev => prev.filter(c => !ids.includes(c.id)));
  }, []);

  const mergeCandidates = useCallback(async (ids: string[]) => {
    if (!userId || !universeId || ids.length < 2) return;
    const toMerge = candidates.filter(c => ids.includes(c.id));
    if (toMerge.length < 2) return;

    const mergedTitle = toMerge.map(c => c.title).filter(Boolean).join(' + ');
    const mergedSummary = toMerge.map(c => c.summary).filter(Boolean).join(' | ');
    const mergedTags = [...new Set(toMerge.flatMap(c => c.tags))];

    await supabase.from('candidate_nodes').insert({
      user_id: userId,
      universe_id: universeId,
      source: toMerge[0].source,
      candidate_type: 'topic' as CandidateType,
      title: mergedTitle.slice(0, 60),
      summary: mergedSummary.slice(0, 300),
      tags: mergedTags.slice(0, 5),
      raw_text: toMerge.map(c => c.raw_text).filter(Boolean).join(' --- '),
    });

    await supabase.from('candidate_nodes').delete().in('id', ids);
  }, [userId, universeId, candidates]);

  const publishCandidates = useCallback(async (
    ids: string[],
    onFlash?: (noteId: string) => void,
  ): Promise<number> => {
    if (!userId || !universeId) return 0;
    const toPublish = candidates.filter(c => ids.includes(c.id));
    let count = 0;

    for (const c of toPublish) {
      const { data, error } = await supabase
        .from('notes')
        .insert({
          user_id: userId,
          universe_id: universeId,
          title: c.title,
          summary: c.summary,
          tags: c.tags,
          node_type: TYPE_TO_NODE[c.candidate_type] || 'capture',
          key_points: [],
          analysis_content: {},
          mindmap_data: {},
          is_edited: false,
        })
        .select()
        .maybeSingle();

      if (!error && data) {
        count++;
        onFlash?.(data.id);
        supabase.functions.invoke('chunk-and-index', {
          body: {
            note_id: data.id,
            user_id: userId,
            content: c.title + ' ' + c.summary,
            title: c.title,
            source_type: 'image',
            universe_id: universeId,
          },
        }).catch(() => {});
      }
    }

    await supabase.from('candidate_nodes').delete().in('id', ids);
    return count;
  }, [userId, universeId, candidates]);

  return {
    candidates,
    loading,
    fetchCandidates,
    insertBatch,
    updateCandidate,
    deleteCandidate,
    deleteBatch,
    mergeCandidates,
    publishCandidates,
  };
}
