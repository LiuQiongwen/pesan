import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";

interface Props {
  message: string;
  color?: string;
  durationMs?: number;
  onUndo: () => void;
  onDismiss: () => void;
}

export function UndoToast({ message, color = '#ff4466', durationMs = 8000, onUndo, onDismiss }: Props) {
  const [progress, setProgress] = useState(100);
  const startRef = useRef(performance.now());
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      const pct = Math.max(0, 100 - (elapsed / durationMs) * 100);
      setProgress(pct);
      if (pct <= 0) { onDismiss(); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [durationMs, onDismiss]);

  return createPortal(
    <div style={{
      position: 'fixed',
      bottom: 'clamp(100px, 10vh, 140px)',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1400,
      display: 'flex', alignItems: 'center', gap: 14,
      fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em',
      color: 'rgba(220,230,250,0.90)',
      background: 'rgba(2,5,16,0.96)',
      border: `1px solid ${color}40`,
      borderRadius: 8,
      padding: '8px 14px',
      boxShadow: `0 0 20px ${color}15, 0 8px 32px rgba(0,0,0,0.75)`,
      animation: 'toast-in var(--dur-standard) var(--spring-snap)',
      overflow: 'hidden',
    }}>
      {/* Progress bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0,
        width: `${progress}%`, height: 2,
        background: color, opacity: 0.5,
        transition: 'width 0.1s linear',
      }} />
      <span>{message}</span>
      <button
        onClick={() => { cancelAnimationFrame(rafRef.current); onUndo(); }}
        style={{
          fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em',
          color, background: `${color}15`,
          border: `1px solid ${color}35`,
          borderRadius: 4, padding: '3px 10px',
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        UNDO
      </button>
    </div>,
    document.body,
  );
}
