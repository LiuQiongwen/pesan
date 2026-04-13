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

    const systemPrompt = `你是一位资深知识策展人，擅长将复杂信息转化为清晰、有深度、易于阅读的知识内容。你的写作风格：逻辑严密、重点突出、语言精炼，读者读完后能立刻抓住核心并形成自己的见解。

输出要求——以"读者体验"为第一优先级：
1. **核心摘要**：用2-3句话写一段流畅的叙述性摘要，不堆砌要点，让读者一眼看懂"这讲的是什么、为什么重要"
2. **关键要点**：每条要点包含一个简明标题（5-10字）和一段说明（1-2句解释其重要性和含义）
3. **主要观点**：每条观点用一句话表达核心立场，再加一句解释支撑理由
4. **批判性分析**：分三个维度——亮点（内容的真正价值）、局限（需要注意的不足或偏差）、延伸问题（值得进一步思考的问题）
5. **创新洞见**：每条洞见要有独特的切入角度，附一句"为什么这个角度有价值"的说明
6. **知识关联**：说明与哪个领域/概念有联系，以及这种联系的意义是什么
7. **完整报告（Markdown）**：写成一篇结构清晰的分析文章，有引言、各节清晰的H2标题、过渡语句，结尾有总结与思考。使用**加粗**突出核心概念，使用> 引用块标注重要论断，语言流畅自然、不罗列堆砌。

严格以合法 JSON 格式输出，不要有任何额外文字：
{
  "title": "内容标题（精炼，40字以内）",
  "summary": "叙述性核心摘要，2-3句话，流畅可读，说明主题和核心价值",
  "key_points": [
    { "title": "要点标题", "detail": "解释这条要点的含义及其重要性，1-2句话" }
  ],
  "analysis_content": {
    "main_viewpoints": [
      { "claim": "核心观点一句话", "support": "支撑这一观点的理由或证据" }
    ],
    "critical_analysis": {
      "strengths": ["这份内容真正有价值的地方是..."],
      "limitations": ["需要注意的局限或偏差是..."],
      "key_questions": ["值得进一步探究的问题是..."]
    },
    "innovative_insights": [
      { "insight": "洞见标题", "value": "为什么这个角度有价值的解释" }
    ],
    "knowledge_connections": [
      { "domain": "相关领域或概念", "connection": "与本内容的关联及意义" }
    ]
  },
  "tags": ["标签1", "标签2", "标签3"],
  "mindmap_data": {
    "root": "主题名称",
    "nodes": [
      {
        "id": "1",
        "label": "一级主题",
        "children": [
          { "id": "1-1", "label": "子概念", "children": [] },
          { "id": "1-2", "label": "子概念", "children": [] }
        ]
      }
    ]
  },
  "content_markdown": "完整分析报告——Markdown格式，写成可读性强的分析文章，有引言段落、清晰H2章节、过渡句、结尾总结。重点用**加粗**，重要论断用>引用块，语言流畅不堆砌"
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
        max_tokens: 5000,
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

    let analysisResult;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (_parseErr) {
      analysisResult = {
        title: "分析结果",
        summary: rawText.slice(0, 200),
        key_points: [{ title: "完整内容", detail: "请查看完整报告" }],
        analysis_content: {
          main_viewpoints: [],
          critical_analysis: { strengths: [], limitations: [], key_questions: [] },
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
