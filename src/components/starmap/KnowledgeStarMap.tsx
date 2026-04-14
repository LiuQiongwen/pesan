import { Suspense, useMemo, useState, useCallback, useRef, useEffect, createElement } from 'react';
import { Canvas } from '@react-three/fiber';
import { CosmosScene } from './CosmosScene';
import { buildCosmosLayout, type CosmosNote } from './cosmos-layout';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface HoveredNodeInfo {
  noteId:  string;
  title:   string | null;
  tags:    string[];
  summary: string | null;
}

interface KnowledgeStarMapProps {
  notes:               CosmosNote[];
  loading?:            boolean;
  onNodeHover?:        (info: HoveredNodeInfo | null) => void;
  onNodeClick?:        (noteId: string) => void; // kept for compat (unused)
  highlightedNoteIds?: string[];
  flashNoteId?:        string | null;
  recenterTrigger?:    number; // increment to trigger smooth camera recenter
}

// ── Loading fallback ──────────────────────────────────────────────────────────
function CanvasLoader() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#01040d',
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
  recenterTrigger = 0,
}: KnowledgeStarMapProps) {
  const layout           = useMemo(() => buildCosmosLayout(notes), [notes]);
  const [openNodes,      setOpenNodes]   = useState<Set<string>>(new Set());
  const recenterActiveRef = useRef(false);

  // ── Max 3 node windows ────────────────────────────────────────────────────
  const toggleNode = useCallback((id: string) => {
    setOpenNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      // Enforce max 3: remove oldest if needed
      if (next.size >= 3) {
        const oldest = Array.from(next)[0];
        next.delete(oldest);
      }
      next.add(id);
      return next;
    });
  }, []);

  // ── Trigger recenter from parent ─────────────────────────────────────────
  useEffect(() => {
    if (recenterTrigger > 0) recenterActiveRef.current = true;
  }, [recenterTrigger]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        recenterActiveRef.current = true;
      }
      if (e.code === 'Escape') {
        setOpenNodes(new Set());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Double-click on canvas area to recenter ───────────────────────────────
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    // Ignore if clicking inside a node window
    if ((e.target as HTMLElement).closest('[data-node-window]')) return;
    recenterActiveRef.current = true;
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: '#01040d',
        zIndex: 0,
      }}
      onDoubleClick={handleDoubleClick}
    >
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
          {createElement(Canvas, {
            camera: { position: [0, 0, 90] as [number,number,number], fov: 55, near: 0.1, far: 1200 },
            gl: { antialias: true, powerPreference: 'high-performance' as const, alpha: false },
            style: { background: '#01040d' },
            dpr: [1, 1.5] as [number, number],
          },
            <CosmosScene
              layout={layout}
              notes={notes}
              highlightedNoteIds={highlightedNoteIds}
              flashNoteId={flashNoteId}
              openNodes={openNodes}
              onNodeToggle={toggleNode}
              onNodeHover={onNodeHover}
              recenterActiveRef={recenterActiveRef}
            />
          )}
        </Suspense>
      )}
    </div>
  );
}
