const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const LENS_PERSONAS: Record<string, string> = {
  "Economics": "an economist focused on incentives, trade-offs, opportunity costs, and systemic efficiency",
  "Systems Theory": "a systems thinker focused on feedback loops, leverage points, emergence, and non-linear dynamics",
  "Psychology": "a cognitive psychologist focused on mental models, biases, behavior, and motivation",
  "Philosophy": "a philosopher focused on underlying assumptions, axioms, ethical implications, and epistemic validity",
  "Design": "a design thinker focused on user needs, constraints, tradeoffs, and the gap between intention and experience",
  "Devil's Advocate": "a rigorous skeptic who challenges every assumption, finds the weakest points, and steelmans the counterargument",
  "Steelman": "a synthesizer who constructs the strongest possible version of every argument and finds what's most defensible",
  "10-Year View": "a long-horizon thinker focused on which of these ideas will matter in 10 years and which are ephemeral",
  "First Principles": "a first-principles reasoner who strips away all assumptions and rebuilds the logic from the ground up",
  "Biology": "an evolutionary biologist focused on adaptation, selection pressures, resource competition, and systemic survival",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const token = Deno.env.get("AI_API_TOKEN_2c7d5422f5cf");
    if (!token) throw new Error("AI token missing");
    const { content, lens } = await req.json();
    if (!content || !lens) throw new Error("Missing content or lens");
    const persona = LENS_PERSONAS[lens] || `an expert in ${lens}`;
    const system = `You are ${persona}.\n\nAnalyze the provided content from your specific perspective. Your reframing should:\n1. Apply your lens's specific conceptual vocabulary and frameworks\n2. Surface what your perspective reveals that a neutral reading would miss\n3. Identify the 2-3 most interesting insights your lens generates\n4. Note what your lens considers a strength vs. a limitation of the ideas\n\nFormat as clean markdown:\n## ${lens} Reframing\n[Your analysis — 150-200 words, dense and precise]\n\n## Key Differences from Neutral Reading\n- [difference 1]\n- [difference 2]\n- [difference 3]\n\n## ${lens} Critique\n[One sharp critical observation — 2-3 sentences]`;
    const r = await fetch("https://api.enter.pro/code/api/v1/ai/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Expect": "" },
      body: JSON.stringify({ model: "google/gemini-3.1-flash-lite-preview", system, messages: [{ role: "user", content: `Reframe this content:\n\n${content.slice(0,2000)}` }], stream: false, max_tokens: 900 }),
      signal: AbortSignal.timeout(25000),
    });
    if (!r.ok) { const txt = await r.text(); let msg = `AI error (${r.status})`; try { msg = JSON.parse(txt).error?.message || msg; } catch(_e){} return new Response(JSON.stringify({ success: false, error: msg }), { status: 200, headers: { ...cors, "Content-Type": "application/json", "Expect": "" } }); }
    const data = await r.json();
    return new Response(JSON.stringify({ success: true, markdown: data.content?.[0]?.text || "" }), { headers: { ...cors, "Content-Type": "application/json", "Expect": "" } });
  } catch(e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 200, headers: { ...cors, "Content-Type": "application/json", "Expect": "" } });
  }
});
