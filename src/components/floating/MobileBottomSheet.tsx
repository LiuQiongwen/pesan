import { useRef, useCallback, useEffect, useState, type ReactNode, type LucideIcon } from 'react';
import { X } from 'lucide-react';
import { useToolbox, type PodId } from '@/contexts/ToolboxContext';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

interface MobileBottomSheetProps {
  id:          PodId;
  title:       string;
  subtitle?:   string;
  icon:        LucideIcon;
  accentColor: string;
  children:    ReactNode;
}

function hexA(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function MobileBottomSheet({
  id, title, subtitle, icon: Icon, accentColor, children,
}: MobileBottomSheetProps) {
  const { pods, closePod } = useToolbox();
  const state = pods[id];
  const sheetRef = useRef<HTMLDivElement>(null);

  // Drag-to-dismiss state
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const startDragY = useRef(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    startDragY.current = dragY;
    setDragging(true);
  }, [dragY]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging) return;
    const dy = e.touches[0].clientY - startY.current;
    // Only allow dragging down
    setDragY(Math.max(0, startDragY.current + dy));
  }, [dragging]);

  const onTouchEnd = useCallback(() => {
    setDragging(false);
    if (dragY > 120) {
      // Dismiss
      closePod(id);
      setDragY(0);
    } else {
      setDragY(0);
    }
  }, [dragY, closePod, id]);

  // Reset drag when closed
  useEffect(() => {
    if (!state?.open) setDragY(0);
  }, [state?.open]);

  if (!state?.open) return null;

  const a = (alpha: number) => hexA(accentColor, alpha);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => closePod(id)}
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(4px)',
          animation: 'fade-in var(--dur-standard) var(--spring-snap)',
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          zIndex: 51,
          maxHeight: 'calc(90vh - env(safe-area-inset-bottom, 0px))',
          transform: `translateY(${dragY}px)`,
          transition: dragging ? 'none' : 'transform var(--dur-gentle) var(--spring)',
          display: 'flex', flexDirection: 'column',
          background: 'rgba(3,5,13,0.98)',
          backdropFilter: 'blur(40px) saturate(2)',
          WebkitBackdropFilter: 'blur(40px) saturate(2)',
          borderTop: `1.5px solid ${a(0.42)}`,
          borderRadius: '20px 20px 0 0',
          boxShadow: `0 -4px 40px rgba(0,0,0,0.80), 0 0 40px ${a(0.12)}`,
          overflow: 'hidden',
          animation: dragY === 0 && !dragging ? 'spring-up var(--dur-gentle) var(--spring)' : 'none',
        }}
      >
        {/* Drag handle */}
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{
            display: 'flex', justifyContent: 'center',
            padding: '10px 0 6px',
            cursor: 'grab',
            touchAction: 'none',
          }}
        >
          <div style={{
            width: 36, height: 4, borderRadius: 2,
            background: 'rgba(255,255,255,0.18)',
          }} />
        </div>

        {/* Title bar */}
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{
            display: 'flex', alignItems: 'center', flexShrink: 0,
            padding: '4px 16px 12px',
            borderBottom: `1px solid ${a(0.14)}`,
            background: `linear-gradient(90deg, ${a(0.15)}, ${a(0.05)} 60%, rgba(255,255,255,0.02))`,
            touchAction: 'none',
          }}
        >
          {/* Icon */}
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: a(0.16), border: `1.5px solid ${a(0.36)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: `0 0 14px ${a(0.25)}`,
          }}>
            <Icon size={18} color={accentColor} style={{ filter: `drop-shadow(0 0 5px ${a(0.70)})` }} />
          </div>

          {/* Title text */}
          <div style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
            <div style={{
              fontFamily: INTER, fontSize: 15, fontWeight: 700,
              color: 'rgba(225,235,255,0.95)', lineHeight: 1.2,
            }}>{title}</div>
            {subtitle && (
              <div style={{
                fontFamily: MONO, fontSize: 10, color: a(0.55),
                letterSpacing: '0.04em', marginTop: 2, lineHeight: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{subtitle}</div>
            )}
          </div>

          {/* Close */}
          <button
            onClick={() => closePod(id)}
            style={{
              width: 36, height: 36, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,80,80,0.08)',
              border: '1px solid rgba(255,80,80,0.20)',
              color: 'rgba(255,80,80,0.75)',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
        }}>
          {children}
        </div>

        {/* Bottom accent line */}
        <div style={{
          height: 2,
          background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
          boxShadow: `0 0 12px ${a(0.60)}`,
          flexShrink: 0,
        }} />
      </div>
    </>
  );
}
