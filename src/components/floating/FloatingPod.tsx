import { useRef, useCallback, useEffect, useState, type ReactNode, type LucideIcon } from 'react';
import { X, Minus, Pin } from 'lucide-react';
import { useToolbox, type PodId } from '@/contexts/ToolboxContext';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";

interface FloatingPodProps {
  id: PodId;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  accentColor: string;
  width?: number;
  /** @deprecated kept for API compatibility — no longer used */
  mode?: 'primary' | 'secondary';
  children: ReactNode;
}

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function FloatingPod({
  id,
  title,
  subtitle,
  icon: Icon,
  accentColor,
  width = 460,
  children,
}: FloatingPodProps) {
  const { pods, closePod, minimizePod, bringToFront, setPos } = useToolbox();
  const state = pods[id];
  const [pinned, setPinned] = useState(false);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const border = hexToRgba(accentColor, 0.38);
  const glow   = hexToRgba(accentColor, 0.18);
  const barBg  = hexToRgba(accentColor, 0.18);

  const onMouseDownHeader = useCallback((e: React.MouseEvent) => {
    if (pinned) return;
    dragging.current = true;
    dragOffset.current = { x: e.clientX - state.pos.x, y: e.clientY - state.pos.y };
    bringToFront(id);
    e.preventDefault();
  }, [pinned, id, state.pos, bringToFront]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const nx = Math.max(0, Math.min(window.innerWidth - width - 4, e.clientX - dragOffset.current.x));
      const ny = Math.max(0, Math.min(window.innerHeight - 52, e.clientY - dragOffset.current.y));
      setPos(id, { x: nx, y: ny });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [id, width, setPos]);

  if (!state?.open) return null;

  return (
    <div
      ref={panelRef}
      onMouseDown={() => bringToFront(id)}
      style={{
        position: 'fixed',
        left: state.pos.x,
        top: state.pos.y,
        width,
        zIndex: state.zIndex,
        animation: 'toolbox-in 0.20s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <div style={{
        background: 'rgba(4,6,14,0.95)',
        backdropFilter: 'blur(32px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(32px) saturate(1.8)',
        border: `1px solid ${border}`,
        borderRadius: 14,
        boxShadow: `0 0 0 1px ${glow}, 0 0 40px ${hexToRgba(accentColor, 0.10)}, 0 20px 64px rgba(0,0,0,0.85)`,
        overflow: 'hidden',
      }}>

        {/* Title bar */}
        <div
          onMouseDown={onMouseDownHeader}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            cursor: pinned ? 'default' : 'grab',
            userSelect: 'none',
            borderBottom: state.minimized ? 'none' : `1px solid ${hexToRgba(accentColor, 0.12)}`,
          }}
        >
          {/* Left accent bar */}
          <div style={{
            width: 4,
            alignSelf: 'stretch',
            background: accentColor,
            opacity: 0.95,
            flexShrink: 0,
            boxShadow: `2px 0 12px ${hexToRgba(accentColor, 0.50)}`,
          }} />

          {/* Icon + text */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '11px 14px 11px 12px',
            flex: 1, minWidth: 0,
            background: barBg,
          }}>
            <div style={{
              width: 32, height: 32,
              borderRadius: 8,
              background: hexToRgba(accentColor, 0.15),
              border: `1px solid ${hexToRgba(accentColor, 0.30)}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: `0 0 12px ${hexToRgba(accentColor, 0.20)}`,
            }}>
              <Icon size={16} color={accentColor} style={{ opacity: 0.95 }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: MONO,
                fontSize: 11,
                fontWeight: 700,
                color: accentColor,
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                lineHeight: 1.2,
                textShadow: `0 0 16px ${hexToRgba(accentColor, 0.50)}`,
              }}>
                {title}
              </div>
              {subtitle && !state.minimized && (
                <div style={{
                  fontFamily: MONO,
                  fontSize: 9,
                  color: hexToRgba(accentColor, 0.55),
                  letterSpacing: '0.05em',
                  marginTop: 3,
                  lineHeight: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 12px', background: barBg }}
            onMouseDown={e => e.stopPropagation()}
          >
            <button
              onClick={() => setPinned(p => !p)}
              title={pinned ? 'Unpin' : 'Pin'}
              style={mkCtrl(pinned ? accentColor : 'rgba(200,210,230,0.40)', pinned ? hexToRgba(accentColor, 0.20) : undefined)}
            >
              <Pin size={10} />
            </button>
            <button onClick={() => minimizePod(id)} title="Collapse" style={mkCtrl('rgba(200,210,230,0.50)')}>
              <Minus size={10} />
            </button>
            <button onClick={() => closePod(id)} title="Close" style={mkCtrl('rgba(255,72,72,0.70)')}>
              <X size={10} />
            </button>
          </div>
        </div>

        {/* Body */}
        {!state.minimized && (
          <div style={{ maxHeight: 'calc(100vh - 120px)', overflowY: 'auto', overscrollBehavior: 'contain' }}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

function mkCtrl(color: string, bg?: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 22, height: 22, borderRadius: 6,
    background: bg ?? 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    cursor: 'pointer', color,
    transition: 'all 0.12s',
    flexShrink: 0,
  };
}
