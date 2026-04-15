/**
 * LayoutEditBar — floating cosmic control panel for the window manager.
 * Position: bottom-right, above the dock.
 * Expands on hover to reveal grid/snap/font/preset controls.
 */
import { useState, useRef, useCallback } from 'react';
import { Lock, Unlock, Grid3x3, Magnet, ALargeSmall, BookMarked, RotateCcw, Save, ChevronRight } from 'lucide-react';
import { useToolbox } from '@/contexts/ToolboxContext';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

export function LayoutEditBar() {
  const {
    layoutConfig,
    presets,
    setLocked, setGridSize, setSnapToEdge, setGlobalFontScale,
    savePreset, loadPreset, deletePreset, resetToDefault,
  } = useToolbox();

  const { locked, gridSize, snapToEdge, globalFontScale } = layoutConfig;

  const [expanded,       setExpanded]       = useState(false);
  const [presetInput,    setPresetInput]     = useState('');
  const [showPresets,    setShowPresets]     = useState(false);
  const [savedFlash,     setSavedFlash]      = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accent      = locked ? '#ffa040' : '#66f0ff';
  const accentDim   = locked ? 'rgba(255,160,64,0.25)' : 'rgba(102,240,255,0.20)';
  const accentBorder= locked ? 'rgba(255,160,64,0.35)' : 'rgba(102,240,255,0.30)';

  const onMouseEnter = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setExpanded(true);
  };
  const onMouseLeave = () => {
    hoverTimerRef.current = setTimeout(() => { setExpanded(false); setShowPresets(false); }, 380);
  };

  const handleSavePreset = useCallback(() => {
    const name = presetInput.trim() || `布局 ${new Date().toLocaleDateString('zh-CN')}`;
    savePreset(name);
    setPresetInput('');
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  }, [presetInput, savePreset]);

  const gridOptions: (0 | 8 | 16 | 24)[] = [0, 8, 16, 24];

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position:       'fixed',
        bottom:         'clamp(14px,1.5vh,22px)',
        right:          'clamp(14px,1.5vw,22px)',
        zIndex:         500,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'flex-end',
        gap:            8,
        pointerEvents:  'auto',
        userSelect:     'none',
      }}
    >
      {/* Expanded panel */}
      {expanded && (
        <div style={{
          background:         'rgba(3,7,22,0.96)',
          backdropFilter:     'blur(32px) saturate(2)',
          WebkitBackdropFilter:'blur(32px) saturate(2)',
          border:             `1px solid ${accentBorder}`,
          borderRadius:       12,
          padding:            '12px 14px',
          boxShadow:          `0 0 0 1px rgba(255,255,255,0.06), 0 16px 48px rgba(0,0,0,0.75)`,
          width:              220,
          animation:          'editbar-in 0.18s cubic-bezier(0.22,1,0.36,1)',
        }}>
          <style>{`
            @keyframes editbar-in {
              from { opacity:0; transform:translateY(6px) scale(0.97); }
              to   { opacity:1; transform:translateY(0)   scale(1); }
            }
          `}</style>

          {/* Section: Grid Snap */}
          <Section label="网格吸附" icon={<Grid3x3 size={10} />} accent={accent}>
            <div style={{ display: 'flex', gap: 4 }}>
              {gridOptions.map(opt => (
                <button
                  key={opt}
                  onClick={() => setGridSize(opt)}
                  style={{
                    flex: 1,
                    padding: '4px 0',
                    fontFamily: MONO,
                    fontSize: 8,
                    color: gridSize === opt ? '#040b10' : accent,
                    background: gridSize === opt ? accent : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${gridSize === opt ? accent : 'rgba(255,255,255,0.10)'}`,
                    borderRadius: 5,
                    cursor: 'pointer',
                    transition: 'all 0.14s',
                  }}
                >
                  {opt === 0 ? 'OFF' : `${opt}`}
                </button>
              ))}
            </div>
          </Section>

          {/* Section: Edge Snap */}
          <Section label="边缘吸附" icon={<Magnet size={10} />} accent={accent}>
            <ToggleRow
              label="吸附到屏幕边缘 & 窗口"
              active={snapToEdge}
              accent={accent}
              onToggle={() => setSnapToEdge(!snapToEdge)}
            />
          </Section>

          {/* Section: Font Scale */}
          <Section label="全局字体" icon={<ALargeSmall size={10} />} accent={accent}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => setGlobalFontScale(Math.round((globalFontScale - 0.05) * 100) / 100)}
                style={smallBtnStyle(accent)}
              >−</button>
              <div style={{
                flex: 1, textAlign: 'center',
                fontFamily: MONO, fontSize: 10, color: accent,
              }}>
                {Math.round(globalFontScale * 100)}%
              </div>
              <button
                onClick={() => setGlobalFontScale(Math.round((globalFontScale + 0.05) * 100) / 100)}
                style={smallBtnStyle(accent)}
              >+</button>
            </div>
            <input
              type="range" min={0.6} max={1.8} step={0.05}
              value={globalFontScale}
              onChange={e => setGlobalFontScale(Number(e.target.value))}
              style={{
                width: '100%', marginTop: 6,
                accentColor: accent,
                cursor: 'pointer',
              }}
            />
          </Section>

          {/* Section: Presets */}
          <Section label="布局预设" icon={<BookMarked size={10} />} accent={accent}>
            {/* Save current */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              <input
                type="text"
                placeholder="预设名称…"
                value={presetInput}
                onChange={e => setPresetInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSavePreset(); }}
                style={{
                  flex: 1,
                  fontFamily: MONO, fontSize: 8,
                  color: 'rgba(195,215,240,0.80)',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 5, padding: '4px 7px',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleSavePreset}
                style={{
                  ...smallBtnStyle(accent),
                  padding: '4px 10px',
                  color: savedFlash ? '#00ff66' : '#040b10',
                  background: savedFlash ? 'rgba(0,255,102,0.15)' : accent,
                  border: savedFlash ? '1px solid rgba(0,255,102,0.35)' : 'none',
                  transition: 'all 0.18s',
                }}
              >
                <Save size={9} />
              </button>
            </div>

            {/* Saved presets list */}
            {Object.keys(presets).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {Object.keys(presets).map(name => (
                  <div key={name} style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => loadPreset(name)}
                      style={{
                        flex: 1, textAlign: 'left',
                        padding: '3px 7px',
                        fontFamily: MONO, fontSize: 8,
                        color: 'rgba(175,195,225,0.75)',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 4, cursor: 'pointer',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}
                    >
                      {name}
                    </button>
                    <button
                      onClick={() => deletePreset(name)}
                      style={{
                        ...smallBtnStyle('rgba(255,80,80,0.65)'),
                        padding: '3px 6px', fontSize: 8,
                        color: 'rgba(255,80,80,0.60)',
                        background: 'rgba(255,60,60,0.06)',
                        border: '1px solid rgba(255,60,60,0.18)',
                      }}
                    >×</button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Reset */}
          <button
            onClick={resetToDefault}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '5px 0',
              fontFamily: MONO, fontSize: 8, letterSpacing: '0.06em',
              color: 'rgba(140,150,175,0.55)',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 5, cursor: 'pointer',
              marginTop: 4,
              transition: 'all 0.14s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,120,120,0.75)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(140,150,175,0.55)'; }}
          >
            <RotateCcw size={9} /> 恢复默认布局
          </button>
        </div>
      )}

      {/* Compact toggle pill */}
      <button
        onClick={() => setLocked(!locked)}
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:            7,
          padding:        '8px 14px',
          fontFamily:     MONO,
          fontSize:       10,
          letterSpacing:  '0.10em',
          color:          accent,
          background:     accentDim,
          border:         `1px solid ${accentBorder}`,
          borderRadius:   8,
          cursor:         'pointer',
          boxShadow:      `0 0 18px ${accentDim}, 0 4px 16px rgba(0,0,0,0.55)`,
          transition:     'all 0.18s',
          whiteSpace:     'nowrap',
          animation:      savedFlash ? 'none' : 'editbar-pulse 3s ease-in-out infinite',
        }}
      >
        <style>{`
          @keyframes editbar-pulse {
            0%,100% { box-shadow: 0 0 18px ${accentDim}, 0 4px 16px rgba(0,0,0,0.55); }
            50%     { box-shadow: 0 0 28px ${accentBorder}, 0 4px 20px rgba(0,0,0,0.60); }
          }
        `}</style>
        {locked
          ? <><Lock   size={11} /> 已锁定</>
          : <><Unlock size={11} /> 编辑模式</>
        }
        <ChevronRight
          size={10}
          style={{ transition: 'transform 0.18s', transform: expanded ? 'rotate(-90deg)' : 'rotate(90deg)' }}
        />
      </button>
    </div>
  );
}

// ── Helper sub-components ──────────────────────────────────────────────────────
function Section({
  label, icon, accent, children,
}: { label: string; icon: React.ReactNode; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        fontFamily: MONO, fontSize: 7.5, letterSpacing: '0.08em',
        color: accent, opacity: 0.65, marginBottom: 6,
      }}>
        {icon} {label}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({
  label, active, accent, onToggle,
}: { label: string; active: boolean; accent: string; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: 'pointer', padding: '3px 0',
      }}
    >
      <span style={{ fontFamily: INTER, fontSize: 9.5, color: 'rgba(175,195,225,0.70)' }}>
        {label}
      </span>
      <div style={{
        width: 28, height: 14, borderRadius: 7,
        background: active ? accent : 'rgba(255,255,255,0.12)',
        border: `1px solid ${active ? accent : 'rgba(255,255,255,0.15)'}`,
        position: 'relative', transition: 'all 0.18s',
      }}>
        <div style={{
          width: 10, height: 10,
          borderRadius: '50%',
          background: active ? '#040b10' : 'rgba(180,190,210,0.50)',
          position: 'absolute', top: 1,
          left: active ? 'calc(100% - 12px)' : 2,
          transition: 'all 0.18s',
        }} />
      </div>
    </div>
  );
}

function smallBtnStyle(color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '4px 8px',
    fontFamily: MONO, fontSize: 10, fontWeight: 700,
    color, background: 'rgba(255,255,255,0.05)',
    border: `1px solid rgba(255,255,255,0.10)`,
    borderRadius: 5, cursor: 'pointer',
    transition: 'background 0.12s',
  };
}
