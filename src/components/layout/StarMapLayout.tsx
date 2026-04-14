import { useEffect, useState, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import { useT } from '@/contexts/LanguageContext';
import { useToolbox } from '@/contexts/ToolboxContext';
import KnowledgeStarMap, { type HoveredNodeInfo } from '@/components/starmap/KnowledgeStarMap';
import { NodeLightBand } from '@/components/layout/NodeLightBand';
import { CommandDock } from '@/components/floating/CommandDock';
import { FloatingToolbox } from '@/components/floating/FloatingToolbox';
import {
  Brain, Search, BookOpen, FlaskConical, Scan, Sparkles, CheckSquare, Settings
} from 'lucide-react';

// Lazy-loaded toolbox content
import AnalyzeBox from '@/components/toolboxes/AnalyzeBox';
import SearchBox from '@/components/toolboxes/SearchBox';
import LibraryBox from '@/components/toolboxes/LibraryBox';
import DistillerBox from '@/components/toolboxes/DistillerBox';
import MirrorBox from '@/components/toolboxes/MirrorBox';
import AnticipationBox from '@/components/toolboxes/AnticipationBox';
import ActionsBox from '@/components/toolboxes/ActionsBox';
import SettingsBox from '@/components/toolboxes/SettingsBox';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

export function StarMapLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const { notes } = useNotes(user?.id);
  const { toolboxes } = useToolbox();

  const [hoveredNode, setHoveredNode] = useState<HoveredNodeInfo | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [flashNoteId, setFlashNoteId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  const handleNodeHover = useCallback((info: HoveredNodeInfo | null) => {
    setHoveredNode(info);
  }, []);

  const handleNodeClick = useCallback((noteId: string) => {
    navigate(`/note/${noteId}`);
  }, [navigate]);

  // Expose callbacks for toolboxes to highlight nodes
  const highlightNotes = useCallback((ids: string[]) => {
    setHighlightedIds(ids);
  }, []);

  const flashNote = useCallback((noteId: string) => {
    setFlashNoteId(noteId);
    setTimeout(() => setFlashNoteId(null), 1000);
  }, []);

  if (loading) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: '#040508',
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
          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 14, color: '#00ff66' }}>Pe</span>
        </div>
        <p style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(80,90,110,0.60)', letterSpacing: '0.08em' }}>
          {t('layout.loading')}
        </p>
      </div>
    );
  }

  if (!user) return null;

  // Count stats
  const totalTags = Array.from(new Set(notes.flatMap(n => n.tags || []))).length;
  const thisWeek  = notes.filter(n => n.created_at && Date.now() - new Date(n.created_at).getTime() < 7 * 86400000).length;

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#040508' }}>

      {/* Layer 0: Star Map Canvas */}
      <KnowledgeStarMap
        notes={notes}
        loading={loading}
        onNodeHover={handleNodeHover}
        onNodeClick={handleNodeClick}
        highlightedNoteIds={highlightedIds}
        flashNoteId={flashNoteId}
      />

      {/* Layer 1: Top HUD */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        padding: '16px 24px',
        pointerEvents: 'none',
        background: 'linear-gradient(to bottom, rgba(4,5,8,0.7) 0%, transparent 100%)',
      }}>
        <div>
          <div style={{ fontFamily: INTER, fontWeight: 700, fontSize: 14, color: '#ffffff', marginBottom: 2 }}>
            {user.email?.split('@')[0]}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(80,90,110,0.60)', letterSpacing: '0.07em' }}>
            KNOWLEDGE COSMOS
          </div>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(80,90,110,0.50)', textAlign: 'right', letterSpacing: '0.06em' }}>
          <div>{notes.length} nodes</div>
          <div>{totalTags} clusters</div>
          <div>+{thisWeek} this week</div>
        </div>
      </div>

      {/* Layer 2: Floating Toolboxes */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 20, pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto' }}>

          <FloatingToolbox id="analyze" title={t('sidebar.analyze')} icon={Brain} width={440}>
            <AnalyzeBox onFlashNote={flashNote} />
          </FloatingToolbox>

          <FloatingToolbox id="search" title={t('sidebar.search')} icon={Search} width={420} accentColor="cyan">
            <SearchBox onHighlight={highlightNotes} />
          </FloatingToolbox>

          <FloatingToolbox id="library" title={t('sidebar.library')} icon={BookOpen} width={360} accentColor="cyan">
            <LibraryBox onHighlight={id => highlightNotes([id])} />
          </FloatingToolbox>

          <FloatingToolbox id="distiller" title={t('sidebar.distiller')} icon={FlaskConical} width={400}>
            <DistillerBox />
          </FloatingToolbox>

          <FloatingToolbox id="mirror" title={t('sidebar.mirror')} icon={Scan} width={380} accentColor="cyan">
            <MirrorBox />
          </FloatingToolbox>

          <FloatingToolbox id="anticipation" title={t('sidebar.anticipation')} icon={Sparkles} width={380}>
            <AnticipationBox />
          </FloatingToolbox>

          <FloatingToolbox id="actions" title={t('sidebar.actions')} icon={CheckSquare} width={380} accentColor="cyan">
            <ActionsBox />
          </FloatingToolbox>

          <FloatingToolbox id="settings" title={t('sidebar.settings')} icon={Settings} width={320}>
            <SettingsBox />
          </FloatingToolbox>

        </div>
      </div>

      {/* Layer 3: Note detail overlay (route-rendered pages, e.g., /note/:id) */}
      <Outlet />

      {/* Layer 4: Node light band */}
      <NodeLightBand node={hoveredNode} />

      {/* Layer 5: Command dock */}
      <CommandDock />

    </div>
  );
}
