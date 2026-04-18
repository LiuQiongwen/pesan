/**
 * TourStepContent — returns single-line task copy for each step.
 * Pattern: one action sentence the user can immediately do.
 */
import type { TourStepId } from './TourProvider';
import { PlusCircle, MousePointerClick } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface StepContent {
  task: string;
  hint: string;
  icon: LucideIcon;
}

export function getStepContent(id: TourStepId): StepContent {
  switch (id) {
    case 'create':
      return {
        task: '在左侧 Capture Pod 输入或粘贴一段文字，点击发送',
        hint: 'AI 会自动提炼、索引并生成你的第一颗知识星',
        icon: PlusCircle,
      };
    case 'explore':
      return {
        task: '点击星图中刚生成的星球',
        hint: '查看 AI 为你生成的摘要、观点和知识关联',
        icon: MousePointerClick,
      };
  }
}
