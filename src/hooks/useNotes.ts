import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Note, Analysis, SourceType } from '@/types';

export function useNotes(userId?: string) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setNotes(data.map(n => ({
        ...n,
        key_points: (n.key_points as string[]) || [],
        analysis_content: (n.analysis_content as Note['analysis_content']) || {
          main_viewpoints: [], critical_analysis: '', innovative_insights: [], knowledge_connections: []
        },
        tags: n.tags || [],
        mindmap_data: (n.mindmap_data as Note['mindmap_data']) || { root: '', nodes: [] },
      })));
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const getNote = async (id: string): Promise<Note | null> => {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return {
      ...data,
      key_points: (data.key_points as string[]) || [],
      analysis_content: (data.analysis_content as Note['analysis_content']) || {
        main_viewpoints: [], critical_analysis: '', innovative_insights: [], knowledge_connections: []
      },
      tags: data.tags || [],
      mindmap_data: (data.mindmap_data as Note['mindmap_data']) || { root: '', nodes: [] },
    };
  };

  const updateNote = async (id: string, updates: Partial<Note>) => {
    const { data, error } = await supabase
      .from('notes')
      .update({ ...updates, is_edited: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (!error && data) {
      setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates, is_edited: true } : n));
    }
    return { data, error };
  };

  const deleteNote = async (id: string) => {
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (!error) {
      setNotes(prev => prev.filter(n => n.id !== id));
    }
    return { error };
  };

  return { notes, loading, fetchNotes, getNote, updateNote, deleteNote };
}

export function useAnalysis(userId?: string) {
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
      .select()
      .maybeSingle();
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
      })
      .select()
      .maybeSingle();
    if (error) return null;
    return data as Note;
  };

  return { createAnalysis, updateAnalysisStatus, saveNote };
}
