const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const token = Deno.env.get("AI_API_TOKEN_2c7d5422f5cf");
    if (!token) throw new Error("AI token missing");

    const { currentNote, candidates } = await req.json();
    if (!candidates?.length) return new Response(JSON.stringify({ success: true, related: [] }), { headers: { ...cors, "Content-Type": "application/json" } });

    const candidateList = (candidates as {id:string,title:string,summary:string,tags:string[]}[])
      .slice(0, 20)
      .map(n => `ID:${n.id} | ${n.title} | tags:[${(n.tags||[]).join(",")}] | ${(n.summary||"").slice(0,80)}`)
      .join("\n");

    const system = `You are a semantic memory engine. Given a current note and a list of older notes, identify the 2-3 most conceptually relevant older notes.

For each related note provide:
- id (exact match from input)
- reason: one sentence explaining why (focus on conceptual bridge)
- relevance: "high" | "medium" | "low"

Output strictly as JSON array: [{"id":"...","reason":"...","relevance":"high"}]
If nothing is genuinely relevant, return [].`;

    const userMsg = `Current note: "${currentNote.title}"\nSummary: ${(currentNote.summary||"").slice(0,200)}\nTags: [${(currentNote.tags||[]).join(",")}]\n\nOlder notes:\n${candidateList}`;

    const r = await fetch("https://api.enter.pro/code/api/v1/ai/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3.1-flash-lite-preview", system, messages: [{ role: "user", content: userMsg }], stream: false, max_tokens: 500 }),
    });
    if (!r.ok) {
      const txt = await r.text();
      let msg = `AI error (${r.status})`;
      try { msg = JSON.parse(txt).error?.message || msg; } catch (_e) { /* ignore */ }
      return new Response(JSON.stringify({ success: false, error: msg }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const data = await r.json();
    const text = data.content?.[0]?.text || "[]";
    let related = [];
    try { const m = text.match(/\[[\s\S]*\]/); if (m) related = JSON.parse(m[0]); } catch (_e) { /* use empty */ }
    return new Response(JSON.stringify({ success: true, related }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
