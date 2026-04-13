import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Note } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ArrowRight, Sparkles, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

const NODE_R = 20;
const NODE_COLORS = [
  '#6366f1','#8b5cf6','#06b6d4','#10b981',
  '#f59e0b','#ef4444','#ec4899','#14b8a6',
  '#a78bfa','#34d399','#fbbf24','#f87171',
];

interface Position { x: number; y: number }

function getPositions(count: number, W: number, H: number): Position[] {
  if (count === 0) return [];
  const cx = W / 2, cy = H / 2;
  if (count === 1) return [{ x: cx, y: cy }];

  const outerR = Math.min(W, H) * 0.36;
  const innerR = outerR * 0.5;
  const outerCount = Math.min(count, 8);
  const innerCount = count - outerCount;

  const positions: Position[] = [];
  for (let i = 0; i < outerCount; i++) {
    const angle = (2 * Math.PI * i) / outerCount - Math.PI / 2;
    positions.push({ x: cx + outerR * Math.cos(angle), y: cy + outerR * Math.sin(angle) });
  }
  for (let i = 0; i < innerCount; i++) {
    const angle = (2 * Math.PI * i) / innerCount - Math.PI / 2;
    positions.push({ x: cx + innerR * Math.cos(angle), y: cy + innerR * Math.sin(angle) });
  }
  return positions;
}

function getCurvePath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ox = (-dy / len) * Math.min(len * 0.25, 50);
  const oy = (dx / len) * Math.min(len * 0.25, 50);
  return `M${x1},${y1} Q${mx + ox},${my + oy} ${x2},${y2}`;
}

// Ghost nodes for empty state
const GHOST_POSITIONS: Position[] = [
  { x: 0.5, y: 0.18 },
  { x: 0.25, y: 0.55 },
  { x: 0.75, y: 0.55 },
  { x: 0.38, y: 0.82 },
  { x: 0.62, y: 0.82 },
];

interface Props { notes: Note[]; loading?: boolean }

export default function KnowledgeConstellation({ notes, loading }: Props) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 460 });
  const [hovered, setHovered] = useState<number | null>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);

  // Responsive sizing
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: width, h: Math.max(height, 380) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const positions = useMemo(() =>
    getPositions(notes.length, dims.w, dims.h),
    [notes.length, dims]
  );

  const edges = useMemo(() => {
    const result: { s: number; t: number; shared: string[] }[] = [];
    for (let i = 0; i < notes.length; i++) {
      for (let j = i + 1; j < notes.length; j++) {
        const shared = (notes[i].tags || []).filter(t => (notes[j].tags || []).includes(t));
        if (shared.length > 0) result.push({ s: i, t: j, shared });
      }
    }
    return result;
  }, [notes]);

  const handleMouseEnter = useCallback((idx: number, pos: Position) => {
    setHovered(idx);
    // Determine popup side (avoid going off-screen)
    const side = pos.x > dims.w * 0.6 ? 'left' : 'right';
    setPopupPos({
      x: side === 'right' ? pos.x + NODE_R + 12 : pos.x - NODE_R - 12,
      y: pos.y,
    });
  }, [dims.w]);

  if (loading) {
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <div className="text-muted-foreground text-sm animate-pulse">加载知识星图…</div>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────
  if (notes.length === 0) {
    return (
      <div
        ref={containerRef}
        className="relative w-full rounded-2xl overflow-hidden"
        style={{ height: 380, background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
      >
        <svg width="100%" height="100%" className="absolute inset-0">
          <defs>
            <radialGradient id="bg-glow" cx="50%" cy="50%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.06" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            <filter id="ghost-blur">
              <feGaussianBlur stdDeviation="1.5" />
            </filter>
          </defs>
          <rect width="100%" height="100%" fill="url(#bg-glow)" />
          {/* Ghost connections */}
          {[[0,1],[0,2],[1,3],[2,4],[3,4]].map(([a,b], i) => {
            const pa = GHOST_POSITIONS[a], pb = GHOST_POSITIONS[b];
            return (
              <path
                key={i}
                d={getCurvePath(pa.x * 800, pa.y * 380, pb.x * 800, pb.y * 380)}
                stroke="hsl(var(--border))"
                strokeWidth="1.5"
                fill="none"
                strokeDasharray="4 6"
                opacity="0.5"
              />
            );
          })}
          {/* Ghost nodes */}
          {GHOST_POSITIONS.map((p, i) => (
            <circle
              key={i}
              cx={p.x * 800} cy={p.y * 380}
              r={NODE_R}
              fill="hsl(var(--muted))"
              opacity="0.25"
              filter="url(#ghost-blur)"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-base">知识星图等待点亮</p>
            <p className="text-muted-foreground text-sm mt-1">添加第一条分析，信息节点将在此处形成关联</p>
          </div>
          <Button
            className="bg-gradient-primary hover:opacity-90 mt-1"
            onClick={() => navigate('/analyze')}
          >
            <Plus className="w-4 h-4 mr-2" />开始第一次分析
          </Button>
        </div>
      </div>
    );
  }

  // ── Full constellation ─────────────────────────────────────────────────
  const hoveredNote = hovered !== null ? notes[hovered] : null;

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-2xl overflow-hidden"
      style={{
        height: Math.max(380, notes.length > 6 ? 520 : 420),
        background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
      }}
      onMouseLeave={() => { setHovered(null); setPopupPos(null); }}
    >
      <svg
        width={dims.w}
        height={dims.h}
        className="absolute inset-0"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Background radial glow */}
          <radialGradient id="kc-bg" cx="50%" cy="50%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.07" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>

          {/* Node glow filter */}
          <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="node-glow-lg" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          {/* Edge gradient */}
          {edges.map(({ s, t }) => (
            <linearGradient
              key={`grad-${s}-${t}`}
              id={`eg-${s}-${t}`}
              x1={positions[s]?.x} y1={positions[s]?.y}
              x2={positions[t]?.x} y2={positions[t]?.y}
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor={NODE_COLORS[s % NODE_COLORS.length]} stopOpacity="0.6" />
              <stop offset="100%" stopColor={NODE_COLORS[t % NODE_COLORS.length]} stopOpacity="0.6" />
            </linearGradient>
          ))}

          {/* Animated dash pattern */}
          <style>{`
            @keyframes dash-flow {
              from { stroke-dashoffset: 24; }
              to   { stroke-dashoffset: 0; }
            }
            .kc-edge { animation: dash-flow 2s linear infinite; }
            @keyframes node-pulse {
              0%, 100% { opacity: 0.2; r: ${NODE_R + 6}px; }
              50%       { opacity: 0.4; r: ${NODE_R + 10}px; }
            }
            .kc-ring { animation: node-pulse 3s ease-in-out infinite; }
          `}</style>
        </defs>

        {/* Background fill */}
        <rect width={dims.w} height={dims.h} fill="url(#kc-bg)" />

        {/* Subtle grid dots */}
        {Array.from({ length: Math.ceil(dims.w / 40) }).map((_, xi) =>
          Array.from({ length: Math.ceil(dims.h / 40) }).map((_, yi) => (
            <circle
              key={`d-${xi}-${yi}`}
              cx={xi * 40 + 20} cy={yi * 40 + 20} r="1"
              fill="hsl(var(--border))" opacity="0.35"
            />
          ))
        )}

        {/* Edges */}
        {edges.map(({ s, t, shared }) => {
          const ps = positions[s], pt = positions[t];
          if (!ps || !pt) return null;
          const isHighlighted = hovered === s || hovered === t;
          return (
            <path
              key={`e-${s}-${t}`}
              className="kc-edge"
              d={getCurvePath(ps.x, ps.y, pt.x, pt.y)}
              stroke={isHighlighted ? `url(#eg-${s}-${t})` : 'hsl(var(--border))'}
              strokeWidth={isHighlighted ? Math.min(shared.length + 1, 3) : 1}
              fill="none"
              strokeDasharray={isHighlighted ? "none" : "4 8"}
              opacity={isHighlighted ? 0.85 : 0.4}
              style={{ transition: 'stroke 0.2s, opacity 0.2s, stroke-width 0.2s' }}
            />
          );
        })}

        {/* Nodes */}
        {notes.map((note, i) => {
          const pos = positions[i];
          if (!pos) return null;
          const color = NODE_COLORS[i % NODE_COLORS.length];
          const isHovered = hovered === i;
          const isConnected = hovered !== null && edges.some(e => (e.s === hovered || e.t === hovered) && (e.s === i || e.t === i));
          const isDimmed = hovered !== null && !isHovered && !isConnected;
          const label = (note.title || '未命名').slice(0, 10) + ((note.title || '').length > 10 ? '…' : '');

          return (
            <g
              key={note.id}
              style={{ cursor: 'pointer', opacity: isDimmed ? 0.3 : 1, transition: 'opacity 0.2s' }}
              onMouseEnter={() => handleMouseEnter(i, pos)}
              onClick={() => navigate(`/note/${note.id}`)}
            >
              {/* Outer pulse ring */}
              <circle
                className="kc-ring"
                cx={pos.x} cy={pos.y} r={NODE_R + 6}
                fill={color}
                style={{ animationDelay: `${i * 0.4}s` }}
              />
              {/* Main node */}
              <circle
                cx={pos.x} cy={pos.y} r={isHovered ? NODE_R + 3 : NODE_R}
                fill={color}
                filter={isHovered ? 'url(#node-glow-lg)' : 'url(#node-glow)'}
                style={{ transition: 'r 0.2s' }}
              />
              {/* Inner dot */}
              <circle
                cx={pos.x} cy={pos.y} r={isHovered ? 7 : 5}
                fill="white" opacity="0.9"
                style={{ transition: 'r 0.2s' }}
              />
              {/* Label */}
              <text
                x={pos.x} y={pos.y + NODE_R + 16}
                textAnchor="middle"
                fill="hsl(var(--foreground))"
                fontSize={isHovered ? 13 : 11}
                fontWeight={isHovered ? 600 : 400}
                style={{ transition: 'font-size 0.15s', pointerEvents: 'none',
                  textShadow: '0 1px 3px rgba(0,0,0,0.5)', userSelect: 'none' }}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* ── Hover popup ─────────────────────────────────────────── */}
      {hovered !== null && hoveredNote && popupPos && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{
            left: popupPos.x > dims.w * 0.6
              ? popupPos.x - 248
              : popupPos.x,
            top: Math.min(Math.max(popupPos.y - 70, 8), dims.h - 160),
            width: 240,
          }}
        >
          <div className="p-3.5 rounded-xl bg-card/95 backdrop-blur-md border border-border shadow-elegant space-y-2"
            style={{ pointerEvents: 'none' }}>
            {/* Source type dot */}
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: NODE_COLORS[hovered % NODE_COLORS.length] }}
              />
              <span className="text-xs font-semibold text-foreground line-clamp-1 leading-tight">
                {hoveredNote.title || '未命名笔记'}
              </span>
            </div>
            {hoveredNote.summary && (
              <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                {hoveredNote.summary}
              </p>
            )}
            {(hoveredNote.tags || []).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {hoveredNote.tags.slice(0, 4).map(tag => (
                  <span key={tag} className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(hoveredNote.created_at), { locale: zhCN, addSuffix: true })}
              </span>
              <span className="flex items-center gap-0.5 text-xs text-primary font-medium">
                查看分析 <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Legend: connected tags hint */}
      {edges.length > 0 && (
        <div className="absolute bottom-3 left-4 text-xs text-muted-foreground flex items-center gap-1.5">
          <div className="w-4 h-px bg-primary/50 inline-block" />
          相同标签的笔记已连接
        </div>
      )}

      {/* Note count badge */}
      <div className="absolute top-3 right-4 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full">
        {notes.length} 个知识节点
      </div>
    </div>
  );
}
