const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const token = Deno.env.get("AI_API_TOKEN_2c7d5422f5cf");
    if (!token) throw new Error("AI token missing");
    const { notes } = await req.json();
    if (!notes?.length) throw new Error("No notes provided");
    const noteList = (notes as {title:string,tags:string[]}[]).slice(0,15).map(n=>`- "${n.title.slice(0,50)}" [${(n.tags||[]).slice(0,3).join(",")}]`).join("\n");
    const system = `You are a cognitive analysis engine. Analyze note titles/tags to identify HOW this person thinks.
Output ONLY valid compact JSON:
{"dominant_themes":[{"theme":"name","weight":0.8,"note_count":5}],"blind_spots":["gap1","gap2"],"bias_signatures":["bias1"],"thinking_style":"2 sentence max","intellectual_diet":{"articles":40,"personal":30,"research":20,"technical":10},"stagnation_alerts":["area1"],"report_markdown":"60-word max portrait"}
Rules: dominant_themes max 3. blind_spots max 2. bias_signatures max 2. stagnation_alerts max 1. Output JSON only.`;
    const r = await fetch("https://api.enter.pro/code/api/v1/ai/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Expect": "" },
      body: JSON.stringify({ model: "google/gemini-3.1-flash-lite-preview", system, messages: [{ role: "user", content: `${notes.length} notes:\n${noteList}` }], stream: false, max_tokens: 700 }),
      signal: AbortSignal.timeout(25000),
    });
    if (!r.ok) { const txt = await r.text(); let msg = `AI error (${r.status})`; try { msg = JSON.parse(txt).error?.message || msg; } catch(_e){} return new Response(JSON.stringify({ success: false, error: msg }), { status: 200, headers: { ...cors, "Content-Type": "application/json", "Expect": "" } }); }
    const data = await r.json();
    const text = (data.content?.[0]?.text || "{}").trim();
    let result = {};
    try { const cleaned = text.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"").trim(); const m = cleaned.match(/\{[\s\S]*\}/); if (m) result = JSON.parse(m[0]); } catch(_e){}
    return new Response(JSON.stringify({ success: true, data: result }), { headers: { ...cors, "Content-Type": "application/json", "Expect": "" } });
  } catch(e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 200, headers: { ...cors, "Content-Type": "application/json", "Expect": "" } });
  }
});
