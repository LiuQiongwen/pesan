import { Suspense, useMemo, useState, useCallback, useRef, useEffect, createElement } from 'react';
import { createPortal } from 'react-dom';
import { Canvas } from '@react-three/fiber';
import { CosmosScene } from './CosmosScene';
import { buildCosmosLayout, type CosmosNote } from './cosmos-layout';
import { NodeContextMenu } from './NodeContextMenu';
import { GalaxyJoinOverlay, type GalaxyOption } from './GalaxyJoinOverlay';
import { WorkbenchSummonBar } from './WorkbenchSummonBar';
import { WorkbenchPanel } from './WorkbenchPanel';
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

interface PendingGalaxy {
  noteId:    string;
  targetTag: string | null; // null → user must choose
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
  onNodeDropToPod?:    (noteId: string, podId: string) => void;
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
  onNodeDropToPod,
}: KnowledgeStarMapProps) {
  const layout            = useMemo(() => buildCosmosLayout(notes), [notes]);
  const [openNodes,       setOpenNodes]        = useState<Set<string>>(new Set());
  const [pendingConn,     setPendingConn]      = useState<PendingConnection | null>(null);
  const [connectStatus,   setConnectStatus]    = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [pendingGalaxy,   setPendingGalaxy]    = useState<PendingGalaxy | null>(null);
  const [galaxyStatus,    setGalaxyStatus]     = useState<'idle' | 'saved' | 'error'>('idle');
  const recenterActiveRef = useRef(false);

  // ── Workbench multi-select state ─────────────────────────────────────────
  const [workbenchSelectedIds, setWorkbenchSelectedIds] = useState<string[]>([]);
  const [workbenchActive,      setWorkbenchActive]      = useState(false);

  // ── Right-click context menu ─────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<{ noteId: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const onCtx = (e: Event) => {
      const { noteId, x, y } = (e as CustomEvent).detail;
      setCtxMenu({ noteId, x, y });
    };
    window.addEventListener('cosmos-context-menu', onCtx);
    return () => window.removeEventListener('cosmos-context-menu', onCtx);
  }, []);


  // Quick lookup map for note objects
  const notesMap = useMemo(() => new Map(notes.map(n => [n.id, n])), [notes]);

  // Galaxy options for the overlay (excluding __untagged__)
  const availableGalaxies = useMemo<GalaxyOption[]>(() =>
    layout.clusters
      .filter(c => c.tag !== '__untagged__')
      .map(c => ({ tag: c.tag, color: c.color })),
    [layout]);

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
    setTimeout(() => setConnectStatus('idle'), 2000);
  }, [pendingConn, userId]);

  const handleConnectionCancel = useCallback(() => setPendingConn(null), []);

  // ── Drag-to-galaxy: initiate ──────────────────────────────────────────────
  const handleNodeDropToGalaxy = useCallback((noteId: string, galaxyTag: string | null) => {
    // If no galaxies exist and user drops on empty space — nothing to join
    if (!galaxyTag && availableGalaxies.length === 0) return;
    setPendingGalaxy({ noteId, targetTag: galaxyTag });
    setGalaxyStatus('idle');
  }, [availableGalaxies]);

  // ── Drag-to-galaxy: confirm ───────────────────────────────────────────────
  const handleGalaxyJoinConfirm = useCallback(async (galaxyTag: string) => {
    if (!pendingGalaxy) return;
    const { noteId } = pendingGalaxy;
    setPendingGalaxy(null);

    const note = notesMap.get(noteId);
    if (!note) return;

    // Prepend galaxy tag as new primary tag, deduplicating
    const newTags = [galaxyTag, ...(note.tags ?? []).filter(t => t !== galaxyTag)];

    const { error } = await supabase
      .from('notes')
      .update({ tags: newTags, updated_at: new Date().toISOString() })
      .eq('id', noteId);

    if (error) {
      console.error('[KnowledgeStarMap] galaxy assign error:', error);
      setGalaxyStatus('error');
    } else {
      setGalaxyStatus('saved');
    }
    // Layout recomputes automatically when notes array updates via realtime
    setTimeout(() => setGalaxyStatus('idle'), 2000);
  }, [pendingGalaxy, notesMap]);

  const handleGalaxyJoinCancel = useCallback(() => setPendingGalaxy(null), []);

  // ── Workbench: multi-select via Shift+click ───────────────────────────────
  const handleWorkbenchSelect = useCallback((noteId: string) => {
    setWorkbenchSelectedIds(prev => {
      if (prev.includes(noteId)) return prev.filter(id => id !== noteId);
      if (prev.length >= 5) return prev; // max 5
      return [...prev, noteId];
    });
  }, []);

  const handleWorkbenchSummon = useCallback(() => setWorkbenchActive(true), []);

  const handleWorkbenchClose = useCallback(() => {
    setWorkbenchActive(false);
    setWorkbenchSelectedIds([]);
  }, []);

  const handleWorkbenchRemove = useCallback((noteId: string) => {
    setWorkbenchSelectedIds(prev => {
      const next = prev.filter(id => id !== noteId);
      if (next.length === 0) setWorkbenchActive(false);
      return next;
    });
  }, []);

  const handleWorkbenchCombine = useCallback(async (noteIds: string[]) => {
    const combinedNotes = noteIds.map(id => notesMap.get(id)).filter(Boolean) as typeof notes;
    if (combinedNotes.length < 2) return;

    const title    = `工作台合并 · ${new Date().toLocaleDateString('zh-CN')}`;
    const content  = combinedNotes.map(n =>
      `## ${n.title ?? '(未命名)'}\n\n${n.summary ?? ''}\n\n${(n.tags ?? []).join(', ')}`
    ).join('\n\n---\n\n');
    const allTags  = [...new Set(combinedNotes.flatMap(n => n.tags ?? []))];

    const { error } = await supabase.from('notes').insert({
      title, content_markdown: content, summary: `合并自：${combinedNotes.map(n => n.title).join('、')}`,
      tags: allTags, node_type: 'insight',
      ...(userId ? { user_id: userId } : {}),
    });
    if (error) console.error('[Workbench] combine error:', error);
  }, [notesMap, userId]);

  // Keyboard shortcut: Escape clears workbench selection too
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
        setPendingGalaxy(null);
        setWorkbenchActive(false);
        setWorkbenchSelectedIds([]);
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

  const pendingGalaxyNote = pendingGalaxy ? notesMap.get(pendingGalaxy.noteId) : null;
  const pendingTargetGalaxy = pendingGalaxy?.targetTag
    ? (availableGalaxies.find(g => g.tag === pendingGalaxy.targetTag) ?? null)
    : null;

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
              highlightedNoteIds={[...highlightedNoteIds, ...workbenchSelectedIds]}
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
              onNodeDropToGalaxy={handleNodeDropToGalaxy}
              onNodeDropToPod={onNodeDropToPod}
              onNodeWorkbenchSelect={handleWorkbenchSelect}
            />
          )}
        </Suspense>
      )}

      {/* Node-to-node connection confirm overlay — portal to escape stacking context */}
      {pendingConn && srcNote && tgtNote && createPortal(
        <ConnectConfirmOverlay
          sourceTitle={srcNote.title ?? ''}
          targetTitle={tgtNote.title ?? ''}
          suggestedType={pendingConn.suggestedType}
          onConfirm={handleConnectionConfirm}
          onCancel={handleConnectionCancel}
        />,
        document.body
      )}

      {/* Galaxy join overlay — portal to escape stacking context */}
      {pendingGalaxy && pendingGalaxyNote && createPortal(
        <GalaxyJoinOverlay
          noteTitle={pendingGalaxyNote.title ?? ''}
          targetGalaxy={pendingTargetGalaxy}
          availableGalaxies={availableGalaxies}
          onConfirm={handleGalaxyJoinConfirm}
          onCancel={handleGalaxyJoinCancel}
        />,
        document.body
      )}

      {/* Status toasts — also portaled for consistent z-ordering */}
      {connectStatus === 'saved' && createPortal(<ConnectToast label="连接已建立" color="#00ff66" />, document.body)}
      {connectStatus === 'error'  && createPortal(<ConnectToast label="连接失败，请重试" color="#ff4466" />, document.body)}
      {galaxyStatus  === 'saved'  && createPortal(<ConnectToast label="已归入星系" color="#b496ff" />, document.body)}
      {galaxyStatus  === 'error'  && createPortal(<ConnectToast label="归类失败，请重试" color="#ff4466" />, document.body)}

      {/* Workbench summon bar — portaled to escape stacking context */}
      {!workbenchActive && workbenchSelectedIds.length >= 2 && createPortal(
        <WorkbenchSummonBar
          selectedCount={workbenchSelectedIds.length}
          onSummon={handleWorkbenchSummon}
          onClear={handleWorkbenchClose}
        />,
        document.body
      )}

      {/* Workbench floating panel — portaled to escape stacking context */}
      {workbenchActive && workbenchSelectedIds.length > 0 && createPortal(
        <WorkbenchPanel
          notes={workbenchSelectedIds.map(id => notesMap.get(id)).filter(Boolean) as CosmosNote[]}
          onRemoveNote={handleWorkbenchRemove}
          onClose={handleWorkbenchClose}
          onFlashNote={id => { onFlashNote?.(id); }}
          onDropToPod={onNodeDropToPod ?? (() => {})}
          onCombine={handleWorkbenchCombine}
          userId={userId}
        />,
        document.body
      )}
      {/* Right-click context menu */}
      {ctxMenu && (
        <NodeContextMenu
          noteId={ctxMenu.noteId}
          x={ctxMenu.x}
          y={ctxMenu.y}
          note={notesMap.get(ctxMenu.noteId)}
          onClose={() => setCtxMenu(null)}
          onOpenNote={id => { toggleNode(id); setCtxMenu(null); }}
          onDistill={id => { onNodeDropToPod?.(id, 'insight'); setCtxMenu(null); }}
          onSendToPod={(id, podId) => { onNodeDropToPod?.(id, podId); setCtxMenu(null); }}
          onFlash={id => { onFlashNote?.(id); setCtxMenu(null); }}
        />
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
