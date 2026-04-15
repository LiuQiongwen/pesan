const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const token = Deno.env.get("AI_API_TOKEN_2c7d5422f5cf");
    if (!token) throw new Error("AI token missing");
    const { notes } = await req.json();
    if (!notes?.length) throw new Error("No notes provided");
    const noteList = (notes as {id:string,title:string,tags:string[]}[]).slice(0,12).map(n=>`${n.id.slice(0,8)}|"${n.title.slice(0,40)}"[${(n.tags||[]).slice(0,2).join(",")}]`).join("\n");
    const system = `You are a forward-looking knowledge analyst. Based on note titles/tags, generate 2 items of each type.
Output ONLY compact valid JSON:
{"items":[{"item_type":"open_question","content":"question (50 chars max)","reasoning":"why (30 chars max)","confidence":"high","related_note_ids":["id1"]},{"item_type":"predicted_need","content":"topic (50 chars max)","reasoning":"why (30 chars max)","confidence":"medium","related_note_ids":[]},{"item_type":"emerging_tension","content":"tension (50 chars max)","reasoning":"why (30 chars max)","confidence":"medium","related_note_ids":["id1"]}]}
Use the first 8 chars of note IDs. Max 2 items per type (6 total). Output JSON only.`;
    const r = await fetch("https://api.enter.pro/code/api/v1/ai/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Expect": "" },
      body: JSON.stringify({ model: "google/gemini-3.1-flash-lite-preview", system, messages: [{ role: "user", content: `${notes.length} notes:\n${noteList}` }], stream: false, max_tokens: 700 }),
      signal: AbortSignal.timeout(25000),
    });
    if (!r.ok) { const txt = await r.text(); let msg = `AI error (${r.status})`; try { msg = JSON.parse(txt).error?.message || msg; } catch(_e){} return new Response(JSON.stringify({ success: false, error: msg }), { status: 200, headers: { ...cors, "Content-Type": "application/json", "Expect": "" } }); }
    const data = await r.json();
    const text = (data.content?.[0]?.text || "{}").trim();
    let result = { items: [] };
    try { const cleaned = text.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"").trim(); const m = cleaned.match(/\{[\s\S]*\}/); if (m) result = JSON.parse(m[0]); } catch(_e){}
    return new Response(JSON.stringify({ success: true, data: result }), { headers: { ...cors, "Content-Type": "application/json", "Expect": "" } });
  } catch(e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 200, headers: { ...cors, "Content-Type": "application/json", "Expect": "" } });
  }
});
