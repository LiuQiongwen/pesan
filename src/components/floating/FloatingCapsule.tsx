/**
 * FloatingCapsule — compact pill representation of a pod in "capsule" mode.
 * Rendered when a pod is open but pushed out of the primary+secondary slots.
 * Stacked vertically on the right edge of the viewport.
 */
import { type LucideIcon } from 'lucide-react';
import { useToolbox, type PodId } from '@/contexts/ToolboxContext';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";

interface FloatingCapsuleProps {
  id: PodId;
  icon: LucideIcon;
  label: string;
  accentColor: string;
  stackIndex: number; // 0 = bottom, 1 = next up, etc.
}

function hexToRgb(hex: string) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

export function FloatingCapsule({
  id, icon: Icon, label, accentColor, stackIndex,
}: FloatingCapsuleProps) {
  const { openPod, closePod } = useToolbox();
  const { r, g, b } = hexToRgb(accentColor);

  const bottom = 80 + stackIndex * 48; // stack upward from bottom-right

  return (
    <div
      style={{
        position: 'fixed',
        right: 20,
        bottom,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        animation: 'capsule-in 0.2s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* Expand button */}
      <button
        onClick={() => openPod(id)}
        title={`展开 ${label}`}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '6px 10px 6px 8px',
          background: `rgba(${r},${g},${b},0.10)`,
          border: `1px solid rgba(${r},${g},${b},0.28)`,
          borderRadius: '20px 0 0 20px',
          cursor: 'pointer',
          backdropFilter: 'blur(16px)',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = `rgba(${r},${g},${b},0.20)`;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = `rgba(${r},${g},${b},0.10)`;
        }}
      >
        {/* Accent dot */}
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: accentColor,
          boxShadow: `0 0 6px ${accentColor}`,
          flexShrink: 0,
        }} />
        <Icon size={11} color={accentColor} />
        <span style={{
          fontFamily: MONO, fontSize: 8, letterSpacing: '0.08em',
          color: accentColor, textTransform: 'uppercase' as const,
        }}>
          {label}
        </span>
      </button>

      {/* Dismiss */}
      <button
        onClick={() => closePod(id)}
        title="关闭"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 26, height: 26,
          background: `rgba(${r},${g},${b},0.07)`,
          border: `1px solid rgba(${r},${g},${b},0.18)`,
          borderLeft: 'none',
          borderRadius: '0 20px 20px 0',
          cursor: 'pointer',
          fontFamily: MONO, fontSize: 9,
          color: `rgba(${r},${g},${b},0.50)`,
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.color = `rgba(${r},${g},${b},0.90)`;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.color = `rgba(${r},${g},${b},0.50)`;
        }}
      >
        ×
      </button>
    </div>
  );
}

// Inject animation once
if (typeof document !== 'undefined') {
  const id = 'capsule-anim';
  if (!document.getElementById(id)) {
    const s = document.createElement('style');
    s.id = id;
    s.textContent = `@keyframes capsule-in { from { opacity:0; transform: translateX(20px); } to { opacity:1; transform: translateX(0); } }`;
    document.head.appendChild(s);
  }
}
