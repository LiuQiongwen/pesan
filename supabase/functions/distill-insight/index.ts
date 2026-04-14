const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISTILL_SYSTEM = `You are a knowledge distillation engine. Extract knowledge into 5 layers. Be brief — max 4 bullets per layer.

Output ONLY compact valid JSON:
{"title":"sharp title (40 chars max)","source_label":"Article","confidence":0.82,"key_insight":"single most valuable sentence (80 chars max)","tags":["tag1","tag2","tag3"],"facts_markdown":"- fact1\\n- fact2","opinions_markdown":"- view1\\n- view2","methods_markdown":"1. method","insights_markdown":"→ insight1\\n→ insight2","actions_markdown":"[ ] action1\\n[ ] action2"}

Rules: each markdown field max 4 items, each item max 60 chars. Output JSON only.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AI_API_TOKEN = Deno.env.get("AI_API_TOKEN_2c7d5422f5cf");
    if (!AI_API_TOKEN) throw new Error("AI_API_TOKEN is not configured");

    const { content } = await req.json();
    if (!content?.trim()) throw new Error("No content provided");

    // Hard limit: 2500 chars
    const truncated = content.slice(0, 2500);

    const response = await fetch("https://api.enter.pro/code/api/v1/ai/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4.5",
        system: DISTILL_SYSTEM,
        messages: [{ role: "user", content: `Distill:\n\n${truncated}` }],
        stream: false,
        max_tokens: 900,
      }),
    });

    if (!response.ok) {
      const txt = await response.text();
      let msg = "AI service error";
      try { msg = JSON.parse(txt).error?.message || msg; } catch (_e) { /* use default */ }
      throw new Error(msg);
    }

    const data = await response.json();
    const rawText = (data.content?.[0]?.text || "").trim();

    let result;
    try {
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON in response");
      result = JSON.parse(match[0]);
    } catch (_parseErr) {
      result = {
        title: "Distillation",
        source_label: "Unknown",
        confidence: 0.5,
        key_insight: rawText.slice(0, 100),
        tags: [],
        facts_markdown: rawText.slice(0, 200),
        opinions_markdown: "",
        methods_markdown: "",
        insights_markdown: "",
        actions_markdown: "",
      };
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
