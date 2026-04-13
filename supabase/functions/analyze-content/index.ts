const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Specialized prompts ({{content}} will be replaced) ────────────────────
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

const ANALYSIS_PROMPT = `你现在是一个深度分析师，而不是摘要工具。请对以下内容进行深入分析，不要只复述表面信息，而要识别其背后的逻辑结构、关键矛盾、隐含假设、潜在问题和可迁移规律。请从以下角度展开：
1. 主题与核心问题
   - 这份内容真正要解决什么问题？
   - 核心矛盾是什么？
2. 逻辑结构分析
   - 作者/材料的主要论证链条是什么？
   - 关键前提是什么？
   - 哪些结论是如何被推导出来的？
3. 深层洞见
   - 这份内容背后反映了什么规律？
   - 哪些部分最有启发价值？
   - 哪些内容容易被忽略但很关键？
4. 局限与问题
   - 内容中有哪些薄弱点、漏洞或未被证明的部分？
   - 有哪些值得质疑或继续验证的地方？
5. 可迁移价值
   - 这些结论能迁移到哪些其他场景？
   - 对实践、研究或决策有什么启发？

输出格式（严格按照此格式输出，用 Markdown）：
## 核心问题
## 逻辑结构
## 深层洞见
## 局限与质疑
## 可迁移方法论
## 行动启发

以下是内容：
{{content}}`;

const REPORT_PROMPT = `你现在是一个专业报告撰写助手。请基于以下内容，输出一份结构完整、表达正式、逻辑清晰的分析报告。报告应适合用于汇报、存档或正式阅读。要求：
1. 内容完整，有明确结构
2. 风格正式、客观、清晰
3. 不要写成聊天总结，要写成报告
4. 既要概括内容，也要提炼关键结论与建议

输出结构如下（严格按照此格式，用 Markdown）：
# 标题
## 一、背景与主题
说明这份内容讨论的背景、范围和核心主题
## 二、主要内容概述
概括主要信息与核心内容
## 三、关键问题与重点发现
提炼重要问题、主要发现和关键信息
## 四、分析与解读
对内容进行进一步分析，包括逻辑、原因、意义、影响等
## 五、结论
给出整体结论
## 六、建议或后续方向
提出下一步建议、可执行方向或待研究问题

以下是材料：
{{content}}`;

const MINDMAP_PROMPT = `你现在是一个信息结构化助手。请将以下内容整理成"思维导图式"的层级结构，而不是写成长段文字。要求：
1. 按主题 -> 子主题 -> 关键点 的层级展开
2. 层级清晰，避免冗长解释
3. 每个节点尽量简洁
4. 保留核心逻辑关系
5. 如果合适，可加入"问题/方法/结论/行动"分支

输出格式示例（严格按照此 Markdown 格式）：
# 主题
- 一级主题A
  - 二级主题A1
    - 关键点1
    - 关键点2
  - 二级主题A2
- 一级主题B
  - 二级主题B1
- 一级主题C

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

    // ── Extract raw text from source ──────────────────────────────────────
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
          .slice(0, 8000);
        rawContent = `来源网址: ${sourceUrl || content}\n\n${rawContent}`;
      } catch (_e) {
        rawContent = `来源网址: ${sourceUrl || content}\n\n注意：无法直接抓取网页内容。`;
      }
    } else {
      rawContent = content || "";
    }

    // ── Build the combined system prompt ─────────────────────────────────
    const systemPrompt = `你是一个专业知识分析平台的 AI 引擎。你会收到一段内容，需要同时以四种专业角色对其进行分析，并将结果打包为一个 JSON 对象输出。

四种分析任务的具体要求如下：

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【任务1：高效摘要助手】
${SUMMARY_PROMPT.replace("以下是内容：\n{{content}}", "（使用用户输入的内容）")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【任务2：深度分析师】
${ANALYSIS_PROMPT.replace("以下是内容：\n{{content}}", "（使用用户输入的内容）")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【任务3：专业报告撰写助手】
${REPORT_PROMPT.replace("以下是材料：\n{{content}}", "（使用用户输入的内容）")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【任务4：信息结构化助手（思维导图）】
${MINDMAP_PROMPT.replace("请基于以下内容输出：\n{{content}}", "（使用用户输入的内容）")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【输出格式】严格输出合法 JSON，不要有任何额外文字：
{
  "title": "精炼标题（40字以内）",
  "summary": "一句话概括，用于卡片预览",
  "tags": ["标签1", "标签2", "标签3"],
  "summary_markdown": "任务1的完整 Markdown 输出",
  "analysis_markdown": "任务2的完整 Markdown 输出",
  "report_markdown": "任务3的完整 Markdown 输出",
  "mindmap_markdown": "任务4的完整 Markdown 输出",
  "mindmap_data": {
    "root": "主题名称",
    "nodes": [
      {
        "id": "1",
        "label": "一级主题",
        "children": [
          { "id": "1-1", "label": "子概念", "children": [] }
        ]
      }
    ]
  }
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
        max_tokens: 8000,
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
