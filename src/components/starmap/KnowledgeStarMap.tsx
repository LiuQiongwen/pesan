import { useEffect, useRef, useCallback } from 'react';

// ── Visual constants ──────────────────────────────────────────────────────
const BG   = '#040508';
const MONO = "'IBM Plex Mono','Roboto Mono',monospace";

type RGB = [number, number, number];
const PALETTE: RGB[] = [
  [0,   255, 102],
  [102, 227, 255],
  [180, 150, 255],
  [255, 160,  64],
  [255, 100, 180],
  [100, 160, 255],
];
const MUTED_RGB: RGB = [100, 110, 130];

export interface StarMapNode {
  noteId:      string;
  title:       string;
  summary:     string | null;
  tags:        string[];
  createdAt:   string;
  clusterIdx:  number;
  baseNX:      number;
  baseNY:      number;
  phase:       number;
  size:        number;
  connections: number[];
}

export interface HoveredNodeInfo {
  noteId:     string;
  title:      string;
  tags:       string[];
  summary:    string | null;
  createdAt:  string;
  clusterIdx: number;
  px:         number;
  py:         number;
}

// ── Deterministic hash ────────────────────────────────────────────────────
function hash01(s: string, salt = ''): number {
  const str = s + salt;
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000;
}

// ── Build node layout ────────────────────────────────────────────────────
export function buildStarMapLayout(notes: { id: string; title: string; summary: string | null; tags: string[]; created_at: string }[], W: number, H: number): StarMapNode[] {
  if (!notes.length) return [];

  const tagFreq: Record<string, number> = {};
  notes.forEach(n => (n.tags || []).forEach(t => { tagFreq[t] = (tagFreq[t] || 0) + 1; }));

  const topTags = Object.entries(tagFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([t]) => t);

  const K = topTags.length || 1;
  const rw = 0.28, rh = 0.24;
  const clusterCenters = topTags.map((_, i) => {
    const angle = (2 * Math.PI * i / K) - Math.PI / 2;
    return { nx: 0.50 + rw * Math.cos(angle), ny: 0.50 + rh * Math.sin(angle) };
  });

  const nodes: StarMapNode[] = notes.map(note => {
    const j1 = hash01(note.id, 'x');
    const j2 = hash01(note.id, 'y');
    let clusterIdx = -1, bestFreq = 0;
    topTags.forEach((tag, i) => {
      if ((note.tags || []).includes(tag) && tagFreq[tag] > bestFreq) {
        bestFreq = tagFreq[tag]; clusterIdx = i;
      }
    });
    const spreadA = j1 * Math.PI * 2;
    const spreadR = 0.06 + j2 * 0.10;
    let nx: number, ny: number;
    if (clusterIdx >= 0) {
      const c = clusterCenters[clusterIdx];
      nx = c.nx + Math.cos(spreadA) * spreadR;
      ny = c.ny + Math.sin(spreadA) * spreadR * (W / H);
    } else {
      nx = 0.5 + (j1 - 0.5) * 0.20;
      ny = 0.5 + (j2 - 0.5) * 0.18;
    }
    return {
      noteId: note.id,
      title: note.title || '未命名',
      summary: note.summary,
      tags: note.tags || [],
      createdAt: note.created_at,
      clusterIdx,
      baseNX: Math.max(0.05, Math.min(0.95, nx)),
      baseNY: Math.max(0.08, Math.min(0.88, ny)),
      phase: hash01(note.id, 'ph') * Math.PI * 2,
      size: 2.8 + (note.tags || []).length * 0.5 + hash01(note.id, 'sz') * 1.5,
      connections: [],
    };
  });

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

// ── Props ─────────────────────────────────────────────────────────────────
interface KnowledgeStarMapProps {
  notes: { id: string; title: string; summary: string | null; tags: string[]; created_at: string }[];
  loading?: boolean;
  onNodeHover?: (info: HoveredNodeInfo | null) => void;
  onNodeClick?: (noteId: string) => void;
  highlightedNoteIds?: string[];
  flashNoteId?: string | null;
}

export default function KnowledgeStarMap({
  notes,
  loading = false,
  onNodeHover,
  onNodeClick,
  highlightedNoteIds = [],
  flashNoteId = null,
}: KnowledgeStarMapProps) {
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const containerRef   = useRef<HTMLDivElement>(null);
  const rafRef         = useRef<number>(0);
  const timeRef        = useRef<number>(0);
  const dimsRef        = useRef({ w: 1400, h: 900 });
  const nodesRef       = useRef<StarMapNode[]>([]);
  const mouseRef       = useRef({ x: -999, y: -999 });
  const hoveredIdxRef  = useRef<number>(-1);
  const prevHoverRef   = useRef<number>(-1);
  const streaksRef     = useRef<Streak[]>([]);
  const nextStreakRef  = useRef<number>(3000);
  const flashRef       = useRef<{ noteId: string; startT: number } | null>(null);
  const highlightSet   = useRef<Set<string>>(new Set(highlightedNoteIds));

  // Update highlight set when prop changes
  useEffect(() => {
    highlightSet.current = new Set(highlightedNoteIds);
  }, [highlightedNoteIds]);

  // Track flash note
  useEffect(() => {
    if (flashNoteId) {
      flashRef.current = { noteId: flashNoteId, startT: timeRef.current };
    }
  }, [flashNoteId]);

  const rebuildLayout = useCallback(() => {
    const { w, h } = dimsRef.current;
    nodesRef.current = buildStarMapLayout(notes, w, h);
  }, [notes]);

  useEffect(() => { rebuildLayout(); }, [rebuildLayout]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w: W, h: H } = dimsRef.current;
    const t   = timeRef.current;
    const mx  = mouseRef.current.x;
    const my  = mouseRef.current.y;
    const nodes = nodesRef.current;
    const hl  = highlightSet.current;
    const fl  = flashRef.current;

    // Background
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // Depth gradient
    const dg = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, W * 0.65);
    dg.addColorStop(0, 'rgba(10,12,22,0.0)');
    dg.addColorStop(1, 'rgba(2,3,6,0.55)');
    ctx.fillStyle = dg;
    ctx.fillRect(0, 0, W, H);

    // Node positions
    const px: number[] = new Array(nodes.length);
    const py: number[] = new Array(nodes.length);
    nodes.forEach((n, i) => {
      const jx = Math.sin(t * 0.00042 + n.phase) * 0.010 + Math.sin(t * 0.00021 + n.phase * 1.4) * 0.005;
      const jy = Math.cos(t * 0.00035 + n.phase * 0.9) * 0.008 + Math.cos(t * 0.00018 + n.phase * 1.8) * 0.004;
      px[i] = (n.baseNX + jx) * W;
      py[i] = (n.baseNY + jy) * H;
    });

    // Cluster nebula glows
    if (nodes.length > 0) {
      const cpx: Record<number, number[]> = {};
      const cpy: Record<number, number[]> = {};
      nodes.forEach((n, i) => {
        const ci = n.clusterIdx >= 0 ? n.clusterIdx : 99;
        if (!cpx[ci]) { cpx[ci] = []; cpy[ci] = []; }
        cpx[ci].push(px[i]); cpy[ci].push(py[i]);
      });
      Object.entries(cpx).forEach(([ci, xs]) => {
        const cIdx = parseInt(ci);
        if (cIdx === 99) return;
        const [r, g, b] = PALETTE[cIdx % PALETTE.length];
        const cx = xs.reduce((a, v) => a + v, 0) / xs.length;
        const cy = cpy[cIdx].reduce((a, v) => a + v, 0) / xs.length;
        const rad = Math.min(W, H) * 0.16;
        const ng = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        ng.addColorStop(0, `rgba(${r},${g},${b},0.04)`);
        ng.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = ng;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Find hovered
    let closestI = -1, closestD = 56;
    nodes.forEach((_, i) => {
      const d = Math.hypot(px[i] - mx, py[i] - my);
      if (d < closestD) { closestD = d; closestI = i; }
    });
    hoveredIdxRef.current = closestI;

    // Connections
    nodes.forEach((n, i) => {
      n.connections.forEach(j => {
        if (j <= i) return;
        const isActive = closestI === i || closestI === j;
        const isHL = hl.size > 0 && (hl.has(n.noteId) || hl.has(nodes[j].noteId));
        const [r, g, b] = n.clusterIdx >= 0 ? PALETTE[n.clusterIdx % PALETTE.length] : MUTED_RGB;
        const alpha = isActive ? 0.6 : isHL ? 0.45 : 0.09;
        ctx.beginPath();
        ctx.moveTo(px[i], py[i]);
        ctx.lineTo(px[j], py[j]);
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.lineWidth = isActive ? 0.9 : isHL ? 0.7 : 0.4;
        ctx.stroke();
      });
    });

    // Nodes
    nodes.forEach((n, i) => {
      const isHov  = closestI === i;
      const isConn = closestI !== -1 && nodes[closestI]?.connections.includes(i);
      const isHL   = hl.size > 0 && hl.has(n.noteId);

      // Flash animation
      let flashScale = 1;
      if (fl && fl.noteId === n.noteId) {
        const elapsed = t - fl.startT;
        if (elapsed < 800) {
          const prog = elapsed / 800;
          flashScale = 1 + Math.sin(prog * Math.PI) * 1.2;
        } else {
          flashRef.current = null;
        }
      }

      const [r, g, b] = n.clusterIdx >= 0 ? PALETTE[n.clusterIdx % PALETTE.length] : MUTED_RGB;
      // Override color for highlighted nodes (cyan ring)
      const [hr, hg, hb]: RGB = isHL ? [102, 240, 255] : [r, g, b];

      const pulse = Math.sin(t * 0.0017 + n.phase) * 0.35;
      let radius = (n.size + pulse) * flashScale;
      let alpha  = n.clusterIdx >= 0 ? 0.82 : 0.45;

      if      (isHov)  { radius *= 2.2; alpha = 1.0; }
      else if (isHL)   { radius *= 1.5; alpha = 1.0; }
      else if (isConn) { radius *= 1.3; alpha = Math.min(1, alpha * 1.3); }
      else if (closestI !== -1 && hl.size === 0) { alpha *= 0.30; }

      // Halo
      if (isHov || isHL) {
        const halo = ctx.createRadialGradient(px[i], py[i], 0, px[i], py[i], radius * (isHL ? 6 : 5));
        halo.addColorStop(0, `rgba(${hr},${hg},${hb},0.28)`);
        halo.addColorStop(1, `rgba(${hr},${hg},${hb},0)`);
        ctx.beginPath();
        ctx.arc(px[i], py[i], radius * (isHL ? 6 : 5), 0, Math.PI * 2);
        ctx.fillStyle = halo;
        ctx.fill();
      }

      // Core
      ctx.shadowBlur  = isHov ? 28 : isHL ? 20 : 10;
      ctx.shadowColor = `rgba(${hr},${hg},${hb},0.9)`;
      ctx.beginPath();
      ctx.arc(px[i], py[i], radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${hr},${hg},${hb},${alpha})`;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Label
      const showLabel = isHov || isConn || isHL || nodes.length <= 12;
      if (showLabel) {
        const lAlpha = isHov ? 1.0 : isHL ? 0.85 : isConn ? 0.5 : 0.32;
        ctx.font = isHov ? `500 11px ${MONO}` : `400 9.5px ${MONO}`;
        const maxChars = isHov ? 22 : 14;
        const label = n.title.length > maxChars ? n.title.slice(0, maxChars) + '…' : n.title;
        ctx.fillStyle = isHov
          ? `rgba(${r},${g},${b},${lAlpha})`
          : isHL
            ? `rgba(102,240,255,${lAlpha})`
            : `rgba(200,210,228,${lAlpha})`;
        ctx.textAlign = 'center';
        ctx.fillText(label, px[i], py[i] + radius + (isHov ? 16 : 13));
        ctx.textAlign = 'left';
      }
    });

    // Shooting stars
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
      const tx = hx - s.dx * s.len * Math.min(prog, 0.4), ty = hy - s.dy * s.len * Math.min(prog, 0.4);
      const sg = ctx.createLinearGradient(tx, ty, hx, hy);
      sg.addColorStop(0, 'rgba(210,230,255,0)');
      sg.addColorStop(1, `rgba(210,230,255,${Math.sin(prog * Math.PI) * 0.65})`);
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy);
      ctx.strokeStyle = sg; ctx.lineWidth = 1.2; ctx.stroke();
      s.t += 16;
    });

    // Empty state ghost
    if (!loading && nodes.length === 0) {
      const ghostPos = [[0.50,0.28],[0.30,0.48],[0.70,0.44],[0.35,0.68],[0.65,0.66],[0.50,0.72]];
      const ghostEdges = [[0,1],[0,2],[1,3],[2,4],[1,2],[3,5],[4,5]];
      ghostEdges.forEach(([a, b]) => {
        const [ax,ay]=ghostPos[a],[bx,by]=ghostPos[b];
        ctx.beginPath(); ctx.moveTo(ax*W,ay*H); ctx.lineTo(bx*W,by*H);
        ctx.strokeStyle='rgba(45,55,70,0.5)'; ctx.lineWidth=0.5; ctx.stroke();
      });
      ghostPos.forEach(([gx,gy],i)=>{
        const p = 0.25 + 0.08 * Math.sin(t * 0.001 + i);
        ctx.beginPath(); ctx.arc(gx*W,gy*H,4+i*0.25,0,Math.PI*2);
        ctx.fillStyle=`rgba(45,58,72,${p})`; ctx.fill();
      });
    }

    // Update hover callback
    if (closestI !== prevHoverRef.current) {
      prevHoverRef.current = closestI;
      if (closestI >= 0 && nodes[closestI]) {
        const n = nodes[closestI];
        onNodeHover?.({
          noteId: n.noteId, title: n.title, tags: n.tags,
          summary: n.summary, createdAt: n.createdAt, clusterIdx: n.clusterIdx,
          px: px[closestI], py: py[closestI],
        });
      } else {
        onNodeHover?.(null);
      }
    }

    timeRef.current += 16;
    rafRef.current = requestAnimationFrame(draw);
  }, [loading, onNodeHover]);

  useEffect(() => {
    const canvas    = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      dimsRef.current = { w: window.innerWidth, h: window.innerHeight };
      rebuildLayout();
    };
    resize();
    window.addEventListener('resize', resize);

    const onMove = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    const onClick = () => {
      const idx = hoveredIdxRef.current;
      if (idx >= 0 && nodesRef.current[idx]) {
        onNodeClick?.(nodesRef.current[idx].noteId);
      }
    };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('click', onClick);

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('click', onClick);
    };
  }, [draw, rebuildLayout, onNodeClick]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: BG,
        zIndex: 0,
        cursor: 'crosshair',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, display: 'block' }}
      />
    </div>
  );
}
