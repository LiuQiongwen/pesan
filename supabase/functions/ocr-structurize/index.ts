
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

    const { raw_text } = await req.json();
    if (!raw_text || raw_text.trim().length < 5) {
      throw new Error("OCR 文本过短，无法结构化");
    }

    const cleanedText = raw_text.trim().slice(0, 4000);

    const systemPrompt = `你是知识结构化助手。用户给你一段 OCR 识别的原始文字（可能来自白板、手写笔记、打印资料、文档截图）。

你的任务：
1. 先清洗文本（修正明显的 OCR 错误、去除乱码）
2. 从中提取结构化候选知识节点，分为三类：
   - topic: 主题节点（核心话题/概念，通常 1-2 个）
   - keypoint: 要点节点（关键论点/事实/要点，通常 2-5 个）
   - action: 行动节点（待办/行动项/下一步，0-3 个，没有就不输出）

严格按以下 JSON 格式输出，不加任何其他文字：
{
  "candidates": [
    { "type": "topic", "title": "标题(15字以内)", "summary": "一句话说明(50字以内)", "tags": ["标签1","标签2"] },
    { "type": "keypoint", "title": "标题", "summary": "摘要", "tags": ["标签"] },
    { "type": "action", "title": "待办标题", "summary": "具体描述", "tags": ["标签"] }
  ],
  "raw_cleaned": "清洗后的完整文本"
}

规则：
- candidates 至少 1 个，最多 8 个
- 每个 tags 最多 3 个
- raw_cleaned 是修正 OCR 错误后的干净全文
- 输出合法 JSON，不加任何其他文字`;

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
        messages: [{ role: "user", content: `以下是 OCR 识别的原始文字，请结构化：\n\n${cleanedText}` }],
        stream: false,
        max_tokens: 2000,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `AI service error (${response.status})`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorMessage;
      } catch (_e) { /* ignore */ }
      return new Response(JSON.stringify({ success: false, error: errorMessage }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const rawText = (data.content?.[0]?.text || "").trim();

    let result;
    try {
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found");
      }
    } catch (_parseErr) {
      // Fallback: create a single topic node from the raw text
      result = {
        candidates: [
          {
            type: "topic",
            title: cleanedText.slice(0, 15),
            summary: cleanedText.slice(0, 80),
            tags: [],
          },
        ],
        raw_cleaned: cleanedText,
      };
    }

    // Validate structure
    if (!Array.isArray(result.candidates) || result.candidates.length === 0) {
      result.candidates = [{
        type: "topic",
        title: cleanedText.slice(0, 15),
        summary: cleanedText.slice(0, 80),
        tags: [],
      }];
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
