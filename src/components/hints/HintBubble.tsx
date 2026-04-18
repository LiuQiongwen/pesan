/**
 * HintBubble — lightweight positional hint label.
 * Sticks to a side of its parent (top/bottom/left/right).
 * pointerEvents: none by default; optional dismiss button is pointer-auto.
 */
import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

type Position = 'top' | 'bottom' | 'left' | 'right';

export interface HintBubbleProps {
  /** Short actionable text, e.g. "拖拽星球到此处" */
  text: string;
  /** Optional tiny label, e.g. "HINT" */
  label?: string;
  /** Which side of the parent */
  position?: Position;
  /** Accent color */
  accent?: string;
  /** Show dismiss (X) button */
  dismissible?: boolean;
  onDismiss?: () => void;
  /** Auto-dismiss after ms (0 = never) */
  autoDismiss?: number;
  /** Control visibility externally */
  visible?: boolean;
  /** Extra inline style on root */
  style?: React.CSSProperties;
}

const POSITION_STYLES: Record<Position, React.CSSProperties> = {
  top:    { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6 },
  bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6 },
  left:   { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 6 },
  right:  { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 6 },
};

const ARROW_STYLES: Record<Position, React.CSSProperties> = {
  top:    { top: '100%', left: '50%', transform: 'translateX(-50%)', borderTop: '4px solid rgba(102,240,255,0.18)', borderLeft: '4px solid transparent', borderRight: '4px solid transparent' },
  bottom: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', borderBottom: '4px solid rgba(102,240,255,0.18)', borderLeft: '4px solid transparent', borderRight: '4px solid transparent' },
  left:   { left: '100%', top: '50%', transform: 'translateY(-50%)', borderLeft: '4px solid rgba(102,240,255,0.18)', borderTop: '4px solid transparent', borderBottom: '4px solid transparent' },
  right:  { right: '100%', top: '50%', transform: 'translateY(-50%)', borderRight: '4px solid rgba(102,240,255,0.18)', borderTop: '4px solid transparent', borderBottom: '4px solid transparent' },
};

export function HintBubble({
  text,
  label = 'HINT',
  position = 'top',
  accent = 'rgba(102,240,255,0.85)',
  dismissible = false,
  onDismiss,
  autoDismiss = 0,
  visible: externalVisible,
  style,
}: HintBubbleProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const controlled = externalVisible !== undefined;
    if (controlled && !externalVisible) { setShow(false); return; }
    const t = setTimeout(() => setShow(true), 150);
    return () => clearTimeout(t);
  }, [externalVisible]);

  useEffect(() => {
    if (!show || !autoDismiss) return;
    const t = setTimeout(() => {
      setShow(false);
      setTimeout(() => onDismiss?.(), 350);
    }, autoDismiss);
    return () => clearTimeout(t);
  }, [show, autoDismiss, onDismiss]);

  const handleDismiss = useCallback(() => {
    setShow(false);
    setTimeout(() => onDismiss?.(), 300);
  }, [onDismiss]);

  return (
    <div style={{
      position: 'absolute',
      ...POSITION_STYLES[position],
      zIndex: 20,
      pointerEvents: 'none',
      opacity: show ? 1 : 0,
      transition: 'opacity 0.3s ease',
      ...style,
    }}>
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        background: 'rgba(6,10,22,0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(102,240,255,0.18)',
        borderRadius: 6,
        boxShadow: '0 0 16px rgba(0,0,0,0.3)',
        whiteSpace: 'nowrap',
      }}>
        {/* Arrow */}
        <div style={{
          position: 'absolute',
          width: 0, height: 0,
          ...ARROW_STYLES[position],
        }} />

        {label && (
          <span style={{
            fontFamily: MONO,
            fontSize: 7,
            letterSpacing: '0.08em',
            color: accent,
            opacity: 0.5,
          }}>
            {label}
          </span>
        )}

        <span style={{
          fontFamily: INTER,
          fontSize: 11,
          fontWeight: 500,
          color: 'rgba(220,230,255,0.82)',
          letterSpacing: '0.01em',
        }}>
          {text}
        </span>

        {dismissible && (
          <button
            onClick={handleDismiss}
            style={{
              pointerEvents: 'auto',
              background: 'rgba(255,255,255,0.06)',
              border: 'none',
              borderRadius: 3,
              padding: 2,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 2,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
          >
            <X size={9} color="rgba(255,255,255,0.4)" />
          </button>
        )}
      </div>
    </div>
  );
}
