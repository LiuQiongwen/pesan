/**
 * ContextToast — non-blocking bottom-center feedback toast.
 * Shows brief action feedback, auto-fades after duration.
 * pointerEvents: none — never blocks interaction.
 */
import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useDevice } from '@/hooks/useDevice';

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
  const { isPhone } = useDevice();

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
      ...(isPhone
        ? { top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }
        : { bottom: 72 }),
      left: '50%',
      transform: `translateX(-50%) translateY(${show ? '0' : (isPhone ? '-12px' : '12px')})`,
      zIndex: 55,
      pointerEvents: 'none',
      opacity: show ? 1 : 0,
      transition: 'opacity var(--dur-standard) var(--spring), transform var(--dur-standard) var(--spring)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: isPhone ? '6px 12px' : '8px 16px',
        background: isPhone ? 'rgba(6,10,22,0.50)' : 'rgba(6,10,22,0.90)',
        backdropFilter: isPhone ? 'blur(24px) saturate(1.4)' : 'blur(16px)',
        WebkitBackdropFilter: isPhone ? 'blur(24px) saturate(1.4)' : 'blur(16px)',
        border: isPhone ? '1px solid rgba(102,240,255,0.08)' : '1px solid rgba(102,240,255,0.14)',
        borderRadius: 10,
        boxShadow: isPhone ? '0 4px 16px rgba(0,0,0,0.25)' : '0 0 30px rgba(0,0,0,0.4)',
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
