import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Note, Analysis, SourceType, NodeType } from '@/types';

// Normalize a raw DB row to a typed Note
function normalizeNote(n: Record<string, unknown>): Note {
  return {
    ...(n as Note),
    key_points: (n.key_points as string[]) || [],
    analysis_content: (n.analysis_content as Note['analysis_content']) || {
      main_viewpoints: [], critical_analysis: '', innovative_insights: [], knowledge_connections: [],
    },
    tags: (n.tags as string[]) || [],
    mindmap_data: (n.mindmap_data as Note['mindmap_data']) || { root: '', nodes: [] },
    node_type: ((n.node_type as NodeType) || 'capture'),
  };
}

export function useNotes(userId?: string, universeId?: string | null) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    if (!userId || !universeId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .eq('universe_id', universeId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (!error && data) setNotes(data.map(n => normalizeNote(n as Record<string, unknown>)));
    setLoading(false);
  }, [userId, universeId]);

  // Initial load
  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  // Realtime: auto-add newly inserted notes (from any source, including derived nodes)
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notes:user:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notes', filter: `user_id=eq.${userId}` },
        (payload) => {
          const raw = payload.new as Record<string, unknown>;
          if (raw.deleted_at) return; // Skip soft-deleted notes
          const newNote = normalizeNote(raw);
          setNotes(prev => {
            if (prev.some(n => n.id === newNote.id)) return prev;
            return [newNote, ...prev];
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const getNote = async (id: string): Promise<Note | null> => {
    const { data, error } = await supabase.from('notes').select('*').eq('id', id).maybeSingle();
    if (error || !data) return null;
    return normalizeNote(data as Record<string, unknown>);
  };

  const updateNote = async (id: string, updates: Partial<Note>) => {
    const { data, error } = await supabase
      .from('notes')
      .update({ ...updates, is_edited: true, updated_at: new Date().toISOString() })
      .eq('id', id).select().maybeSingle();
    if (!error && data) {
      setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates, is_edited: true } : n));
    }
    return { data, error };
  };

  const deleteNote = async (id: string) => {
    // Soft-delete: set deleted_at timestamp
    const { error } = await supabase
      .from('notes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) setNotes(prev => prev.filter(n => n.id !== id));
    return { error };
  };

  const undoDeleteNote = async (id: string) => {
    // Restore soft-deleted note
    const { error } = await supabase
      .from('notes')
      .update({ deleted_at: null })
      .eq('id', id);
    if (!error) {
      // Refetch to get the note back into state
      const { data } = await supabase.from('notes').select('*').eq('id', id).maybeSingle();
      if (data) {
        const restored = normalizeNote(data as Record<string, unknown>);
        setNotes(prev => {
          if (prev.some(n => n.id === restored.id)) return prev;
          return [restored, ...prev];
        });
      }
    }
    return { error };
  };

  return { notes, loading, fetchNotes, getNote, updateNote, deleteNote, undoDeleteNote };
}

export function useAnalysis(userId?: string, universeId?: string | null) {
  const createAnalysis = async (
    sourceType: SourceType,
    sourceContent: string,
    sourceUrl?: string
  ): Promise<Analysis | null> => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('analyses')
      .insert({
        user_id: userId,
        source_type: sourceType,
        source_content: sourceContent,
        source_url: sourceUrl || null,
        status: 'pending',
      })
      .select().maybeSingle();
    if (error) return null;
    return data as Analysis;
  };

  const updateAnalysisStatus = async (id: string, status: string, errorMsg?: string) => {
    await supabase
      .from('analyses')
      .update({ status, error_message: errorMsg || null, updated_at: new Date().toISOString() })
      .eq('id', id);
  };

  const saveNote = async (analysisId: string, noteData: Partial<Note>): Promise<Note | null> => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('notes')
      .insert({
        analysis_id: analysisId,
        user_id: userId,
        universe_id: universeId,
        title: noteData.title || null,
        summary: noteData.summary || null,
        key_points: noteData.key_points || [],
        analysis_content: noteData.analysis_content || {},
        tags: noteData.tags || [],
        mindmap_data: noteData.mindmap_data || {},
        content_markdown: noteData.content_markdown || null,
        summary_markdown: noteData.summary_markdown || null,
        analysis_markdown: noteData.analysis_markdown || null,
        mindmap_markdown: noteData.mindmap_markdown || null,
        is_edited: false,
        node_type: noteData.node_type || 'capture',
      })
      .select().maybeSingle();
    if (error) return null;
    return data as Note;
  };

  // Create a standalone derived node (no analysis record required)
  const insertDerivedNode = async (params: {
    userId: string;
    universeId: string;
    node_type: NodeType;
    title: string;
    summary: string;
    tags: string[];
    sourceNoteId?: string;
  }): Promise<Note | null> => {
    const { data, error } = await supabase
      .from('notes')
      .insert({
        analysis_id: null,
        user_id: params.userId,
        universe_id: params.universeId,
        title: params.title,
        summary: params.summary,
        key_points: [],
        analysis_content: {},
        tags: params.tags,
        mindmap_data: {},
        content_markdown: null,
        summary_markdown: null,
        analysis_markdown: null,
        mindmap_markdown: null,
        is_edited: false,
        node_type: params.node_type,
      })
      .select().maybeSingle();
    if (error) return null;
    return data as Note;
  };

  return { createAnalysis, updateAnalysisStatus, saveNote, insertDerivedNode };
}
