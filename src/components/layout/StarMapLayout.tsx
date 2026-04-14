import { useEffect, useState, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import KnowledgeStarMap, { type HoveredNodeInfo } from '@/components/starmap/KnowledgeStarMap';
import { NodeLightBand } from '@/components/layout/NodeLightBand';
import { CommandDock } from '@/components/floating/CommandDock';
import { FloatingPod } from '@/components/floating/FloatingPod';
import { SettingsCapsule } from '@/components/floating/SettingsCapsule';
import { Feather, Radar, FlaskConical, Layers, Zap } from 'lucide-react';

import CaptureBox   from '@/components/pods/CaptureBox';
import RetrievalBox from '@/components/pods/RetrievalBox';
import InsightBox   from '@/components/pods/InsightBox';
import MemoryBox    from '@/components/pods/MemoryBox';
import ActionBox    from '@/components/pods/ActionBox';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

export function StarMapLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { notes } = useNotes(user?.id);

  const [hoveredNode,    setHoveredNode]    = useState<HoveredNodeInfo | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [flashNoteId,    setFlashNoteId]    = useState<string | null>(null);
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  const handleNodeHover = useCallback((info: HoveredNodeInfo | null) => {
    setHoveredNode(info);
  }, []);

  const highlightNotes = useCallback((ids: string[]) => {
    setHighlightedIds(ids);
  }, []);

  const flashNote = useCallback((noteId: string) => {
    setFlashNoteId(noteId);
    setTimeout(() => setFlashNoteId(null), 1200);
  }, []);

  if (loading) {
    return (
      <div style={{
        width: '100vw', height: '100vh', background: '#040508',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 14,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          border: '1px solid rgba(0,255,102,0.25)',
          background: 'rgba(0,255,102,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'pulse-glow 2s ease-in-out infinite',
        }}>
          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 14, color: '#00ff66' }}>平</span>
        </div>
        <p style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(80,90,110,0.60)', letterSpacing: '0.08em' }}>
          LOADING…
        </p>
      </div>
    );
  }

  if (!user) return null;

  // HUD stats
  const totalTags = Array.from(new Set(notes.flatMap(n => n.tags || []))).length;
  const thisWeek  = notes.filter(n => n.created_at && Date.now() - new Date(n.created_at).getTime() < 7*86400000).length;

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
      />

      {/* Layer 1 — Top-left HUD */}
      <div style={{
        position: 'fixed', top: 0, left: 0, zIndex: 10,
        padding: '18px 22px',
        pointerEvents: 'none',
        background: 'linear-gradient(135deg, rgba(1,4,13,0.65) 0%, transparent 70%)',
      }}>
        <div style={{ fontFamily: INTER, fontWeight: 700, fontSize: 13, color: 'rgba(230,238,255,0.75)', marginBottom: 2 }}>
          {user.email?.split('@')[0]}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(60,72,95,0.60)', letterSpacing: '0.08em', marginBottom: 10 }}>
          {notes.length} nodes · {totalTags} clusters · +{thisWeek} this week
        </div>
        {/* Recenter button — pointer-auto override */}
        <button
          onClick={() => setRecenterTrigger(t => t + 1)}
          title="回到中心 (Space)"
          style={{
            pointerEvents: 'auto',
            display: 'flex', alignItems: 'center', gap: 5,
            fontFamily: MONO, fontSize: 8, letterSpacing: '0.08em',
            color: 'rgba(102,240,255,0.55)',
            background: 'rgba(102,240,255,0.06)',
            border: '1px solid rgba(102,240,255,0.14)',
            borderRadius: 5, padding: '4px 9px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(102,240,255,0.90)';
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(102,240,255,0.12)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(102,240,255,0.55)';
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(102,240,255,0.06)';
          }}
        >
          ↺ 回到中心
        </button>
      </div>

      {/* Layer 2 — Floating Pods */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 20, pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto' }}>

          <FloatingPod id="capture"   title="Capture Pod"   subtitle="捕捉舱 · 知识入口"     icon={Feather}      accentColor="#00ff66" width={360}>
            <CaptureBox onFlashNote={flashNote} />
          </FloatingPod>

          <FloatingPod id="retrieval" title="Retrieval Pod" subtitle="检索舱 · 语义召回"     icon={Radar}        accentColor="#66f0ff" width={420}>
            <RetrievalBox onHighlight={highlightNotes} />
          </FloatingPod>

          <FloatingPod id="insight"   title="Insight Pod"   subtitle="洞察舱 · 知识精炼"     icon={FlaskConical} accentColor="#b496ff" width={400}>
            <InsightBox />
          </FloatingPod>

          <FloatingPod id="memory"    title="Memory Pod"    subtitle="记忆舱 · 上下文唤醒"   icon={Layers}       accentColor="#ffa040" width={360}>
            <MemoryBox hoveredNoteId={hoveredNode?.noteId} />
          </FloatingPod>

          <FloatingPod id="action"    title="Action Pod"    subtitle="行动舱 · 知识转执行"   icon={Zap}          accentColor="#ff4466" width={360}>
            <ActionBox />
          </FloatingPod>

        </div>
      </div>

      {/* Layer 3 — Route overlay (e.g. /app/note/:id) */}
      <Outlet />

      {/* Layer 4 — Node hover light band */}
      <NodeLightBand node={hoveredNode} />

      {/* Layer 5 — Command Dock */}
      <CommandDock />

      {/* Layer 6 — Settings Capsule (top-right, fixed, pointer-auto) */}
      <SettingsCapsule />

    </div>
  );
}
