import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Search, ArrowRight } from 'lucide-react';
import { PestaLogo } from '@/components/brand/PestaLogo';

// ── Color palette ─────────────────────────────────────────────────────────
type ColorType = 'green' | 'cyan' | 'purple' | 'white';
const RGB: Record<ColorType, [number, number, number]> = {
  green:  [0,   255, 102],
  cyan:   [102, 227, 255],
  purple: [180, 150, 255],
  white:  [210, 220, 235],
};
const BG        = '#040508';
const MONO      = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER     = "'Inter',system-ui,sans-serif";
const NAV_H     = 64;

// ── Cluster definitions ───────────────────────────────────────────────────
// [normalizedX, normalizedY]
const CLUSTER_CENTERS: [number, number][] = [
  [0.73, 0.27], // 0 AI/ML
  [0.27, 0.40], // 1 Systems
  [0.15, 0.72], // 2 Philosophy
  [0.68, 0.66], // 3 Design
  [0.50, 0.24], // 4 Knowledge
];
const CLUSTER_COLORS: ColorType[] = ['green','cyan','purple','cyan','green'];
const CLUSTER_NAMES = ['AI / ML','Systems','Philosophy','Design','Knowledge'];

// ── Node definitions ──────────────────────────────────────────────────────
interface NodeDef {
  label: string;
  cluster: number;
  anchor?: boolean;
  fx?: number; // fixed normalized x (for bridge nodes)
  fy?: number;
}

const NODE_DEFS: NodeDef[] = [
  // Cluster 0 – AI/ML
  { label: 'Neural Networks',    cluster: 0, anchor: true },
  { label: 'Attention',          cluster: 0 },
  { label: 'Transformers',       cluster: 0 },
  { label: 'Embeddings',         cluster: 0 },
  { label: 'Semantic Search',    cluster: 0 },
  { label: 'Vector DB',          cluster: 0 },
  { label: 'Pattern Recognition',cluster: 0 },
  { label: 'Bayesian Inference', cluster: 0 },
  { label: 'Information Theory', cluster: 0 },
  // Cluster 1 – Systems
  { label: 'Systems Thinking',   cluster: 1, anchor: true },
  { label: 'Emergence',          cluster: 1 },
  { label: 'Feedback Loops',     cluster: 1 },
  { label: 'Network Effects',    cluster: 1 },
  { label: 'Causal Mapping',     cluster: 1 },
  { label: 'Mental Models',      cluster: 1 },
  { label: 'Complexity Theory',  cluster: 1 },
  { label: 'Decision Trees',     cluster: 1 },
  // Cluster 2 – Philosophy
  { label: 'Philosophy of Mind', cluster: 2, anchor: true },
  { label: 'Consciousness',      cluster: 2 },
  { label: 'Epistemology',       cluster: 2 },
  { label: 'Phenomenology',      cluster: 2 },
  { label: 'Cognitive Bias',     cluster: 2 },
  { label: 'Memory Formation',   cluster: 2 },
  { label: 'Intuition',          cluster: 2 },
  { label: 'Metaphor',           cluster: 2 },
  // Cluster 3 – Design
  { label: 'Design Systems',     cluster: 3, anchor: true },
  { label: 'Visual Language',    cluster: 3 },
  { label: 'UX Heuristics',      cluster: 3 },
  { label: 'Info Architecture',  cluster: 3 },
  { label: 'Gestalt Theory',     cluster: 3 },
  { label: 'Typography',         cluster: 3 },
  { label: 'Color Theory',       cluster: 3 },
  // Cluster 4 – Knowledge
  { label: 'Second Brain',       cluster: 4, anchor: true },
  { label: 'Deep Work',          cluster: 4 },
  { label: 'Flow State',         cluster: 4 },
  { label: 'Spaced Repetition',  cluster: 4 },
  { label: 'Knowledge Graph',    cluster: 4 },
  { label: 'Zettelkasten',       cluster: 4 },
  { label: 'Research Methods',   cluster: 4 },
  // Bridge / scattered
  { label: 'Synthesis',          cluster: 0, fx: 0.59, fy: 0.44 },
  { label: 'Abstraction',        cluster: 1, fx: 0.39, fy: 0.56 },
  { label: 'Reasoning',          cluster: 0, fx: 0.63, fy: 0.36 },
  { label: 'Inference',          cluster: 2, fx: 0.33, fy: 0.62 },
  { label: 'Creativity',         cluster: 3, fx: 0.56, fy: 0.58 },
  { label: 'Signal vs Noise',    cluster: 4, fx: 0.47, fy: 0.33 },
  { label: 'Emergence Patterns', cluster: 1, fx: 0.42, fy: 0.47 },
  { label: 'Deep Learning',      cluster: 0, fx: 0.66, fy: 0.46 },
];

// ── Runtime node ──────────────────────────────────────────────────────────
interface StarNode {
  id:          number;
  baseNX:      number;
  baseNY:      number;
  vx:          number;
  vy:          number;
  size:        number;
  phase:       number;
  colorType:   ColorType;
  alpha:       number;
  label:       string;
  cluster:     number;
  isAnchor:    boolean;
  connections: number[];
}

// Seeded pseudo-random for deterministic layout
function mkRng(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}
const rng = mkRng(42);

function randn(mean: number, std: number) {
  // Box-Muller
  const u1 = Math.max(1e-9, rng());
  const u2 = rng();
  return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ── Build nodes + connections ─────────────────────────────────────────────
function buildNodes(): StarNode[] {
  const nodes: StarNode[] = NODE_DEFS.map((def, i) => {
    const [cx, cy] = CLUSTER_CENTERS[def.cluster];
    const bx = def.fx !== undefined ? def.fx : randn(cx, 0.075);
    const by = def.fy !== undefined ? def.fy : randn(cy, 0.060);
    const isAnchor = !!def.anchor;
    return {
      id:          i,
      baseNX:      Math.max(0.04, Math.min(0.96, bx)),
      baseNY:      Math.max(0.06, Math.min(0.94, by)),
      vx:          (rng() - 0.5) * 0.00012,
      vy:          (rng() - 0.5) * 0.00010,
      size:        isAnchor ? 5.5 + rng() * 1.5 : 2.0 + rng() * 2.5,
      phase:       rng() * Math.PI * 2,
      colorType:   CLUSTER_COLORS[def.cluster],
      alpha:       isAnchor ? 0.92 : 0.50 + rng() * 0.35,
      label:       def.label,
      cluster:     def.cluster,
      isAnchor,
      connections: [],
    };
  });

  // Build edges
  const rng2 = mkRng(99);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const ni = nodes[i], nj = nodes[j];
      let connect = false;
      if (ni.cluster === nj.cluster) {
        // Always connect anchor to cluster members, random for rest
        connect = (ni.isAnchor || nj.isAnchor) ? rng2() < 0.70 : rng2() < 0.28;
      } else if (ni.isAnchor && nj.isAnchor) {
        // Anchor cross-cluster bridges (sparse)
        const [ax, ay] = CLUSTER_CENTERS[ni.cluster];
        const [bx, by] = CLUSTER_CENTERS[nj.cluster];
        const dist = Math.hypot(ax - bx, ay - by);
        connect = dist < 0.40 && rng2() < 0.50;
      } else if (ni.isAnchor || nj.isAnchor) {
        // Bridge nodes connect to nearest anchor
        const dx = ni.baseNX - nj.baseNX;
        const dy = ni.baseNY - nj.baseNY;
        connect = Math.hypot(dx, dy) < 0.14 && rng2() < 0.40;
      }
      if (connect) {
        ni.connections.push(j);
        nj.connections.push(i);
      }
    }
  }

  return nodes;
}

const INIT_NODES = buildNodes();

// ── Shooting star ─────────────────────────────────────────────────────────
interface Streak { x: number; y: number; dx: number; dy: number; len: number; t: number; maxT: number }

// ── Main component ────────────────────────────────────────────────────────
export default function Index({ preview = false }: { preview?: boolean }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!preview && !loading && user) navigate('/app');
  }, [preview, user, loading, navigate]);

  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const nodesRef    = useRef<StarNode[]>(INIT_NODES.map(n => ({ ...n, connections: [...n.connections] })));
  const rafRef      = useRef<number>(0);
  const timeRef     = useRef<number>(0);
  const mouseRef    = useRef({ x: -999, y: -999 });
  const hoveredRef  = useRef<number>(-1);
  const streaksRef  = useRef<Streak[]>([]);
  const nextStreakRef = useRef<number>(0);

  const [hoveredLabel, setHoveredLabel] = useState<{ label: string; cluster: string; x: number; y: number } | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);

  const gotoAuth = useCallback(() => navigate('/auth'), [navigate]);

  // ── Canvas draw ──────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const t = timeRef.current;
    const mx = mouseRef.current.x;
    const my = mouseRef.current.y;
    const nodes = nodesRef.current;

    // ── Background ──────────────────────────────────────────────────────
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // Central radial gradient (very subtle depth)
    const centerGrad = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, W * 0.7);
    centerGrad.addColorStop(0, 'rgba(10,12,20,0.0)');
    centerGrad.addColorStop(1, 'rgba(2,3,6,0.55)');
    ctx.fillStyle = centerGrad;
    ctx.fillRect(0, 0, W, H);

    // ── Nebula cluster glows ─────────────────────────────────────────────
    CLUSTER_CENTERS.forEach(([cx, cy], ci) => {
      const [r, g, b] = RGB[CLUSTER_COLORS[ci]];
      const nx = cx * W, ny = cy * H;
      const rad = Math.min(W, H) * 0.18;
      const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, rad);
      ng.addColorStop(0, `rgba(${r},${g},${b},0.04)`);
      ng.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = ng;
      ctx.beginPath();
      ctx.arc(nx, ny, rad, 0, Math.PI * 2);
      ctx.fill();
    });

    // ── Compute current node positions ───────────────────────────────────
    const px: number[] = new Array(nodes.length);
    const py: number[] = new Array(nodes.length);
    nodes.forEach((n, i) => {
      const jx = Math.sin(t * 0.00045 + n.phase) * 0.012 + Math.sin(t * 0.00023 + n.phase * 1.3) * 0.006;
      const jy = Math.cos(t * 0.00038 + n.phase * 0.9) * 0.010 + Math.cos(t * 0.00019 + n.phase * 1.7) * 0.005;
      px[i] = (n.baseNX + jx) * W;
      py[i] = (n.baseNY + jy) * H;
    });

    // ── Find hovered node ────────────────────────────────────────────────
    let closestI = -1;
    let closestD = 52;
    nodes.forEach((_, i) => {
      const d = Math.hypot(px[i] - mx, py[i] - my);
      if (d < closestD) { closestD = d; closestI = i; }
    });
    hoveredRef.current = closestI;

    // ── Draw connections ─────────────────────────────────────────────────
    nodes.forEach((n, i) => {
      n.connections.forEach(j => {
        if (j <= i) return; // draw once
        const [r, g, b] = RGB[n.colorType];
        const isActive = closestI === i || closestI === j;
        const baseAlpha = n.isAnchor ? 0.18 : 0.10;
        const alpha = isActive ? 0.55 : baseAlpha;
        ctx.beginPath();
        ctx.moveTo(px[i], py[i]);
        ctx.lineTo(px[j], py[j]);
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.lineWidth = isActive ? 0.8 : 0.4;
        ctx.stroke();
      });
    });

    // ── Draw nodes ───────────────────────────────────────────────────────
    nodes.forEach((n, i) => {
      const isHovered = closestI === i;
      const isConnected = closestI !== -1 && nodes[closestI].connections.includes(i);
      const [r, g, b] = RGB[n.colorType];

      const pulse = Math.sin(t * 0.0018 + n.phase) * 0.4;
      let radius = n.size + pulse;
      let alpha   = n.alpha;

      if (isHovered)    { radius *= 2.0; alpha = 1.0; }
      else if (isConnected) { radius *= 1.3; alpha = Math.min(1, alpha * 1.4); }
      else if (closestI !== -1) { alpha *= 0.35; }

      // Outer ring for anchors
      if (n.isAnchor && !isHovered) {
        ctx.beginPath();
        ctx.arc(px[i], py[i], radius * 3.0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha * 0.12})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Halo
      if (isHovered || n.isAnchor) {
        const haloR = radius * (isHovered ? 4 : 2.5);
        const halo = ctx.createRadialGradient(px[i], py[i], 0, px[i], py[i], haloR);
        halo.addColorStop(0, `rgba(${r},${g},${b},${alpha * (isHovered ? 0.25 : 0.10)})`);
        halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.beginPath();
        ctx.arc(px[i], py[i], haloR, 0, Math.PI * 2);
        ctx.fillStyle = halo;
        ctx.fill();
      }

      // Core glow
      ctx.shadowBlur  = isHovered ? 28 : (n.isAnchor ? 16 : 8);
      ctx.shadowColor = `rgba(${r},${g},${b},0.9)`;
      ctx.beginPath();
      ctx.arc(px[i], py[i], radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Always-on label for anchors (small + faint unless hovered)
      const showLabel = n.isAnchor || isHovered || isConnected;
      if (showLabel) {
        const labelAlpha = isHovered ? 1.0 : (n.isAnchor ? 0.55 : 0.35);
        ctx.font = isHovered
          ? `500 11px ${MONO}`
          : `400 9.5px ${MONO}`;
        ctx.fillStyle = isHovered
          ? `rgba(${r},${g},${b},${labelAlpha})`
          : `rgba(210,220,235,${labelAlpha})`;
        ctx.textAlign = 'center';
        const ly = py[i] + radius + (isHovered ? 16 : 12);
        ctx.fillText(n.label, px[i], ly);
        ctx.textAlign = 'left';
      }
    });

    // ── Shooting stars ───────────────────────────────────────────────────
    if (t > nextStreakRef.current) {
      nextStreakRef.current = t + 6000 + rng() * 8000;
      const sx = rng() * W;
      const sy = rng() * H * 0.5;
      const angle = (Math.PI / 5) + rng() * (Math.PI / 8);
      const speed = 0.002 + rng() * 0.003;
      streaksRef.current.push({ x: sx, y: sy, dx: Math.cos(angle), dy: Math.sin(angle), len: 60 + rng() * 80, t: 0, maxT: 600 });
    }
    streaksRef.current = streaksRef.current.filter(s => s.t < s.maxT);
    streaksRef.current.forEach(s => {
      const progress = s.t / s.maxT;
      const headX = s.x + s.dx * s.len * progress;
      const headY = s.y + s.dy * s.len * progress;
      const tailX = headX - s.dx * s.len * Math.min(progress, 0.4);
      const tailY = headY - s.dy * s.len * Math.min(progress, 0.4);
      const alpha = Math.sin(progress * Math.PI) * 0.7;
      const sg = ctx.createLinearGradient(tailX, tailY, headX, headY);
      sg.addColorStop(0, `rgba(210,230,255,0)`);
      sg.addColorStop(1, `rgba(210,230,255,${alpha})`);
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(headX, headY);
      ctx.strokeStyle = sg;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      s.t += 16;
    });

    // ── Tooltip state update ─────────────────────────────────────────────
    if (closestI !== -1) {
      const n = nodes[closestI];
      setHoveredLabel({
        label: n.label,
        cluster: CLUSTER_NAMES[n.cluster],
        x: px[closestI],
        y: py[closestI],
      });
    } else {
      setHoveredLabel(null);
    }

    timeRef.current += 16;
    rafRef.current = requestAnimationFrame(draw);
  }, []);

  // ── Setup canvas & events ────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const onMove = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    const onClick = () => { if (hoveredRef.current !== -1) gotoAuth(); };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('click', onClick);

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('click', onClick);
    };
  }, [draw, gotoAuth]);

  // ── Tooltip position clamped to viewport ─────────────────────────────────
  const tooltipX = hoveredLabel ? Math.min(hoveredLabel.x + 16, window.innerWidth  - 180) : 0;
  const tooltipY = hoveredLabel ? Math.max(hoveredLabel.y - 56, 80) : 0;

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: BG, position: 'relative', cursor: hoveredLabel ? 'pointer' : 'default' }}>

      {/* ── Canvas ── */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, display: 'block' }} />

      {/* ── Floating Nav ── */}
      <nav style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: NAV_H,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', zIndex: 10, pointerEvents: 'none',
      }}>
        {/* Logo */}
        <div style={{ pointerEvents: 'auto' }}>
          <PestaLogo size={30} showName />
        </div>

        {/* Right CTAs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, pointerEvents: 'auto' }}>
          <button
            onClick={gotoAuth}
            style={{
              fontFamily: INTER, fontSize: 13, color: 'rgba(140,142,148,0.9)',
              background: 'none', border: 'none', cursor: 'pointer', padding: '6px 12px',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(140,142,148,0.9)'; }}
          >
            登录
          </button>
          <button
            onClick={gotoAuth}
            style={{
              fontFamily: INTER, fontSize: 13, fontWeight: 600,
              color: '#040508', background: '#00ff66', border: 'none', cursor: 'pointer',
              padding: '7px 16px', borderRadius: 5,
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'box-shadow 0.2s, opacity 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = '0 0 22px rgba(0,255,102,0.55)';
              e.currentTarget.style.opacity = '0.92';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.opacity = '1';
            }}
          >
            开始使用 <ArrowRight size={13} />
          </button>
        </div>
      </nav>

      {/* ── Hero text overlay (bottom-left) ── */}
      <div style={{
        position: 'absolute', left: 52, bottom: 112, zIndex: 10,
        maxWidth: 360, pointerEvents: 'none',
      }}>
        <div style={{
          fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em',
          color: 'rgba(0,255,102,0.65)', marginBottom: 12,
          textTransform: 'uppercase',
        }}>
          [ Personal Knowledge OS ]
        </div>
        <h1 style={{
          fontFamily: INTER, fontWeight: 800, fontSize: 'clamp(26px, 3.2vw, 42px)',
          color: '#ffffff', lineHeight: 1.15, letterSpacing: '-0.03em', margin: '0 0 14px',
        }}>
          思维的宇宙<br />
          <span style={{ color: 'rgba(0,255,102,0.9)' }}>知识的星图</span>
        </h1>
        <p style={{
          fontFamily: MONO, fontSize: 11, color: 'rgba(140,142,148,0.70)',
          lineHeight: 1.6, margin: 0,
        }}>
          点击任意知识节点开始探索 →
        </p>
      </div>

      {/* ── Bottom floating command bar ── */}
      <div style={{
        position: 'absolute', bottom: 36, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, width: 380,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(15,17,22,0.85)', backdropFilter: 'blur(20px)',
          border: `1px solid ${searchFocused ? 'rgba(0,255,102,0.50)' : 'rgba(50,55,64,0.80)'}`,
          borderRadius: 8, padding: '10px 16px',
          boxShadow: searchFocused ? '0 0 28px rgba(0,255,102,0.18)' : '0 8px 32px rgba(0,0,0,0.4)',
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}>
          <Search size={14} color="rgba(107,110,117,0.8)" style={{ flexShrink: 0 }} />
          <input
            placeholder="搜索你的知识宇宙..."
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            onKeyDown={e => { if (e.key === 'Enter') gotoAuth(); }}
            style={{
              fontFamily: MONO, fontSize: 12, color: '#ffffff',
              background: 'none', border: 'none', outline: 'none',
              flex: 1, letterSpacing: '0.02em',
            }}
          />
          <span style={{
            fontFamily: MONO, fontSize: 10, color: 'rgba(107,110,117,0.6)',
            background: 'rgba(35,38,43,0.8)', border: '1px solid rgba(50,55,64,0.6)',
            padding: '2px 6px', borderRadius: 4, flexShrink: 0,
          }}>
            ⌘K
          </span>
        </div>
      </div>

      {/* ── Node tooltip ── */}
      {hoveredLabel && (
        <div style={{
          position: 'absolute',
          left: tooltipX,
          top: tooltipY,
          zIndex: 20,
          pointerEvents: 'none',
          background: 'rgba(13,15,20,0.92)',
          border: '1px solid rgba(50,55,64,0.9)',
          borderRadius: 6,
          padding: '8px 12px',
          backdropFilter: 'blur(12px)',
          animation: 'fadeIn 0.12s ease',
        }}>
          <div style={{ fontFamily: INTER, fontSize: 12, fontWeight: 600, color: '#ffffff', marginBottom: 3 }}>
            {hoveredLabel.label}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(107,110,117,0.8)' }}>
            {hoveredLabel.cluster}
          </div>
        </div>
      )}

      {/* ── Star count badge (bottom-right) ── */}
      <div style={{
        position: 'absolute', bottom: 44, right: 40, zIndex: 10,
        fontFamily: MONO, fontSize: 10,
        color: 'rgba(107,110,117,0.45)', letterSpacing: '0.08em',
        pointerEvents: 'none', userSelect: 'none',
      }}>
        {NODE_DEFS.length} nodes · {CLUSTER_NAMES.length} clusters
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        canvas { cursor: inherit; }
        input::placeholder { color: rgba(107,110,117,0.55); }
      `}</style>
    </div>
  );
}
