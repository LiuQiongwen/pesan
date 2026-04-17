import { useRef, useCallback, useEffect, useState, type ReactNode, type LucideIcon } from 'react';
import { X, Minus, Pin, Maximize2, Minimize2, ALargeSmall, Expand, Shrink } from 'lucide-react';
import { useToolbox, type PodId } from '@/contexts/ToolboxContext';
import { ResizeHandles } from '@/components/window-manager/ResizeHandles';
import { useWindowSnap } from '@/hooks/useWindowSnap';
import { emitSnapGuides } from '@/components/window-manager/snap-utils';
import { useDevice } from '@/hooks/useDevice';
import { MobileBottomSheet } from '@/components/floating/MobileBottomSheet';

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

/** Default CSS clamp sizes (used when no explicit size is set) */
const AUTO_W_COMPACT  = 'clamp(260px, 26vw, 400px)';
const AUTO_W_EXPANDED = 'clamp(300px, 32vw, 620px)';
const AUTO_H_COMPACT  = 'clamp(180px, 24vh, 300px)';
const AUTO_H_EXPANDED = 'clamp(240px, 44vh, 560px)';

const MIN_W = 200;
const MIN_H = 130;

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function FloatingPod({
  id, title, subtitle, icon: Icon, accentColor, children,
}: FloatingPodProps) {
  const { isPhone } = useDevice();

  // Phone: use bottom sheet
  if (isPhone) {
    return (
      <MobileBottomSheet id={id} title={title} subtitle={subtitle} icon={Icon} accentColor={accentColor}>
        {children}
      </MobileBottomSheet>
    );
  }

  // Desktop / Tablet: existing floating window
  return (
    <DesktopFloatingPod id={id} title={title} subtitle={subtitle} icon={Icon} accentColor={accentColor}>
      {children}
    </DesktopFloatingPod>
  );
}

function DesktopFloatingPod({
  id, title, subtitle, icon: Icon, accentColor, children,
}: FloatingPodProps) {
  const {
    pods, layoutConfig, reportedSizesRef,
    closePod, minimizePod, bringToFront,
    setPos, setSize, setPinned, setFontScale, setSizeMode,
    reportSize,
  } = useToolbox();

  const { snap } = useWindowSnap();
  const state     = pods[id];
  const { locked, gridSize, snapToEdge, globalFontScale } = layoutConfig;

  const panelRef  = useRef<HTMLDivElement>(null);
  const dragging  = useRef(false);
  const dragOff   = useRef({ x: 0, y: 0 });

  // Font scale popover
  const [showFontPopover, setShowFontPopover] = useState(false);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const prevStateRef = useRef<{ pos: { x: number; y: number }; w: number | null; h: number | null } | null>(null);

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      prevStateRef.current = { pos: { ...state.pos }, w: state.size.w, h: state.size.h };
      setPos(id, { x: 0, y: 0 });
      setSize(id, { w: window.innerWidth, h: window.innerHeight });
      setIsFullscreen(true);
    } else {
      if (prevStateRef.current) {
        setPos(id, prevStateRef.current.pos);
        setSize(id, { w: prevStateRef.current.w ?? MIN_W, h: prevStateRef.current.h ?? MIN_H });
      }
      setIsFullscreen(false);
    }
  }, [isFullscreen, id, state.pos, state.size, setPos, setSize]);

  const a = (alpha: number) => hexToRgba(accentColor, alpha);

  // ── Report actual size via ResizeObserver ─────────────────────────────
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      reportSize(id, width, height);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [id, reportSize]);

  // ── Drag ──────────────────────────────────────────────────────────────
  const onMouseDownHeader = useCallback((e: React.MouseEvent) => {
    if (locked || state.pinned) return;
    dragging.current = true;
    dragOff.current  = { x: e.clientX - state.pos.x, y: e.clientY - state.pos.y };
    bringToFront(id);
    e.preventDefault();
  }, [locked, state.pinned, state.pos, id, bringToFront]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;

      const actualW = panelRef.current?.getBoundingClientRect().width  ?? (state.size.w ?? MIN_W);
      const actualH = panelRef.current?.getBoundingClientRect().height ?? (state.size.h ?? MIN_H);

      const rawX = e.clientX - dragOff.current.x;
      const rawY = e.clientY - dragOff.current.y;

      const { pos, guides } = snap(
        id,
        { x: rawX, y: rawY },
        { w: actualW, h: actualH },
        layoutConfig,
        pods,
        reportedSizesRef.current,
        accentColor,
      );

      setPos(id, pos);
      emitSnapGuides(guides, true);
    };

    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      emitSnapGuides([], false);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [id, setPos, snap, layoutConfig, pods, reportedSizesRef, accentColor, state.size.w, state.size.h]);

  // ── Resize handler ────────────────────────────────────────────────────
  const handleResize = useCallback((
    pos:  { x: number; y: number },
    size: { w: number; h: number },
  ) => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const cw = clamp(size.w, MIN_W, W - 16);
    const ch = clamp(size.h, MIN_H, H - 60);
    const cx = clamp(pos.x,  0,     W - cw);
    const cy = clamp(pos.y,  0,     H - 60);
    setPos(id,  { x: cx, y: cy });
    setSize(id, { w: cw, h: ch });
  }, [id, setPos, setSize]);

  // ── Effective dimensions ──────────────────────────────────────────────
  const explicitW = state.size.w;
  const explicitH = state.size.h;
  const autoW     = state.sizeMode === 'compact' ? AUTO_W_COMPACT  : AUTO_W_EXPANDED;
  const autoBodyH = state.sizeMode === 'compact' ? AUTO_H_COMPACT  : AUTO_H_EXPANDED;

  // CSS custom properties for font scale
  const fontScaleVar = `calc(${state.fontScale} * ${globalFontScale})`;

  if (!state?.open) return null;

  // Measure current size for resize handles
  const measuredW = panelRef.current?.getBoundingClientRect().width  ?? (explicitW ?? 400);
  const measuredH = panelRef.current?.getBoundingClientRect().height ?? (explicitH ?? 300);

  return (
    <div
      ref={panelRef}
      onMouseDown={() => bringToFront(id)}
      style={{
        position:   'fixed',
        left:       state.pos.x,
        top:        state.pos.y,
        width:      explicitW !== null ? explicitW : autoW,
        height:     explicitH !== null ? (state.minimized ? 'auto' : explicitH) : 'auto',
        zIndex:     state.zIndex,
        animation:  'pod-in 0.22s cubic-bezier(0.16,1,0.3,1)',
        maxWidth:   'calc(100vw - 16px)',
        maxHeight:  'calc(100vh - 60px)',
        // Font scale injected as CSS custom property
        ['--win-font-scale' as string]: fontScaleVar,
      }}
    >
      <style>{`
        @keyframes edit-rim-pulse {
          0%, 100% { opacity: 0.45; box-shadow: 0 0 0 0 rgba(102,240,255,0); }
          50%       { opacity: 0.85; box-shadow: 0 0 18px 2px rgba(102,240,255,0.22); }
        }
      `}</style>
      {/* Resize handles (only in edit mode and not minimized) */}
      {!locked && !state.minimized && (
        <ResizeHandles
          accentColor={accentColor}
          currentPos={state.pos}
          currentSize={{ w: measuredW, h: measuredH }}
          onResize={handleResize}
        />
      )}

      {/* Edit-mode indicator — visible animated dashed rim */}
      {!locked && !state.minimized && (
        <div style={{
          position: 'absolute', inset: -3,
          borderRadius: 20,
          border: '1px dashed rgba(102,240,255,0.45)',
          pointerEvents: 'none',
          animation: 'edit-rim-pulse 2.4s ease-in-out infinite',
          zIndex: 2,
        }} />
      )}

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
        height:   explicitH !== null && !state.minimized ? '100%' : undefined,
        display:  'flex',
        flexDirection: 'column',
      }}>

        {/* Title bar */}
        <div
          onMouseDown={onMouseDownHeader}
          style={{
            display: 'flex', alignItems: 'center', flexShrink: 0,
            cursor: (locked || state.pinned) ? 'default' : 'grab',
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
            <div style={{
              width: 'clamp(32px, 3.0vw, 44px)', height: 'clamp(32px, 3.0vw, 44px)',
              borderRadius: 'clamp(8px, 0.8vw, 11px)',
              background: a(0.16), border: `1.5px solid ${a(0.36)}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: `0 0 18px ${a(0.25)}, inset 0 1px 0 ${a(0.20)}`,
            }}>
              <Icon size={20} color={accentColor} style={{
                filter: `drop-shadow(0 0 6px ${a(0.70)})`,
                width: 'clamp(14px, 1.4vw, 20px)', height: 'clamp(14px, 1.4vw, 20px)',
              }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: INTER,
                fontSize: `calc(clamp(12px, 1.1vw, 15px) * var(--win-font-scale, 1))`,
                fontWeight: 700,
                color: 'rgba(225,235,255,0.95)',
                letterSpacing: '0.02em', lineHeight: 1.2,
              }}>
                {title}
              </div>
              {subtitle && !state.minimized && (
                <div style={{
                  fontFamily: MONO,
                  fontSize: `calc(clamp(9px, 0.8vw, 11px) * var(--win-font-scale, 1))`,
                  color: a(0.60), letterSpacing: '0.05em', marginTop: 3, lineHeight: 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
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
            {/* Font scale (edit mode only) */}
            {!locked && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowFontPopover(p => !p)}
                  title="字体大小"
                  style={mkCtrl(a(0.65), a(0.12), a(0.25))}
                >
                  <ALargeSmall size={11} />
                </button>
                {showFontPopover && (
                  <div style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: 6,
                    background: 'rgba(3,7,22,0.97)',
                    backdropFilter: 'blur(24px)',
                    border: `1px solid ${a(0.30)}`,
                    borderRadius: 8, padding: '8px 12px',
                    zIndex: 10, width: 130,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.65)',
                  }}>
                    <div style={{ fontFamily: MONO, fontSize: 7.5, color: a(0.55), marginBottom: 6, letterSpacing: '0.07em' }}>
                      字体缩放
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={() => setFontScale(id, Math.round((state.fontScale - 0.05) * 100) / 100)}
                        style={{ ...smallBtn(accentColor), padding: '2px 7px' }}
                      >−</button>
                      <div style={{ flex: 1, textAlign: 'center', fontFamily: MONO, fontSize: 9, color: accentColor }}>
                        {Math.round(state.fontScale * 100)}%
                      </div>
                      <button
                        onClick={() => setFontScale(id, Math.round((state.fontScale + 0.05) * 100) / 100)}
                        style={{ ...smallBtn(accentColor), padding: '2px 7px' }}
                      >+</button>
                    </div>
                    <input
                      type="range" min={0.6} max={1.8} step={0.05}
                      value={state.fontScale}
                      onChange={e => setFontScale(id, Number(e.target.value))}
                      style={{ width: '100%', marginTop: 5, accentColor }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Size toggle */}
            <button
              onClick={() => setSizeMode(id, state.sizeMode === 'compact' ? 'expanded' : 'compact')}
              title={state.sizeMode === 'compact' ? 'Expand' : 'Compact'}
              style={mkCtrl(a(0.65), a(0.12), a(0.25))}
            >
              {state.sizeMode === 'compact' ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
            </button>

            {/* Fullscreen toggle */}
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? '退出全屏' : '全屏展开'}
              style={mkCtrl(
                isFullscreen ? accentColor : 'rgba(190,205,230,0.45)',
                isFullscreen ? a(0.16) : undefined,
                isFullscreen ? a(0.30) : undefined,
              )}
            >
              {isFullscreen ? <Shrink size={12} /> : <Expand size={12} />}
            </button>

            {/* Pin */}
            <button
              onClick={() => setPinned(id, !state.pinned)}
              title={state.pinned ? 'Unpin' : 'Pin'}
              style={mkCtrl(
                state.pinned ? accentColor : 'rgba(190,205,230,0.45)',
                state.pinned ? a(0.16) : undefined,
                state.pinned ? a(0.30) : undefined,
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
            maxHeight: explicitH !== null ? undefined : autoBodyH,
            flex: explicitH !== null ? 1 : undefined,
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
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: accentColor, boxShadow: `0 0 6px ${a(0.80)}`,
                animation: 'pod-dot 2.4s ease-in-out infinite',
              }} />
              <span style={{
                fontFamily: MONO,
                fontSize: `calc(clamp(8px, 0.75vw, 10px) * var(--win-font-scale, 1))`,
                color: a(0.50), letterSpacing: '0.06em',
              }}>
                {locked ? 'LOCKED' : 'ACTIVE'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Size indicator */}
              {explicitW !== null && (
                <span style={{
                  fontFamily: MONO, fontSize: 7.5, color: 'rgba(80,100,130,0.45)', letterSpacing: '0.04em',
                }}>
                  {Math.round(explicitW)}×{Math.round(explicitH ?? 0)}
                </span>
              )}
              <span style={{
                fontFamily: MONO,
                fontSize: `calc(clamp(8px, 0.75vw, 10px) * var(--win-font-scale, 1))`,
                color: 'rgba(60,75,105,0.50)', letterSpacing: '0.04em',
              }}>
                {state.sizeMode === 'compact' ? 'COMPACT' : 'EXPANDED'}
              </span>
            </div>
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

function mkCtrl(color: string, bg?: string, border?: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width:  'clamp(24px, 2.2vw, 30px)',
    height: 'clamp(24px, 2.2vw, 30px)',
    borderRadius: 8,
    background: bg     ?? 'rgba(255,255,255,0.05)',
    border: `1px solid ${border ?? 'rgba(255,255,255,0.09)'}`,
    cursor: 'pointer', color,
    transition: 'all 0.14s', flexShrink: 0,
  };
}

function smallBtn(color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: MONO, fontSize: 11, fontWeight: 700,
    color, background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 4, cursor: 'pointer',
  };
}
