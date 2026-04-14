import { useRef, useCallback, useEffect, type ReactNode, type LucideIcon } from 'react';
import { X, Minus, Pin, PinOff } from 'lucide-react';
import { useToolbox, type ToolboxId } from '@/contexts/ToolboxContext';
import { cn } from '@/lib/utils';

interface FloatingToolboxProps {
  id: ToolboxId;
  title: string;
  icon: LucideIcon;
  width?: number;
  children: ReactNode;
  accentColor?: 'green' | 'cyan';
}

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";

export function FloatingToolbox({
  id,
  title,
  icon: Icon,
  width = 400,
  children,
  accentColor = 'green',
}: FloatingToolboxProps) {
  const { toolboxes, closeToolbox, minimizeToolbox, bringToFront, setPos } = useToolbox();
  const state = toolboxes[id];
  const isPinned = useRef(false);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const neonColor = accentColor === 'cyan' ? '#66f0ff' : '#00ff66';
  const glowColor = accentColor === 'cyan' ? 'rgba(102,240,255,0.22)' : 'rgba(0,255,102,0.22)';
  const borderColor = accentColor === 'cyan' ? 'rgba(102,240,255,0.30)' : 'rgba(0,255,102,0.30)';

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (isPinned.current) return;
    const el = panelRef.current;
    if (!el) return;
    dragging.current = true;
    dragOffset.current = {
      x: e.clientX - state.pos.x,
      y: e.clientY - state.pos.y,
    };
    bringToFront(id);
    e.preventDefault();
  }, [id, state.pos, bringToFront]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const newX = Math.max(0, Math.min(window.innerWidth - width - 4, e.clientX - dragOffset.current.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 50, e.clientY - dragOffset.current.y));
      setPos(id, { x: newX, y: newY });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [id, width, setPos]);

  if (!state.open) return null;

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
        animation: 'toolbox-in 0.18s ease-out',
      }}
      className="animate-toolbox-in"
    >
      {/* Glass panel */}
      <div
        style={{
          background: 'rgba(4,6,10,0.88)',
          backdropFilter: 'blur(22px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(22px) saturate(1.5)',
          border: `1px solid ${borderColor}`,
          borderRadius: 10,
          boxShadow: `0 0 0 1px ${glowColor}, 0 12px 48px rgba(0,0,0,0.75)`,
          overflow: 'hidden',
        }}
      >
        {/* Title bar — drag handle */}
        <div
          onMouseDown={onMouseDown}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 12px',
            cursor: isPinned.current ? 'default' : 'grab',
            borderBottom: state.minimized ? 'none' : `1px solid rgba(255,255,255,0.05)`,
            userSelect: 'none',
            background: 'rgba(0,0,0,0.25)',
          }}
        >
          {/* Icon */}
          <Icon size={13} color={neonColor} style={{ flexShrink: 0 }} />

          {/* Title */}
          <span style={{
            fontFamily: MONO,
            fontSize: 10,
            fontWeight: 500,
            color: neonColor,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            flex: 1,
          }}>
            {title}
          </span>

          {/* Controls */}
          <div style={{ display: 'flex', gap: 4 }} onMouseDown={e => e.stopPropagation()}>
            {/* Pin */}
            <button
              onClick={() => { isPinned.current = !isPinned.current; }}
              title="Pin"
              style={ctrlBtn}
            >
              {isPinned.current ? <PinOff size={10} /> : <Pin size={10} />}
            </button>
            {/* Minimize */}
            <button
              onClick={() => minimizeToolbox(id)}
              title="Minimize"
              style={ctrlBtn}
            >
              <Minus size={10} />
            </button>
            {/* Close */}
            <button
              onClick={() => closeToolbox(id)}
              title="Close"
              style={{ ...ctrlBtn, color: 'rgba(255,80,80,0.7)' }}
            >
              <X size={10} />
            </button>
          </div>
        </div>

        {/* Content */}
        {!state.minimized && (
          <div
            className={cn("overflow-y-auto")}
            style={{
              maxHeight: 'calc(100vh - 120px)',
              overscrollBehavior: 'contain',
            }}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

const ctrlBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 20,
  height: 20,
  borderRadius: 4,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  cursor: 'pointer',
  color: 'rgba(180,185,200,0.70)',
  transition: 'all 0.15s',
};
