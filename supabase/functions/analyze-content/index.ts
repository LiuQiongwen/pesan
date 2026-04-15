const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AI_API_TOKEN = Deno.env.get("AI_API_TOKEN_2c7d5422f5cf");
    if (!AI_API_TOKEN) throw new Error("AI_API_TOKEN is not configured");

    const body = await req.json();
    const sourceType = body.sourceType || body.source_type || "text";
    const content    = body.content    || body.text        || "";
    const sourceUrl  = body.sourceUrl  || body.url         || "";

    let rawContent = "";
    if (sourceType === "url") {
      try {
        const urlResponse = await fetch(sourceUrl || content, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; KnowledgeBot/1.0)" },
          signal: AbortSignal.timeout(10000),
        });
        const html = await urlResponse.text();
        rawContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 2000);
        rawContent = `来源: ${sourceUrl || content}\n\n${rawContent}`;
      } catch (_e) {
        rawContent = `来源: ${sourceUrl || content}\n\n注意：无法直接抓取网页内容。`;
      }
    } else {
      rawContent = (content || "").slice(0, 2000);
    }

    if (!rawContent.trim()) throw new Error("内容不能为空");

    const systemPrompt = `你是知识分析助手。严格按以下 JSON 格式输出，不加任何其他文字：

{"title":"标题（20字以内）","summary":"一句话概括（50字以内）","tags":["标签1","标签2","标签3"],"summary_markdown":"核心要点（100字以内）","analysis_markdown":"核心逻辑与洞见（150字以内）","report_markdown":"背景与结论（150字以内）","mindmap_markdown":"# 主题\\n- 一级A\\n  - 二级A1\\n- 一级B","mindmap_data":{"root":"主题","nodes":[{"id":"1","label":"一级主题","children":[]}]}}

规则：输出合法JSON，不加任何其他文字，markdown换行用\\n`;

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
        messages: [{ role: "user", content: `分析以下内容：\n\n${rawContent}` }],
        stream: false,
        max_tokens: 1500,
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `AI service error (${response.status})`;
      try { const errorData = JSON.parse(errorText); errorMessage = errorData.error?.message || errorMessage; } catch (_e) {}
      return new Response(JSON.stringify({ success: false, error: errorMessage }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "Expect": "" } });
    }

    const data = await response.json();
    const rawText = (data.content?.[0]?.text || "").trim();

    let analysisResult;
    try {
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) { analysisResult = JSON.parse(jsonMatch[0]); } else { throw new Error("No JSON found"); }
    } catch (_parseErr) {
      analysisResult = { title: "分析结果", summary: rawText.slice(0, 80), tags: [], summary_markdown: rawText.slice(0, 300), analysis_markdown: "", report_markdown: "", mindmap_markdown: "", mindmap_data: { root: "主题", nodes: [] } };
    }

    analysisResult.content_markdown = analysisResult.report_markdown || analysisResult.content_markdown || "";

    return new Response(JSON.stringify({ success: true, data: analysisResult }), { headers: { ...corsHeaders, "Content-Type": "application/json", "Expect": "" } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "Expect": "" } });
  }
});
