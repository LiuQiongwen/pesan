import { useEffect } from 'react';
import { createPortal } from 'react-dom';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

interface Props {
  title: string;
  subtitle?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  color?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDeleteOverlay({
  title,
  subtitle,
  confirmLabel = '删除',
  cancelLabel = '取消',
  color = '#ff4466',
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onConfirm, onCancel]);

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1500,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.65)',
      animation: 'fade-in var(--dur-standard) var(--spring-snap)',
    }}>
      <div style={{
        width: 320, maxWidth: '90vw',
        background: 'rgba(2,5,16,0.98)',
        border: `1px solid ${color}30`,
        borderRadius: 10,
        padding: '20px 22px 18px',
        boxShadow: `0 0 40px ${color}10, 0 12px 40px rgba(0,0,0,0.80)`,
        animation: 'spring-in var(--dur-standard) var(--spring)',
      }}>
        <div style={{
          fontFamily: INTER, fontSize: 14, fontWeight: 600,
          color: 'rgba(220,230,250,0.92)',
          marginBottom: subtitle ? 6 : 16,
        }}>
          {title}
        </div>

        {subtitle && (
          <div style={{
            fontFamily: MONO, fontSize: 10, letterSpacing: '0.04em',
            color: 'rgba(160,175,200,0.55)',
            marginBottom: 16,
          }}>
            {subtitle}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em',
              color: 'rgba(200,215,240,0.65)',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 5, padding: '6px 16px',
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em',
              color: '#fff',
              background: `${color}25`,
              border: `1px solid ${color}50`,
              borderRadius: 5, padding: '6px 16px',
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
