import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { CosmosNote } from '@/components/starmap/cosmos-layout';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter','system-ui',sans-serif";

const PODS = [
  { id: 'capture',   label: '捕获舱', color: '#00ff66' },
  { id: 'retrieval', label: '检索舱', color: '#66f0ff' },
  { id: 'insight',   label: '洞察舱', color: '#b496ff' },
  { id: 'memory',    label: '记忆舱', color: '#ffa040' },
  { id: 'action',    label: '行动舱', color: '#ff4466' },
];

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

export function NodeContextMenu({ noteId, x, y, note, onClose, onOpenNote, onDistill, onSendToPod, onFlash }: Props) {
  const [podHover, setPodHover] = useState(false);

  // Dismiss on any outside mousedown
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const el = document.getElementById('cosmos-ctx-menu');
      if (el && !el.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', h), 0);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  // Keep within viewport
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
      </div>
    </div>,
    document.body
  );
}
