/**
 * GalaxyJoinOverlay
 *
 * Two modes:
 *  A) "join-existing"  — user dragged node INTO a galaxy zone. Auto-confirms in 3s.
 *  B) "choose"         — dropped in empty space. User must pick a galaxy or create one.
 */

import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import { X, Plus } from 'lucide-react';

const MONO   = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER  = "'Inter',system-ui,sans-serif";
const CONFIRM_DELAY = 3000; // ms — only used in mode A

export interface GalaxyOption {
  tag:   string;
  color: string;
}

interface GalaxyJoinOverlayProps {
  noteTitle:         string;
  targetGalaxy:      GalaxyOption | null;   // null → empty-space drop → choose mode
  availableGalaxies: GalaxyOption[];
  onConfirm:         (galaxyTag: string) => void;
  onCancel:          () => void;
}

export function GalaxyJoinOverlay({
  noteTitle,
  targetGalaxy,
  availableGalaxies,
  onConfirm,
  onCancel,
}: GalaxyJoinOverlayProps) {
  const mode = targetGalaxy ? 'join' : 'choose';

  // ── Mode A state ──────────────────────────────────────────────────────────
  const [progress,   setProgress]   = useState(0);
  const startRef     = useRef(Date.now());
  const rafRef       = useRef<number>();
  const confirmedRef = useRef(false);

  // ── New galaxy input ──────────────────────────────────────────────────────
  const [creatingNew,  setCreatingNew]  = useState(false);
  const [newGalaxyName, setNewGalaxyName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus new input when shown
  useEffect(() => {
    if (creatingNew) setTimeout(() => inputRef.current?.focus(), 60);
  }, [creatingNew]);

  // ── Mode A: countdown RAF ─────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'join') return;
    startRef.current  = Date.now();
    confirmedRef.current = false;

    const tick = () => {
      const pct = Math.min((Date.now() - startRef.current) / CONFIRM_DELAY, 1);
      setProgress(pct);
      if (pct >= 1 && !confirmedRef.current) {
        confirmedRef.current = true;
        onConfirm(targetGalaxy!.tag);
      } else if (pct < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ── ESC to cancel ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // ── New galaxy submit ─────────────────────────────────────────────────────
  const handleNewGalaxySubmit = () => {
    const name = newGalaxyName.trim();
    if (!name) return;
    onConfirm(name);
  };

  const handleNewGalaxyKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleNewGalaxySubmit();
    if (e.key === 'Escape') { setCreatingNew(false); setNewGalaxyName(''); }
  };

  // ── Active color ──────────────────────────────────────────────────────────
  const accentColor = targetGalaxy?.color ?? '#00ff66';
  const remainSecs  = Math.ceil(((1 - progress) * CONFIRM_DELAY) / 1000);

  return (
    <div
      role="dialog"
      aria-label="归入星系"
      style={{
        position:             'fixed',
        bottom:               'clamp(130px, 12.5vh, 170px)',
        left:                 '50%',
        transform:            'translateX(-50%)',
        zIndex:               1200,
        width:                'clamp(320px, 36vw, 510px)',
        background:           'rgba(2,5,16,0.97)',
        backdropFilter:       'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border:               `1px solid ${accentColor}28`,
        borderRadius:         12,
        overflow:             'hidden',
        boxShadow:            `0 0 36px ${accentColor}12, 0 20px 50px rgba(0,0,0,0.65)`,
        animation:            'cco-in 0.22s cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      {/* Mode A progress bar (drains right→empty over 3s) */}
      {mode === 'join' && (
        <div style={{ height: 2, background: 'rgba(255,255,255,0.05)', position: 'relative' }}>
          <div style={{
            position:   'absolute', left: 0, top: 0, height: '100%',
            width:      `${(1 - progress) * 100}%`,
            background: `linear-gradient(90deg, ${accentColor}cc, ${accentColor})`,
            boxShadow:  `0 0 6px ${accentColor}`,
            transition: 'width 0.08s linear',
          }} />
        </div>
      )}

      <div style={{ padding: 'clamp(10px,1.0vh,14px) clamp(12px,1.2vw,16px)' }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <span style={{
            fontFamily:    MONO,
            fontSize:      9,
            letterSpacing: '0.12em',
            color:         `${accentColor}70`,
            textTransform: 'uppercase' as const,
          }}>
            {mode === 'join' ? 'ASSIGNING TO GALAXY · 归入星系' : 'CHOOSE GALAXY · 选择星系'}
          </span>
          <button
            onClick={onCancel}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(120,140,170,0.45)', padding: 2,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(200,210,230,0.75)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(120,140,170,0.45)')}
          >
            <X size={12} />
          </button>
        </div>

        {/* Note title */}
        <div style={{
          fontFamily:   INTER,
          fontSize:     'clamp(11px,1.0vw,13px)',
          color:        'rgba(200,215,245,0.80)',
          marginBottom: 12,
          whiteSpace:   'nowrap',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
        }}>
          <span style={{ color: 'rgba(100,120,160,0.50)', fontFamily: MONO, fontSize: 8, marginRight: 5 }}>NODE</span>
          {noteTitle || '未命名节点'}
        </div>

        {/* ── Mode A: single target galaxy ────────────────────────────────── */}
        {mode === 'join' && targetGalaxy && !creatingNew && (
          <>
            <div style={{
              display:       'flex',
              alignItems:    'center',
              gap:           10,
              marginBottom:  12,
              padding:       '10px 12px',
              background:    `${targetGalaxy.color}0d`,
              border:        `1px solid ${targetGalaxy.color}28`,
              borderRadius:  8,
            }}>
              {/* Galaxy color dot */}
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: targetGalaxy.color,
                boxShadow: `0 0 8px ${targetGalaxy.color}`,
                flexShrink: 0,
              }} />
              <div style={{
                fontFamily:    INTER,
                fontSize:      'clamp(12px,1.1vw,14px)',
                fontWeight:    600,
                color:         targetGalaxy.color,
                flex:          1,
              }}>
                {targetGalaxy.tag}
              </div>
              <div style={{
                fontFamily:    MONO,
                fontSize:      8,
                color:         `${targetGalaxy.color}60`,
                letterSpacing: '0.08em',
              }}>
                GALAXY
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
              <button
                onClick={() => setCreatingNew(true)}
                style={{
                  fontFamily:    MONO, fontSize: 9, letterSpacing: '0.07em',
                  background:    'transparent',
                  color:         'rgba(120,140,175,0.55)',
                  border:        '1px solid rgba(55,75,110,0.25)',
                  borderRadius:  4, padding: '4px 10px', cursor: 'pointer',
                }}
              >
                新建星系
              </button>
              <button
                onClick={onCancel}
                style={{
                  fontFamily:    MONO, fontSize: 9, letterSpacing: '0.07em',
                  background:    'transparent',
                  color:         'rgba(120,140,175,0.45)',
                  border:        '1px solid rgba(55,75,110,0.18)',
                  borderRadius:  4, padding: '4px 10px', cursor: 'pointer',
                }}
              >
                暂不归类
              </button>
            </div>

            <div style={{
              fontFamily: MONO, fontSize: 8,
              color: 'rgba(70,90,125,0.50)', letterSpacing: '0.07em',
            }}>
              {remainSecs}s 后自动加入 · ESC 取消
            </div>
          </>
        )}

        {/* ── Mode B: galaxy picker ────────────────────────────────────────── */}
        {mode === 'choose' && !creatingNew && (
          <>
            <div style={{
              display: 'flex', gap: 7, flexWrap: 'wrap' as const, marginBottom: 12,
            }}>
              {availableGalaxies.map(g => (
                <button
                  key={g.tag}
                  onClick={() => onConfirm(g.tag)}
                  style={{
                    fontFamily:    INTER,
                    fontSize:      'clamp(10px,0.95vw,12px)',
                    background:    `${g.color}10`,
                    color:         g.color,
                    border:        `1px solid ${g.color}30`,
                    borderRadius:  20,
                    padding:       '5px 12px',
                    cursor:        'pointer',
                    display:       'flex',
                    alignItems:    'center',
                    gap:           5,
                    transition:    'all 0.14s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = `${g.color}22`;
                    (e.currentTarget as HTMLButtonElement).style.borderColor = `${g.color}60`;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = `${g.color}10`;
                    (e.currentTarget as HTMLButtonElement).style.borderColor = `${g.color}30`;
                  }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                  {g.tag}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
              <button
                onClick={() => setCreatingNew(true)}
                style={{
                  fontFamily:    MONO, fontSize: 9, letterSpacing: '0.07em',
                  background:    'rgba(0,255,102,0.06)',
                  color:         'rgba(0,255,102,0.60)',
                  border:        '1px solid rgba(0,255,102,0.20)',
                  borderRadius:  4, padding: '5px 11px', cursor: 'pointer',
                  display:       'flex', alignItems: 'center', gap: 4,
                }}
              >
                <Plus size={10} /> 新建星系
              </button>
              <button
                onClick={onCancel}
                style={{
                  fontFamily:    MONO, fontSize: 9, letterSpacing: '0.07em',
                  background:    'transparent',
                  color:         'rgba(100,120,160,0.40)',
                  border:        '1px solid rgba(55,75,110,0.18)',
                  borderRadius:  4, padding: '5px 11px', cursor: 'pointer',
                }}
              >
                暂不归类
              </button>
            </div>
          </>
        )}

        {/* ── Create new galaxy inline input ───────────────────────────────── */}
        {creatingNew && (
          <div style={{ marginBottom: 10 }}>
            <div style={{
              fontFamily:    MONO, fontSize: 8, letterSpacing: '0.10em',
              color:         'rgba(0,255,102,0.50)',
              marginBottom:  6,
              textTransform: 'uppercase' as const,
            }}>
              新星系名称 / NEW GALAXY NAME
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                ref={inputRef}
                value={newGalaxyName}
                onChange={e => setNewGalaxyName(e.target.value)}
                onKeyDown={handleNewGalaxyKey}
                placeholder="输入星系名称…"
                maxLength={24}
                style={{
                  flex:            1,
                  fontFamily:      INTER,
                  fontSize:        'clamp(11px,1.0vw,13px)',
                  color:           'rgba(210,225,250,0.90)',
                  background:      'rgba(0,255,102,0.04)',
                  border:          '1px solid rgba(0,255,102,0.25)',
                  borderRadius:    6,
                  padding:         '7px 10px',
                  outline:         'none',
                }}
              />
              <button
                onClick={handleNewGalaxySubmit}
                disabled={!newGalaxyName.trim()}
                style={{
                  fontFamily:    MONO, fontSize: 9,
                  background:    newGalaxyName.trim() ? 'rgba(0,255,102,0.12)' : 'transparent',
                  color:         newGalaxyName.trim() ? 'rgba(0,255,102,0.80)' : 'rgba(80,100,130,0.35)',
                  border:        `1px solid ${newGalaxyName.trim() ? 'rgba(0,255,102,0.30)' : 'rgba(55,75,110,0.18)'}`,
                  borderRadius:  6, padding: '7px 12px', cursor: newGalaxyName.trim() ? 'pointer' : 'default',
                }}
              >
                创建
              </button>
              <button
                onClick={() => { setCreatingNew(false); setNewGalaxyName(''); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(100,120,160,0.40)', padding: '7px 4px',
                }}
              >
                <X size={11} />
              </button>
            </div>
            <div style={{
              fontFamily: MONO, fontSize: 8, color: 'rgba(70,90,125,0.40)',
              marginTop: 5, letterSpacing: '0.06em',
            }}>
              Enter 确认 · ESC 取消
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
