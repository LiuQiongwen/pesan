/**
 * ResizeHandles — 8-point resize handles for FloatingPod edit mode.
 * Renders corner + edge-midpoint handles with cosmic luminous styling.
 */
import { useEffect, useRef } from 'react';

type Handle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

const HANDLE_SIZE = 8;
const MIN_W = 200;
const MIN_H = 130;

interface ResizeHandlesProps {
  accentColor: string;
  currentPos:  { x: number; y: number };
  currentSize: { w: number; h: number };
  onResize:    (pos: { x: number; y: number }, size: { w: number; h: number }) => void;
}

const HANDLES: { id: Handle; cursor: string; style: React.CSSProperties }[] = [
  {
    id: 'nw', cursor: 'nwse-resize',
    style: { top: -4, left: -4 },
  },
  {
    id: 'n',  cursor: 'ns-resize',
    style: { top: -4, left: '50%', transform: 'translateX(-50%)', width: 24 },
  },
  {
    id: 'ne', cursor: 'nesw-resize',
    style: { top: -4, right: -4 },
  },
  {
    id: 'e',  cursor: 'ew-resize',
    style: { top: '50%', right: -4, transform: 'translateY(-50%)', height: 24 },
  },
  {
    id: 'se', cursor: 'nwse-resize',
    style: { bottom: -4, right: -4 },
  },
  {
    id: 's',  cursor: 'ns-resize',
    style: { bottom: -4, left: '50%', transform: 'translateX(-50%)', width: 24 },
  },
  {
    id: 'sw', cursor: 'nesw-resize',
    style: { bottom: -4, left: -4 },
  },
  {
    id: 'w',  cursor: 'ew-resize',
    style: { top: '50%', left: -4, transform: 'translateY(-50%)', height: 24 },
  },
];

export function ResizeHandles({ accentColor, currentPos, currentSize, onResize }: ResizeHandlesProps) {
  const resizingRef = useRef<{
    handle:   Handle;
    startX:   number;
    startY:   number;
    startW:   number;
    startH:   number;
    startPX:  number;
    startPY:  number;
  } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const { handle, startX, startY, startW, startH, startPX, startPY } = resizingRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newW  = startW;
      let newH  = startH;
      let newPX = startPX;
      let newPY = startPY;

      if (handle.includes('e')) newW = Math.max(MIN_W, startW + dx);
      if (handle.includes('w')) { newW = Math.max(MIN_W, startW - dx); newPX = startPX + (startW - newW); }
      if (handle.includes('s')) newH = Math.max(MIN_H, startH + dy);
      if (handle.includes('n')) { newH = Math.max(MIN_H, startH - dy); newPY = startPY + (startH - newH); }

      onResize({ x: newPX, y: newPY }, { w: newW, h: newH });
    };

    const onUp = () => { resizingRef.current = null; };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [onResize]);

  const onHandleDown = (e: React.MouseEvent, handle: Handle) => {
    e.stopPropagation();
    e.preventDefault();
    resizingRef.current = {
      handle,
      startX:  e.clientX,
      startY:  e.clientY,
      startW:  currentSize.w,
      startH:  currentSize.h,
      startPX: currentPos.x,
      startPY: currentPos.y,
    };
  };

  const hexToRgba = (hex: string, a: number) => {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `rgba(${r},${g},${b},${a})`;
  };

  return (
    <>
      {HANDLES.map(h => (
        <div
          key={h.id}
          onMouseDown={e => onHandleDown(e, h.id)}
          style={{
            position:    'absolute',
            width:       HANDLE_SIZE,
            height:      HANDLE_SIZE,
            borderRadius: 2,
            background:  accentColor,
            boxShadow:   `0 0 8px ${hexToRgba(accentColor, 0.9)}, 0 0 2px ${hexToRgba(accentColor, 0.5)}`,
            cursor:      h.cursor,
            zIndex:      10,
            transition:  'opacity 0.14s, transform 0.14s',
            opacity:     0.75,
            ...h.style,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLDivElement).style.opacity = '1';
            (e.currentTarget as HTMLDivElement).style.transform =
              ((h.style.transform as string) ?? '') + ' scale(1.4)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLDivElement).style.opacity = '0.75';
            (e.currentTarget as HTMLDivElement).style.transform = h.style.transform as string ?? '';
          }}
        />
      ))}

      {/* Resize rim glow */}
      <div style={{
        position:     'absolute',
        inset:        -1,
        borderRadius: 17,
        border:       `1px solid ${hexToRgba(accentColor, 0.35)}`,
        pointerEvents:'none',
        boxShadow:    `0 0 12px ${hexToRgba(accentColor, 0.20)}, inset 0 0 12px ${hexToRgba(accentColor, 0.08)}`,
        animation:    'resize-rim-pulse 2s ease-in-out infinite',
      }} />

      <style>{`
        @keyframes resize-rim-pulse {
          0%, 100% { opacity: 0.7; }
          50%       { opacity: 1.0; }
        }
      `}</style>
    </>
  );
}
