/**
 * PerfOverlay — floating HUD for 3D scene diagnostics.
 * Rendered as plain DOM on top of the Canvas.
 */
import { useRef, useEffect, useCallback, useState } from 'react';
import type { PerfSnapshot } from '@/hooks/usePerfMonitor';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

interface SubsystemToggle {
  key: string;
  label: string;
  enabled: boolean;
}

interface Props {
  snapshotRef: React.MutableRefObject<PerfSnapshot>;
  historyRef: React.MutableRefObject<PerfSnapshot[]>;
  subsystems: SubsystemToggle[];
  onToggleSubsystem: (key: string) => void;
}

function fpsColor(fps: number): string {
  if (fps >= 55) return '#00ff66';
  if (fps >= 40) return '#ffa040';
  return '#ff4466';
}

function formatK(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

/** Tiny canvas-based sparkline */
function Sparkline({ data, width, height, color }: { data: number[]; width: number; height: number; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c || data.length < 2) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr;
    c.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.lineJoin = 'round';

    const step = width / (data.length - 1);
    data.forEach((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Threshold line at 60fps
    if (max > 60) {
      const y60 = height - ((60 - min) / range) * (height - 4) - 2;
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0,255,102,0.15)';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([3, 3]);
      ctx.moveTo(0, y60);
      ctx.lineTo(width, y60);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [data, width, height, color]);

  return <canvas ref={ref} style={{ width, height, display: 'block' }} />;
}

export function PerfOverlay({ snapshotRef, historyRef, subsystems, onToggleSubsystem }: Props) {
  const [snap, setSnap] = useState<PerfSnapshot>(snapshotRef.current);
  const [fpsHistory, setFpsHistory] = useState<number[]>([]);
  const [impacts, setImpacts] = useState<Record<string, number | null>>({});

  // Poll snapshot at 4Hz (no re-render storm)
  useEffect(() => {
    const id = setInterval(() => {
      setSnap({ ...snapshotRef.current });
      setFpsHistory(historyRef.current.map(s => s.fps));
    }, 250);
    return () => clearInterval(id);
  }, [snapshotRef, historyRef]);

  // Track FPS before/after toggle for impact estimation
  const lastToggleFps = useRef<{ key: string; fps: number; wasEnabled: boolean } | null>(null);

  const handleToggle = useCallback((key: string) => {
    const sub = subsystems.find(s => s.key === key);
    if (sub) {
      lastToggleFps.current = { key, fps: snap.fps, wasEnabled: sub.enabled };
    }
    onToggleSubsystem(key);

    // Measure impact 1.5s after toggle
    setTimeout(() => {
      const lt = lastToggleFps.current;
      if (!lt || lt.key !== key) return;
      const currentFps = snapshotRef.current.fps;
      // If we disabled the subsystem, impact = currentFps - beforeFps (positive = improvement)
      // If we enabled it, impact = beforeFps - currentFps (positive = cost)
      const delta = lt.wasEnabled
        ? currentFps - lt.fps   // disabled → gained fps
        : lt.fps - currentFps;  // enabled → lost fps
      setImpacts(prev => ({ ...prev, [key]: delta }));
      lastToggleFps.current = null;
    }, 1500);
  }, [subsystems, onToggleSubsystem, snap.fps, snapshotRef]);

  return (
    <div style={{
      position: 'fixed', top: 14, right: 14, zIndex: 9000,
      width: 220,
      background: 'rgba(2,5,16,0.92)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(102,240,255,0.12)',
      borderRadius: 12,
      padding: '12px 14px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.60)',
      fontFamily: MONO,
      userSelect: 'none',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8,
      }}>
        <span style={{
          fontSize: 28, fontWeight: 800, lineHeight: 1,
          color: fpsColor(snap.fps),
          fontFamily: INTER,
          textShadow: `0 0 12px ${fpsColor(snap.fps)}40`,
        }}>
          {snap.fps}
        </span>
        <span style={{ fontSize: 9, color: 'rgba(160,180,220,0.50)', letterSpacing: '0.08em' }}>
          FPS
        </span>
        <span style={{ fontSize: 9, color: 'rgba(160,180,220,0.35)', marginLeft: 'auto' }}>
          {snap.frameMs}ms
        </span>
      </div>

      {/* Sparkline */}
      <div style={{
        marginBottom: 10,
        background: 'rgba(255,255,255,0.02)',
        borderRadius: 4,
        padding: '4px 2px',
      }}>
        <Sparkline
          data={fpsHistory}
          width={190}
          height={32}
          color={fpsColor(snap.fps)}
        />
      </div>

      {/* Stats grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '4px 12px', marginBottom: 10,
      }}>
        {([
          ['Draw Calls', String(snap.drawCalls), snap.drawCalls > 150 ? '#ff4466' : undefined],
          ['Triangles', formatK(snap.triangles), snap.triangles > 200_000 ? '#ff4466' : undefined],
          ['Geometries', String(snap.geometries), undefined],
          ['Textures', String(snap.textures), undefined],
          ['Nodes', String(snap.nodeCount), snap.nodeCount > 200 ? '#ffa040' : undefined],
          ['Edges', String(snap.edgeCount), snap.edgeCount > 500 ? '#ffa040' : undefined],
          ['Raycast', snap.raycastMs + 'ms', snap.raycastMs > 2 ? '#ff4466' : undefined],
        ] as [string, string, string | undefined][]).map(([label, value, warn]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 8, color: 'rgba(140,155,185,0.50)', letterSpacing: '0.06em' }}>
              {label}
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, color: warn ?? 'rgba(225,235,255,0.70)' }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 8 }} />

      {/* Subsystem toggles */}
      <div style={{ fontSize: 8, color: 'rgba(140,155,185,0.40)', letterSpacing: '0.08em', marginBottom: 6 }}>
        SUBSYSTEMS
      </div>
      {subsystems.map(sub => {
        const impact = impacts[sub.key];
        return (
          <button
            key={sub.key}
            onClick={() => handleToggle(sub.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '5px 6px',
              background: 'transparent', border: 'none',
              cursor: 'pointer', borderRadius: 4,
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(255,255,255,0.04)'; }}
            onMouseLeave={e => { (e.currentTarget).style.background = 'transparent'; }}
          >
            {/* Toggle dot */}
            <div style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: sub.enabled ? '#00ff66' : 'rgba(255,255,255,0.12)',
              boxShadow: sub.enabled ? '0 0 6px rgba(0,255,102,0.40)' : 'none',
              transition: 'all 0.15s',
            }} />
            <span style={{
              fontFamily: MONO, fontSize: 9, color: sub.enabled ? 'rgba(225,235,255,0.70)' : 'rgba(140,155,185,0.35)',
              letterSpacing: '0.04em', flex: 1, textAlign: 'left',
            }}>
              {sub.label}
            </span>
            {impact !== null && impact !== undefined && (
              <span style={{
                fontFamily: MONO, fontSize: 8, fontWeight: 700,
                color: impact > 0 ? '#00ff66' : impact < -3 ? '#ff4466' : 'rgba(160,180,220,0.40)',
              }}>
                {impact > 0 ? '+' : ''}{impact}fps
              </span>
            )}
          </button>
        );
      })}

      {/* Footer */}
      <div style={{
        marginTop: 8, fontSize: 7,
        color: 'rgba(100,115,145,0.35)',
        letterSpacing: '0.08em',
        textAlign: 'center',
      }}>
        SHIFT+P TO CLOSE
      </div>
    </div>
  );
}
