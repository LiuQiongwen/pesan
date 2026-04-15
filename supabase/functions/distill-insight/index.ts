const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") { return new Response(null, { headers: corsHeaders }); }
  try {
    const AI_API_TOKEN = Deno.env.get("AI_API_TOKEN_2c7d5422f5cf");
    if (!AI_API_TOKEN) throw new Error("AI_API_TOKEN is not configured");

    const body = await req.json();
    const content = body.content || "";
    const title   = body.title   || "";
    const mode    = body.mode    || "summary";

    if (!content?.trim()) throw new Error("No content provided");

    const modePrompts: Record<string, string> = {
      summary:    "提炼核心观点，简明扼要",
      research:   "深度分析拆解，识别假设与论据",
      writing:    "转化为写作素材，提炼可引用内容",
      reflection: "从个人角度提炼意义与启示",
    };

    const systemPrompt = `你是知识洞察引擎。模式：${modePrompts[mode] || modePrompts.summary}。

严格输出以下 JSON 格式，不加任何其他文字：
{"success":true,"summary":"核心摘要（60字以内）","key_points":["要点1","要点2","要点3"],"insights":["洞见1","洞见2"],"actionables":["下一步行动1","下一步行动2"]}

规则：key_points 3-5条每条40字以内，insights 2-3条每条50字以内，actionables 1-3条每条40字以内，输出合法JSON不加任何其他文字`;

    const response = await fetch("https://api.enter.pro/code/api/v1/ai/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_API_TOKEN}`,
        "Content-Type": "application/json",
        "Expect": "",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-lite-preview",
        system: systemPrompt,
        messages: [{ role: "user", content: `标题：${title}\n\n内容：${content.slice(0, 3000)}` }],
        stream: false,
        max_tokens: 800,
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!response.ok) {
      const txt = await response.text();
      let msg = `AI error (${response.status})`;
      try { msg = JSON.parse(txt).error?.message || msg; } catch (_e) {}
      return new Response(JSON.stringify({ success: false, error: msg }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "Expect": "" } });
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
      result = { success: true, summary: rawText.slice(0, 100), key_points: [rawText.slice(0, 60)], insights: [], actionables: [] };
    }
    result.success = true;

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json", "Expect": "" } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "Expect": "" } });
  }
});
