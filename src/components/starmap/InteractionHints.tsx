/**
 * InteractionHints — contextual bottom-left HUD showing interaction shortcuts.
 * Ultra-subtle, auto-fades after 8s idle, reappears on mouse move.
 * Shows touch-specific hints on mobile.
 */
import { useState, useEffect, useRef, useMemo, memo } from 'react';
import { useDevice } from '@/hooks/useDevice';
import { useRenderTracer } from '@/hooks/useRenderTracer';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";

interface Props {
  noteCount: number;
  hoveredNode: boolean;
  connectMode: boolean;
  nodeWindowOpen?: boolean;
}

interface Hint {
  key: string;
  action: string;
}

export const InteractionHints = memo(function InteractionHints({ noteCount, hoveredNode, connectMode, nodeWindowOpen }: Props) {
  useRenderTracer('InteractionHints', { noteCount, hoveredNode, connectMode, nodeWindowOpen });
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const { isPhone } = useDevice();

  // Auto-hide after 8s, reshow on interaction
  useEffect(() => {
    const reset = () => {
      setVisible(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), 8000);
    };
    reset();
    window.addEventListener('mousemove', reset, { passive: true });
    window.addEventListener('touchstart', reset, { passive: true });
    window.addEventListener('keydown', reset, { passive: true });
    return () => {
      window.removeEventListener('mousemove', reset);
      window.removeEventListener('touchstart', reset);
      window.removeEventListener('keydown', reset);
      clearTimeout(timerRef.current);
    };
  }, []);

  const hints = useMemo((): Hint[] => {
    // ── Mobile hints ──
    if (isPhone) {
      if (connectMode) {
        return [
          { key: '轻点', action: '选择第二颗星完成连接' },
        ];
      }
      if (noteCount === 0) {
        return [
          { key: '底栏', action: '点「捕获」输入第一条知识' },
        ];
      }
      return [
        { key: '轻点', action: '查看星球' },
        { key: '长按', action: '更多操作' },
      ];
    }

    // ── Desktop hints ──
    if (connectMode) {
      return [
        { key: '点击', action: '选择目标星建立连接' },
        { key: 'Esc', action: '取消连接' },
      ];
    }
    if (nodeWindowOpen) {
      return [
        { key: '委托', action: '发送到功能舱' },
        { key: '详情', action: '打开笔记全文' },
        { key: 'Esc', action: '关闭' },
      ];
    }
    if (hoveredNode) {
      return [
        { key: '点击', action: '打开节点' },
        { key: '右键', action: '更多操作' },
        { key: '拖拽', action: '移动位置' },
        { key: 'F', action: '闪烁定位' },
      ];
    }
    if (noteCount === 0) {
      return [
        { key: 'N', action: '输入第一条知识' },
        { key: '点击光圈', action: '开始创作' },
      ];
    }
    return [
      { key: '点击', action: '打开节点' },
      { key: '拖拽', action: '转动视角' },
      { key: '右键', action: '更多操作' },
      { key: 'N', action: '新笔记' },
      { key: 'G', action: '回到中心' },
    ];
  }, [noteCount, hoveredNode, connectMode, nodeWindowOpen, isPhone]);

  return (
    <div style={{
      position: 'fixed',
      ...(isPhone
        ? { top: 'calc(env(safe-area-inset-top, 0px) + 56px)', left: 12 }
        : { bottom: 'clamp(12px, 1.5vh, 20px)', left: 'clamp(14px, 1.5vw, 22px)' }),
      zIndex: 8,
      pointerEvents: 'none',
      display: 'flex',
      gap: isPhone ? 8 : 12,
      opacity: visible ? 0.6 : 0,
      transition: 'opacity 0.6s ease',
    }}>
      {hints.map(h => (
        <div key={h.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{
            fontFamily: MONO,
            fontSize: isPhone ? 9 : 8,
            letterSpacing: '0.06em',
            color: 'rgba(102,240,255,0.65)',
            background: 'rgba(102,240,255,0.08)',
            border: '1px solid rgba(102,240,255,0.15)',
            padding: isPhone ? '2px 6px' : '1px 5px',
            borderRadius: 3,
          }}>
            {h.key}
          </span>
          <span style={{
            fontFamily: MONO,
            fontSize: isPhone ? 9 : 8,
            letterSpacing: '0.04em',
            color: 'rgba(160,175,205,0.45)',
          }}>
            {h.action}
          </span>
        </div>
      ))}
    </div>
  );
});