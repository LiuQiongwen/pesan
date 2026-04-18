import { Suspense, useMemo, useState, useCallback, useRef, useEffect, createElement } from 'react';
import { createPortal } from 'react-dom';
import { Canvas } from '@react-three/fiber';
import { CosmosScene } from './CosmosScene';
import { PerfOverlay } from './PerfOverlay';
import type { PerfMonitorAPI } from '@/hooks/usePerfMonitor';
import { buildCosmosLayout, type CosmosNote, type DbEdge, type ManualPositions } from './cosmos-layout';
import { NodeContextMenu } from './NodeContextMenu';
import { GalaxyContextMenu } from './GalaxyContextMenu';
import { GalaxyJoinOverlay, type GalaxyOption } from './GalaxyJoinOverlay';
import { ConnectConfirmOverlay } from './ConnectConfirmOverlay';
import { ConfirmDeleteOverlay } from './ConfirmDeleteOverlay';
import { UndoToast } from './UndoToast';
import { WorkbenchSummonBar } from './WorkbenchSummonBar';
import { WorkbenchPanel } from './WorkbenchPanel';
import { MobileNodeCard } from './MobileNodeCard';
import { CreateAnchorModal } from '@/components/anchors/CreateAnchorModal';
import { type RelationType } from './connect-types';
import { supabase } from '@/integrations/supabase/client';
import { useDevice } from '@/hooks/useDevice';
import { useCosmosCam, type CosmosCamAPI } from '@/hooks/useCosmosCam';

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
  universeId?:         string | null;
  onEmptyStateClick?:  () => void;
  onNodeDropToPod?:    (noteId: string, podId: string) => void;
  onModeChange?:       (mode: 'browse' | 'connect', connectFromTitle?: string) => void;
  onDeleteNote?:       (noteId: string) => Promise<{ error: unknown }>;
  onUndoDeleteNote?:   (noteId: string) => Promise<{ error: unknown }>;
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

// ── CamBridge: instantiates useCosmosCam inside Canvas and exposes API via ref ──
function CamBridge({ apiRef }: { apiRef: React.MutableRefObject<CosmosCamAPI | null> }) {
  const api = useCosmosCam();
  apiRef.current = api;
  return null;
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
  universeId,
  onEmptyStateClick,
  onNodeDropToPod,
  onModeChange,
  onDeleteNote,
  onUndoDeleteNote,
}: KnowledgeStarMapProps) {
  const [dbEdges, setDbEdges] = useState<DbEdge[]>([]);

  // ── Manual positions (fetched from DB) ──────────────────────────────────
  const [manualNodePos, setManualNodePos] = useState<Record<string, [number, number, number]>>({});
  const [manualGalaxyPos, setManualGalaxyPos] = useState<Record<string, [number, number, number]>>({});

  const manualPositions = useMemo<ManualPositions>(() => ({
    nodes: Object.keys(manualNodePos).length > 0 ? manualNodePos : undefined,
    galaxies: Object.keys(manualGalaxyPos).length > 0 ? manualGalaxyPos : undefined,
  }), [manualNodePos, manualGalaxyPos]);

  const layout = useMemo(() => buildCosmosLayout(notes, dbEdges, manualPositions), [notes, dbEdges, manualPositions]);

  // Fetch thought_edges from DB
  useEffect(() => {
    if (!userId || !universeId) return;
    supabase
      .from('thought_edges')
      .select('id, source_id, target_id, edge_type, description, confidence')
      .eq('user_id', userId)
      .eq('universe_id', universeId)
      .then(({ data }) => { if (data) setDbEdges(data as DbEdge[]); });
  }, [userId, universeId, notes]); // refetch when notes change (new connections may appear)

  // ── Fetch manual positions ───────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !universeId) return;
    supabase.from('node_positions').select('note_id, x, y, z').eq('user_id', userId).eq('universe_id', universeId)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, [number, number, number]> = {};
          for (const r of data) map[r.note_id] = [r.x, r.y, r.z];
          setManualNodePos(map);
        }
      });
    supabase.from('galaxy_positions').select('tag, cx, cy, cz').eq('user_id', userId).eq('universe_id', universeId)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, [number, number, number]> = {};
          for (const r of data) map[r.tag] = [r.cx, r.cy, r.cz];
          setManualGalaxyPos(map);
        }
      });
  }, [userId, universeId]);

  const [openNodes,       setOpenNodes]        = useState<Set<string>>(new Set());
  const [pendingConn,     setPendingConn]      = useState<PendingConnection | null>(null);
  const [connectStatus,   setConnectStatus]    = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [pendingGalaxy,   setPendingGalaxy]    = useState<PendingGalaxy | null>(null);
  const [galaxyStatus,    setGalaxyStatus]     = useState<'idle' | 'saved' | 'error'>('idle');
  const camApiRef = useRef<CosmosCamAPI | null>(null);

  // No-op fallback before CamBridge mounts
  const camApiFallback = useMemo<CosmosCamAPI>(() => ({
    focusNode: () => {},
    focusGalaxy: () => {},
    recenter: () => {},
    peek: () => {},
    isAnimating: () => false,
  }), []);

  // ── Delete / Undo state ─────────────────────────────────────────────────
  const [pendingDeleteId,  setPendingDeleteId]  = useState<string | null>(null);
  const [undoInfo, setUndoInfo] = useState<{ noteId: string; title: string } | null>(null);

  // ── Galaxy context menu state ───────────────────────────────────────────
  const [galaxyCtx, setGalaxyCtx] = useState<{ tag: string; x: number; y: number } | null>(null);
  const [pendingGalaxyDelete, setPendingGalaxyDelete] = useState<{ tag: string; mode: 'dissolve' | 'delete_all' } | null>(null);
  const [galaxyUndoInfo, setGalaxyUndoInfo] = useState<{ tag: string; noteIds: string[]; oldTags: Record<string, string[]> } | null>(null);

  // ── Node interaction mode FSM ──────────────────────────────────────────
  const [interactionMode,  setInteractionMode]  = useState<'browse' | 'connect'>('browse');
  const [selectedNodeId,   setSelectedNodeId]   = useState<string | null>(null);
  const [connectFromId,    setConnectFromId]    = useState<string | null>(null);

  // ── Mobile node card ──────────────────────────────────────────────────
  const { isPhone } = useDevice();
  const [mobileCardNoteId, setMobileCardNoteId] = useState<string | null>(null);
  const [anchorNoteId, setAnchorNoteId] = useState<string | null>(null);

  // ── Perf diagnostics state ──────────────────────────────────────────
  const [perfEnabled, setPerfEnabled] = useState(false);
  const perfApiRef = useRef<PerfMonitorAPI | null>(null);
  const [bloomEnabled, setBloomEnabled] = useState(true);
  const [starFieldEnabled, setStarFieldEnabled] = useState(true);
  const [edgesEnabled, setEdgesEnabled] = useState(true);
  const [labelsEnabled, setLabelsEnabled] = useState(true);
  const [raycastThrottle, setRaycastThrottle] = useState(3);

  const subsystems = useMemo(() => [
    { key: 'bloom',     label: 'Bloom',     enabled: bloomEnabled },
    { key: 'starfield', label: 'Star Field', enabled: starFieldEnabled },
    { key: 'edges',     label: 'Edges',     enabled: edgesEnabled },
    { key: 'labels',    label: 'Labels',    enabled: labelsEnabled },
    { key: 'raycast',   label: `Raycast (/${raycastThrottle}f)`, enabled: raycastThrottle <= 6 },
  ], [bloomEnabled, starFieldEnabled, edgesEnabled, labelsEnabled, raycastThrottle]);

  const handleToggleSubsystem = useCallback((key: string) => {
    switch (key) {
      case 'bloom':     setBloomEnabled(v => !v); break;
      case 'starfield': setStarFieldEnabled(v => !v); break;
      case 'edges':     setEdgesEnabled(v => !v); break;
      case 'labels':    setLabelsEnabled(v => !v); break;
      case 'raycast':   setRaycastThrottle(v => v === 3 ? 6 : v === 6 ? 999 : 3); break;
    }
  }, []);

  // Shift+P to toggle perf panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setPerfEnabled(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // On phone, intercept node toggle to open MobileNodeCard instead
  const toggleNode = useCallback((id: string) => {
    if (isPhone) {
      setMobileCardNoteId(prev => prev === id ? null : id);
      return;
    }
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
  }, [isPhone]);

  const handleSelectNode = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
  }, []);

  const handleSetMode = useCallback((m: 'browse' | 'connect') => {
    setInteractionMode(m);
    if (m === 'browse') {
      setConnectFromId(null);
      setSelectedNodeId(null);
    }
  }, []);

  const handleConnectPick = useCallback((nodeId: string) => {
    if (!connectFromId) {
      // First pick — set source
      setConnectFromId(nodeId);
    } else if (nodeId !== connectFromId) {
      // Second pick — trigger connection
      setPendingConn({ sourceId: connectFromId, targetId: nodeId });
      // Reset to browse after connection initiated
      setConnectFromId(null);
      setInteractionMode('browse');
      setSelectedNodeId(null);
    }
  }, [connectFromId]);

  // Esc exits connect mode (handled in CosmosScene too, but also here for safety)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && interactionMode === 'connect') {
        setInteractionMode('browse');
        setConnectFromId(null);
        setSelectedNodeId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [interactionMode]);

  // Notify parent when mode changes
  useEffect(() => {
    const title = connectFromId ? notes.find(n => n.id === connectFromId)?.title : undefined;
    onModeChange?.(interactionMode, title ?? undefined);
  }, [interactionMode, connectFromId, notes, onModeChange]);

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
  const handleConnectionConfirm = useCallback(async (relType: RelationType, description?: string) => {
    if (!pendingConn) return;
    setConnectStatus('saving');
    const { sourceId, targetId } = pendingConn;
    setPendingConn(null);

    const { data, error } = await supabase
      .from('thought_edges')
      .insert({
        source_id:   sourceId,
        target_id:   targetId,
        edge_type:   relType,
        description: description || null,
        confidence:  0.8,
        ...(userId ? { user_id: userId } : {}),
        ...(universeId ? { universe_id: universeId } : {}),
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error('[KnowledgeStarMap] connect insert error:', error);
      setConnectStatus('error');
    } else {
      setConnectStatus('saved');
      // Immediately add new edge to local state for instant feedback
      if (data) {
        setDbEdges(prev => [...prev, data as DbEdge]);
      }
    }
    setTimeout(() => setConnectStatus('idle'), 2000);
  }, [pendingConn, userId, universeId]);

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
      ...(universeId ? { universe_id: universeId } : {}),
    });
    if (error) console.error('[Workbench] combine error:', error);
  }, [notesMap, userId, universeId]);

  // ── Node delete: initiate (from context menu / NodeWindow) ─────────────
  const handleDeleteRequest = useCallback((noteId: string) => {
    setPendingDeleteId(noteId);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!pendingDeleteId || !onDeleteNote) return;
    const note = notesMap.get(pendingDeleteId);
    const title = note?.title ?? '(未命名)';
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    setOpenNodes(prev => { const n = new Set(prev); n.delete(id); return n; });

    const { error } = await onDeleteNote(id);
    if (!error) {
      setUndoInfo({ noteId: id, title });
    }
  }, [pendingDeleteId, onDeleteNote, notesMap]);

  const handleDeleteCancel = useCallback(() => setPendingDeleteId(null), []);

  const handleUndo = useCallback(async () => {
    if (!undoInfo || !onUndoDeleteNote) return;
    await onUndoDeleteNote(undoInfo.noteId);
    setUndoInfo(null);
  }, [undoInfo, onUndoDeleteNote]);

  const handleUndoDismiss = useCallback(() => setUndoInfo(null), []);

  // ── Node move: save position to DB ─────────────────────────────────────
  const handleNodeMove = useCallback(async (noteId: string, pos: [number, number, number]) => {
    setManualNodePos(prev => ({ ...prev, [noteId]: pos }));
    if (!userId || !universeId) return;
    await supabase.from('node_positions').upsert({
      user_id: userId, note_id: noteId, universe_id: universeId,
      x: pos[0], y: pos[1], z: pos[2],
      is_manual: true, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,note_id' });
  }, [userId, universeId]);

  // ── Reset manual position ──────────────────────────────────────────────
  const handleResetPosition = useCallback(async (noteId: string) => {
    setManualNodePos(prev => {
      const next = { ...prev };
      delete next[noteId];
      return next;
    });
    if (!userId) return;
    await supabase.from('node_positions').delete()
      .eq('user_id', userId).eq('note_id', noteId);
  }, [userId]);

  // ── Galaxy context menu listener ───────────────────────────────────────
  useEffect(() => {
    const onGalaxyCtx = (e: Event) => {
      const { tag, x, y } = (e as CustomEvent).detail;
      setGalaxyCtx({ tag, x, y });
    };
    window.addEventListener('cosmos-galaxy-context-menu', onGalaxyCtx);
    return () => window.removeEventListener('cosmos-galaxy-context-menu', onGalaxyCtx);
  }, []);

  // ── Galaxy dissolve ────────────────────────────────────────────────────
  const handleGalaxyDissolve = useCallback(async (tag: string) => {
    const cluster = layout.clusters.find(c => c.tag === tag);
    if (!cluster) return;
    // Save old tags for undo
    const oldTags: Record<string, string[]> = {};
    for (const nId of cluster.noteIds) {
      const n = notesMap.get(nId);
      if (n) oldTags[nId] = [...(n.tags ?? [])];
    }
    // Remove tag from all member notes
    for (const nId of cluster.noteIds) {
      const n = notesMap.get(nId);
      if (!n) continue;
      const newTags = (n.tags ?? []).filter(t => t !== tag);
      await supabase.from('notes').update({ tags: newTags, updated_at: new Date().toISOString() }).eq('id', nId);
    }
    setGalaxyUndoInfo({ tag, noteIds: cluster.noteIds, oldTags });
  }, [layout, notesMap]);

  // ── Galaxy delete all ──────────────────────────────────────────────────
  const handleGalaxyDeleteAll = useCallback((tag: string) => {
    setPendingGalaxyDelete({ tag, mode: 'delete_all' });
  }, []);

  const handleGalaxyDeleteAllConfirm = useCallback(async () => {
    if (!pendingGalaxyDelete || !onDeleteNote) return;
    const cluster = layout.clusters.find(c => c.tag === pendingGalaxyDelete.tag);
    setPendingGalaxyDelete(null);
    if (!cluster) return;
    for (const nId of cluster.noteIds) {
      await onDeleteNote(nId);
    }
    setUndoInfo(null); // Too many to undo individually; galaxy delete is final
  }, [pendingGalaxyDelete, layout, onDeleteNote]);

  const handleGalaxyDeleteAllCancel = useCallback(() => setPendingGalaxyDelete(null), []);

  // ── Galaxy undo (dissolve) ─────────────────────────────────────────────
  const handleGalaxyUndo = useCallback(async () => {
    if (!galaxyUndoInfo) return;
    for (const nId of galaxyUndoInfo.noteIds) {
      const oldT = galaxyUndoInfo.oldTags[nId];
      if (oldT) {
        await supabase.from('notes').update({ tags: oldT, updated_at: new Date().toISOString() }).eq('id', nId);
      }
    }
    setGalaxyUndoInfo(null);
  }, [galaxyUndoInfo]);

  // ── Galaxy move: save position to DB ───────────────────────────────────
  const handleGalaxyMove = useCallback(async (
    tag: string,
    center: [number, number, number],
    memberPositions: Record<string, [number, number, number]>,
  ) => {
    setManualGalaxyPos(prev => ({ ...prev, [tag]: center }));
    setManualNodePos(prev => ({ ...prev, ...memberPositions }));
    if (!userId || !universeId) return;
    await supabase.from('galaxy_positions').upsert({
      user_id: userId, tag, universe_id: universeId,
      cx: center[0], cy: center[1], cz: center[2],
      is_manual: true, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,tag' });
    for (const [nId, pos] of Object.entries(memberPositions)) {
      await supabase.from('node_positions').upsert({
        user_id: userId, note_id: nId, universe_id: universeId,
        x: pos[0], y: pos[1], z: pos[2],
        is_manual: true, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,note_id' });
    }
  }, [userId, universeId]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        camApiRef.current?.recenter();
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

  // ── Flash note → camera fly ─────────────────────────────────────────────
  useEffect(() => {
    if (flashNoteId) camApiRef.current?.focusNode(flashNoteId);
  }, [flashNoteId]);

  // ── Galaxy focus from tag click ─────────────────────────────────────────
  useEffect(() => {
    const onFocusGalaxy = (e: Event) => {
      const { tag } = (e as CustomEvent).detail;
      camApiRef.current?.focusGalaxy(tag);
    };
    window.addEventListener('cosmos-focus-galaxy', onFocusGalaxy);
    return () => window.removeEventListener('cosmos-focus-galaxy', onFocusGalaxy);
  }, []);

  // ── Recenter trigger from parent ────────────────────────────────────────
  useEffect(() => {
    if (recenterTrigger > 0) camApiRef.current?.recenter();
  }, [recenterTrigger]);

  // ── Double-click on canvas area to recenter ───────────────────────────────
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node-window]')) return;
    camApiRef.current?.recenter();
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
      {/* Keyframes moved to index.css (spring motion system) */}

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
            <CamBridge apiRef={camApiRef} />,
            <CosmosScene
              layout={layout}
              notes={notes}
              highlightedNoteIds={[...highlightedNoteIds, ...workbenchSelectedIds]}
              flashNoteId={flashNoteId}
              openNodes={openNodes}
              onNodeToggle={toggleNode}
              onNodeHover={onNodeHover}
              camApi={camApiRef.current ?? camApiFallback}
              onFlashNote={onFlashNote}
              userId={userId}
              entranceNoteId={entranceNoteId}
              onEmptyStateClick={onEmptyStateClick}
              onNodeConnect={handleNodeConnect}
              onNodeDropToGalaxy={handleNodeDropToGalaxy}
              onNodeDropToPod={onNodeDropToPod}
              onNodeWorkbenchSelect={handleWorkbenchSelect}
              interactionMode={interactionMode}
              selectedNodeId={selectedNodeId}
              connectFromId={connectFromId}
              onSetMode={handleSetMode}
              onSetSelectedNodeId={handleSelectNode}
              onSetConnectFromId={(id) => setConnectFromId(id)}
              onNodeMove={handleNodeMove}
              onGalaxyMove={handleGalaxyMove}
              perfEnabled={perfEnabled}
              perfApiRef={perfApiRef}
              bloomEnabled={bloomEnabled}
              starFieldEnabled={starFieldEnabled}
              edgesEnabled={edgesEnabled}
              labelsEnabled={labelsEnabled}
              raycastThrottle={raycastThrottle}
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
          onConnect={id => {
            setInteractionMode('connect');
            setConnectFromId(id);
            setSelectedNodeId(id);
            setCtxMenu(null);
          }}
          onDelete={onDeleteNote ? (id => { handleDeleteRequest(id); setCtxMenu(null); }) : undefined}
          onResetPosition={id => { handleResetPosition(id); setCtxMenu(null); }}
          onCreateAnchor={id => { setAnchorNoteId(id); setCtxMenu(null); }}
          hasManualPosition={!!(ctxMenu && manualNodePos[ctxMenu.noteId])}
        />
      )}

      {/* Mobile node card */}
      {isPhone && mobileCardNoteId && (() => {
        const note = notesMap.get(mobileCardNoteId);
        const np = note ? layout.positions[note.id] : undefined;
        if (!note) return null;
        return (
          <MobileNodeCard
            note={{ id: note.id, title: note.title, summary: note.summary, tags: note.tags, created_at: note.created_at, node_type: note.node_type }}
            accentColor={np?.color ?? '#66f0ff'}
            onClose={() => setMobileCardNoteId(null)}
            onNavigate={(id) => { window.location.href = `/app/note/${id}`; }}
            onSendToPod={(id, podId) => { onNodeDropToPod?.(id, podId); }}
            onConnect={(id) => {
              setInteractionMode('connect');
              setConnectFromId(id);
              setSelectedNodeId(id);
              setMobileCardNoteId(null);
            }}
            onDelete={onDeleteNote ? ((id) => { handleDeleteRequest(id); setMobileCardNoteId(null); }) : undefined}
          />
        );
      })()}

      {/* Galaxy context menu */}
      {galaxyCtx && (() => {
        const cluster = layout.clusters.find(c => c.tag === galaxyCtx.tag);
        return cluster ? (
          <GalaxyContextMenu
            tag={galaxyCtx.tag}
            nodeCount={cluster.noteIds.length}
            color={cluster.color}
            x={galaxyCtx.x}
            y={galaxyCtx.y}
            onClose={() => setGalaxyCtx(null)}
            onDissolve={handleGalaxyDissolve}
            onDeleteAll={handleGalaxyDeleteAll}
          />
        ) : null;
      })()}

      {/* Node delete confirmation */}
      {pendingDeleteId && (() => {
        const n = notesMap.get(pendingDeleteId);
        return (
          <ConfirmDeleteOverlay
            title={`删除节点 "${n?.title ?? '(未命名)'}"`}
            subtitle="节点将被软删除，可在 8 秒内撤销"
            onConfirm={handleDeleteConfirm}
            onCancel={handleDeleteCancel}
          />
        );
      })()}

      {/* Galaxy delete-all confirmation */}
      {pendingGalaxyDelete && (() => {
        const cluster = layout.clusters.find(c => c.tag === pendingGalaxyDelete.tag);
        return (
          <ConfirmDeleteOverlay
            title={`删除星系 "${pendingGalaxyDelete.tag}" 的全部节点`}
            subtitle={`将删除 ${cluster?.noteIds.length ?? 0} 个节点，此操作不可撤销`}
            confirmLabel="全部删除"
            color="#ff4466"
            onConfirm={handleGalaxyDeleteAllConfirm}
            onCancel={handleGalaxyDeleteAllCancel}
          />
        );
      })()}

      {/* Undo toast for node delete */}
      {undoInfo && (
        <UndoToast
          message={`已删除 "${undoInfo.title}"`}
          color="#ff4466"
          onUndo={handleUndo}
          onDismiss={handleUndoDismiss}
        />
      )}

      {/* Undo toast for galaxy dissolve */}
      {galaxyUndoInfo && (
        <UndoToast
          message={`已解散星系 "${galaxyUndoInfo.tag}"`}
          color="#b496ff"
          onUndo={handleGalaxyUndo}
          onDismiss={() => setGalaxyUndoInfo(null)}
        />
      )}

      {/* Perf diagnostics overlay */}
      {perfEnabled && perfApiRef.current && (
        <PerfOverlay
          snapshotRef={perfApiRef.current.snapshotRef}
          historyRef={perfApiRef.current.historyRef}
          subsystems={subsystems}
          onToggleSubsystem={handleToggleSubsystem}
        />
      )}

      {/* Create QR Anchor Modal */}
      {anchorNoteId && (
        <CreateAnchorModal
          noteId={anchorNoteId}
          noteTitle={notesMap.get(anchorNoteId)?.title ?? ''}
          onClose={() => setAnchorNoteId(null)}
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
