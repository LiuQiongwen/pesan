/**
 * WorkbenchSummonBar — floats above the CommandDock when 2-5 nodes are
 * Shift+clicked, prompting the user to "召唤工作台".
 */
import { Layers3, X } from 'lucide-react';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

interface Props {
  selectedCount: number;  // 2-5
  onSummon:      () => void;
  onClear:       () => void;
}

export function WorkbenchSummonBar({ selectedCount, onSummon, onClear }: Props) {
  if (selectedCount < 2) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom:   'clamp(105px, 11.5vh, 145px)',
        left:     '50%',
        transform:'translateX(-50%)',
        zIndex:   60,
        display:  'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px 8px 14px',
        background: 'rgba(3,7,22,0.92)',
        backdropFilter: 'blur(28px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
        border: '1px solid rgba(102,240,255,0.28)',
        borderRadius: 10,
        boxShadow: '0 0 0 1px rgba(102,240,255,0.10), 0 8px 40px rgba(0,0,0,0.70)',
        animation: 'wb-summon-in 0.22s cubic-bezier(0.22,1,0.36,1)',
        pointerEvents: 'auto',
        userSelect: 'none',
      }}
    >
      {/* Icon */}
      <Layers3 size={13} color="#66f0ff" style={{ flexShrink: 0 }} />

      {/* Label */}
      <span style={{
        fontFamily: INTER, fontSize: 12, fontWeight: 500,
        color: 'rgba(195,225,245,0.85)',
        whiteSpace: 'nowrap',
      }}>
        已选 {selectedCount} 个节点
      </span>

      {/* Dot separator */}
      <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(100,110,140,0.45)' }}>·</span>

      {/* Summon button */}
      <button
        onClick={onSummon}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 12px',
          fontFamily: INTER, fontSize: 11, fontWeight: 600,
          color: '#040b10',
          background: 'linear-gradient(135deg, #66f0ff, #44d8e8)',
          border: 'none', borderRadius: 6,
          cursor: 'pointer',
          boxShadow: '0 2px 12px rgba(102,240,255,0.35)',
          transition: 'opacity 0.15s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
      >
        <Layers3 size={10} />
        召唤工作台
      </button>

      {/* Clear button */}
      <button
        onClick={onClear}
        style={{
          width: 26, height: 26,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 6, cursor: 'pointer', flexShrink: 0,
          transition: 'background 0.12s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,80,80,0.12)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
        title="取消选择"
      >
        <X size={11} color="rgba(160,170,200,0.60)" />
      </button>

      <style>{`
        @keyframes wb-summon-in {
          from { opacity: 0; transform: translateX(-50%) translateY(10px) scale(0.94); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0)     scale(1);    }
        }
      `}</style>
    </div>
  );
}
