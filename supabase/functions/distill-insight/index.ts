const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISTILL_SYSTEM = `You are a precision knowledge distillation engine — not a summarizer.

Your task: extract and classify knowledge from raw input into exactly 5 structured layers.
Each layer must be concise, high-signal, and analytically precise.
Avoid padding, filler, and restatements. Every bullet should carry weight.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYER 1 — FACTS
Extract verifiable claims, data points, statistics, named entities, and established information.
No interpretations. Only what is stated or strongly implied as factual.
Format: bullet list, each starting with a dash.

LAYER 2 — VIEWPOINTS
Extract subjective claims, perspectives, arguments, and contested assertions.
Where multiple sides exist, note the contrast. Flag speculative claims with [?].
Format: bullet list.

LAYER 3 — METHODS / FRAMEWORKS
Extract processes, techniques, frameworks, mental models, or structured approaches described or implied.
If none exist, note "No explicit methods identified."
Format: numbered list with short descriptions.

LAYER 4 — INSIGHTS
This is the most critical layer. Identify non-obvious patterns, underlying principles, hidden implications, and emergent truths not explicitly stated in the text.
Ask: what does this reveal that isn't said directly?
Format: bullet list, each insight prefixed with →

LAYER 5 — NEXT ACTIONS
Extract concrete, executable next steps a reader could take. Prioritize specificity over generality.
Format: numbered checklist with [ ] prefix.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADDITIONAL FIELDS:
- title: A sharp, precise title (max 60 chars). No fluff.
- key_insight: The single most valuable sentence from all 5 layers. This should be the one sentence worth remembering.
- confidence: 0.0–1.0 score reflecting quality of the source material and reliability of this distillation.
- source_label: Brief content-type label. One of: Research Paper · Article · Transcript · Personal Note · Technical Doc · Interview · Book Excerpt · Code · Other
- tags: 3–5 keyword tags for this content (lowercase, no spaces).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT: Strictly valid JSON. No markdown outside the values. No preamble.

{
  "title": "...",
  "source_label": "...",
  "confidence": 0.82,
  "key_insight": "...",
  "tags": ["tag1", "tag2", "tag3"],
  "facts_markdown": "- fact 1\\n- fact 2",
  "opinions_markdown": "- viewpoint 1\\n- viewpoint 2",
  "methods_markdown": "1. Method name — brief description\\n2. ...",
  "insights_markdown": "→ insight 1\\n→ insight 2",
  "actions_markdown": "[ ] action 1\\n[ ] action 2"
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

    const truncated = content.slice(0, 12000);

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
        max_tokens: 4000,
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
