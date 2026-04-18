/**
 * RenderTracerOverlay — DEV-only floating HUD showing React render log.
 * Toggle: Shift+R
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { getRenderLog, clearRenderLog, type RenderEntry } from '@/hooks/useRenderTracer';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

function timeAgo(ts: number, now: number): string {
  const ms = now - ts;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function freqColor(count: number): string {
  if (count >= 20) return '#ff4466';
  if (count >= 10) return '#ffa040';
  if (count >= 5)  return '#ffcc00';
  return 'rgba(160,180,220,0.50)';
}

export function RenderTracerOverlay() {
  const [visible, setVisible] = useState(false);
  const [entries, setEntries] = useState<readonly RenderEntry[]>([]);

  // Shift+R toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.shiftKey && e.key === 'R') {
        e.preventDefault();
        setVisible(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Poll log at 2Hz
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      setEntries([...getRenderLog()]);
    }, 500);
    return () => clearInterval(id);
  }, [visible]);

  const handleClear = useCallback(() => {
    clearRenderLog();
    setEntries([]);
  }, []);

  // Frequency map
  const freqMap = useMemo(() => {
    const m = new Map<string, number>();
    entries.forEach(e => m.set(e.name, (m.get(e.name) ?? 0) + 1));
    return m;
  }, [entries]);

  const topComponents = useMemo(() => {
    return [...freqMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [freqMap]);

  if (!visible) return null;

  const now = performance.now();
  const recent = [...entries].reverse().slice(0, 50);

  return (
    <div style={{
      position: 'fixed', bottom: 14, right: 14, zIndex: 9001,
      width: 320, maxHeight: 420,
      background: 'rgba(2,5,16,0.94)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,160,64,0.15)',
      borderRadius: 12,
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 8px 32px rgba(0,0,0,0.60)',
      fontFamily: MONO,
      userSelect: 'none',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px 8px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontFamily: INTER, fontSize: 11, fontWeight: 700, color: 'rgba(255,160,64,0.85)' }}>
          RENDER TRACER
        </span>
        <span style={{ fontSize: 8, color: 'rgba(140,155,185,0.40)', marginLeft: 'auto' }}>
          {entries.length} renders
        </span>
        <button
          onClick={handleClear}
          style={{
            fontSize: 8, fontFamily: MONO, color: 'rgba(255,160,64,0.50)',
            background: 'rgba(255,160,64,0.08)', border: '1px solid rgba(255,160,64,0.15)',
            borderRadius: 4, padding: '2px 8px', cursor: 'pointer',
          }}
        >
          CLEAR
        </button>
      </div>

      {/* Top components by frequency */}
      {topComponents.length > 0 && (
        <div style={{
          padding: '6px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          display: 'flex', flexWrap: 'wrap', gap: '3px 8px',
        }}>
          {topComponents.map(([name, count]) => (
            <span key={name} style={{
              fontSize: 8, fontWeight: 600,
              color: freqColor(count),
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 3, padding: '1px 6px',
            }}>
              {name}: {count}
            </span>
          ))}
        </div>
      )}

      {/* Log entries */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '6px 0',
        maxHeight: 300,
      }}>
        {recent.length === 0 && (
          <div style={{ padding: '20px 14px', fontSize: 9, color: 'rgba(140,155,185,0.30)', textAlign: 'center' }}>
            No renders recorded yet
          </div>
        )}
        {recent.map((entry, i) => (
          <div
            key={entry.renderIndex}
            style={{
              padding: '3px 14px',
              fontSize: 8,
              lineHeight: 1.5,
              background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
              display: 'flex', gap: 6,
            }}
          >
            <span style={{ color: 'rgba(100,115,145,0.35)', minWidth: 36, textAlign: 'right', flexShrink: 0 }}>
              {timeAgo(entry.ts, now)}
            </span>
            <span style={{
              color: freqColor(freqMap.get(entry.name) ?? 0),
              fontWeight: 600, minWidth: 80, flexShrink: 0,
            }}>
              {entry.name}
            </span>
            <span style={{
              color: entry.changedKeys[0] === '(initial)' ? 'rgba(100,200,255,0.40)' : 'rgba(200,180,140,0.50)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {entry.changedKeys.join(', ')}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: '4px 14px 8px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        fontSize: 7, color: 'rgba(100,115,145,0.30)', textAlign: 'center',
        letterSpacing: '0.08em',
      }}>
        SHIFT+R TO CLOSE
      </div>
    </div>
  );
}
