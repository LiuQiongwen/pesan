import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Citation {
  id: number;
  chunk_id: string;
  note_id: string;
  note_title: string;
  excerpt: string;
}

export interface RAGConversation {
  id: string | null;
  query: string;
  answer: string;
  citations: Citation[];
  created_at: string;
}

export function useRAG() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<RAGConversation[]>([]);

  const search = useCallback(
    async (query: string): Promise<RAGConversation | null> => {
      if (!user?.id || !query.trim()) return null;
      setLoading(true);
      setError(null);
      try {
        const { data, error: fnError } = await supabase.functions.invoke("rag-search", {
          body: { query: query.trim(), user_id: user.id, project_id: "default", top_k: 5 },
        });
        if (fnError) throw new Error(fnError.message);
        if (!data?.success) throw new Error(data?.error || "Search failed");

        const convo: RAGConversation = {
          id: data.conversation_id || null,
          query: query.trim(),
          answer: data.answer,
          citations: data.citations || [],
          created_at: new Date().toISOString(),
        };
        setConversations((prev) => [convo, ...prev]);
        return convo;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user?.id]
  );

  const indexNote = useCallback(
    async (noteId: string, content: string, title: string, sourceType?: string) => {
      if (!user?.id || !noteId || !content) return;
      await supabase.functions.invoke("chunk-and-index", {
        body: {
          note_id: noteId,
          user_id: user.id,
          content,
          title,
          source_type: sourceType || "text",
          project_id: "default",
        },
      });
    },
    [user?.id]
  );

  const clearConversations = useCallback(() => setConversations([]), []);

  return { search, indexNote, loading, error, conversations, clearConversations };
}
