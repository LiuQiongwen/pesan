import { Feather, Radar, FlaskConical, Layers, Zap } from 'lucide-react';
import { useToolbox, type PodId } from '@/contexts/ToolboxContext';
import { type LucideIcon } from 'lucide-react';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

interface DockItem {
  id: PodId;
  icon: LucideIcon;
  label: string;
  accent: string;
}

const PODS: DockItem[] = [
  { id: 'capture',   icon: Feather,      label: 'Capture',   accent: '#00ff66' },
  { id: 'retrieval', icon: Radar,        label: 'Retrieval', accent: '#66f0ff' },
  { id: 'insight',   icon: FlaskConical, label: 'Insight',   accent: '#b496ff' },
  { id: 'memory',    icon: Layers,       label: 'Memory',    accent: '#ffa040' },
  { id: 'action',    icon: Zap,          label: 'Action',    accent: '#ff4466' },
];

export function CommandDock() {
  const { pods, togglePod } = useToolbox();

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 28,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        background: 'rgba(5,7,12,0.92)',
        backdropFilter: 'blur(28px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.6)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16,
        padding: '7px 12px',
        boxShadow: '0 4px 36px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.04)',
      }}
    >
      {PODS.map(({ id, icon: Icon, label, accent }) => {
        const isOpen = pods[id]?.open && !pods[id]?.minimized;
        const r = parseInt(accent.slice(1, 3), 16);
        const g = parseInt(accent.slice(3, 5), 16);
        const b = parseInt(accent.slice(5, 7), 16);

        return (
          <div key={id} style={{ position: 'relative' }}>
            <button
              onClick={() => togglePod(id)}
              title={label}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0,
                width: 48,
                height: 46,
                borderRadius: 11,
                border: isOpen
                  ? `1px solid rgba(${r},${g},${b},0.40)`
                  : '1px solid transparent',
                background: isOpen
                  ? `rgba(${r},${g},${b},0.10)`
                  : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.16s',
                boxShadow: isOpen ? `0 0 14px rgba(${r},${g},${b},0.20)` : 'none',
              }}
              onMouseEnter={e => {
                if (!isOpen) {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = `rgba(${r},${g},${b},0.07)`;
                  el.style.border = `1px solid rgba(${r},${g},${b},0.22)`;
                }
              }}
              onMouseLeave={e => {
                if (!isOpen) {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = 'transparent';
                  el.style.border = '1px solid transparent';
                }
              }}
            >
              <Icon
                size={16}
                color={isOpen ? accent : 'rgba(130,140,165,0.65)'}
                style={{ transition: 'color 0.16s', marginBottom: 1 }}
              />
              <span style={{
                fontFamily: MONO,
                fontSize: 7.5,
                letterSpacing: '0.05em',
                color: isOpen ? accent : 'rgba(90,100,125,0.60)',
                transition: 'color 0.16s',
                textTransform: 'uppercase',
              }}>
                {label}
              </span>

              {/* Active dot */}
              {isOpen && (
                <div style={{
                  position: 'absolute',
                  bottom: 4,
                  width: 3,
                  height: 3,
                  borderRadius: '50%',
                  background: accent,
                  boxShadow: `0 0 5px ${accent}`,
                }} />
              )}
            </button>
          </div>
        );
      })}

      {/* Divider + wordmark */}
      <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.07)', margin: '0 6px' }} />
      <div style={{
        fontFamily: MONO, fontSize: 8,
        color: 'rgba(60,70,95,0.55)',
        letterSpacing: '0.07em',
        paddingRight: 2,
        userSelect: 'none',
      }}>
        平
      </div>
    </div>
  );
}
