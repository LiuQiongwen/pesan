
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Split text into ~400-char chunks at sentence boundaries with ~50-char overlap */
function chunkText(text: string, maxChars = 400, overlap = 80): string[] {
  if (!text || text.trim().length < 20) return [];

  const sentences: string[] = [];
  let current = "";
  for (let i = 0; i < text.length; i++) {
    current += text[i];
    const ch = text[i];
    const next = text[i + 1] || "";
    if (
      (ch === "。" || ch === "！" || ch === "？") ||
      (ch === "." && (next === " " || next === "\n")) ||
      (ch === "!" && (next === " " || next === "\n")) ||
      (ch === "?" && (next === " " || next === "\n")) ||
      ch === "\n"
    ) {
      const trimmed = current.trim();
      if (trimmed.length > 0) sentences.push(trimmed);
      current = "";
    }
  }
  if (current.trim()) sentences.push(current.trim());

  const chunks: string[] = [];
  let buf = "";
  let overlapBuf = "";

  for (const sentence of sentences) {
    if (buf.length + sentence.length > maxChars && buf.length > 0) {
      chunks.push(buf.trim());
      buf = overlapBuf + " " + sentence;
      overlapBuf = sentence.slice(-overlap);
    } else {
      buf += (buf ? " " : "") + sentence;
      overlapBuf = sentence.slice(-overlap);
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks.filter(c => c.length >= 20);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { note_id, user_id, content, title, source_type, project_id, universe_id } = await req.json();
    if (!note_id || !user_id || !content) throw new Error("note_id, user_id, content required");

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Resolve universe_id if not provided
    let resolvedUniverseId = universe_id;
    if (!resolvedUniverseId) {
      const { data: defUni } = await db.from("universes")
        .select("id").eq("user_id", user_id).eq("is_default", true).limit(1).maybeSingle();
      resolvedUniverseId = defUni?.id;
    }

    // Idempotent: delete existing chunks for this note
    await db.from("knowledge_chunks").delete().eq("note_id", note_id);

    const fullText = (content || "").slice(0, 6000);
    const chunks = chunkText(fullText);

    if (chunks.length === 0) {
      return new Response(JSON.stringify({ success: true, chunks_created: 0 }), {
        headers: { ...cors, "Content-Type": "application/json", "Expect": "" },
      });
    }

    const rows = chunks.map((chunk, idx) => ({
      user_id,
      project_id: project_id || "default",
      universe_id: resolvedUniverseId,
      note_id,
      chunk_index: idx,
      content: chunk,
      source_title: title || null,
      source_type: source_type || null,
      tokens_estimate: Math.ceil(chunk.length / 4),
      metadata: { chunk_count: chunks.length },
    }));

    const { error } = await db.from("knowledge_chunks").insert(rows);
    if (error) throw new Error("DB insert failed: " + error.message);

    return new Response(JSON.stringify({ success: true, chunks_created: chunks.length }), {
      headers: { ...cors, "Content-Type": "application/json", "Expect": "" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json", "Expect": "" },
    });
  }
});
