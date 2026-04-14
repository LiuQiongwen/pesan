const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const token = Deno.env.get("AI_API_TOKEN_2c7d5422f5cf");
    if (!token) throw new Error("AI token missing");

    const { level, noteTitle, noteContent, relatedNotes } = await req.json();
    // level 4: synthesize current + related; level 5: domain worldview

    let systemPrompt = "";
    let userMsg = "";

    if (level === 4) {
      systemPrompt = `You are a knowledge synthesis engine. Given a primary note and 2-4 related notes, produce a concise synthesis (~250 words) that:
- Identifies what these notes share at a conceptual level
- Highlights complementary insights across notes
- Notes any interesting tensions or contrasts
- Ends with 1-2 emergent principles that span all notes
Output as clean markdown with sections: ## Synthesis, ## Complementary Insights, ## Emergent Principles`;
      const related = (relatedNotes || []).map((n: {title:string,summary:string}) => `### ${n.title}\n${n.summary}`).join("\n\n");
      userMsg = `Primary note: ${noteTitle}\n\n${(noteContent||"").slice(0,800)}\n\nRelated notes:\n${related}`;
    } else {
      systemPrompt = `You are a domain-level knowledge synthesizer. Given several notes from the same knowledge domain, produce a concise (~200 word) worldview paragraph:
- What is the fundamental perspective these notes collectively represent?
- What is the underlying principle or mental model?
- What does mastery of this domain look like based on these notes?
Output as clean markdown with sections: ## Domain Worldview, ## Core Mental Model, ## Mastery Signal`;
      const related = (relatedNotes || []).map((n: {title:string,summary:string}) => `- ${n.title}: ${(n.summary||"").slice(0,100)}`).join("\n");
      userMsg = `Domain notes:\n- ${noteTitle}: ${(noteContent||"").slice(0,200)}\n${related}`;
    }

    const r = await fetch("https://api.enter.pro/code/api/v1/ai/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "anthropic/claude-sonnet-4.5", system: systemPrompt, messages: [{ role: "user", content: userMsg }], stream: false, max_tokens: 1000 }),
    });
    if (!r.ok) throw new Error("AI error");
    const data = await r.json();
    const markdown = data.content?.[0]?.text || "";
    return new Response(JSON.stringify({ success: true, markdown }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
