import { useRef, useCallback, useEffect, useState, type ReactNode, type LucideIcon } from 'react';
import { X, Minus } from 'lucide-react';
import { useToolbox, type PodId } from '@/contexts/ToolboxContext';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";

interface FloatingPodProps {
  id: PodId;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  accentColor: string;   // hex, e.g. '#00ff66'
  width?: number;
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
  width = 380,
  children,
}: FloatingPodProps) {
  const { pods, closePod, minimizePod, bringToFront, setPos } = useToolbox();
  const state = pods[id];
  const [pinned, setPinned] = useState(false);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const border  = hexToRgba(accentColor, 0.28);
  const glow    = hexToRgba(accentColor, 0.12);
  const barBg   = hexToRgba(accentColor, 0.15);

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
      const ny = Math.max(0, Math.min(window.innerHeight - 48, e.clientY - dragOffset.current.y));
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
        animation: 'toolbox-in 0.18s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <div style={{
        background: 'rgba(5,7,12,0.91)',
        backdropFilter: 'blur(24px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
        border: `1px solid ${border}`,
        borderRadius: 11,
        boxShadow: `0 0 0 1px ${glow}, 0 16px 56px rgba(0,0,0,0.80)`,
        overflow: 'hidden',
      }}>

        {/* Accent bar + title row */}
        <div
          onMouseDown={onMouseDownHeader}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            cursor: pinned ? 'default' : 'grab',
            userSelect: 'none',
            borderBottom: state.minimized ? 'none' : '1px solid rgba(255,255,255,0.05)',
          }}
        >
          {/* Left accent bar */}
          <div style={{
            width: 3,
            alignSelf: 'stretch',
            background: accentColor,
            opacity: 0.85,
            flexShrink: 0,
          }} />

          {/* Icon + text */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px 8px 10px',
            flex: 1, minWidth: 0,
            background: barBg,
          }}>
            <Icon size={12} color={accentColor} style={{ flexShrink: 0, opacity: 0.9 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: MONO,
                fontSize: 9.5,
                fontWeight: 600,
                color: accentColor,
                letterSpacing: '0.09em',
                textTransform: 'uppercase',
                lineHeight: 1,
              }}>
                {title}
              </div>
              {subtitle && !state.minimized && (
                <div style={{
                  fontFamily: MONO,
                  fontSize: 8,
                  color: hexToRgba(accentColor, 0.45),
                  letterSpacing: '0.05em',
                  marginTop: 2,
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
            style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '0 10px', background: barBg }}
            onMouseDown={e => e.stopPropagation()}
          >
            {/* Pin dot */}
            <button
              onClick={() => setPinned(p => !p)}
              title={pinned ? 'Unpin' : 'Pin'}
              style={{
                width: 16, height: 16,
                borderRadius: '50%',
                background: pinned ? hexToRgba(accentColor, 0.35) : 'rgba(255,255,255,0.05)',
                border: `1px solid ${pinned ? hexToRgba(accentColor, 0.60) : 'rgba(255,255,255,0.10)'}`,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: pinned ? accentColor : 'rgba(255,255,255,0.30)' }} />
            </button>

            {/* Minimize */}
            <button
              onClick={() => minimizePod(id)}
              title="Collapse"
              style={mkCtrl('rgba(200,208,224,0.50)')}
            >
              <Minus size={9} />
            </button>

            {/* Close */}
            <button
              onClick={() => closePod(id)}
              title="Close"
              style={mkCtrl('rgba(255,72,72,0.60)')}
            >
              <X size={9} />
            </button>
          </div>
        </div>

        {/* Body */}
        {!state.minimized && (
          <div style={{ maxHeight: 'calc(100vh - 130px)', overflowY: 'auto', overscrollBehavior: 'contain' }}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

function mkCtrl(color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 18, height: 18, borderRadius: 4,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    cursor: 'pointer', color,
    transition: 'all 0.12s',
    flexShrink: 0,
  };
}
