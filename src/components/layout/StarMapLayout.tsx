/**
 * StarMapLayout — root layout for the knowledge star map view.
 * Architecture:
 *   StarMapLayout
 *    └── StarMapOuter  (has ToolboxContext, provides AgentWorkflowProvider)
 *          └── StarMapContents  (uses AgentWorkflow + all child components)
 */
import { useEffect, useState, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth }  from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import { useToolbox, type PodId } from '@/contexts/ToolboxContext';
import { AgentWorkflowProvider, useAgentWorkflow } from '@/contexts/AgentWorkflowContext';

import KnowledgeStarMap, { type HoveredNodeInfo } from '@/components/starmap/KnowledgeStarMap';
import { NodeLightBand }   from '@/components/layout/NodeLightBand';
import { AgentTrail }      from '@/components/layout/AgentTrail';
import { CommandDock }     from '@/components/floating/CommandDock';
import { FloatingPod }     from '@/components/floating/FloatingPod';
import { SettingsCapsule } from '@/components/floating/SettingsCapsule';
import { QuickCaptureBar } from '@/components/starmap/QuickCaptureBar';
import { LayoutEditBar }   from '@/components/window-manager/LayoutEditBar';
import { AlignmentGuides } from '@/components/window-manager/AlignmentGuides';

import { Feather, Radar, FlaskConical, Layers, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import CaptureBox   from '@/components/pods/CaptureBox';
import RetrievalBox from '@/components/pods/RetrievalBox';
import InsightBox   from '@/components/pods/InsightBox';
import MemoryBox    from '@/components/pods/MemoryBox';
import ActionBox    from '@/components/pods/ActionBox';
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
}

function StarMapContents({ user, notes, loading, openPod, pods }: ContentsProps) {
  const navigate = useNavigate();
  const workflow = useAgentWorkflow();

  const [hoveredNode,     setHoveredNode]     = useState<HoveredNodeInfo | null>(null);
  const [highlightedIds,  setHighlightedIds]  = useState<string[]>([]);
  const [flashNoteId,     setFlashNoteId]     = useState<string | null>(null);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [agentActive,     setAgentActive]     = useState(false);
  const [pinnedMemoryId,  setPinnedMemoryId]  = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  const handleNodeHover = useCallback((info: HoveredNodeInfo | null) => setHoveredNode(info), []);
  const highlightNotes  = useCallback((ids: string[]) => setHighlightedIds(ids), []);
  const flashNote       = useCallback((noteId: string) => {
    setFlashNoteId(noteId);
    setTimeout(() => setFlashNoteId(null), 1200);
  }, []);

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
  }, [notes, workflow, openPod]);

  if (loading) return (
    <div style={{
      width: '100vw', height: '100vh', background: '#040508',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        border: '1px solid rgba(0,255,102,0.25)', background: 'rgba(0,255,102,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'pulse-glow 2s ease-in-out infinite',
      }}>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 14, color: '#00ff66' }}>pesan</span>
      </div>
      <p style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(80,90,110,0.60)', letterSpacing: '0.08em' }}>LOADING…</p>
    </div>
  );

  if (!user) return null;

  const totalTags = Array.from(new Set(notes.flatMap(n => n.tags ?? []))).length;
  const thisWeek  = notes.filter(n =>
    n.created_at && Date.now() - new Date(n.created_at).getTime() < 7 * 86400000
  ).length;

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
        onEmptyStateClick={() => openPod('capture')}
        onNodeDropToPod={handleNodeDropToPod}
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
        <div style={{ fontFamily: MONO, fontSize: 'clamp(7px,0.7vw,9px)', color: 'rgba(60,72,95,0.60)', letterSpacing: '0.08em', marginBottom: 'clamp(7px,0.8vh,12px)' }}>
          {notes.length} nodes · {totalTags} clusters · +{thisWeek} this week
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
      <NodeLightBand node={hoveredNode} />

      {/* Layer 6 — Quick Capture Bar */}
      <QuickCaptureBar userId={user.id} onFlashNote={flashNote} hasNotes={notes.length > 0} />

      {/* Layer 7 — Command Dock */}
      <CommandDock />

      {/* Layer 7 — Settings Capsule */}
      <SettingsCapsule />

      {/* Layer 8 — Window Manager Controls */}
      <AlignmentGuides />
      <LayoutEditBar />

    </div>
  );
}

// ── StarMapOuter — provides AgentWorkflowProvider with wired openPod ─────────
function StarMapOuter() {
  const { user, loading } = useAuth();
  const { notes }         = useNotes(user?.id);
  const { pods, openPod } = useToolbox();

  return (
    <AgentWorkflowProvider onOpenPod={openPod}>
      {user ? (
        <StarMapContents
          user={user}
          notes={notes as CosmosNote[]}
          loading={loading}
          openPod={openPod}
          pods={pods as Record<PodId, { open: boolean }>}
        />
      ) : (
        <div style={{ width: '100vw', height: '100vh', background: '#040508' }} />
      )}
    </AgentWorkflowProvider>
  );
}

// ── Exported component (ToolboxContext is provided by App) ───────────────────
export function StarMapLayout() {
  return <StarMapOuter />;
}
