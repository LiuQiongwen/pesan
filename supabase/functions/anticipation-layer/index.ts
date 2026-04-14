const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const token = Deno.env.get("AI_API_TOKEN_2c7d5422f5cf");
    if (!token) throw new Error("AI token missing");

    const { notes } = await req.json();
    if (!notes?.length) throw new Error("No notes provided");

    const noteList = (notes as {id:string,title:string,summary:string,tags:string[]}[])
      .slice(0, 30)
      .map(n => `ID:${n.id} | "${n.title}" [${(n.tags||[]).join(",")}] | ${(n.summary||"").slice(0,80)}`)
      .join("\n");

    const system = `You are a forward-looking knowledge analyst. Based on a person's knowledge base, generate anticipation items — things they should be thinking about that their current corpus doesn't address.

Generate 2-3 items of each type. For each item, include related_note_ids (array of note IDs from input that relate to this item).

Output strictly as JSON:
{
  "items": [
    {
      "item_type": "open_question",
      "content": "The specific question their knowledge raises but doesn't answer",
      "reasoning": "One sentence explaining why this gap exists",
      "confidence": "high",
      "related_note_ids": ["id1","id2"]
    },
    {
      "item_type": "predicted_need",
      "content": "Topic they will likely need to understand soon based on their trajectory",
      "reasoning": "...",
      "confidence": "medium",
      "related_note_ids": []
    },
    {
      "item_type": "emerging_tension",
      "content": "Two ideas in their corpus that are starting to contradict each other",
      "reasoning": "...",
      "confidence": "medium",
      "related_note_ids": ["id1","id3"]
    }
  ]
}

Be specific and insightful. Avoid generic advice. Output strictly valid JSON only.`;

    const r = await fetch("https://api.enter.pro/code/api/v1/ai/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "anthropic/claude-sonnet-4.5", system, messages: [{ role: "user", content: `Knowledge base (${notes.length} notes):\n\n${noteList}` }], stream: false, max_tokens: 1200 }),
    });
    if (!r.ok) throw new Error("AI error");
    const data = await r.json();
    const text = data.content?.[0]?.text || "{}";
    let result = { items: [] };
    try { const m = text.match(/\{[\s\S]*\}/); if (m) result = JSON.parse(m[0]); } catch (_e) { /* use empty */ }
    return new Response(JSON.stringify({ success: true, data: result }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
