import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter','system-ui',sans-serif";

function Item({ label, onClick, color }: { label: string; onClick: () => void; color?: string }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '5px 12px',
        fontFamily: MONO, fontSize: 11, letterSpacing: '0.04em',
        color: hover ? (color ?? 'rgba(102,240,255,0.92)') : (color ?? 'rgba(200,215,240,0.82)'),
        background: hover ? 'rgba(102,240,255,0.06)' : 'transparent',
        border: 'none', cursor: 'pointer',
        transition: 'background 0.1s, color 0.1s',
      }}
    >{label}</button>
  );
}

interface Props {
  tag: string;
  nodeCount: number;
  color: string;
  x: number;
  y: number;
  onClose: () => void;
  onDissolve: (tag: string) => void;
  onDeleteAll: (tag: string) => void;
}

export function GalaxyContextMenu({ tag, nodeCount, color, x, y, onClose, onDissolve, onDeleteAll }: Props) {
  useEffect(() => {
    const h = (e: MouseEvent | TouchEvent) => {
      const el = document.getElementById('cosmos-galaxy-ctx');
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

  const ax = Math.min(x, window.innerWidth - 210);
  const ay = Math.min(y, window.innerHeight - 170);

  return createPortal(
    <div
      id="cosmos-galaxy-ctx"
      style={{
        position: 'fixed', left: ax, top: ay, zIndex: 9999,
        width: 200,
        background: 'rgba(2,5,16,0.97)',
        backdropFilter: 'blur(20px)',
        border: `1px solid ${color}30`,
        borderRadius: 8,
        boxShadow: `0 8px 32px rgba(0,0,0,0.85), 0 0 24px ${color}10`,
        overflow: 'hidden',
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
          color,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {tag}
        </div>
        <div style={{
          fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em',
          color: 'rgba(160,175,200,0.50)',
          marginTop: 2,
        }}>
          {nodeCount} NODES
        </div>
      </div>

      <div style={{ padding: '4px 0' }}>
        <Item
          label="~ 解散星系"
          onClick={() => { onDissolve(tag); onClose(); }}
        />
        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '3px 0' }} />
        <Item
          label="! 删除全部节点"
          color="#ff4466"
          onClick={() => { onDeleteAll(tag); onClose(); }}
        />
      </div>
    </div>,
    document.body,
  );
}
