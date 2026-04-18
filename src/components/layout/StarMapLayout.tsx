/**
 * StarMapLayout — root layout for the knowledge star map view.
 * Architecture:
 *   StarMapLayout
 *    └── StarMapOuter  (has ToolboxContext, provides AgentWorkflowProvider)
 *          └── StarMapContents  (uses AgentWorkflow + all child components)
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth }  from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import { useToolbox, type PodId } from '@/contexts/ToolboxContext';
import { useDevice } from '@/hooks/useDevice';
import { AgentWorkflowProvider, useAgentWorkflow } from '@/contexts/AgentWorkflowContext';
import { UniverseProvider, useActiveUniverse } from '@/contexts/UniverseContext';
import { PestaLogo } from '@/components/brand/PestaLogo';

import KnowledgeStarMap, { type HoveredNodeInfo } from '@/components/starmap/KnowledgeStarMap';
import { NodeLightBand }   from '@/components/layout/NodeLightBand';
import { AgentTrail }      from '@/components/layout/AgentTrail';
import { CommandDock }     from '@/components/floating/CommandDock';
import { FloatingPod }     from '@/components/floating/FloatingPod';
import { SettingsCapsule } from '@/components/floating/SettingsCapsule';
import { QuickCaptureBar } from '@/components/starmap/QuickCaptureBar';
import { LayoutEditBar }   from '@/components/window-manager/LayoutEditBar';
import { AlignmentGuides } from '@/components/window-manager/AlignmentGuides';
import { UniverseSwitcher } from '@/components/universe/UniverseSwitcher';
import { InteractionHints } from '@/components/starmap/InteractionHints';
import { ContextToast, type ToastItem } from '@/components/hints/ContextToast';
import { useHintState } from '@/hooks/useHintState';
import { TourProvider, useTour } from '@/components/tour/TourProvider';
import { TourOverlay } from '@/components/tour/TourOverlay';
import { useTourTrigger } from '@/hooks/useTourTrigger';

import { Feather, Radar, FlaskConical, Layers, Zap, Sparkles, Link2, Send, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import CaptureBox   from '@/components/pods/CaptureBox';
import RetrievalBox from '@/components/pods/RetrievalBox';
import { OcrCaptureModal } from '@/components/ocr/OcrCaptureModal';
import InsightBox   from '@/components/pods/InsightBox';
import MemoryBox    from '@/components/pods/MemoryBox';
import ActionBox    from '@/components/pods/ActionBox';
import { StagingWorkbench } from '@/components/staging/StagingWorkbench';
import { RenderTracerOverlay } from '@/components/starmap/RenderTracerOverlay';
import type { CosmosNote } from '@/components/starmap/cosmos-layout';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

interface PodDef {
  id:       PodId;
  title:    string;
  subtitle: string;
  icon:     LucideIcon;
  accent:   string;
  width:    number;
}

const POD_DEFS: PodDef[] = [
  { id: 'capture',   title: 'Capture Pod',   subtitle: '捕捉舱 · 知识入口',   icon: Feather,      accent: '#00ff66', width: 460 },
  { id: 'retrieval', title: 'Retrieval Pod', subtitle: '检索舱 · 语义召回',   icon: Radar,        accent: '#66f0ff', width: 500 },
  { id: 'insight',   title: 'Insight Pod',   subtitle: '洞察舱 · 知识精炼',   icon: FlaskConical, accent: '#b496ff', width: 480 },
  { id: 'memory',    title: 'Memory Pod',    subtitle: '记忆舱 · 上下文唤醒', icon: Layers,       accent: '#ffa040', width: 460 },
  { id: 'action',    title: 'Action Pod',    subtitle: '行动舱 · 知识转执行', icon: Zap,          accent: '#ff4466', width: 460 },
];

// ── StarMapContents — rendered INSIDE AgentWorkflowProvider ─────────────────
interface ContentsProps {
  user:    { id: string; email?: string };
  notes:   CosmosNote[];
  loading: boolean;
  openPod: (id: PodId) => void;
  pods:    Record<PodId, { open: boolean }>;
  deleteNote:     (id: string) => Promise<{ error: unknown }>;
  undoDeleteNote: (id: string) => Promise<{ error: unknown }>;
  fetchNotes:     () => Promise<void>;
}

function StarMapContents({ user, notes, loading, openPod, pods, deleteNote, undoDeleteNote, fetchNotes }: ContentsProps) {
  const navigate = useNavigate();
  const workflow = useAgentWorkflow();
  const device = useDevice();
  const { activeUniverseId } = useActiveUniverse();

  const [hoveredNode,     setHoveredNode]     = useState<HoveredNodeInfo | null>(null);
  const [highlightedIds,  setHighlightedIds]  = useState<string[]>([]);
  const [flashNoteId,     setFlashNoteId]     = useState<string | null>(null);
  const [tagFilter,       setTagFilter]       = useState<string | null>(null);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [agentActive,     setAgentActive]     = useState(false);
  const [pinnedMemoryId,  setPinnedMemoryId]  = useState<string | null>(null);
  const [stagingOpen,     setStagingOpen]     = useState(false);
  const [ocrOpen,         setOcrOpen]         = useState(false);
  const [ocrPasteImage,   setOcrPasteImage]   = useState<File | null>(null);
  const [ocrAutoCamera,   setOcrAutoCamera]   = useState(false);

  // ── Toast queue for contextual feedback ────────────────────────────────────
  const [toastQueue, setToastQueue] = useState<ToastItem[]>([]);
  const currentToast = toastQueue[0] ?? null;
  const pushToast = useCallback((t: Omit<ToastItem, 'id'>) => {
    setToastQueue(q => [...q, { ...t, id: `${Date.now()}-${Math.random()}` }]);
  }, []);
  const popToast = useCallback(() => {
    setToastQueue(q => q.slice(1));
  }, []);
  const hints = useHintState();

  // ── Track open NodeWindow count for InteractionHints ───────────────────────
  const [nodeWindowOpen, setNodeWindowOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => {
      setNodeWindowOpen(true);
      // First-time NodeWindow hint
      if (hints.shouldShowHint('first_click_node')) {
        pushToast({ message: '点击「委托」将知识发送到各功能舱', icon: Sparkles, duration: 3500 });
        hints.markCompleted('first_click_node');
      }
    };
    const onClose = () => setNodeWindowOpen(false);

    // First-time camera move hint
    const onCameraMove = () => {
      if (hints.shouldShowHint('first_move_universe')) {
        pushToast({ message: '视角已旋转 — 滚轮缩放，双指平移', icon: Sparkles, duration: 3000 });
        hints.markCompleted('first_move_universe');
      }
    };

    // Trace source: fly to star from Retrieval Pod
    const onTraceSource = (e: Event) => {
      const title = (e as CustomEvent).detail?.noteTitle ?? '';
      pushToast({ message: `已在星图中高亮「${title}」`, icon: Star, duration: 2500 });
      hints.markCompleted('trace_source');
    };

    window.addEventListener('tour-node-opened', onOpen);
    window.addEventListener('node-window-closed', onClose);
    window.addEventListener('tour-camera-moved', onCameraMove);
    window.addEventListener('hint-trace-source', onTraceSource);
    return () => {
      window.removeEventListener('tour-node-opened', onOpen);
      window.removeEventListener('node-window-closed', onClose);
      window.removeEventListener('tour-camera-moved', onCameraMove);
      window.removeEventListener('hint-trace-source', onTraceSource);
    };
  }, [hints, pushToast]);

  // Tour trigger hook — watches actions to auto-advance tour
  useTourTrigger({ noteCount: notes.length });
  const tour = useTour();

  // ── First note created feedback ────────────────────────────────────────────
  const prevNoteCountRef = useRef(notes.length);
  useEffect(() => {
    if (prevNoteCountRef.current === 0 && notes.length > 0 && hints.shouldShowHint('first_create_star')) {
      pushToast({ message: '知识星已生成 — 点击星球查看详情', icon: Sparkles, duration: 3500 });
      hints.markCompleted('first_create_star');
    }
    prevNoteCountRef.current = notes.length;
  }, [notes.length, hints, pushToast]);

  // Auto-open capture pod ONCE when tour starts on 'create' step
  const captureAutoOpened = useRef(false);
  useEffect(() => {
    if (tour.active && tour.step?.id === 'create' && !captureAutoOpened.current) {
      captureAutoOpened.current = true;
      openPod('capture');
    }
  }, [tour.active, tour.step, openPod]);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  const handleNodeHover = useCallback((info: HoveredNodeInfo | null) => setHoveredNode(info), []);
  const highlightNotes  = useCallback((ids: string[]) => setHighlightedIds(ids), []);
  const flashNote       = useCallback((noteId: string) => {
    setFlashNoteId(noteId);
    setTimeout(() => setFlashNoteId(null), 1200);
  }, []);

  // ── Tag filter — click tag in NodeLightBand to highlight all nodes with that tag ─
  const handleTagClick = useCallback((tag: string) => {
    if (tagFilter === tag) {
      setTagFilter(null);
      setHighlightedIds([]);
    } else {
      setTagFilter(tag);
      setHighlightedIds(notes.filter(n => (n.tags ?? []).includes(tag)).map(n => n.id));
      // Fly camera to the galaxy cluster for this tag
      window.dispatchEvent(new CustomEvent('cosmos-focus-galaxy', { detail: { tag } }));
    }
  }, [tagFilter, notes]);

  // ── Global keyboard shortcuts (desktop/tablet only) ────────────────────────
  useEffect(() => {
    if (device === 'phone') return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      switch (e.key.toUpperCase()) {
        case 'N': e.preventDefault(); openPod('capture');   break;
        case 'G': e.preventDefault(); setRecenterTrigger(t => t + 1); break;
        case 'F': e.preventDefault(); if (hoveredNode?.noteId) flashNote(hoveredNode.noteId); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [device, openPod, hoveredNode, flashNote]);


  // ── Connect-mode state (lifted from KnowledgeStarMap) ─────────────────────
  const [connectModeInfo, setConnectModeInfo] = useState<{ mode: 'browse' | 'connect'; fromTitle?: string }>({ mode: 'browse' });
  const handleModeChange = useCallback((mode: 'browse' | 'connect', fromTitle?: string) => {
    setConnectModeInfo({ mode, fromTitle });
    if (mode === 'connect' && hints.shouldShowHint('action_feedback')) {
      pushToast({ message: '连接模式 — 点击另一颗星建立关联', icon: Link2, duration: 3000 });
      hints.markCompleted('action_feedback');
    }
  }, [hints, pushToast]);

  // ── OCR & Staging event listeners ───────────────────────────────────────────
  useEffect(() => {
    const onOpenStaging = () => setStagingOpen(true);
    const onOpenOcr = () => {
      setOcrPasteImage(null);
      setOcrAutoCamera(false);
      setOcrOpen(true);
    };
    const onOpenOcrCamera = () => {
      setOcrPasteImage(null);
      setOcrAutoCamera(true);
      setOcrOpen(true);
    };
    // Global clipboard paste → OCR
    const onPaste = (e: ClipboardEvent) => {
      // Skip if user is typing in an input/textarea
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            setOcrPasteImage(blob);
            setOcrAutoCamera(false);
            setOcrOpen(true);
          }
          return;
        }
      }
    };

    window.addEventListener('open-staging', onOpenStaging);
    window.addEventListener('open-ocr', onOpenOcr);
    window.addEventListener('open-ocr-camera', onOpenOcrCamera);
    window.addEventListener('paste', onPaste as EventListener);
    return () => {
      window.removeEventListener('open-staging', onOpenStaging);
      window.removeEventListener('open-ocr', onOpenOcr);
      window.removeEventListener('open-ocr-camera', onOpenOcrCamera);
      window.removeEventListener('paste', onPaste as EventListener);
    };
  }, []);

  useEffect(() => {
    const onImportDone = () => {
      fetchNotes();
      // Highlight obsidian nodes for 6 seconds after import
      setTimeout(() => {
        const obsNotes = notes.filter(n => n.node_type === 'obsidian');
        if (obsNotes.length > 0) {
          setTagFilter('node:obsidian');
          setHighlightedIds(obsNotes.map(n => n.id));
          setTimeout(() => { setTagFilter(null); setHighlightedIds([]); }, 6000);
        }
      }, 500);
    };
    window.addEventListener('obsidian-import-done', onImportDone);
    return () => window.removeEventListener('obsidian-import-done', onImportDone);
  }, [notes, fetchNotes]);

  // ── Drag-to-pod handler ───────────────────────────────────────────────────
  const handleNodeDropToPod = useCallback((noteId: string, podId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    const title   = note.title   ?? '(未命名)';
    const summary = note.summary ?? '';
    const tags    = (note.tags   ?? []).join(', ');

    switch (podId as PodId) {
      case 'retrieval': {
        // Pre-fill search query with note title and auto-search
        workflow.sendRelay(title, 'capture', 'retrieval');
        openPod('retrieval');
        break;
      }
      case 'insight': {
        // Use __noteId__ prefix so InsightBox auto-selects the note in dropdown
        workflow.sendRelay(`__noteId__:${noteId}\n${title}\n${summary}`, 'capture', 'insight');
        openPod('insight');
        break;
      }
      case 'action': {
        // Format note content for ActionBox input
        const content = [title, summary, tags ? `标签: ${tags}` : ''].filter(Boolean).join('\n');
        workflow.sendRelay(content.slice(0, 2000), 'capture', 'action');
        openPod('action');
        break;
      }
      case 'memory': {
        // Set pinned note ID — MemoryBox shows related memories for this note
        setPinnedMemoryId(noteId);
        openPod('memory');
        break;
      }
      case 'capture': {
        // Re-open capture pod with note title pre-filled (edge case)
        openPod('capture');
        break;
      }
    }

    // Feedback toast
    const podNames: Record<string, string> = {
      retrieval: 'Retrieval Pod', insight: 'Insight Pod',
      action: 'Action Pod', memory: 'Memory Pod', capture: 'Capture Pod',
    };
    pushToast({ message: `已发送到 ${podNames[podId] ?? podId}`, icon: Send, duration: 2000 });
    hints.markCompleted('drag_to_pod');
  }, [notes, workflow, openPod, pushToast, hints]);

  if (loading) return (
    <div style={{
      width: '100vw', height: '100vh', background: '#040508',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14,
    }}>
        <PestaLogo size={44} iconOnly style={{ animation: 'pulse-glow 2s ease-in-out infinite' }} />
      <p style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(80,90,110,0.60)', letterSpacing: '0.08em' }}>LOADING…</p>
    </div>
  );

  if (!user) return null;

  const totalTags = Array.from(new Set(notes.flatMap(n => n.tags ?? []))).length;
  const thisWeek  = notes.filter(n =>
    n.created_at && Date.now() - new Date(n.created_at).getTime() < 7 * 86400000
  ).length;
  const obsidianCount = notes.filter(n => n.node_type === 'obsidian').length;
  const wikiCount = notes.filter(n => (n.node_type ?? '').startsWith('wiki_')).length;

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#040508' }}>

      {/* Layer 0 — Star Map */}
      <KnowledgeStarMap
        notes={notes}
        loading={loading}
        onNodeHover={handleNodeHover}
        highlightedNoteIds={highlightedIds}
        flashNoteId={flashNoteId}
        recenterTrigger={recenterTrigger}
        onFlashNote={flashNote}
        userId={user.id}
        universeId={activeUniverseId}
        onEmptyStateClick={() => openPod('capture')}
        onNodeDropToPod={handleNodeDropToPod}
        onModeChange={handleModeChange}
        onDeleteNote={deleteNote}
        onUndoDeleteNote={undoDeleteNote}
      />

      {/* Layer 1 — Agent Trail */}
      <AgentTrail />

      {/* Layer 2 — Top-left HUD */}
      <div style={{
        position: 'fixed', top: 0, left: 0, zIndex: 10,
        padding: 'clamp(14px,1.5vh,22px) clamp(16px,1.5vw,22px)',
        pointerEvents: 'none',
        background: 'linear-gradient(135deg, rgba(1,4,13,0.65) 0%, transparent 70%)',
      }}>
        <div style={{ fontFamily: INTER, fontWeight: 700, fontSize: 'clamp(11px,1.0vw,14px)', color: 'rgba(230,238,255,0.75)', marginBottom: 'clamp(1px,0.2vh,3px)' }}>
          {user.email?.split('@')[0]}
        </div>
        <div style={{ marginBottom: 'clamp(4px,0.5vh,7px)' }}>
          <UniverseSwitcher userId={user.id} />
        </div>
        <div style={{ fontFamily: MONO, fontSize: 'clamp(7px,0.7vw,9px)', color: 'rgba(60,72,95,0.60)', letterSpacing: '0.08em', marginBottom: 'clamp(7px,0.8vh,12px)' }}>
          {notes.length} nodes · {totalTags} clusters · +{thisWeek} this week{obsidianCount > 0 ? ` · ${obsidianCount} obsidian` : ''}{wikiCount > 0 ? ` · ${wikiCount} wiki` : ''}
        </div>
        <button
          onClick={() => setRecenterTrigger(t => t + 1)}
          title="回到中心"
          style={{
            pointerEvents: 'auto',
            display: 'flex', alignItems: 'center', gap: 5,
            fontFamily: MONO, fontSize: 'clamp(7.5px,0.7vw,9px)', letterSpacing: '0.08em',
            color: 'rgba(102,240,255,0.55)', background: 'rgba(102,240,255,0.06)',
            border: '1px solid rgba(102,240,255,0.14)',
            borderRadius: 5, padding: 'clamp(3px,0.4vh,5px) clamp(7px,0.7vw,11px)',
            cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget).style.color = 'rgba(102,240,255,0.90)'; (e.currentTarget).style.background = 'rgba(102,240,255,0.12)'; }}
          onMouseLeave={e => { (e.currentTarget).style.color = 'rgba(102,240,255,0.55)'; (e.currentTarget).style.background = 'rgba(102,240,255,0.06)'; }}
        >
          ↺ 回到中心
        </button>
        {agentActive && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 7, fontFamily: MONO, fontSize: 8, letterSpacing: '0.10em', color: '#00ff66', pointerEvents: 'none' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff66', animation: 'cosmos-pulse 0.8s ease-in-out infinite', boxShadow: '0 0 8px #00ff66' }} />
            AGENT WORKING…
          </div>
        )}
      </div>

      {/* Layer 3 — All Floating Pods (free, independent) */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 20, pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto' }}>
          {POD_DEFS.map(pod => {
            if (!pods[pod.id]?.open) return null;
            return (
              <FloatingPod
                key={pod.id}
                id={pod.id}
                title={pod.title}
                subtitle={pod.subtitle}
                icon={pod.icon}
                accentColor={pod.accent}
                width={pod.width}
              >
                {pod.id === 'capture'   && <CaptureBox onFlashNote={flashNote} onAgentStart={() => setAgentActive(true)} onAgentEnd={() => setAgentActive(false)} />}
                {pod.id === 'retrieval' && <RetrievalBox onHighlight={highlightNotes} />}
                {pod.id === 'insight'   && <InsightBox />}
                {pod.id === 'memory'    && <MemoryBox hoveredNoteId={hoveredNode?.noteId} pinnedNoteId={pinnedMemoryId} />}
                {pod.id === 'action'    && <ActionBox />}
              </FloatingPod>
            );
          })}
        </div>
      </div>

      {/* Layer 4 — Route overlay */}
      <Outlet />

      {/* Layer 5 — Node hover light band */}
      <NodeLightBand
        node={hoveredNode}
        onTagClick={handleTagClick}
        tagFilter={tagFilter}
        connectMode={connectModeInfo.mode === 'connect'}
        connectFromTitle={connectModeInfo.fromTitle}
      />

      {/* Layer 6 — Quick Capture Bar (desktop/tablet only) */}
      {device !== 'phone' && <QuickCaptureBar userId={user.id} onFlashNote={flashNote} hasNotes={notes.length > 0} />}

      {/* Layer 7 — Command Dock */}
      <CommandDock />

      {/* Layer 7 — Settings Capsule */}
      <SettingsCapsule />

      {/* Layer 8 — Window Manager Controls (desktop/tablet only) */}
      {device !== 'phone' && <AlignmentGuides />}
      {device !== 'phone' && <LayoutEditBar />}

      {/* Layer 9 — Interaction Hints */}
      <InteractionHints
        noteCount={notes.length}
        hoveredNode={!!hoveredNode}
        connectMode={connectModeInfo.mode === 'connect'}
        nodeWindowOpen={nodeWindowOpen}
      />

      {/* Layer 10 — Context Toast */}
      <ContextToast toast={currentToast} onDone={popToast} />

      {/* Layer 11 — Tour Overlay */}
      <TourOverlay />

      {/* Layer 12 — Staging Workbench */}
      {stagingOpen && (
        <StagingWorkbench
          onClose={() => setStagingOpen(false)}
          onFlashNote={flashNote}
        />
      )}

      {ocrOpen && (
        <OcrCaptureModal
          onClose={() => { setOcrOpen(false); setOcrPasteImage(null); setOcrAutoCamera(false); }}
          onFlashNote={flashNote}
          onOpenStaging={() => { setOcrOpen(false); setStagingOpen(true); }}
          initialImage={ocrPasteImage}
          autoCamera={ocrAutoCamera}
        />
      )}

      {/* DEV: Render Tracer — Shift+R */}
      {import.meta.env.DEV && <RenderTracerOverlay />}

    </div>
  );
}

// ── StarMapOuter — provides UniverseProvider, then AgentWorkflowProvider ─────
function StarMapOuter() {
  const { user, loading } = useAuth();

  return (
    <UniverseProvider userId={user?.id}>
      {user ? <StarMapWithUniverse user={user} loading={loading} /> : (
        loading ? (
          <div style={{
            width: '100vw', height: '100vh', background: '#040508',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14,
          }}>
            <PestaLogo size={44} iconOnly style={{ animation: 'pulse-glow 2s ease-in-out infinite' }} />
            <p style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(80,90,110,0.60)', letterSpacing: '0.08em' }}>LOADING…</p>
          </div>
        ) : <div style={{ width: '100vw', height: '100vh', background: '#040508' }} />
      )}
    </UniverseProvider>
  );
}

function StarMapWithUniverse({ user, loading }: { user: { id: string; email?: string }; loading: boolean }) {
  const { activeUniverseId } = useActiveUniverse();
  const { notes, fetchNotes, deleteNote, undoDeleteNote } = useNotes(user.id, activeUniverseId);
  const { pods, openPod } = useToolbox();

  return (
    <AgentWorkflowProvider onOpenPod={openPod}>
      <TourProvider userId={user.id} noteCount={(notes as CosmosNote[]).length}>
        <StarMapContents
          user={user}
          notes={notes as CosmosNote[]}
          loading={loading || !activeUniverseId}
          openPod={openPod}
          pods={pods as Record<PodId, { open: boolean }>}
          deleteNote={deleteNote}
          undoDeleteNote={undoDeleteNote}
          fetchNotes={fetchNotes}
        />
      </TourProvider>
    </AgentWorkflowProvider>
  );
}

// ── Exported component (ToolboxContext is provided by App) ───────────────────
export function StarMapLayout() {
  return <StarMapOuter />;
}
