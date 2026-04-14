import type * as THREE from 'three';

// ── Palette ───────────────────────────────────────────────────────────────────
export const PALETTE = [
  '#00ff66', // neon green
  '#66f0ff', // cyan
  '#b496ff', // purple
  '#ffa040', // amber
  '#ff4466', // red-pink
  '#40ccff', // sky blue
  '#ff80ab', // pink
  '#7fff7f', // lime
];

// ── Types ─────────────────────────────────────────────────────────────────────
export interface CosmosNote {
  id: string;
  title: string | null;
  summary: string | null;
  tags: string[];
  created_at: string;
  node_type?: string;   // 'capture'|'summary'|'insight'|'action'|'question'|'relation'
}

export interface NotePosition {
  pos: [number, number, number];
  color: string;
  clusterIdx: number;
}

export interface ClusterInfo {
  tag: string;
  center: [number, number, number];
  color: string;
  noteIds: string[];
  radius: number;
}

export interface CosmosEdge {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  fromNoteId: string;
  toNoteId: string;
}

export interface CosmosLayout {
  positions: Record<string, NotePosition>;
  clusters: ClusterInfo[];
  edges: CosmosEdge[];
}

// ── Deterministic seeded RNG ──────────────────────────────────────────────────
function seededRng(seed: string) {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h, 33) ^ seed.charCodeAt(i);
  }
  h = h >>> 0;
  return function (): number {
    h ^= h << 13;
    h ^= h >> 17;
    h ^= h << 5;
    h = h >>> 0;
    return h / 0xffffffff;
  };
}

// ── Fibonacci sphere distribution ─────────────────────────────────────────────
function fibonacciPoint(i: number, total: number, radius: number): [number, number, number] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (i / (total - 1)) * 2;
  const r = Math.sqrt(1 - y * y);
  const theta = goldenAngle * i;
  return [
    radius * r * Math.cos(theta),
    radius * y,
    radius * r * Math.sin(theta),
  ];
}

// ── Main layout builder ───────────────────────────────────────────────────────
export function buildCosmosLayout(notes: CosmosNote[]): CosmosLayout {
  if (!notes.length) {
    return { positions: {}, clusters: [], edges: [] };
  }

  // Group notes by primary tag
  const tagMap: Record<string, string[]> = {};
  for (const note of notes) {
    const primary = note.tags?.[0] ?? '__untagged__';
    if (!tagMap[primary]) tagMap[primary] = [];
    tagMap[primary].push(note.id);
  }

  // Sort tags by frequency (most common first)
  const tagList = Object.entries(tagMap)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([tag]) => tag);

  const positions: Record<string, NotePosition> = {};
  const clusters: ClusterInfo[] = [];

  // Place cluster centers on a Fibonacci sphere
  const CLUSTER_RADIUS = 32;
  tagList.forEach((tag, i) => {
    const noteIds = tagMap[tag];
    const colorIdx = i % PALETTE.length;
    const color = tag === '__untagged__' ? '#4a5068' : PALETTE[colorIdx];

    const center: [number, number, number] = tag === '__untagged__'
      ? [0, 0, 0]
      : fibonacciPoint(i, Math.max(tagList.length, 2), CLUSTER_RADIUS);

    const spread = 4 + Math.sqrt(noteIds.length) * 2.5;
    const clusterRadius = spread * 1.6;

    clusters.push({ tag, center, color, noteIds, radius: clusterRadius });

    noteIds.forEach((noteId) => {
      const rng = seededRng(noteId + 'pos');
      const angle1 = rng() * Math.PI * 2;
      const angle2 = rng() * Math.PI;
      const r = spread * (0.3 + rng() * 0.7);

      const pos: [number, number, number] = [
        center[0] + r * Math.sin(angle2) * Math.cos(angle1),
        center[1] + r * Math.cos(angle2) * 0.6,
        center[2] + r * Math.sin(angle2) * Math.sin(angle1),
      ];

      positions[noteId] = {
        pos,
        color,
        clusterIdx: tag === '__untagged__' ? -1 : i,
      };
    });
  });

  // Build edges: connect notes sharing ≥1 tag (cap at 120 for performance)
  const edges: CosmosEdge[] = [];
  const noteList = notes.slice(0, 120);
  for (let i = 0; i < noteList.length; i++) {
    for (let j = i + 1; j < noteList.length; j++) {
      const ni = noteList[i];
      const nj = noteList[j];
      const shared = (ni.tags || []).filter(t => (nj.tags || []).includes(t));
      if (shared.length > 0) {
        const pi = positions[ni.id];
        const pj = positions[nj.id];
        if (pi && pj) {
          edges.push({
            from: pi.pos,
            to: pj.pos,
            color: pi.color,
            fromNoteId: ni.id,
            toNoteId: nj.id,
          });
        }
      }
    }
  }

  return { positions, clusters, edges };
}
