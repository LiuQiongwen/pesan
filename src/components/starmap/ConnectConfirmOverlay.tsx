/**
 * ConnectConfirmOverlay
 *
 * Floats above the starmap after a successful drag-to-connect.
 * Shows source → target titles, relationship-type selector pills,
 * a countdown progress bar (auto-confirms after CONFIRM_DELAY ms),
 * and an ESC / ✕ cancel option.
 */

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { RELATION_TYPES, type RelationType } from './connect-types';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";
const CONFIRM_DELAY = 2800; // ms before auto-confirm

interface Props {
  sourceTitle:   string;
  targetTitle:   string;
  suggestedType: RelationType;
  onConfirm:     (relType: RelationType, description?: string) => void;
  onCancel:      () => void;
}

export function ConnectConfirmOverlay({
  sourceTitle, targetTitle, suggestedType, onConfirm, onCancel,
}: Props) {
  const [selected, setSelected]     = useState<RelationType>(suggestedType);
  const [description, setDescription] = useState('');
  const [progress, setProgress]     = useState(0);
  const startRef     = useRef(Date.now());
  const rafRef       = useRef<number>();
  const confirmedRef = useRef(false);
  const selectedRef  = useRef<RelationType>(suggestedType);
  const descRef      = useRef('');

  // Keep refs current so the RAF callback always reads latest value
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { descRef.current = description; }, [description]);

  // Countdown + auto-confirm RAF loop
  useEffect(() => {
    startRef.current  = Date.now();
    confirmedRef.current = false;

    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const pct     = Math.min(elapsed / CONFIRM_DELAY, 1);
      setProgress(pct);
      if (pct >= 1 && !confirmedRef.current) {
        confirmedRef.current = true;
        onConfirm(selectedRef.current, descRef.current || undefined);
      } else if (pct < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // ESC to cancel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const handleSelectType = (id: RelationType) => {
    // Reset countdown when user manually picks a type
    startRef.current     = Date.now();
    confirmedRef.current = false;
    setProgress(0);
    setSelected(id);
  };

  const config = RELATION_TYPES.find(r => r.id === selected)!;
  const remainingSecs = Math.ceil(((1 - progress) * CONFIRM_DELAY) / 1000);

  return (
    <div
      role="dialog"
      aria-label="确认节点连接"
      style={{
        position:         'fixed',
        bottom:           'clamp(130px, 12.5vh, 170px)',
        left:             '50%',
        transform:        'translateX(-50%)',
        zIndex:           1200,
        width:            'clamp(310px, 34vw, 490px)',
        background:       'rgba(2,5,16,0.97)',
        backdropFilter:   'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border:           `1px solid ${config.color}28`,
        borderRadius:     12,
        overflow:         'hidden',
        boxShadow:        `0 0 36px ${config.color}14, 0 20px 50px rgba(0,0,0,0.65)`,
        animation:        'toast-in var(--dur-standard) var(--spring)',
      }}
    >
      {/* Auto-confirm progress bar */}
      <div style={{ height: 2, background: 'rgba(255,255,255,0.05)', position: 'relative' }}>
        <div style={{
          position:   'absolute',
          left:       0,
          top:        0,
          height:     '100%',
          width:      `${(1 - progress) * 100}%`,
          background: `linear-gradient(90deg, ${config.color}cc, ${config.color})`,
          boxShadow:  `0 0 6px ${config.color}`,
          transition: 'width 0.08s linear',
        }} />
      </div>

      <div style={{ padding: 'clamp(10px,1.0vh,14px) clamp(12px,1.2vw,16px)' }}>
        {/* Header row */}
        <div style={{
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'space-between',
          marginBottom:    9,
        }}>
          <span style={{
            fontFamily:    MONO,
            fontSize:      9,
            letterSpacing: '0.12em',
            color:         `${config.color}70`,
            textTransform: 'uppercase' as const,
          }}>
            CONNECTING NODES · 建立连接
          </span>
          <button
            onClick={onCancel}
            title="取消 (ESC)"
            style={{
              background: 'none',
              border:     'none',
              cursor:     'pointer',
              color:      'rgba(120,140,170,0.45)',
              padding:    2,
              lineHeight: 1,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(200,210,230,0.75)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(120,140,170,0.45)')}
          >
            <X size={12} />
          </button>
        </div>

        {/* Node title row */}
        <div style={{
          display:       'flex',
          alignItems:    'center',
          gap:           8,
          marginBottom:  12,
        }}>
          <div style={nodeChipStyle}>{sourceTitle || '未命名'}</div>
          <div style={{
            fontFamily:    MONO,
            fontSize:      10,
            color:         config.color,
            flexShrink:    0,
            letterSpacing: '-0.02em',
          }}>
            ──→
          </div>
          <div style={nodeChipStyle}>{targetTitle || '未命名'}</div>
        </div>

        {/* Relationship type pills */}
        <div style={{
          display:       'flex',
          gap:           6,
          flexWrap:      'wrap' as const,
          marginBottom:  8,
        }}>
          {RELATION_TYPES.map(r => {
            const isActive = selected === r.id;
            return (
              <button
                key={r.id}
                onClick={() => handleSelectType(r.id)}
                style={{
                  fontFamily:    MONO,
                  fontSize:      'clamp(8px,0.75vw,10px)',
                  letterSpacing: '0.07em',
                  background:    isActive ? `${r.color}1a` : 'transparent',
                  color:         isActive ? r.color : 'rgba(120,140,175,0.55)',
                  border:        `1px solid ${isActive ? r.color : 'rgba(55,75,110,0.28)'}`,
                  borderRadius:  4,
                  padding:       '4px 11px',
                  cursor:        'pointer',
                  transition:    'all var(--dur-snap) var(--spring-snap)',
                  outline:       'none',
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        {/* Impact hint */}
        <div style={{
          fontFamily:    INTER,
          fontSize:      'clamp(9px,0.8vw,11px)',
          color:         `${config.color}88`,
          marginBottom:  8,
          lineHeight:    1.5,
        }}>
          {config.desc}
        </div>

        {/* Description input */}
        <input
          type="text"
          placeholder="描述这条关系（可选）..."
          value={description}
          onChange={e => {
            setDescription(e.target.value);
            // Reset countdown when user types
            startRef.current = Date.now();
            confirmedRef.current = false;
            setProgress(0);
          }}
          style={{
            width:         '100%',
            boxSizing:     'border-box' as const,
            fontFamily:    INTER,
            fontSize:      'clamp(9px,0.82vw,11px)',
            color:         'rgba(200,215,240,0.80)',
            background:    'rgba(255,255,255,0.03)',
            border:        `1px solid ${config.color}20`,
            borderRadius:  5,
            padding:       '5px 9px',
            outline:       'none',
            marginBottom:  8,
          }}
        />

        {/* Footer hint */}
        <div style={{
          fontFamily:    MONO,
          fontSize:      'clamp(7.5px,0.68vw,9px)',
          color:         'rgba(70,90,125,0.55)',
          letterSpacing: '0.07em',
        }}>
          {remainingSecs}s 后自动确认「{config.label}」· ESC 取消
        </div>
      </div>
    </div>
  );
}

// ── Shared mini-style ─────────────────────────────────────────────────────────
const nodeChipStyle: React.CSSProperties = {
  flex:          '1 1 0',
  fontFamily:    INTER,
  fontSize:      'clamp(10px,0.95vw,12px)',
  color:         'rgba(210,220,245,0.85)',
  background:    'rgba(255,255,255,0.04)',
  border:        '1px solid rgba(60,80,120,0.20)',
  borderRadius:  6,
  padding:       '5px 9px',
  whiteSpace:    'nowrap' as const,
  overflow:      'hidden',
  textOverflow:  'ellipsis',
  minWidth:      0,
};
