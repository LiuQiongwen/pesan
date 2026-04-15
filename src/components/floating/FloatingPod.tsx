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
  /** @deprecated kept for API compatibility */
  width?:      number;
  /** @deprecated kept for API compatibility */
  mode?:       'primary' | 'secondary';
  children:    ReactNode;
}

type SizeMode = 'light' | 'expanded';

/** Responsive CSS clamp values — no fixed pixels */
const SIZE: Record<SizeMode, { width: string; bodyMaxH: string }> = {
  light:    { width: 'clamp(280px, 28vw, 440px)',  bodyMaxH: 'clamp(200px, 28vh, 340px)' },
  expanded: { width: 'clamp(320px, 34vw, 660px)',  bodyMaxH: 'clamp(240px, 44vh, 580px)' },
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
      // Use actual rendered width for boundary so CSS clamp is respected
      const actualW = panelRef.current?.getBoundingClientRect().width ?? 400;
      const actualH = panelRef.current?.getBoundingClientRect().height ?? 300;
      const nx = Math.max(0, Math.min(window.innerWidth  - actualW - 4, e.clientX - dragOffset.current.x));
      const ny = Math.max(0, Math.min(window.innerHeight - actualH,     e.clientY - dragOffset.current.y));
      setPos(id, { x: nx, y: ny });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [id, setPos]);

  if (!state?.open) return null;

  return (
    <div
      ref={panelRef}
      onMouseDown={() => bringToFront(id)}
      style={{
        position:   'fixed',
        left:       state.pos.x,
        top:        state.pos.y,
        width,
        zIndex:     state.zIndex,
        animation:  'pod-in 0.22s cubic-bezier(0.16,1,0.3,1)',
        transition: 'width 0.24s cubic-bezier(0.4,0,0.2,1)',
        maxWidth:   'calc(100vw - 16px)',
        maxHeight:  'calc(100vh - 80px)',
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
            width: 'clamp(4px, 0.4vw, 5px)',
            alignSelf: 'stretch',
            background: `linear-gradient(180deg, ${accentColor}, ${a(0.60)})`,
            flexShrink: 0,
            boxShadow: `3px 0 18px ${a(0.55)}`,
          }} />

          {/* Icon + text */}
          <div style={{
            display: 'flex', alignItems: 'center',
            gap: 'clamp(9px, 1.0vw, 13px)',
            padding: 'clamp(10px,1.1vh,14px) clamp(13px,1.3vw,17px)',
            flex: 1, minWidth: 0,
          }}>
            {/* Icon container */}
            <div style={{
              width:  'clamp(32px, 3.0vw, 44px)',
              height: 'clamp(32px, 3.0vw, 44px)',
              borderRadius: 'clamp(8px, 0.8vw, 11px)',
              background: a(0.16),
              border: `1.5px solid ${a(0.36)}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: `0 0 18px ${a(0.25)}, inset 0 1px 0 ${a(0.20)}`,
            }}>
              <Icon size={20} color={accentColor} style={{
                filter: `drop-shadow(0 0 6px ${a(0.70)})`,
                width: 'clamp(14px, 1.4vw, 20px)',
                height: 'clamp(14px, 1.4vw, 20px)',
              }} />
            </div>

            {/* Title + subtitle */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: INTER,
                fontSize: 'clamp(12px, 1.1vw, 15px)',
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
                  fontSize: 'clamp(9px, 0.8vw, 11px)',
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
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 clamp(10px,1.0vw,15px)' }}
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
            padding: 'clamp(5px,0.5vh,8px) clamp(13px,1.2vw,18px) clamp(5px,0.5vh,8px) clamp(16px,1.5vw,22px)',
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
                fontFamily: MONO,
                fontSize: 'clamp(8px, 0.75vw, 10px)',
                color: a(0.50), letterSpacing: '0.06em',
              }}>
                ACTIVE
              </span>
            </div>
            <span style={{
              fontFamily: MONO,
              fontSize: 'clamp(8px, 0.75vw, 10px)',
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
    width:           'clamp(24px, 2.2vw, 30px)',
    height:          'clamp(24px, 2.2vw, 30px)',
    borderRadius:    8,
    background:      bg     ?? 'rgba(255,255,255,0.05)',
    border:          `1px solid ${border ?? 'rgba(255,255,255,0.09)'}`,
    cursor:          'pointer',
    color,
    transition:      'all 0.14s',
    flexShrink:      0,
  };
}
