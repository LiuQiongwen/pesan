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

export interface DbEdge {
  id: string;
  source_id: string;
  target_id: string;
  edge_type: string;
  description: string | null;
  confidence: number | null;
}

export interface CosmosEdge {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  fromNoteId: string;
  toNoteId: string;
  edgeType: string;
  description: string | null;
  edgeId: string | null; // DB id, null for tag-inferred edges
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

// ── Manual position overrides ────────────────────────────────────────────────
export interface ManualPositions {
  nodes?: Record<string, [number, number, number]>;
  galaxies?: Record<string, [number, number, number]>;
}

// ── Main layout builder ───────────────────────────────────────────────────────
export function buildCosmosLayout(
  notes: CosmosNote[],
  dbEdges: DbEdge[] = [],
  manual?: ManualPositions,
): CosmosLayout {
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
      : (manual?.galaxies?.[tag] ?? fibonacciPoint(i, Math.max(tagList.length, 2), CLUSTER_RADIUS));

    const spread = 4 + Math.sqrt(noteIds.length) * 2.5;
    const clusterRadius = spread * 1.6;

    clusters.push({ tag, center, color, noteIds, radius: clusterRadius });

    noteIds.forEach((noteId) => {
      // Check for manual position override
      const manualPos = manual?.nodes?.[noteId];
      if (manualPos) {
        positions[noteId] = {
          pos: manualPos,
          color,
          clusterIdx: tag === '__untagged__' ? -1 : i,
        };
        return;
      }

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

  // Build edges: tag-inferred + DB edges (deduplicated)
  const edges: CosmosEdge[] = [];
  const edgeKey = (a: string, b: string) => a < b ? `${a}:${b}` : `${b}:${a}`;
  const seenPairs = new Set<string>();

  // 1. DB edges first (higher priority — they carry semantic info)
  for (const de of dbEdges) {
    const pi = positions[de.source_id];
    const pj = positions[de.target_id];
    if (!pi || !pj) continue;
    const key = edgeKey(de.source_id, de.target_id);
    seenPairs.add(key);

    const typeColors: Record<string, string> = {
      semantic: '#00ff66', insight_of: '#cc88ff', drives_action: '#ffaa44',
      answers: '#66c2ff', supports: '#44dd88', contradicts: '#ff4466',
      extends: '#66f0ff', inspires: '#ffa0d0', wikilink: '#a855f7',
      related: '#4a5068',
    };

    edges.push({
      from: pi.pos, to: pj.pos,
      color: typeColors[de.edge_type] ?? '#4a5068',
      fromNoteId: de.source_id, toNoteId: de.target_id,
      edgeType: de.edge_type,
      description: de.description,
      edgeId: de.id,
    });
  }

  // 2. Tag-inferred edges (only if not already covered by DB edge)
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
          const key = edgeKey(ni.id, nj.id);
          if (!seenPairs.has(key)) {
            seenPairs.add(key);
            edges.push({
              from: pi.pos, to: pj.pos,
              color: pi.color,
              fromNoteId: ni.id, toNoteId: nj.id,
              edgeType: 'related',
              description: `共享标签: ${shared.join(', ')}`,
              edgeId: null,
            });
          }
        }
      }
    }
  }

  return { positions, clusters, edges };
}
