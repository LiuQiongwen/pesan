import { Suspense, useMemo, useState, useCallback, useRef, useEffect, createElement } from 'react';
import { Canvas } from '@react-three/fiber';
import { CosmosScene } from './CosmosScene';
import { buildCosmosLayout, type CosmosNote } from './cosmos-layout';
import { ConnectConfirmOverlay } from './ConnectConfirmOverlay';
import { type RelationType } from './connect-types';
import { supabase } from '@/integrations/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface HoveredNodeInfo {
  noteId:  string;
  title:   string | null;
  tags:    string[];
  summary: string | null;
}

interface PendingConnection {
  sourceId:      string;
  targetId:      string;
  suggestedType: RelationType;
}

interface KnowledgeStarMapProps {
  notes:               CosmosNote[];
  loading?:            boolean;
  onNodeHover?:        (info: HoveredNodeInfo | null) => void;
  onNodeClick?:        (noteId: string) => void;
  highlightedNoteIds?: string[];
  flashNoteId?:        string | null;
  recenterTrigger?:    number;
  onFlashNote?:        (id: string) => void;
  userId?:             string;
  onEmptyStateClick?:  () => void;
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

// ── Relationship type suggestion ──────────────────────────────────────────────
function suggestRelType(a: CosmosNote, b: CosmosNote): RelationType {
  const commonTags = (a.tags ?? []).filter(t => (b.tags ?? []).includes(t));
  if (commonTags.length > 0) return 'semantic';
  if (
    (a.node_type === 'capture' && b.node_type === 'insight') ||
    (a.node_type === 'insight' && b.node_type === 'capture')
  ) return 'insight_of';
  if (a.node_type === 'action' || b.node_type === 'action') return 'drives_action';
  if (a.node_type === 'question' || b.node_type === 'question') return 'answers';
  return 'semantic';
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function KnowledgeStarMap({
  notes,
  loading = false,
  onNodeHover,
  highlightedNoteIds = [],
  flashNoteId = null,
  recenterTrigger = 0,
  onFlashNote,
  userId,
  onEmptyStateClick,
}: KnowledgeStarMapProps) {
  const layout            = useMemo(() => buildCosmosLayout(notes), [notes]);
  const [openNodes,       setOpenNodes]        = useState<Set<string>>(new Set());
  const [pendingConn,     setPendingConn]      = useState<PendingConnection | null>(null);
  const [connectStatus,   setConnectStatus]    = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const recenterActiveRef = useRef(false);

  // Quick lookup map for note objects
  const notesMap = useMemo(() => new Map(notes.map(n => [n.id, n])), [notes]);

  // Compute the most recently created note as the "entrance" node
  const entranceNoteId = useMemo(() => {
    if (!notes.length) return undefined;
    return [...notes].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0].id;
  }, [notes]);

  // ── Max 3 node windows ────────────────────────────────────────────────────
  const toggleNode = useCallback((id: string) => {
    setOpenNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (next.size >= 3) {
        const oldest = Array.from(next)[0];
        next.delete(oldest);
      }
      next.add(id);
      return next;
    });
  }, []);

  // ── Drag-to-connect: initiate ─────────────────────────────────────────────
  const handleNodeConnect = useCallback((sourceId: string, targetId: string) => {
    const src = notesMap.get(sourceId);
    const tgt = notesMap.get(targetId);
    if (!src || !tgt) return;
    const suggestedType = suggestRelType(src, tgt);
    setPendingConn({ sourceId, targetId, suggestedType });
    setConnectStatus('idle');
  }, [notesMap]);

  // ── Drag-to-connect: confirm ──────────────────────────────────────────────
  const handleConnectionConfirm = useCallback(async (relType: RelationType) => {
    if (!pendingConn) return;
    setConnectStatus('saving');
    const { sourceId, targetId } = pendingConn;
    setPendingConn(null);

    const { error } = await supabase
      .from('thought_relationships')
      .insert({
        source_note_id:    sourceId,
        target_note_id:    targetId,
        relationship_type: relType,
        strength:          0.8,
        rationale:         `手动连接 via drag · ${new Date().toISOString()}`,
        ...(userId ? { user_id: userId } : {}),
      });

    if (error) {
      console.error('[KnowledgeStarMap] connect insert error:', error);
      setConnectStatus('error');
    } else {
      setConnectStatus('saved');
    }

    // Clear status badge after 2s
    setTimeout(() => setConnectStatus('idle'), 2000);
  }, [pendingConn, userId]);

  // ── Drag-to-connect: cancel ───────────────────────────────────────────────
  const handleConnectionCancel = useCallback(() => {
    setPendingConn(null);
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
        setPendingConn(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Double-click on canvas area to recenter ───────────────────────────────
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node-window]')) return;
    recenterActiveRef.current = true;
  }, []);

  const srcNote = pendingConn ? notesMap.get(pendingConn.sourceId) : null;
  const tgtNote = pendingConn ? notesMap.get(pendingConn.targetId) : null;

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
        @keyframes cosmos-window-in {
          from { opacity:0; transform: scale(0.94) translateY(-6px); }
          to   { opacity:1; transform: scale(1)    translateY(0);    }
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
              onFlashNote={onFlashNote}
              userId={userId}
              entranceNoteId={entranceNoteId}
              onEmptyStateClick={onEmptyStateClick}
              onNodeConnect={handleNodeConnect}
            />
          )}
        </Suspense>
      )}

      {/* Connection confirm overlay */}
      {pendingConn && srcNote && tgtNote && (
        <ConnectConfirmOverlay
          sourceTitle={srcNote.title ?? ''}
          targetTitle={tgtNote.title ?? ''}
          suggestedType={pendingConn.suggestedType}
          onConfirm={handleConnectionConfirm}
          onCancel={handleConnectionCancel}
        />
      )}

      {/* Connection status toast */}
      {connectStatus === 'saved' && (
        <ConnectToast label="✓ 连接已建立" color="#00ff66" />
      )}
      {connectStatus === 'error' && (
        <ConnectToast label="✕ 连接失败，请重试" color="#ff4466" />
      )}
    </div>
  );
}

// ── Tiny status toast ─────────────────────────────────────────────────────────
function ConnectToast({ label, color }: { label: string; color: string }) {
  return (
    <div style={{
      position:      'fixed',
      bottom:        'clamp(130px, 12.5vh, 170px)',
      left:          '50%',
      transform:     'translateX(-50%)',
      zIndex:        1300,
      fontFamily:    "'IBM Plex Mono','Roboto Mono',monospace",
      fontSize:      'clamp(10px, 0.95vw, 12px)',
      letterSpacing: '0.08em',
      color,
      background:    'rgba(2,5,16,0.95)',
      border:        `1px solid ${color}30`,
      borderRadius:  6,
      padding:       '7px 16px',
      boxShadow:     `0 0 16px ${color}18`,
      animation:     'cco-in 0.2s ease',
      pointerEvents: 'none',
    }}>
      {label}
    </div>
  );
}
