const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const token = Deno.env.get("AI_API_TOKEN_2c7d5422f5cf");
    if (!token) throw new Error("AI token missing");
    const { level, noteTitle, noteContent, relatedNotes } = await req.json();
    let systemPrompt = "";
    let userMsg = "";
    if (level === 4) {
      systemPrompt = `You are a knowledge synthesis engine. Given a primary note and 2-4 related notes, produce a concise synthesis (~250 words) that:\n- Identifies what these notes share at a conceptual level\n- Highlights complementary insights across notes\n- Notes any interesting tensions or contrasts\n- Ends with 1-2 emergent principles that span all notes\nOutput as clean markdown with sections: ## Synthesis, ## Complementary Insights, ## Emergent Principles`;
      const related = (relatedNotes || []).map((n:{title:string,summary:string}) => `### ${n.title}\n${n.summary}`).join("\n\n");
      userMsg = `Primary note: ${noteTitle}\n\n${(noteContent||"").slice(0,800)}\n\nRelated notes:\n${related}`;
    } else {
      systemPrompt = `You are a domain-level knowledge synthesizer. Given several notes from the same knowledge domain, produce a concise (~200 word) worldview paragraph:\n- What is the fundamental perspective these notes collectively represent?\n- What is the underlying principle or mental model?\n- What does mastery of this domain look like based on these notes?\nOutput as clean markdown with sections: ## Domain Worldview, ## Core Mental Model, ## Mastery Signal`;
      const related = (relatedNotes || []).map((n:{title:string,summary:string}) => `- ${n.title}: ${(n.summary||"").slice(0,100)}`).join("\n");
      userMsg = `Domain notes:\n- ${noteTitle}: ${(noteContent||"").slice(0,200)}\n${related}`;
    }
    const r = await fetch("https://api.enter.pro/code/api/v1/ai/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Expect": "" },
      body: JSON.stringify({ model: "google/gemini-3.1-flash-lite-preview", system: systemPrompt, messages: [{ role: "user", content: userMsg }], stream: false, max_tokens: 1000 }),
      signal: AbortSignal.timeout(25000),
    });
    if (!r.ok) { const txt = await r.text(); let msg = `AI error (${r.status})`; try { msg = JSON.parse(txt).error?.message || msg; } catch(_e){} return new Response(JSON.stringify({ success: false, error: msg }), { status: 200, headers: { ...cors, "Content-Type": "application/json", "Expect": "" } }); }
    const data = await r.json();
    return new Response(JSON.stringify({ success: true, markdown: data.content?.[0]?.text || "" }), { headers: { ...cors, "Content-Type": "application/json", "Expect": "" } });
  } catch(e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 200, headers: { ...cors, "Content-Type": "application/json", "Expect": "" } });
  }
});
