/**
 * TourStepContent — returns single-line task copy for each step.
 * Pattern: one action sentence the user can immediately do.
 */
import type { TourStepId } from './TourProvider';
import { Orbit, PlusCircle, MousePointerClick } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface StepContent {
  task: string;
  icon: LucideIcon;
}

export function getStepContent(id: TourStepId): StepContent {
  switch (id) {
    case 'orbit':
      return { task: '拖动星空，转动你的宇宙', icon: Orbit };
    case 'create':
      return { task: '粘贴一段文字，生成第一颗知识星', icon: PlusCircle };
    case 'explore':
      return { task: '点击星球，查看 AI 分析', icon: MousePointerClick };
  }
}
