import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { CosmosNote } from '@/components/starmap/cosmos-layout';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter','system-ui',sans-serif";

const PODS = [
  { id: 'capture',   label: 'Capture', color: '#00ff66' },
  { id: 'retrieval', label: 'Retrieve', color: '#66f0ff' },
  { id: 'insight',   label: 'Insight',  color: '#b496ff' },
  { id: 'memory',    label: 'Memory',   color: '#ffa040' },
  { id: 'action',    label: 'Action',   color: '#ff4466' },
];

/* ── Mobile menu item ─────────────────────────────────────────────────── */
function MobileMenuItem({ label, sub, color, onClick }: { label: string; sub?: string; color?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      width: '100%', textAlign: 'left',
      padding: '10px 20px',
      fontFamily: INTER, fontSize: 15, fontWeight: 500,
      color: color ?? 'rgba(220,230,250,0.90)',
      background: 'transparent',
      border: 'none', cursor: 'pointer',
      WebkitTapHighlightColor: 'rgba(102,240,255,0.08)',
    }}>
      <span>{label}</span>
      {sub && <span style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(160,175,200,0.50)', letterSpacing: '0.04em' }}>{sub}</span>}
    </button>
  );
}

interface Props {
  noteId: string;
  x: number;
  y: number;
  note: CosmosNote | undefined;
  onClose: () => void;
  onOpenNote: (noteId: string) => void;
  onDistill: (noteId: string) => void;
  onSendToPod: (noteId: string, podId: string) => void;
  onFlash: (noteId: string) => void;
  onConnect?: (noteId: string) => void;
  onDelete?: (noteId: string) => void;
  onResetPosition?: (noteId: string) => void;
  onCreateAnchor?: (noteId: string) => void;
  hasManualPosition?: boolean;
}

function Item({ label, onClick, sub }: { label: string; onClick: () => void; sub?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '5px 12px',
        fontFamily: MONO, fontSize: sub ? 10 : 11, letterSpacing: '0.04em',
        color: hover ? 'rgba(102,240,255,0.92)' : 'rgba(200,215,240,0.82)',
        background: hover ? 'rgba(102,240,255,0.06)' : 'transparent',
        border: 'none', cursor: 'pointer',
        transition: 'background 0.1s, color 0.1s',
      }}
    >{label}</button>
  );
}

export function NodeContextMenu({ noteId, x, y, note, onClose, onOpenNote, onDistill, onSendToPod, onFlash, onConnect, onDelete, onResetPosition, onCreateAnchor, hasManualPosition }: Props) {
  const [podHover, setPodHover] = useState(false);
  const isPhone = typeof window !== 'undefined' && window.innerWidth < 768;

  // Dismiss on any outside click/touch
  useEffect(() => {
    const h = (e: MouseEvent | TouchEvent) => {
      const el = document.getElementById('cosmos-ctx-menu');
      const target = 'touches' in e ? e.touches[0]?.target : e.target;
      if (el && target && !el.contains(target as Node)) onClose();
    };
    setTimeout(() => {
      document.addEventListener('mousedown', h);
      document.addEventListener('touchstart', h, { passive: true });
    }, 0);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('touchstart', h);
    };
  }, [onClose]);

  // ── Phone: bottom-anchored action sheet ──────────────────────────────────
  if (isPhone) {
    const act = (fn: () => void) => () => { fn(); onClose(); };
    return createPortal(
      <>
        {/* Backdrop */}
        <div onClick={onClose} style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.55)',
          animation: 'cosmos-window-in 0.15s ease',
        }} />
        {/* Sheet */}
        <div id="cosmos-ctx-menu" style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
          background: 'rgba(2,5,16,0.98)',
          backdropFilter: 'blur(24px)',
          borderTop: '1px solid rgba(102,240,255,0.12)',
          borderRadius: '16px 16px 0 0',
          padding: '16px 0 max(16px, env(safe-area-inset-bottom))',
          animation: 'mobile-sheet-up 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
        }}>
          {/* Drag handle */}
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', margin: '0 auto 12px' }} />
          {/* Title */}
          <div style={{
            padding: '0 20px 12px',
            fontFamily: INTER, fontSize: 14, fontWeight: 600,
            color: 'rgba(220,230,250,0.88)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {note?.title ?? '(Unnamed)'}
          </div>
          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <MobileMenuItem label="Open Note" sub="Open this knowledge node" onClick={act(() => onOpenNote(noteId))} />
            <MobileMenuItem label="Quick Distill" sub="Generate insights" onClick={act(() => onDistill(noteId))} />
            <MobileMenuItem label="Locate in Cosmos" sub="Flash and center" onClick={act(() => onFlash(noteId))} />
            {onConnect && <MobileMenuItem label="Connect to..." sub="Link this node to another" color="#ff44ff" onClick={act(() => onConnect(noteId))} />}
            {onDelete && (
              <>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 20px' }} />
                <MobileMenuItem label="Delete Node" sub="Soft-delete with undo" color="#ff4466" onClick={act(() => onDelete(noteId))} />
              </>
            )}
            {onCreateAnchor && (
              <>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 20px' }} />
                <MobileMenuItem label="QR 锚点" sub="Generate reality anchor QR code" color="#66f0ff" onClick={act(() => onCreateAnchor(noteId))} />
              </>
            )}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 20px' }} />
            <div style={{ padding: '6px 20px 4px', fontFamily: MONO, fontSize: 10, color: 'rgba(102,240,255,0.50)', letterSpacing: '0.10em' }}>
              SEND TO POD
            </div>
            {PODS.map(pod => (
              <MobileMenuItem
                key={pod.id}
                label={pod.label}
                color={pod.color}
                onClick={act(() => onSendToPod(noteId, pod.id))}
              />
            ))}
          </div>
        </div>
      </>,
      document.body,
    );
  }

  // ── Desktop: positioned dropdown (existing) ──────────────────────────────
  const ax = Math.min(x, window.innerWidth  - 200);
  const ay = Math.min(y, window.innerHeight - 220);

  return createPortal(
    <div
      id="cosmos-ctx-menu"
      style={{
        position: 'fixed', left: ax, top: ay, zIndex: 9999,
        width: 185,
        background: 'rgba(2,5,16,0.97)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(102,240,255,0.15)',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.85), 0 0 24px rgba(102,240,255,0.05)',
        overflow: 'visible',
        animation: 'cosmos-window-in 0.12s ease',
        userSelect: 'none',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '7px 12px 6px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{
          fontFamily: INTER, fontSize: 11, fontWeight: 600,
          color: 'rgba(220,230,250,0.88)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {note?.title ?? '(未命名)'}
        </div>
      </div>

      {/* Menu items */}
      <div style={{ padding: '4px 0' }}>
        <Item label="→ 打开笔记"    onClick={() => { onOpenNote(noteId); onClose(); }} />
        <Item label="◇ 快速蒸馏"    onClick={() => { onDistill(noteId); onClose(); }} />

        {/* Send-to-pod submenu */}
        <div
          style={{ position: 'relative' }}
          onMouseEnter={() => setPodHover(true)}
          onMouseLeave={() => setPodHover(false)}
        >
          <Item label="▶ 发送到舱..." onClick={() => setPodHover(v => !v)} />
          {podHover && (
            <div style={{
              position: 'absolute', left: '100%', top: 0,
              width: 120,
              background: 'rgba(2,5,16,0.97)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 6,
              boxShadow: '0 8px 24px rgba(0,0,0,0.75)',
              padding: '4px 0',
              zIndex: 10000,
            }}>
              {PODS.map(pod => (
                <button
                  key={pod.id}
                  onClick={() => { onSendToPod(noteId, pod.id); onClose(); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '5px 12px',
                    fontFamily: MONO, fontSize: 10,
                    color: pod.color,
                    background: 'transparent',
                    border: 'none', cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.background = `${pod.color}18`; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent'; }}
                >{pod.label}</button>
              ))}
            </div>
          )}
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '3px 0' }} />
        <Item label="✦ 在宇宙中定位" onClick={() => { onFlash(noteId); onClose(); }} />
        {onConnect && <Item label="⟷ 连接到..." onClick={() => { onConnect(noteId); onClose(); }} />}
        {hasManualPosition && onResetPosition && (
          <Item label="⊕ 重置位置" onClick={() => { onResetPosition(noteId); onClose(); }} />
        )}
        {onCreateAnchor && (
          <Item label="⊞ QR 锚点" onClick={() => { onCreateAnchor(noteId); onClose(); }} />
        )}
        {onDelete && (
          <>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '3px 0' }} />
            <Item label="✕ 删除节点" onClick={() => { onDelete(noteId); onClose(); }} />
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
