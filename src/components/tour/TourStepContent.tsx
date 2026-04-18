/**
 * TourStepContent — returns the copy for each tour step.
 * Pattern: action prompt + value explanation.
 */
import type { TourStepId } from './TourProvider';

export interface StepContent {
  title:     string;
  body:      string;
  sub:       string;
  cta?:      string;   // If present, shows a button (manual advance)
  hint?:     string;   // Small helper text
}

export function getStepContent(id: TourStepId): StepContent {
  switch (id) {
    case 'welcome':
      return {
        title: '欢迎来到你的知识宇宙',
        body:  '这不是一个笔记工具 — 这是一个会思考的知识星图。',
        sub:   '每一条知识都会成为一颗星，AI 会帮你建立它们之间的联系。',
        cta:   '创造第一颗星',
      };
    case 'capture':
      return {
        title: '投入第一条知识',
        body:  '粘贴一段文字、一个网址、或写下一个想法。',
        sub:   '输入任何内容，AI 会自动分析、摘要、建立关联。',
        hint:  '试试粘贴一篇你最近在读的文章',
      };
    case 'pipeline':
      return {
        title: 'AI 正在处理你的知识',
        body:  '分析内容 → 生成摘要 → 提取关键点 → 建立索引 → 编译图谱',
        sub:   '7 步自动化管道，把原始信息变成结构化知识。',
      };
    case 'star-born':
      return {
        title: '你的第一颗知识星诞生了',
        body:  '点击它，查看 AI 为你生成的分析报告。',
        sub:   '每颗星都有摘要、分析、报告、思维导图四个视角。',
      };
    case 'note-detail':
      return {
        title: '四个视角，一条知识',
        body:  '切换标签页，看看 AI 从你的输入中提炼出了什么。',
        sub:   '这不是你写的笔记 — 这是 AI 为你构建的结构化知识。',
      };
    case 'complete':
      return {
        title: '五大功能舱，等你探索',
        body:  '捕获 · 检索 · 洞察 · 记忆 · 行动 — 知识从输入到执行的完整链路。',
        sub:   '继续添加更多知识，你的星图会越来越丰富。',
        cta:   '开始自由探索',
      };
  }
}
