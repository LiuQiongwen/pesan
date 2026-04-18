
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CompileRequest {
  user_id: string;
  universe_id?: string;
  trigger: "new_note" | "manual" | "batch";
  note_ids?: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const AI_TOKEN = Deno.env.get("AI_API_TOKEN_2c7d5422f5cf");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!AI_TOKEN) throw new Error("AI token missing");

    const body: CompileRequest = await req.json();
    const { user_id, universe_id, trigger, note_ids } = body;
    if (!user_id) throw new Error("user_id required");

    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    // Resolve universe_id
    let uniId = universe_id;
    if (!uniId) {
      const { data: defUni } = await db.from("universes")
        .select("id").eq("user_id", user_id).eq("is_default", true).limit(1).maybeSingle();
      uniId = defUni?.id;
    }

    // 1. Gather source material
    let notesQuery = db.from("notes")
      .select("id, title, tags, summary, content_markdown, summary_markdown, analysis_markdown, node_type, created_at")
      .eq("user_id", user_id)
      .is("deleted_at", null)
      .not("node_type", "like", "wiki_%")
      .order("created_at", { ascending: false });
    if (uniId) notesQuery = notesQuery.eq("universe_id", uniId);

    if (trigger === "new_note" && note_ids?.length) {
      const { data: targetNotes } = await db.from("notes")
        .select("id, title, tags, summary, content_markdown, summary_markdown, analysis_markdown, node_type, created_at")
        .in("id", note_ids);

      const { data: recentNotes } = await notesQuery.limit(20);
      const allNotes = [...(targetNotes || []), ...(recentNotes || [])];
      const seen = new Set<string>();
      const deduped = allNotes.filter(n => { if (seen.has(n.id)) return false; seen.add(n.id); return true; });
      return await compileFromNotes(db, AI_TOKEN, user_id, uniId, deduped, note_ids || []);
    }

    const { data: allNotes } = await notesQuery.limit(50);
    return await compileFromNotes(db, AI_TOKEN, user_id, uniId, allNotes || [], []);

  } catch (e) {
    console.error("wiki-compile error:", e.message);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

async function compileFromNotes(
  db: ReturnType<typeof createClient>,
  aiToken: string,
  userId: string,
  universeId: string | undefined,
  notes: Array<Record<string, unknown>>,
  targetNoteIds: string[],
) {
  if (notes.length === 0) {
    return new Response(JSON.stringify({ success: true, created: 0, updated: 0, message: "No notes to compile" }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const sourceBlocks = notes.slice(0, 15).map((n, i) => {
    const content = [
      (n.summary as string) || "",
      ((n.content_markdown as string) || "").slice(0, 300),
    ].filter(Boolean).join("\n");
    const tags = ((n.tags as string[]) || []).join(", ");
    return `[NOTE-${i}] id=${n.id} title="${n.title || "Untitled"}" tags=[${tags}]\n${content.slice(0, 500)}`;
  }).join("\n---\n");

  let existingQuery = db.from("wiki_pages")
    .select("id, slug, title, page_type, summary, version, tags, source_note_ids")
    .eq("user_id", userId);
  if (universeId) existingQuery = existingQuery.eq("universe_id", universeId);
  const { data: existingPages } = await existingQuery;

  const existingContext = (existingPages || []).map(p =>
    `[WIKI:${p.slug}] type=${p.page_type} title="${p.title}" tags=[${(p.tags || []).join(",")}] v${p.version}`
  ).join("\n");

  const systemPrompt = `You are a knowledge compiler. Given source notes and existing wiki pages, generate structured wiki pages.

RULES:
1. Only synthesize from provided notes — never hallucinate
2. Each wiki page must reference source notes using [NOTE-N] markers
3. Identify 1-3 topics that deserve wiki pages from the source material
4. If an existing wiki page covers the topic, output an UPDATE; otherwise CREATE
5. Output ONLY valid JSON array

For each page output:
{
  "action": "create" | "update",
  "slug": "kebab-case-identifier",
  "existing_slug": null | "slug-if-updating",
  "title": "Page Title",
  "page_type": "topic" | "entity" | "timeline" | "summary",
  "summary": "One paragraph summary (100 chars max)",
  "content_markdown": "Full structured markdown content with ## sections. Include [NOTE-N] references inline.",
  "tags": ["tag1", "tag2"],
  "source_note_indices": [0, 1, 2]
}

Content guidelines:
- topic: Synthesize a theme across multiple notes. Sections: ## Overview, ## Key Concepts, ## Evidence, ## Open Questions
- entity: Define a concept/person/tool. Sections: ## Definition, ## Context, ## Related
- timeline: Chronological synthesis. Sections: ## Timeline, ## Analysis
- summary: Compress multiple notes into one view. Sections: ## Summary, ## Key Points, ## Sources

Output: JSON array of page objects. Max 3 pages per call.`;

  const userMsg = `EXISTING WIKI PAGES:\n${existingContext || "(none)"}\n\nSOURCE NOTES:\n${sourceBlocks}`;

  const aiRes = await fetch("https://api.enter.pro/code/api/v1/ai/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${aiToken}`, "Content-Type": "application/json", "Expect": "" },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-lite-preview",
      system: systemPrompt,
      messages: [{ role: "user", content: userMsg }],
      stream: false,
      max_tokens: 2000,
    }),
    signal: AbortSignal.timeout(50000),
  });

  if (!aiRes.ok) {
    const txt = await aiRes.text();
    throw new Error(`AI error (${aiRes.status}): ${txt.slice(0, 200)}`);
  }

  const aiData = await aiRes.json();
  const rawText = (aiData.content?.[0]?.text || "").trim();

  let pages: Array<Record<string, unknown>> = [];
  try {
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) pages = JSON.parse(match[0]);
    else {
      const objMatch = cleaned.match(/\{[\s\S]*\}/);
      if (objMatch) pages = [JSON.parse(objMatch[0])];
    }
  } catch {
    console.error("Failed to parse wiki-compile output:", rawText.slice(0, 500));
    return new Response(JSON.stringify({ success: false, error: "Failed to parse AI output" }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let created = 0;
  let updated = 0;

  for (const page of pages.slice(0, 3)) {
    const slug = String(page.slug || "").replace(/[^a-z0-9-]/g, "").slice(0, 80) || `wiki-${Date.now()}`;
    const pageType = ["topic", "entity", "timeline", "summary", "question", "overview"].includes(String(page.page_type))
      ? String(page.page_type) : "topic";
    const tags = Array.isArray(page.tags) ? page.tags.map(String).slice(0, 10) : [];
    const srcIndices: number[] = Array.isArray(page.source_note_indices) ? page.source_note_indices : [];
    const sourceNoteIds = srcIndices.map(i => notes[i]?.id).filter(Boolean).map(String);

    if (page.action === "update" && page.existing_slug) {
      const existing = (existingPages || []).find(p => p.slug === page.existing_slug);
      if (existing) {
        const mergedSources = [...new Set([...(existing.source_note_ids || []), ...sourceNoteIds])];
        await db.from("wiki_pages").update({
          title: String(page.title || existing.title),
          summary: String(page.summary || ""),
          content_markdown: String(page.content_markdown || ""),
          tags,
          version: (existing.version || 1) + 1,
          source_note_ids: mergedSources,
          compiled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);

        await db.from("notes").update({
          title: String(page.title || existing.title),
          summary: String(page.summary || ""),
          content_markdown: String(page.content_markdown || ""),
          tags,
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId)
          .eq("node_type", `wiki_${pageType}`)
          .like("title", `%${existing.title}%`);

        updated++;
        continue;
      }
    }

    const { data: newPage } = await db.from("wiki_pages").insert({
      user_id: userId,
      universe_id: universeId,
      slug,
      title: String(page.title || slug),
      page_type: pageType,
      summary: String(page.summary || ""),
      content_markdown: String(page.content_markdown || ""),
      tags,
      source_note_ids: sourceNoteIds,
      source_chunk_ids: [],
      version: 1,
    }).select("id").maybeSingle();

    const nodeType = `wiki_${pageType}`;
    const { data: mirrorNote } = await db.from("notes").insert({
      user_id: userId,
      universe_id: universeId,
      analysis_id: null,
      title: String(page.title || slug),
      summary: String(page.summary || ""),
      content_markdown: String(page.content_markdown || ""),
      tags,
      node_type: nodeType,
      key_points: [],
      analysis_content: {},
      mindmap_data: {},
    }).select("id").maybeSingle();

    if (mirrorNote && sourceNoteIds.length > 0) {
      const edges = sourceNoteIds.slice(0, 10).map(srcId => ({
        user_id: userId,
        universe_id: universeId,
        source_id: srcId,
        target_id: mirrorNote.id,
        edge_type: "compiled_from",
        description: `Compiled into wiki: ${String(page.title || slug)}`,
        confidence: 0.9,
      }));
      await db.from("thought_edges").insert(edges);
    }

    if (newPage) {
      const refs = sourceNoteIds.slice(0, 10).map(noteId => ({
        wiki_page_id: newPage.id,
        note_id: noteId,
        section_anchor: null,
        excerpt: null,
      }));
      if (refs.length > 0) {
        await db.from("wiki_source_refs").insert(refs);
      }
    }

    if (mirrorNote) {
      const content = [String(page.summary || ""), String(page.content_markdown || "")].join("\n\n");
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/chunk-and-index`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          note_id: mirrorNote.id,
          user_id: userId,
          universe_id: universeId,
          content: content.slice(0, 6000),
          title: `[WIKI] ${String(page.title || slug)}`,
          source_type: "wiki",
          project_id: "default",
        }),
      }).catch(e => console.error("chunk-and-index for wiki failed:", e));
    }

    created++;
  }

  return new Response(JSON.stringify({
    success: true,
    created,
    updated,
    total_pages: (existingPages?.length || 0) + created,
  }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
