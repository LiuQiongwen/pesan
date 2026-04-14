const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Specialized prompts ────────────────────────────────────────────────────
const SUMMARY_PROMPT = `你现在是一个高效摘要助手。请对以下内容生成一份高质量摘要，要求：
1. 用 3-5 句话概括整体内容
2. 提炼最重要的核心观点
3. 提取关键事实、结论或论据
4. 忽略细枝末节和重复信息
5. 不要大段复述原文，要用自己的话压缩表达

输出格式（严格按照此格式输出，用 Markdown）：
## 内容概览
## 核心观点
## 关键事实/结论
## 一句话总结

以下是内容：
{{content}}`;

const ANALYSIS_PROMPT = `你现在是一个深度分析师。请对以下内容进行深入分析，识别背后的逻辑结构、关键矛盾、隐含假设和可迁移规律。

输出格式（严格按照此格式输出，用 Markdown，每节简洁）：
## 核心问题
## 逻辑结构
## 深层洞见
## 局限与质疑
## 可迁移方法论
## 行动启发

以下是内容：
{{content}}`;

const REPORT_PROMPT = `你现在是一个专业报告撰写助手。请基于以下内容输出结构清晰的分析报告。

输出结构如下（严格按照此格式，用 Markdown）：
# 标题
## 一、背景与主题
## 二、主要内容概述
## 三、关键问题与重点发现
## 四、分析与解读
## 五、结论
## 六、建议或后续方向

以下是材料：
{{content}}`;

const MINDMAP_PROMPT = `你现在是一个信息结构化助手。请将以下内容整理成思维导图层级结构，按主题->子主题->关键点展开，每个节点简洁。

输出格式示例（严格按照此 Markdown 格式）：
# 主题
- 一级主题A
  - 二级主题A1
    - 关键点1
  - 二级主题A2
- 一级主题B

请基于以下内容输出：
{{content}}`;

// ── Main handler ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AI_API_TOKEN = Deno.env.get("AI_API_TOKEN_2c7d5422f5cf");
    if (!AI_API_TOKEN) throw new Error("AI_API_TOKEN is not configured");

    const { sourceType, content, sourceUrl } = await req.json();

    // ── Extract raw text ──────────────────────────────────────────────────
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
          .slice(0, 4000); // Reduced from 8000
        rawContent = `来源网址: ${sourceUrl || content}\n\n${rawContent}`;
      } catch (_e) {
        rawContent = `来源网址: ${sourceUrl || content}\n\n注意：无法直接抓取网页内容。`;
      }
    } else {
      rawContent = (content || "").slice(0, 4000); // Reduced from 8000
    }

    // ── Compact combined system prompt ───────────────────────────────────
    const systemPrompt = `你是专业知识分析平台的 AI 引擎。收到内容后，同时以四种专业角色分析，将结果打包为一个 JSON 输出。四种分析任务要求如下（每项保持简洁，控制总输出量）：

【任务1：摘要】${SUMMARY_PROMPT.replace("以下是内容：\n{{content}}", "").trim()}

【任务2：深度分析】${ANALYSIS_PROMPT.replace("以下是内容：\n{{content}}", "").trim()}

【任务3：报告】${REPORT_PROMPT.replace("以下是材料：\n{{content}}", "").trim()}

【任务4：思维导图】${MINDMAP_PROMPT.replace("请基于以下内容输出：\n{{content}}", "").trim()}

【输出格式】严格输出合法 JSON，每个 markdown 字段控制在 400 字以内：
{
  "title": "精炼标题（40字以内）",
  "summary": "一句话概括",
  "tags": ["标签1", "标签2", "标签3"],
  "summary_markdown": "任务1输出",
  "analysis_markdown": "任务2输出",
  "report_markdown": "任务3输出",
  "mindmap_markdown": "任务4输出",
  "mindmap_data": { "root": "主题", "nodes": [{ "id": "1", "label": "一级主题", "children": [{ "id": "1-1", "label": "子概念", "children": [] }] }] }
}`;

    const response = await fetch("https://api.enter.pro/code/api/v1/ai/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4.5",
        system: systemPrompt,
        messages: [{ role: "user", content: `请分析以下内容：\n\n${rawContent}` }],
        stream: false,
        max_tokens: 3000, // Reduced from 8000
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
        summary_markdown: rawText,
        analysis_markdown: "",
        report_markdown: "",
        mindmap_markdown: "",
        mindmap_data: { root: "主题", nodes: [] },
      };
    }

    // Map report_markdown -> content_markdown for backward compatibility
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
