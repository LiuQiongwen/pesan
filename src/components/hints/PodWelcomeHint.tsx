/**
 * PodWelcomeHint — one-line welcome hint shown inside a Pod on first open.
 * Auto-dismisses after 5s or when user interacts.
 */
import { useEffect, useState } from 'react';
import { useHintState } from '@/hooks/useHintState';
import type { PodId } from '@/contexts/ToolboxContext';

const INTER = "'Inter',system-ui,sans-serif";

const POD_HINTS: Record<string, string> = {
  capture:   '输入文字或 URL，AI 自动提炼生成知识星',
  retrieval: '输入关键词，语义检索你的全部知识',
  insight:   '选择节点，AI 深度蒸馏提炼洞察',
  memory:    '查看与当前星球关联的记忆上下文',
  action:    '将知识转化为待办、大纲或执行方案',
};

const POD_ACCENTS: Record<string, string> = {
  capture:   'rgba(0,255,102,0.60)',
  retrieval: 'rgba(102,240,255,0.60)',
  insight:   'rgba(180,150,255,0.60)',
  memory:    'rgba(255,160,64,0.60)',
  action:    'rgba(255,68,102,0.60)',
};

interface Props {
  podId: PodId;
}

export function PodWelcomeHint({ podId }: Props) {
  const { shouldShow, dismiss } = useHintState();
  const [visible, setVisible] = useState(false);
  const hintKey = `pod-${podId}-welcome`;

  useEffect(() => {
    if (!shouldShow(hintKey)) return;
    const enterTimer = setTimeout(() => setVisible(true), 400);
    const dismissTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => dismiss(hintKey), 350);
    }, 5400);
    return () => { clearTimeout(enterTimer); clearTimeout(dismissTimer); };
  }, [hintKey, shouldShow, dismiss]);

  if (!shouldShow(hintKey)) return null;

  const hint = POD_HINTS[podId];
  const accent = POD_ACCENTS[podId] ?? 'rgba(102,240,255,0.60)';
  if (!hint) return null;

  return (
    <div style={{
      padding: '6px 14px 8px',
      opacity: visible ? 1 : 0,
      transform: `translateY(${visible ? '0' : '-4px'})`,
      transition: 'opacity 0.35s ease, transform 0.35s ease',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{
        fontFamily: INTER,
        fontSize: 11,
        color: accent,
        letterSpacing: '0.01em',
      }}>
        {hint}
      </span>
    </div>
  );
}
