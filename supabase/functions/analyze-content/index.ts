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

    const { sourceType, content, sourceUrl } = await req.json();

    // ── Extract raw text (hard limit: 2000 chars) ─────────────────────────
    let rawContent = "";
    if (sourceType === "url") {
      try {
        const urlResponse = await fetch(sourceUrl || content, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; KnowledgeBot/1.0)" },
          signal: AbortSignal.timeout(15000),
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

    // ── Single compact system prompt ─────────────────────────────────────
    const systemPrompt = `你是知识分析助手。严格按以下 JSON 格式输出，每个 markdown 字段严格控制在 200 字以内，不得超出：

{
  "title": "标题（20字以内）",
  "summary": "一句话概括（50字以内）",
  "tags": ["标签1", "标签2", "标签3"],
  "summary_markdown": "## 核心观点\\n要点1\\n要点2\\n## 一句话总结\\n总结",
  "analysis_markdown": "## 核心逻辑\\n分析\\n## 深层洞见\\n洞见\\n## 行动启发\\n启发",
  "report_markdown": "# 报告\\n## 背景\\n内容\\n## 关键发现\\n发现\\n## 结论\\n结论",
  "mindmap_markdown": "# 主题\\n- 一级A\\n  - 二级A1\\n  - 二级A2\\n- 一级B\\n  - 二级B1",
  "mindmap_data": {"root": "主题", "nodes": [{"id": "1", "label": "一级主题", "children": [{"id": "1-1", "label": "子主题", "children": []}]}]}
}

关键要求：
1. 每个 markdown 字段严格 200 字以内
2. 输出合法 JSON，不加任何其他文字
3. markdown 中换行用 \\n
4. mindmap_data 的 nodes 最多 3 个一级节点，每个最多 2 个子节点`;

    const response = await fetch("https://api.enter.pro/code/api/v1/ai/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4.5",
        system: systemPrompt,
        messages: [{ role: "user", content: `分析以下内容：\n\n${rawContent}` }],
        stream: false,
        max_tokens: 1800,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = "AI service error";
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorMessage;
      } catch (_parseErr) { /* use default */ }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const rawText = (data.content?.[0]?.text || "").trim();

    let analysisResult;
    try {
      // Strip markdown code fences if present
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found");
      }
    } catch (_parseErr) {
      analysisResult = {
        title: "分析结果",
        summary: rawText.slice(0, 80),
        tags: [],
        summary_markdown: rawText.slice(0, 300),
        analysis_markdown: "",
        report_markdown: "",
        mindmap_markdown: "",
        mindmap_data: { root: "主题", nodes: [] },
      };
    }

    // Backward compatibility
    analysisResult.content_markdown = analysisResult.report_markdown || analysisResult.content_markdown || "";

    return new Response(JSON.stringify({ success: true, data: analysisResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
