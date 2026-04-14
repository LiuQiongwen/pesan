import { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import { Note } from '@/types';
import { Plus, Sparkles } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// ── Visual constants ──────────────────────────────────────────────────────
const BG    = '#040508';
const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

type RGB = [number, number, number];
const PALETTE: RGB[] = [
  [0,   255, 102],   // green
  [102, 227, 255],   // cyan
  [180, 150, 255],   // purple
  [255, 160,  64],   // orange
  [255, 100, 180],   // pink
  [100, 160, 255],   // blue
];
const MUTED_RGB: RGB = [140, 148, 162];

// ── Layout types ──────────────────────────────────────────────────────────
interface NoteNode {
  noteId:      string;
  title:       string;
  summary:     string | null;
  tags:        string[];
  createdAt:   string;
  clusterIdx:  number;    // index into PALETTE (or -1 for unclustered)
  baseNX:      number;    // normalized 0–1
  baseNY:      number;
  phase:       number;
  size:        number;
  connections: number[];  // indices into the nodes array
}

interface HoveredInfo {
  title:     string;
  tags:      string[];
  summary:   string | null;
  createdAt: string;
  noteId:    string;
  px:        number;
  py:        number;
  clusterIdx: number;
}

// ── Deterministic jitter from note ID ─────────────────────────────────────
function hash01(s: string, salt = ''): number {
  const str = s + salt;
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000;
}

// ── Build node layout from notes ──────────────────────────────────────────
function buildLayout(notes: Note[], W: number, H: number): NoteNode[] {
  if (!notes.length) return [];

  // Collect tag frequencies
  const tagFreq: Record<string, number> = {};
  notes.forEach(n => (n.tags || []).forEach(t => { tagFreq[t] = (tagFreq[t] || 0) + 1; }));

  // Top N tags → cluster centers (max 6)
  const topTags = Object.entries(tagFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([t]) => t);

  // Cluster center positions arranged in an offset polygon
  const K = topTags.length || 1;
  const rw = 0.28, rh = 0.24;
  const clusterCenters = topTags.map((_, i) => {
    const angle = (2 * Math.PI * i / K) - Math.PI / 2;
    return { nx: 0.50 + rw * Math.cos(angle), ny: 0.50 + rh * Math.sin(angle) };
  });

  // Build nodes
  const nodes: NoteNode[] = notes.map(note => {
    const j1 = hash01(note.id, 'x');
    const j2 = hash01(note.id, 'y');

    // Assign cluster
    let clusterIdx = -1;
    let bestFreq = 0;
    topTags.forEach((tag, i) => {
      if ((note.tags || []).includes(tag) && tagFreq[tag] > bestFreq) {
        bestFreq = tagFreq[tag];
        clusterIdx = i;
      }
    });

    // Scatter around cluster center
    const spreadA = j1 * Math.PI * 2;
    const spreadR = 0.06 + j2 * 0.10;
    let nx: number, ny: number;
    if (clusterIdx >= 0) {
      const c = clusterCenters[clusterIdx];
      nx = c.nx + Math.cos(spreadA) * spreadR;
      ny = c.ny + Math.sin(spreadA) * spreadR * (W / H);
    } else {
      // Unclustered: loose central cloud
      nx = 0.5 + (j1 - 0.5) * 0.20;
      ny = 0.5 + (j2 - 0.5) * 0.18;
    }

    return {
      noteId:     note.id,
      title:      note.title || '未命名笔记',
      summary:    note.summary,
      tags:       note.tags || [],
      createdAt:  note.created_at,
      clusterIdx,
      baseNX:     Math.max(0.05, Math.min(0.95, nx)),
      baseNY:     Math.max(0.08, Math.min(0.92, ny)),
      phase:      hash01(note.id, 'ph') * Math.PI * 2,
      size:       2.8 + (note.tags || []).length * 0.5 + hash01(note.id, 'sz') * 1.5,
      connections: [],
    };
  });

  // Build edges (shared tags)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const shared = nodes[i].tags.filter(t => nodes[j].tags.includes(t));
      if (shared.length > 0) {
        nodes[i].connections.push(j);
        nodes[j].connections.push(i);
      }
    }
  }

  return nodes;
}

// ── Shooting star ─────────────────────────────────────────────────────────
interface Streak { x: number; y: number; dx: number; dy: number; len: number; t: number }
let streakSeed = 7;
function sRng() { streakSeed = (streakSeed * 1664525 + 1013904223) & 0xffffffff; return (streakSeed >>> 0) / 0xffffffff; }

// ── Dashboard component ────────────────────────────────────────────────────
export default function Dashboard() {
  const { user }        = useAuth();
  const { notes, loading } = useNotes(user?.id);
  const navigate        = useNavigate();

  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const containerRef   = useRef<HTMLDivElement>(null);
  const rafRef         = useRef<number>(0);
  const timeRef        = useRef<number>(0);
  const dimsRef        = useRef({ w: 800, h: 600 });
  const nodesRef       = useRef<NoteNode[]>([]);
  const mouseRef       = useRef({ x: -999, y: -999 });
  const hoveredIdxRef  = useRef<number>(-1);
  const prevHoverRef   = useRef<number>(-1);
  const streaksRef     = useRef<Streak[]>([]);
  const nextStreakRef  = useRef<number>(3000);

  const [hoveredInfo, setHoveredInfo] = useState<HoveredInfo | null>(null);

  const username = user?.email?.split('@')[0] || '用户';

  // ── Rebuild layout when notes or dims change ───────────────────────────
  const rebuildLayout = useCallback(() => {
    const { w, h } = dimsRef.current;
    nodesRef.current = buildLayout(notes, w, h);
  }, [notes]);

  useEffect(() => { rebuildLayout(); }, [rebuildLayout]);

  // ── Canvas draw loop ────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w: W, h: H } = dimsRef.current;
    const t  = timeRef.current;
    const mx = mouseRef.current.x;
    const my = mouseRef.current.y;
    const nodes = nodesRef.current;

    // Background
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // Central depth gradient
    const dg = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, W * 0.65);
    dg.addColorStop(0, 'rgba(12,15,25,0.0)');
    dg.addColorStop(1, 'rgba(2,3,6,0.55)');
    ctx.fillStyle = dg;
    ctx.fillRect(0, 0, W, H);

    // ── Compute current node positions ──────────────────────────────────
    const px: number[] = new Array(nodes.length);
    const py: number[] = new Array(nodes.length);
    nodes.forEach((n, i) => {
      const jx = Math.sin(t * 0.00042 + n.phase) * 0.010 + Math.sin(t * 0.00021 + n.phase * 1.4) * 0.005;
      const jy = Math.cos(t * 0.00035 + n.phase * 0.9) * 0.008 + Math.cos(t * 0.00018 + n.phase * 1.8) * 0.004;
      px[i] = (n.baseNX + jx) * W;
      py[i] = (n.baseNY + jy) * H;
    });

    // ── Cluster nebula glows ─────────────────────────────────────────────
    if (nodes.length > 0) {
      const clusterPx: Record<number, number[]> = {};
      const clusterPy: Record<number, number[]> = {};
      nodes.forEach((n, i) => {
        const ci = n.clusterIdx >= 0 ? n.clusterIdx : 99;
        if (!clusterPx[ci]) { clusterPx[ci] = []; clusterPy[ci] = []; }
        clusterPx[ci].push(px[i]);
        clusterPy[ci].push(py[i]);
      });
      Object.entries(clusterPx).forEach(([ci, xs]) => {
        const cIdx = parseInt(ci);
        if (cIdx === 99) return;
        const [r, g, b] = PALETTE[cIdx % PALETTE.length];
        const cx = xs.reduce((a, v) => a + v, 0) / xs.length;
        const cy = clusterPy[cIdx].reduce((a, v) => a + v, 0) / xs.length;
        const rad = Math.min(W, H) * 0.16;
        const ng = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        ng.addColorStop(0, `rgba(${r},${g},${b},0.05)`);
        ng.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = ng;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // ── Find hovered node ────────────────────────────────────────────────
    let closestI = -1;
    let closestD = 56;
    nodes.forEach((n, i) => {
      const d = Math.hypot(px[i] - mx, py[i] - my);
      if (d < closestD) { closestD = d; closestI = i; }
    });
    hoveredIdxRef.current = closestI;

    // ── Draw connections ─────────────────────────────────────────────────
    nodes.forEach((n, i) => {
      n.connections.forEach(j => {
        if (j <= i) return;
        const isActive = closestI === i || closestI === j;
        const [r, g, b] = n.clusterIdx >= 0 ? PALETTE[n.clusterIdx % PALETTE.length] : MUTED_RGB;
        const alpha = isActive ? 0.55 : 0.10;
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
      const isHov  = closestI === i;
      const isConn = closestI !== -1 && nodes[closestI].connections.includes(i);
      const [r, g, b] = n.clusterIdx >= 0 ? PALETTE[n.clusterIdx % PALETTE.length] : MUTED_RGB;
      const pulse = Math.sin(t * 0.0017 + n.phase) * 0.35;
      let radius = n.size + pulse;
      let alpha  = n.clusterIdx >= 0 ? 0.82 : 0.50;

      if      (isHov)  { radius *= 2.1; alpha = 1.0; }
      else if (isConn) { radius *= 1.3; alpha = Math.min(1, alpha * 1.3); }
      else if (closestI !== -1) { alpha *= 0.30; }

      // Outer glow ring
      if (isHov) {
        const halo = ctx.createRadialGradient(px[i], py[i], 0, px[i], py[i], radius * 4.5);
        halo.addColorStop(0, `rgba(${r},${g},${b},0.28)`);
        halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.beginPath();
        ctx.arc(px[i], py[i], radius * 4.5, 0, Math.PI * 2);
        ctx.fillStyle = halo;
        ctx.fill();
      }

      // Core node
      ctx.shadowBlur  = isHov ? 28 : 10;
      ctx.shadowColor = `rgba(${r},${g},${b},0.9)`;
      ctx.beginPath();
      ctx.arc(px[i], py[i], radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Label: always show for hovered/connected, else only if ≤10 notes
      const showLabel = isHov || isConn || nodes.length <= 10;
      if (showLabel) {
        const lAlpha = isHov ? 1.0 : (isConn ? 0.5 : 0.35);
        ctx.font = isHov ? `500 11px ${MONO}` : `400 9.5px ${MONO}`;
        const maxChars = isHov ? 20 : 12;
        const label = n.title.length > maxChars ? n.title.slice(0, maxChars) + '…' : n.title;
        ctx.fillStyle = isHov
          ? `rgba(${r},${g},${b},${lAlpha})`
          : `rgba(210,220,235,${lAlpha})`;
        ctx.textAlign = 'center';
        ctx.fillText(label, px[i], py[i] + radius + (isHov ? 16 : 13));
        ctx.textAlign = 'left';
      }
    });

    // ── Shooting stars ────────────────────────────────────────────────────
    if (t > nextStreakRef.current) {
      nextStreakRef.current = t + 7000 + sRng() * 10000;
      streaksRef.current.push({
        x: sRng() * W, y: sRng() * H * 0.5,
        dx: Math.cos(Math.PI / 5 + sRng() * 0.4),
        dy: Math.sin(Math.PI / 5 + sRng() * 0.4),
        len: 55 + sRng() * 75, t: 0,
      });
    }
    streaksRef.current = streaksRef.current.filter(s => s.t < 550);
    streaksRef.current.forEach(s => {
      const prog = s.t / 550;
      const hx = s.x + s.dx * s.len * prog, hy = s.y + s.dy * s.len * prog;
      const tx = hx - s.dx * s.len * Math.min(prog, 0.4);
      const ty = hy - s.dy * s.len * Math.min(prog, 0.4);
      const sg = ctx.createLinearGradient(tx, ty, hx, hy);
      sg.addColorStop(0, 'rgba(210,230,255,0)');
      sg.addColorStop(1, `rgba(210,230,255,${Math.sin(prog * Math.PI) * 0.65})`);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
      ctx.strokeStyle = sg;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      s.t += 16;
    });

    // ── Empty-state ghost nodes ───────────────────────────────────────────
    if (!loading && nodes.length === 0) {
      const ghostPos = [
        [0.50, 0.28], [0.30, 0.48], [0.70, 0.44],
        [0.35, 0.68], [0.65, 0.66], [0.50, 0.72],
      ];
      const ghostEdges = [[0,1],[0,2],[1,3],[2,4],[1,2],[3,5],[4,5]];
      ghostEdges.forEach(([a, b]) => {
        const [ax, ay] = ghostPos[a], [bx, by] = ghostPos[b];
        ctx.beginPath();
        ctx.moveTo(ax * W, ay * H);
        ctx.lineTo(bx * W, by * H);
        ctx.strokeStyle = 'rgba(50,58,70,0.6)';
        ctx.lineWidth = 0.6;
        ctx.stroke();
      });
      ghostPos.forEach(([gx, gy], i) => {
        const pulse = 0.3 + 0.1 * Math.sin(t * 0.001 + i);
        ctx.beginPath();
        ctx.arc(gx * W, gy * H, 4 + i * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(55,65,80,${pulse})`;
        ctx.fill();
      });
    }

    // ── Update hover state (only when node changes) ───────────────────────
    if (closestI !== prevHoverRef.current) {
      prevHoverRef.current = closestI;
      if (closestI >= 0 && nodes[closestI]) {
        const n = nodes[closestI];
        setHoveredInfo({
          title:      n.title,
          tags:       n.tags,
          summary:    n.summary,
          createdAt:  n.createdAt,
          noteId:     n.noteId,
          px:         px[closestI],
          py:         py[closestI],
          clusterIdx: n.clusterIdx,
        });
      } else {
        setHoveredInfo(null);
      }
    }

    timeRef.current += 16;
    rafRef.current = requestAnimationFrame(draw);
  }, [loading]);

  // ── Setup canvas + events ────────────────────────────────────────────────
  useEffect(() => {
    const canvas    = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const w = container.offsetWidth;
      const h = container.offsetHeight;
      canvas.width  = w;
      canvas.height = h;
      dimsRef.current = { w, h };
      rebuildLayout();
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const onMove  = (e: MouseEvent) => { mouseRef.current = { x: e.clientX - container.getBoundingClientRect().left, y: e.clientY - container.getBoundingClientRect().top }; };
    const onClick = () => {
      const idx = hoveredIdxRef.current;
      if (idx >= 0 && nodesRef.current[idx]) navigate(`/note/${nodesRef.current[idx].noteId}`);
    };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('click', onClick);

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('click', onClick);
    };
  }, [draw, navigate, rebuildLayout]);

  // ── Tooltip placement ────────────────────────────────────────────────────
  const W = dimsRef.current.w;
  const H = dimsRef.current.h;
  const ttX = hoveredInfo ? Math.min(hoveredInfo.px + 18, W - 240) : 0;
  const ttY = hoveredInfo ? Math.max(hoveredInfo.py - 70, 12) : 0;

  const totalTags = Array.from(new Set(notes.flatMap(n => n.tags || []))).length;
  const thisWeek  = notes.filter(n => n.created_at && Date.now() - new Date(n.created_at).getTime() < 7 * 86400000).length;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%', position: 'relative',
        background: BG, overflow: 'hidden',
        cursor: hoveredInfo ? 'pointer' : 'default',
      }}
    >
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, display: 'block' }} />

      {/* ── Top floating bar ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: '16px 24px', zIndex: 10, pointerEvents: 'none',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontFamily: INTER, fontWeight: 700, fontSize: 15, color: '#ffffff', marginBottom: 2 }}>
            {username}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(107,110,117,0.7)', letterSpacing: '0.06em' }}>
            {format(new Date(), 'yyyy.MM.dd EEEE', { locale: zhCN })}
          </div>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(107,110,117,0.55)', textAlign: 'right', letterSpacing: '0.06em' }}>
          {!loading && (
            <>
              <div>{notes.length} nodes</div>
              <div>{totalTags} tags</div>
              <div>+{thisWeek} this week</div>
            </>
          )}
        </div>
      </div>

      {/* ── Add button ── */}
      <button
        onClick={() => navigate('/analyze')}
        style={{
          position: 'absolute', bottom: 32, left: 28, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(13,15,20,0.90)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(0,255,102,0.30)',
          borderRadius: 8, padding: '9px 16px',
          fontFamily: MONO, fontSize: 11, color: '#00ff66', cursor: 'pointer',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          letterSpacing: '0.04em',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'rgba(0,255,102,0.70)';
          e.currentTarget.style.boxShadow   = '0 0 20px rgba(0,255,102,0.20)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'rgba(0,255,102,0.30)';
          e.currentTarget.style.boxShadow   = 'none';
        }}
      >
        <Plus size={13} />
        新建分析
      </button>

      {/* ── Node tooltip ── */}
      {hoveredInfo && (
        <div style={{
          position: 'absolute', left: ttX, top: ttY,
          zIndex: 20, pointerEvents: 'none',
          background: 'rgba(11,13,18,0.94)',
          border: '1px solid rgba(45,49,54,0.95)',
          borderRadius: 7, padding: '11px 14px',
          backdropFilter: 'blur(16px)',
          maxWidth: 230,
          animation: 'fadeInUp 0.12s ease',
        }}>
          {/* Color bar */}
          <div style={{
            position: 'absolute', left: 0, top: 8, bottom: 8, width: 2.5,
            borderRadius: '0 2px 2px 0',
            background: hoveredInfo.clusterIdx >= 0
              ? `rgb(${PALETTE[hoveredInfo.clusterIdx % PALETTE.length].join(',')})`
              : `rgb(${MUTED_RGB.join(',')})`,
            opacity: 0.8,
          }} />
          <div style={{ paddingLeft: 4 }}>
            <div style={{ fontFamily: INTER, fontSize: 12, fontWeight: 600, color: '#ffffff', marginBottom: 5, lineHeight: 1.4 }}>
              {hoveredInfo.title}
            </div>
            {hoveredInfo.summary && (
              <div style={{ fontFamily: INTER, fontSize: 11, color: 'rgba(140,142,148,0.85)', marginBottom: 7, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                {hoveredInfo.summary}
              </div>
            )}
            {hoveredInfo.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 7 }}>
                {hoveredInfo.tags.slice(0, 4).map(tag => (
                  <span key={tag} style={{
                    fontFamily: MONO, fontSize: 9.5, color: 'rgba(0,255,102,0.75)',
                    background: 'rgba(0,255,102,0.08)', border: '1px solid rgba(0,255,102,0.18)',
                    padding: '1.5px 6px', borderRadius: 3,
                  }}>#{tag}</span>
                ))}
              </div>
            )}
            <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(107,110,117,0.60)', letterSpacing: '0.04em' }}>
              {formatDistanceToNow(new Date(hoveredInfo.createdAt), { locale: zhCN, addSuffix: true })}
            </div>
          </div>
        </div>
      )}

      {/* ── Empty state overlay ── */}
      {!loading && notes.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(10,12,18,0.88)', backdropFilter: 'blur(20px)',
            border: '1px solid rgba(45,49,54,0.80)',
            borderRadius: 12, padding: '32px 40px',
            textAlign: 'center', maxWidth: 340,
            pointerEvents: 'auto',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              border: '1px solid rgba(0,255,102,0.25)',
              background: 'rgba(0,255,102,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <Sparkles size={18} color="rgba(0,255,102,0.80)" />
            </div>
            <div style={{ fontFamily: INTER, fontWeight: 700, fontSize: 15, color: '#ffffff', marginBottom: 8 }}>
              知识星图等待点亮
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(107,110,117,0.70)', lineHeight: 1.6, marginBottom: 20 }}>
              添加第一条分析<br/>信息节点将在此处形成关联
            </div>
            <button
              onClick={() => navigate('/analyze')}
              style={{
                fontFamily: MONO, fontSize: 11, color: '#040508', fontWeight: 700,
                background: '#00ff66', border: 'none', borderRadius: 6,
                padding: '9px 20px', cursor: 'pointer', letterSpacing: '0.04em',
                transition: 'box-shadow 0.2s',
                display: 'flex', alignItems: 'center', gap: 7, margin: '0 auto',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 22px rgba(0,255,102,0.50)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
            >
              <Plus size={13} />
              开始第一次分析
            </button>
          </div>
        </div>
      )}

      {/* ── Bottom-right: connection hint ── */}
      {notes.length > 1 && (
        <div style={{
          position: 'absolute', bottom: 38, right: 24, zIndex: 10,
          fontFamily: MONO, fontSize: 10, color: 'rgba(107,110,117,0.40)',
          letterSpacing: '0.06em', pointerEvents: 'none',
        }}>
          {notes.length} nodes · 悬停预览 · 点击查看
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
