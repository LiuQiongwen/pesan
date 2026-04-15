import { useRef, useCallback, useEffect, useState, type ReactNode, type LucideIcon } from 'react';
import { X, Minus, Pin, Maximize2, Minimize2 } from 'lucide-react';
import { useToolbox, type PodId } from '@/contexts/ToolboxContext';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

interface FloatingPodProps {
  id:          PodId;
  title:       string;
  subtitle?:   string;
  icon:        LucideIcon;
  accentColor: string;
  /** light: 380px, expanded: 620px — can be overridden */
  width?:      number;
  /** @deprecated kept for API compatibility */
  mode?:       'primary' | 'secondary';
  children:    ReactNode;
}

type SizeMode = 'light' | 'expanded';

const SIZE: Record<SizeMode, { width: number; bodyMaxH: string }> = {
  light:    { width: 400,  bodyMaxH: '300px' },
  expanded: { width: 640,  bodyMaxH: '560px' },
};

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
  children,
}: FloatingPodProps) {
  const { pods, closePod, minimizePod, bringToFront, setPos } = useToolbox();
  const state = pods[id];
  const [pinned,   setPinned]   = useState(false);
  const [sizeMode, setSizeMode] = useState<SizeMode>('expanded');
  const dragging   = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef   = useRef<HTMLDivElement>(null);

  const { width, bodyMaxH } = SIZE[sizeMode];

  const a = (alpha: number) => hexToRgba(accentColor, alpha);

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
      const nx = Math.max(0, Math.min(window.innerWidth  - width - 4,  e.clientX - dragOffset.current.x));
      const ny = Math.max(0, Math.min(window.innerHeight - 60,         e.clientY - dragOffset.current.y));
      setPos(id, { x: nx, y: ny });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [id, width, setPos]);

  if (!state?.open) return null;

  return (
    <div
      ref={panelRef}
      onMouseDown={() => bringToFront(id)}
      style={{
        position:  'fixed',
        left:      state.pos.x,
        top:       state.pos.y,
        width,
        zIndex:    state.zIndex,
        animation: 'pod-in 0.22s cubic-bezier(0.16,1,0.3,1)',
        transition: 'width 0.24s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Outer glow ring */}
      <div style={{
        position: 'absolute', inset: -1,
        borderRadius: 17,
        background: `linear-gradient(135deg, ${a(0.20)}, transparent 60%)`,
        pointerEvents: 'none',
        zIndex: -1,
      }} />

      <div style={{
        background: 'rgba(3,5,13,0.97)',
        backdropFilter: 'blur(40px) saturate(2)',
        WebkitBackdropFilter: 'blur(40px) saturate(2)',
        border: `1.5px solid ${a(0.42)}`,
        borderRadius: 16,
        boxShadow: `
          0 0 0 1px ${a(0.10)},
          0 0 50px ${a(0.14)},
          0 24px 72px rgba(0,0,0,0.90),
          inset 0 1px 0 rgba(255,255,255,0.06)
        `,
        overflow: 'hidden',
      }}>

        {/* Title bar */}
        <div
          onMouseDown={onMouseDownHeader}
          style={{
            display: 'flex',
            alignItems: 'center',
            cursor: pinned ? 'default' : 'grab',
            userSelect: 'none',
            borderBottom: state.minimized ? 'none' : `1px solid ${a(0.14)}`,
            background: `linear-gradient(90deg, ${a(0.22)}, ${a(0.08)} 60%, rgba(255,255,255,0.02))`,
          }}
        >
          {/* Left accent bar with glow */}
          <div style={{
            width: 5,
            alignSelf: 'stretch',
            background: `linear-gradient(180deg, ${accentColor}, ${a(0.60)})`,
            flexShrink: 0,
            boxShadow: `3px 0 18px ${a(0.55)}`,
          }} />

          {/* Icon + text */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '13px 16px',
            flex: 1, minWidth: 0,
          }}>
            {/* Icon container */}
            <div style={{
              width: 40, height: 40,
              borderRadius: 10,
              background: a(0.16),
              border: `1.5px solid ${a(0.36)}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: `0 0 18px ${a(0.25)}, inset 0 1px 0 ${a(0.20)}`,
            }}>
              <Icon size={20} color={accentColor} style={{
                filter: `drop-shadow(0 0 6px ${a(0.70)})`,
              }} />
            </div>

            {/* Title + subtitle */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: INTER,
                fontSize: 14,
                fontWeight: 700,
                color: 'rgba(225,235,255,0.95)',
                letterSpacing: '0.02em',
                lineHeight: 1.2,
              }}>
                {title}
              </div>
              {subtitle && !state.minimized && (
                <div style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  color: a(0.60),
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

          {/* Window controls */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px' }}
            onMouseDown={e => e.stopPropagation()}
          >
            {/* Size toggle */}
            <button
              onClick={() => setSizeMode(m => m === 'light' ? 'expanded' : 'light')}
              title={sizeMode === 'light' ? 'Expand' : 'Compact'}
              style={mkCtrl(a(0.65), a(0.12), a(0.25))}
            >
              {sizeMode === 'light' ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
            </button>

            {/* Pin */}
            <button
              onClick={() => setPinned(p => !p)}
              title={pinned ? 'Unpin' : 'Pin'}
              style={mkCtrl(
                pinned ? accentColor : 'rgba(190,205,230,0.45)',
                pinned ? a(0.16) : undefined,
                pinned ? a(0.30) : undefined,
              )}
            >
              <Pin size={12} />
            </button>

            {/* Minimize */}
            <button
              onClick={() => minimizePod(id)}
              title="Collapse"
              style={mkCtrl('rgba(210,220,240,0.55)')}
            >
              <Minus size={12} />
            </button>

            {/* Close */}
            <button
              onClick={() => closePod(id)}
              title="Close"
              style={mkCtrl('rgba(255,80,80,0.75)', 'rgba(255,60,60,0.08)', 'rgba(255,60,60,0.25)')}
            >
              <X size={12} />
            </button>
          </div>
        </div>

        {/* Body */}
        {!state.minimized && (
          <div style={{
            maxHeight: bodyMaxH,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            transition: 'max-height 0.24s cubic-bezier(0.4,0,0.2,1)',
          }}>
            {children}
          </div>
        )}

        {/* Footer status bar */}
        {!state.minimized && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 16px 6px 21px',
            borderTop: `1px solid ${a(0.10)}`,
            background: 'rgba(0,0,0,0.25)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: accentColor,
                boxShadow: `0 0 6px ${a(0.80)}`,
                animation: 'pod-dot 2.4s ease-in-out infinite',
              }} />
              <span style={{
                fontFamily: MONO, fontSize: 9,
                color: a(0.50), letterSpacing: '0.06em',
              }}>
                ACTIVE
              </span>
            </div>
            <span style={{
              fontFamily: MONO, fontSize: 9,
              color: 'rgba(60,75,105,0.50)',
              letterSpacing: '0.04em',
            }}>
              {sizeMode === 'light' ? 'LIGHT' : 'EXPANDED'}
            </span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pod-in {
          from { opacity: 0; transform: scale(0.94) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
        @keyframes pod-dot {
          0%,100% { opacity: 0.6; }
          50%     { opacity: 1; box-shadow: 0 0 10px currentColor; }
        }
      `}</style>
    </div>
  );
}

function mkCtrl(
  color:   string,
  bg?:     string,
  border?: string,
): React.CSSProperties {
  return {
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    width:           28,
    height:          28,
    borderRadius:    8,
    background:      bg     ?? 'rgba(255,255,255,0.05)',
    border:          `1px solid ${border ?? 'rgba(255,255,255,0.09)'}`,
    cursor:          'pointer',
    color,
    transition:      'all 0.14s',
    flexShrink:      0,
  };
}
