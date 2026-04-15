const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") { return new Response(null, { headers: corsHeaders }); }
  try {
    const AI_API_TOKEN = Deno.env.get("AI_API_TOKEN_2c7d5422f5cf");
    if (!AI_API_TOKEN) throw new Error("AI_API_TOKEN is not configured");

    const { content, convert_type } = await req.json();
    if (!content?.trim()) throw new Error("内容不能为空");

    const prompts: Record<string, string> = {
      task:     "将以下内容拆解为具体可执行的任务列表。每个任务格式：[ ] 任务描述（动词开头，20字以内）。输出3-7个任务，每行一个。",
      outline:  "将以下内容提炼为结构化提纲。使用 # ## ### 标题层级，简洁清晰。不超过300字。",
      question: "根据以下内容生成深度追问问题，帮助更深入理解。输出5-8个问题，每行一个，以「？」结尾。",
      material: "将以下内容转化为写作素材。提炼可引用的金句、案例、数据点。每条以 · 开头。",
      action:   "将以下内容转化为清晰的行动步骤。格式：Step N: 动作描述。输出3-6步，简洁可执行。",
    };

    const response = await fetch("https://api.enter.pro/code/api/v1/ai/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_API_TOKEN}`,
        "Content-Type": "application/json",
        "Expect": "",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-lite-preview",
        messages: [{ role: "user", content: `${prompts[convert_type] || prompts.task}\n\n---\n\n${content.slice(0, 2000)}` }],
        stream: false,
        max_tokens: 600,
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
    return new Response(JSON.stringify({ success: true, result: (data.content?.[0]?.text || "").trim() }), { headers: { ...corsHeaders, "Content-Type": "application/json", "Expect": "" } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "Expect": "" } });
  }
});
