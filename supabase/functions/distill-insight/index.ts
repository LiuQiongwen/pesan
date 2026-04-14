const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISTILL_SYSTEM = `You are a precision knowledge distillation engine — not a summarizer.

Extract and classify knowledge from raw input into exactly 5 structured layers.
Be concise and high-signal. Keep each layer brief (5-7 bullets max).

LAYER 1 — FACTS: Verifiable claims, data points, statistics. Format: dash bullet list.
LAYER 2 — VIEWPOINTS: Subjective claims, perspectives, contested assertions. Format: dash bullet list.
LAYER 3 — METHODS: Processes, frameworks, mental models. Format: numbered list. If none: "No explicit methods identified."
LAYER 4 — INSIGHTS: Non-obvious patterns, hidden implications, emergent truths. Format: bullet list prefixed with →
LAYER 5 — NEXT ACTIONS: Concrete executable next steps. Format: numbered list with [ ] prefix.

OUTPUT: Strictly valid JSON only. No preamble. No markdown outside values.

{
  "title": "Sharp title (max 60 chars)",
  "source_label": "Article",
  "confidence": 0.82,
  "key_insight": "Single most valuable sentence",
  "tags": ["tag1", "tag2", "tag3"],
  "facts_markdown": "- fact 1\n- fact 2",
  "opinions_markdown": "- viewpoint 1\n- viewpoint 2",
  "methods_markdown": "1. Method — description",
  "insights_markdown": "→ insight 1\n→ insight 2",
  "actions_markdown": "[ ] action 1\n[ ] action 2"
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AI_API_TOKEN = Deno.env.get("AI_API_TOKEN_2c7d5422f5cf");
    if (!AI_API_TOKEN) throw new Error("AI_API_TOKEN is not configured");

    const { content } = await req.json();
    if (!content?.trim()) throw new Error("No content provided");

    const truncated = content.slice(0, 5000); // Reduced from 12000

    const response = await fetch("https://api.enter.pro/code/api/v1/ai/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4.5",
        system: DISTILL_SYSTEM,
        messages: [{ role: "user", content: `Distill the following content:\n\n${truncated}` }],
        stream: false,
        max_tokens: 1500, // Reduced from 4000
      }),
    });

    if (!response.ok) {
      const txt = await response.text();
      let msg = "AI service error";
      try { msg = JSON.parse(txt).error?.message || msg; } catch (_e) { /* use default */ }
      throw new Error(msg);
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || "";

    let result;
    try {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON in response");
      result = JSON.parse(match[0]);
    } catch (_parseErr) {
      result = {
        title: "Distillation",
        source_label: "Unknown",
        confidence: 0.5,
        key_insight: rawText.slice(0, 200),
        tags: [],
        facts_markdown: rawText,
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
