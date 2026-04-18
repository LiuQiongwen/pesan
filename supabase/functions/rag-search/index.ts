
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const AI_TOKEN = Deno.env.get("AI_API_TOKEN_2c7d5422f5cf");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!AI_TOKEN) throw new Error("AI token missing");

    const { query, user_id, project_id, universe_id, top_k = 5 } = await req.json();
    if (!query || !user_id) throw new Error("query and user_id required");

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const searchTerms = query.replace(/[^\w\s\u4e00-\u9fff]/g, " ").trim();

    // Resolve universe_id if not provided
    let uniId = universe_id;
    if (!uniId) {
      const { data: defUni } = await db.from("universes")
        .select("id").eq("user_id", user_id).eq("is_default", true).limit(1).maybeSingle();
      uniId = defUni?.id;
    }

    // ── 0. Scope metadata ─────────────────────────────────────────────
    const [{ count: noteCount }, { count: chunkCount }, uniRow] = await Promise.all([
      db.from("notes").select("*", { count: "exact", head: true }).eq("user_id", user_id).eq("universe_id", uniId),
      db.from("knowledge_chunks").select("*", { count: "exact", head: true }).eq("user_id", user_id).eq("universe_id", uniId),
      db.from("universes").select("name").eq("id", uniId).maybeSingle(),
    ]);
    const scope_meta = {
      note_count: noteCount ?? 0,
      chunk_count: chunkCount ?? 0,
      universe_name: uniRow?.data?.name ?? "默认宇宙",
    };

    // ── 1. Wiki-first: search wiki_pages ──────────────────────────────
    let wikiHits: Array<{ id: string; title: string; summary: string; content_markdown: string; page_type: string }> = [];
    try {
      let wikiQuery = db
        .from("wiki_pages")
        .select("id, title, summary, content_markdown, page_type")
        .eq("user_id", user_id);
      if (uniId) wikiQuery = wikiQuery.eq("universe_id", uniId);
      const { data: wikiResults } = await wikiQuery
        .textSearch("search_vector", searchTerms, { type: "plain", config: "simple" })
        .limit(3);
      wikiHits = wikiResults || [];
    } catch {
      // wiki table might not have data yet, continue
    }

    // ── 2. Chunk search (existing logic) ──────────────────────────────
    let chunkQuery = db
      .from("knowledge_chunks")
      .select("id, note_id, content, source_title, source_type, chunk_index")
      .eq("user_id", user_id);
    if (uniId) chunkQuery = chunkQuery.eq("universe_id", uniId);
    const { data: ftsResults } = await chunkQuery
      .textSearch("search_vector", searchTerms, { type: "plain", config: "simple" })
      .limit(20);

    let candidates = ftsResults || [];
    if (candidates.length < 3) {
      let recentQuery = db
        .from("knowledge_chunks")
        .select("id, note_id, content, source_title, source_type, chunk_index")
        .eq("user_id", user_id);
      if (uniId) recentQuery = recentQuery.eq("universe_id", uniId);
      const { data: recent } = await recentQuery
        .order("created_at", { ascending: false })
        .limit(10);
      const ids = new Set(candidates.map((c: { id: string }) => c.id));
      for (const r of recent || []) {
        if (!ids.has(r.id)) candidates.push(r);
      }
    }

    // Resolve note titles
    const noteIds = [...new Set(candidates.map((c: { note_id: string }) => c.note_id))];
    const noteTitles: Record<string, string> = {};
    if (noteIds.length > 0) {
      const { data: notes } = await db.from("notes").select("id, title").in("id", noteIds);
      for (const n of notes || []) noteTitles[n.id] = n.title || "Untitled";
    }

    candidates = candidates.slice(0, 15).map((c: { id: string; note_id: string; content: string; source_title: string | null; source_type: string | null; chunk_index: number }) => ({
      ...c,
      source_title: c.source_title || noteTitles[c.note_id] || "Untitled",
    }));

    if (candidates.length === 0 && wikiHits.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        answer: null,
        citations: [],
        wiki_citations: [],
        scope_meta,
        no_evidence: true,
        conversation_id: null,
      }), { headers: { ...cors, "Content-Type": "application/json", "Expect": "" } });
    }

    // ── 3. Build context for LLM ──────────────────────────────────────
    const wikiBlocks = wikiHits.map((w, i) =>
      `[WIKI-${i + 1}] "${w.title}" (${w.page_type})\n${(w.summary || "").slice(0, 200)}\n${(w.content_markdown || "").slice(0, 500)}`
    ).join("\n\n");

    const chunkBlocks = candidates.map((c: { id: string; content: string; source_title: string }, i: number) =>
      `[${i + 1}] 来源："${c.source_title}" (chunk_id: ${c.id})\n${c.content.slice(0, 300)}`
    ).join("\n\n");

    const system = `You are a personal knowledge retrieval assistant with a dual-layer knowledge base.

LAYER 1 — WIKI PAGES (compiled knowledge, higher authority):
These are AI-compiled structured summaries. Use them as primary answers when available.
Cite as [WIKI-1], [WIKI-2], etc.

LAYER 2 — RAW CHUNKS (original source material, evidence):
These are original document fragments. Use them as supporting evidence.
Cite as [1], [2], etc.

Rules:
1. Prefer wiki content for the main answer, supplement with raw chunk evidence
2. Only use information from provided content — never hallucinate
3. Cite sources inline using the markers above
4. If wiki pages cover the topic well, lead with that synthesis
5. If no wiki matches, fall back to raw chunks only
6. Answer in the same language as the query (Chinese query → Chinese answer)
7. Keep under 250 words
8. Return ONLY valid JSON: {"answer": "text with citations", "used_chunks": [1, 2], "used_wiki": [1]}`;

    const userContent = wikiBlocks
      ? `Query: ${query}\n\nWiki pages:\n${wikiBlocks}\n\nRaw chunks:\n${chunkBlocks}`
      : `Query: ${query}\n\nKnowledge chunks:\n${chunkBlocks}`;

    const r = await fetch("https://api.enter.pro/code/api/v1/ai/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${AI_TOKEN}`, "Content-Type": "application/json", "Expect": "" },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-lite-preview",
        system,
        messages: [{ role: "user", content: userContent }],
        stream: false,
        max_tokens: 800,
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!r.ok) {
      const txt = await r.text();
      let msg = `AI error (${r.status})`;
      try { msg = JSON.parse(txt).error?.message || msg; } catch { /* */ }
      return new Response(JSON.stringify({ success: false, error: msg }), {
        status: 200, headers: { ...cors, "Content-Type": "application/json", "Expect": "" },
      });
    }

    const data = await r.json();
    const rawText = (data.content?.[0]?.text || "").trim();

    let answer = rawText;
    let usedChunkIndices: number[] = [];
    let usedWikiIndices: number[] = [];
    try {
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        answer = parsed.answer || rawText;
        usedChunkIndices = (parsed.used_chunks || []).map((n: number) => n - 1);
        usedWikiIndices = (parsed.used_wiki || []).map((n: number) => n - 1);
      }
    } catch { /* use raw text */ }

    // Build citations
    const usedSet = usedChunkIndices.length > 0
      ? new Set(usedChunkIndices)
      : new Set(candidates.map((_: unknown, i: number) => i));

    const citations = candidates
      .map((c: { id: string; note_id: string; source_title: string; content: string }, i: number) => ({
        id: i + 1,
        chunk_id: c.id,
        note_id: c.note_id,
        note_title: c.source_title,
        excerpt: c.content.slice(0, 150) + (c.content.length > 150 ? "…" : ""),
      }))
      .filter((_: unknown, i: number) => usedSet.has(i))
      .slice(0, top_k);

    // Build wiki citations
    const wikiCitSet = usedWikiIndices.length > 0
      ? new Set(usedWikiIndices)
      : (wikiHits.length > 0 ? new Set(wikiHits.map((_, i) => i)) : new Set<number>());

    const wiki_citations = wikiHits
      .map((w, i) => ({
        id: i + 1,
        wiki_page_id: w.id,
        title: w.title,
        page_type: w.page_type,
        excerpt: (w.summary || "").slice(0, 150),
      }))
      .filter((_, i) => wikiCitSet.has(i));

    // Save conversation
    const { data: convo } = await db
      .from("rag_conversations")
      .insert({
        user_id,
        project_id: project_id || "default",
        universe_id: uniId,
        query,
        answer,
        citations: [...wiki_citations.map(w => ({ ...w, type: "wiki" })), ...citations.map(c => ({ ...c, type: "chunk" }))],
      })
      .select("id")
      .maybeSingle();

    return new Response(JSON.stringify({
      success: true,
      answer,
      citations,
      wiki_citations,
      scope_meta,
      conversation_id: convo?.id || null,
    }), { headers: { ...cors, "Content-Type": "application/json", "Expect": "" } });

  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json", "Expect": "" },
    });
  }
});
