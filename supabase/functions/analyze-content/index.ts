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
    if (!AI_API_TOKEN) {
      throw new Error("AI_API_TOKEN is not configured");
    }

    const { sourceType, content, sourceUrl } = await req.json();

    // Build context based on source type
    let inputContext = "";
    if (sourceType === "url") {
      // Try to fetch URL content
      try {
        const urlResponse = await fetch(sourceUrl || content, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; KnowledgeBot/1.0)" },
          signal: AbortSignal.timeout(15000),
        });
        const html = await urlResponse.text();
        // Simple HTML text extraction
        const text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 8000);
        inputContext = `来源网址: ${sourceUrl || content}\n\n网页内容:\n${text}`;
      } catch {
        inputContext = `来源网址: ${sourceUrl || content}\n\n注意：无法直接抓取网页内容，请基于URL本身进行分析。`;
      }
    } else if (sourceType === "image") {
      inputContext = `图片内容分析请求。图片数据（base64）已提供。\n\n请分析图片中的文字、图表、信息内容。\n\n${content?.slice(0, 100)}...`;
    } else {
      inputContext = content;
    }

    const systemPrompt = `你是一位深度知识分析专家，擅长从各种信息来源提炼有价值的知识洞见。你需要对用户提供的内容进行全面深度分析，并以严格的 JSON 格式输出。

分析框架：
1. 核心摘要：提炼最重要的核心信息（150字以内）
2. 关键要点：5-8个最重要的信息点
3. 主要观点：作者/内容的核心主张（3-5条）
4. 批判性分析：对内容的客观评估，包括优点、局限性、潜在问题
5. 创新洞见：从内容中提炼的新颖见解或延伸思考（3-5条）
6. 知识关联：与其他领域/概念的联系（3-5条）
7. 标签分类：3-6个关键词标签
8. 思维导图：层级结构，根节点为主题，展开2-3层关键概念

必须以合法的 JSON 格式输出，不要有任何其他文字，格式如下：
{
  "title": "内容标题（50字以内）",
  "summary": "核心摘要（150字以内）",
  "key_points": ["要点1", "要点2", ...],
  "analysis_content": {
    "main_viewpoints": ["观点1", "观点2", ...],
    "critical_analysis": "批判性分析文本",
    "innovative_insights": ["洞见1", "洞见2", ...],
    "knowledge_connections": ["关联1", "关联2", ...]
  },
  "tags": ["标签1", "标签2", ...],
  "mindmap_data": {
    "root": "主题名称",
    "nodes": [
      {
        "id": "1",
        "label": "一级节点",
        "children": [
          {"id": "1-1", "label": "二级节点", "children": []},
          {"id": "1-2", "label": "二级节点", "children": []}
        ]
      }
    ]
  },
  "content_markdown": "完整的 Markdown 格式分析报告，包含所有分析内容，使用标题、列表等 Markdown 格式"
}`;

    const messages = [
      {
        role: "user",
        content: `请深度分析以下内容：\n\n${inputContext}`,
      },
    ];

    const response = await fetch("https://api.enter.pro/code/api/v1/ai/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4.5",
        system: systemPrompt,
        messages,
        stream: false,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = "AI service error";
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorMessage;
      } catch (_parseErr) {
        // Use default error message
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || "";

    // Parse the JSON from the response
    let analysisResult;
    try {
      // Try to extract JSON from the response
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch {
      // Fallback: create basic structure
      analysisResult = {
        title: "分析结果",
        summary: rawText.slice(0, 200),
        key_points: ["请查看完整报告"],
        analysis_content: {
          main_viewpoints: [],
          critical_analysis: "",
          innovative_insights: [],
          knowledge_connections: [],
        },
        tags: [],
        mindmap_data: { root: "主题", nodes: [] },
        content_markdown: rawText,
      };
    }

    return new Response(JSON.stringify({ success: true, data: analysisResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
