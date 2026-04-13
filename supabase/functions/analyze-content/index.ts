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

    let inputContext = "";
    if (sourceType === "url") {
      try {
        const urlResponse = await fetch(sourceUrl || content, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; KnowledgeBot/1.0)" },
          signal: AbortSignal.timeout(15000),
        });
        const html = await urlResponse.text();
        const text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 8000);
        inputContext = `来源网址: ${sourceUrl || content}\n\n网页内容:\n${text}`;
      } catch (_e) {
        inputContext = `来源网址: ${sourceUrl || content}\n\n注意：无法直接抓取网页内容，请基于URL本身进行分析。`;
      }
    } else if (sourceType === "image") {
      inputContext = `图片内容分析请求。\n\n${content?.slice(0, 100)}...`;
    } else {
      inputContext = content;
    }

    const systemPrompt = `你是一位资深知识策展人与深度思考者，擅长将复杂信息提炼为逻辑清晰、观点深刻、可读性强的知识文档。

你的输出是一个 JSON 对象，其中 content_markdown 字段包含完整的 Markdown 格式知识报告。报告必须覆盖以下 7 个章节，每个章节有清晰的 H2 标题：

【content_markdown 文档结构要求】

## 核心摘要
2-3 句流畅叙述，交代"这是什么 + 为什么值得读 + 核心价值所在"。语言要有温度，不是干燥的定义。

## 关键要点
5-8 条，每条格式：
**要点标题（5-10字）**：1-2 句说明这条要点的含义与重要性，用读者视角解释"所以呢？这意味着什么？"

## 深度分析

### 主要观点
每条格式：
> **核心论断**
> 支撑理由：为什么这个观点成立，有哪些逻辑依据或实证支持。

### 批判性审视
**✦ 真正有价值的地方**
- 列出 2-3 条内容的核心亮点与贡献

**⚠ 需要注意的局限**
- 列出 2-3 条偏差、过度简化或缺失的视角

**? 值得深究的问题**
- 列出 2-3 条读完后应该继续追问的问题

## 创新洞见与发散思考
这是报告的精华。提炼 3-5 条独特视角，不要复述内容，要给出"换个角度看，这意味着……"的洞察。每条洞见后补充 1-2 句发散延伸：如果把这个洞见推向极致，或者与另一个领域结合，会产生什么新的可能？

## 知识关联图谱
3-5 条，格式：
**[相关领域/概念]** → 关联说明：这个概念与本内容的联系是什么，能产生怎样的交叉理解？

## 综合结论与行动建议
整合以上所有分析，给出 1 段概括性结论（100字左右），提炼本内容对知识体系的贡献。然后给出 2-3 条具体的"下一步"建议：读了这个之后，可以做什么、读什么、思考什么。

---

【格式规范】
- 重要概念用 **加粗**
- 关键论断用 > 引用块
- 逻辑列表用 - 无序列表
- 各章节间有 1 行空行分隔
- 语言流畅自然，不堆砌，不官腔

【JSON 输出格式】严格输出合法 JSON，不要有任何额外文字：
{
  "title": "精炼标题（40字以内）",
  "summary": "一句话概括，作为卡片预览用",
  "tags": ["标签1", "标签2", "标签3", "标签4"],
  "mindmap_data": {
    "root": "主题名称",
    "nodes": [
      {
        "id": "1",
        "label": "核心要点",
        "children": [
          { "id": "1-1", "label": "子概念", "children": [] }
        ]
      }
    ]
  },
  "content_markdown": "（完整的 Markdown 报告，包含上述全部 6 个章节，使用 \\n 换行）"
}`;

    const messages = [
      { role: "user", content: `请深度分析以下内容：\n\n${inputContext}` },
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
        max_tokens: 6000,
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
    const rawText = data.content?.[0]?.text || "";

    let analysisResult;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found");
      }
    } catch (_parseErr) {
      analysisResult = {
        title: "分析结果",
        summary: rawText.slice(0, 100),
        tags: [],
        mindmap_data: { root: "主题", nodes: [] },
        content_markdown: rawText,
      };
    }

    // Ensure content_markdown exists and is a string
    if (!analysisResult.content_markdown || typeof analysisResult.content_markdown !== "string") {
      analysisResult.content_markdown = `# ${analysisResult.title}\n\n${analysisResult.summary}`;
    }

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
