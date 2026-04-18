/**
 * ContextToast — non-blocking bottom-center feedback toast.
 * Shows brief action feedback, auto-fades after duration.
 * pointerEvents: none — never blocks interaction.
 */
import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

export interface ToastItem {
  id: string;
  message: string;
  icon?: LucideIcon;
  accent?: string;
  duration?: number;
}

interface Props {
  toast: ToastItem | null;
  onDone: (id: string) => void;
}

export function ContextToast({ toast, onDone }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!toast) { setShow(false); return; }
    // Enter animation
    requestAnimationFrame(() => setShow(true));
    const timer = setTimeout(() => {
      setShow(false);
      setTimeout(() => onDone(toast.id), 350);
    }, toast.duration ?? 3000);
    return () => clearTimeout(timer);
  }, [toast, onDone]);

  if (!toast) return null;

  const Icon = toast.icon;
  const accent = toast.accent ?? 'rgba(102,240,255,0.85)';

  return (
    <div style={{
      position: 'fixed',
      bottom: 72,
      left: '50%',
      transform: `translateX(-50%) translateY(${show ? '0' : '12px'})`,
      zIndex: 55,
      pointerEvents: 'none',
      opacity: show ? 1 : 0,
      transition: 'opacity var(--dur-standard) var(--spring), transform var(--dur-standard) var(--spring)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 16px',
        background: 'rgba(6,10,22,0.90)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(102,240,255,0.14)',
        borderRadius: 10,
        boxShadow: '0 0 30px rgba(0,0,0,0.4)',
        whiteSpace: 'nowrap',
      }}>
        {Icon && (
          <div style={{
            width: 22, height: 22, borderRadius: 5,
            background: 'rgba(102,240,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon size={12} color={accent} />
          </div>
        )}
        <span style={{
          fontFamily: INTER,
          fontSize: 12,
          fontWeight: 500,
          color: 'rgba(220,230,255,0.85)',
          letterSpacing: '0.01em',
        }}>
          {toast.message}
        </span>
        <span style={{
          fontFamily: MONO,
          fontSize: 8,
          color: 'rgba(102,240,255,0.35)',
          letterSpacing: '0.06em',
        }}>
          HINT
        </span>
      </div>
    </div>
  );
}
