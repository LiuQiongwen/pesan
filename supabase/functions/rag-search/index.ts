import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const AI_TOKEN = Deno.env.get("AI_API_TOKEN_2c7d5422f5cf");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!AI_TOKEN) throw new Error("AI token missing");
    const { query, user_id, project_id, top_k = 5 } = await req.json();
    if (!query || !user_id) throw new Error("query and user_id required");
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: ftsResults } = await db.from("knowledge_chunks").select("id, note_id, content, source_title, source_type, chunk_index").eq("user_id", user_id).textSearch("search_vector", query.replace(/[^\w\s\u4e00-\u9fff]/g," ").trim(), { type: "plain", config: "simple" }).limit(20);
    let candidates = ftsResults || [];
    if (candidates.length < 3) {
      const { data: recent } = await db.from("knowledge_chunks").select("id, note_id, content, source_title, source_type, chunk_index").eq("user_id", user_id).order("created_at", { ascending: false }).limit(10);
      const ids = new Set(candidates.map((c:{id:string}) => c.id));
      for (const r of (recent || [])) { if (!ids.has(r.id)) candidates.push(r); }
    }
    const noteIds = [...new Set(candidates.map((c:{note_id:string}) => c.note_id))];
    const noteTitles: Record<string, string> = {};
    if (noteIds.length > 0) { const { data: notes } = await db.from("notes").select("id, title").in("id", noteIds); for (const n of (notes||[])) { noteTitles[n.id] = n.title || "Untitled"; } }
    candidates = candidates.slice(0,15).map((c:{id:string,note_id:string,content:string,source_title:string|null,source_type:string|null,chunk_index:number}) => ({ ...c, source_title: c.source_title || noteTitles[c.note_id] || "Untitled" }));
    if (candidates.length === 0) {
      return new Response(JSON.stringify({ success: true, answer: "知识库中暂无相关内容。请先分析一些笔记，然后再搜索。", citations: [], conversation_id: null }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    const contextBlocks = candidates.map((c:{id:string,content:string,source_title:string}, i:number) => `[${i+1}] 来源："${c.source_title}" (chunk_id: ${c.id})\n${c.content.slice(0,300)}`).join("\n\n");
    const system = `You are a personal knowledge retrieval assistant. Answer the user's query STRICTLY based on the provided knowledge chunks.\nRules:\n1. Only use information from the provided chunks — never hallucinate\n2. Cite sources inline as [1], [2], etc. matching the chunk numbers\n3. If chunks are insufficient, say so clearly\n4. Answer in the same language as the query (Chinese query → Chinese answer)\n5. Keep the answer under 200 words\n6. Return ONLY valid JSON: {"answer": "text with [1] citations", "used_chunks": [1, 2, 3]}`;
    const r = await fetch("https://api.enter.pro/code/api/v1/ai/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${AI_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3.1-flash-lite-preview", system, messages: [{ role: "user", content: `Query: ${query}\n\nKnowledge chunks:\n${contextBlocks}` }], stream: false, max_tokens: 600 }),
    });
    if (!r.ok) { const txt = await r.text(); let msg = `AI error (${r.status})`; try { msg = JSON.parse(txt).error?.message || msg; } catch(_e){} return new Response(JSON.stringify({ success: false, error: msg }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } }); }
    const data = await r.json();
    const rawText = (data.content?.[0]?.text || "").trim();
    let answer = rawText; let usedChunkIndices: number[] = [];
    try { const cleaned = rawText.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"").trim(); const m = cleaned.match(/\{[\s\S]*\}/); if (m) { const parsed = JSON.parse(m[0]); answer = parsed.answer || rawText; usedChunkIndices = (parsed.used_chunks||[]).map((n:number)=>n-1); } } catch(_e){}
    const usedSet = usedChunkIndices.length > 0 ? new Set(usedChunkIndices) : new Set(candidates.map((_:unknown,i:number)=>i));
    const citations = candidates.map((c:{id:string,note_id:string,source_title:string,content:string},i:number) => ({ id:i+1, chunk_id:c.id, note_id:c.note_id, note_title:c.source_title, excerpt:c.content.slice(0,150)+(c.content.length>150?"…":"") })).filter((_:unknown,i:number)=>usedSet.has(i)).slice(0,top_k);
    const { data: convo } = await db.from("rag_conversations").insert({ user_id, project_id: project_id||"default", query, answer, citations }).select("id").maybeSingle();
    return new Response(JSON.stringify({ success: true, answer, citations, conversation_id: convo?.id||null }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch(e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
