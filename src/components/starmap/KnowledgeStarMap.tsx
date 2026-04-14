import { Suspense, useMemo, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { CosmosScene } from './CosmosScene';
import { buildCosmosLayout, type CosmosNote } from './cosmos-layout';

// ── Types (kept for backward compat) ─────────────────────────────────────────
export interface HoveredNodeInfo {
  noteId:  string;
  title:   string | null;
  tags:    string[];
  summary: string | null;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface KnowledgeStarMapProps {
  notes: CosmosNote[];
  loading?: boolean;
  onNodeHover?: (info: HoveredNodeInfo | null) => void;
  onNodeClick?: (noteId: string) => void;   // kept for compat (unused; click opens inline window)
  highlightedNoteIds?: string[];
  flashNoteId?: string | null;
}

// ── Loading fallback ──────────────────────────────────────────────────────────
function CanvasLoader() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#040508',
    }}>
      <div style={{
        fontFamily: "'IBM Plex Mono',monospace",
        fontSize: 10, letterSpacing: '0.10em',
        color: 'rgba(60,70,90,0.60)',
        animation: 'cosmos-pulse 2s ease-in-out infinite',
      }}>
        INITIALIZING COSMOS…
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function KnowledgeStarMap({
  notes,
  loading = false,
  onNodeHover,
  highlightedNoteIds = [],
  flashNoteId = null,
}: KnowledgeStarMapProps) {
  const layout = useMemo(() => buildCosmosLayout(notes), [notes]);
  const [openNodes, setOpenNodes] = useState<Set<string>>(new Set());

  const toggleNode = useCallback((id: string) => {
    setOpenNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      width: '100vw',
      height: '100vh',
      background: '#040508',
      zIndex: 0,
    }}>
      <style>{`
        @keyframes cosmos-pulse {
          0%,100% { opacity: 0.4; }
          50%      { opacity: 0.9; }
        }
      `}</style>

      {loading ? (
        <CanvasLoader />
      ) : (
        <Suspense fallback={<CanvasLoader />}>
          <Canvas
            camera={{ position: [0, 0, 90], fov: 55, near: 0.1, far: 1200 }}
            gl={{
              antialias: true,
              powerPreference: 'high-performance',
              alpha: false,
            }}
            style={{ background: '#040508' }}
            dpr={[1, 2]}
          >
            <CosmosScene
              layout={layout}
              notes={notes}
              highlightedNoteIds={highlightedNoteIds}
              flashNoteId={flashNoteId}
              openNodes={openNodes}
              onNodeToggle={toggleNode}
              onNodeHover={onNodeHover}
            />
          </Canvas>
        </Suspense>
      )}
    </div>
  );
}
