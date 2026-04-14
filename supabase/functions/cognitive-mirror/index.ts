const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const token = Deno.env.get("AI_API_TOKEN_2c7d5422f5cf");
    if (!token) throw new Error("AI token missing");

    const { notes } = await req.json();
    if (!notes?.length) throw new Error("No notes provided");

    const noteList = (notes as {title:string,tags:string[],created_at:string}[])
      .slice(0, 40)
      .map(n => `- "${n.title}" [${(n.tags||[]).join(",")}]`)
      .join("\n");

    const system = `You are a cognitive analysis engine performing a meta-analysis of a person's knowledge base.
Analyze the titles and tags of their notes to identify patterns in HOW they think — not just what they know.

Produce a JSON object with these fields:
{
  "dominant_themes": [{"theme":"...","weight":0.8,"note_count":12}], // top 4 themes, weight 0-1
  "blind_spots": ["topic or domain the user conspicuously avoids given their interests"],  // 2-3 items
  "bias_signatures": ["pattern suggesting a cognitive bias, stated precisely"], // 1-3 items  
  "thinking_style": "1-2 sentence description of their apparent reasoning style (inductive/deductive, systems/reductionist, etc.)",
  "intellectual_diet": {"articles":40,"personal":30,"research":20,"technical":10}, // estimated % breakdown
  "stagnation_alerts": ["knowledge area that appears to have stopped growing"], // 0-2 items
  "report_markdown": "A 150-word analytical portrait of this person's mind based on their notes. Technical, precise, not flattering."
}

Output strictly as valid JSON only.`;

    const r = await fetch("https://api.enter.pro/code/api/v1/ai/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "anthropic/claude-sonnet-4.5", system, messages: [{ role: "user", content: `Analyze this knowledge base (${notes.length} notes):\n\n${noteList}` }], stream: false, max_tokens: 1200 }),
    });
    if (!r.ok) throw new Error("AI error");
    const data = await r.json();
    const text = data.content?.[0]?.text || "{}";
    let result = {};
    try { const m = text.match(/\{[\s\S]*\}/); if (m) result = JSON.parse(m[0]); } catch (_e) { /* use empty */ }
    return new Response(JSON.stringify({ success: true, data: result }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
