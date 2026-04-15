/**
 * Memory Pod — 记忆舱
 * Accent: #ffa040 (amber)
 * Features:
 * - Each card explains WHY it appears now
 * - 4 hover actions: connect | inspect | distill | save for later
 * - Relay connect/distill to Insight pod
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import { useNavigate } from 'react-router-dom';
import { useAgentWorkflow } from '@/contexts/AgentWorkflowContext';
import { RefreshCw, Clock, Link2, Eye, Sparkles, Bookmark } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const A    = '#ffa040';
const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

interface MemoryCard {
  id: string;
  title: string;
  summary: string | null;
  tags: string[];
  created_at: string;
  relevance: 'high' | 'medium' | 'low';
  reason: string;  // why this card appears now
}

function getTagOverlap(a: string[], b: string[]): number {
  return a.filter(t => b.includes(t)).length;
}

interface Props { hoveredNoteId?: string | null; pinnedNoteId?: string | null }

export default function MemoryBox({ hoveredNoteId, pinnedNoteId }: Props) {
  const { user }    = useAuth();
  const { notes }   = useNotes(user?.id);
  const navigate    = useNavigate();
  const workflow    = useAgentWorkflow();

  const [cards,     setCards]     = useState<MemoryCard[]>([]);
  const [anchor,    setAnchor]    = useState<string | null>(null);
  const [mode,      setMode]      = useState<'hover' | 'recent'>('recent');
  const [savedIds,  setSavedIds]  = useState<Set<string>>(new Set());
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const buildCards = useCallback((sourceId: string | null) => {
    if (!notes.length) return;
    const source = notes.find(n => n.id === sourceId);
    if (source && mode === 'hover') {
      const related = notes
        .filter(n => n.id !== source.id)
        .map(n => ({ ...n, overlap: getTagOverlap(n.tags || [], source.tags || []) }))
        .filter(n => n.overlap > 0)
        .sort((a, b) => b.overlap - a.overlap)
        .slice(0, 5)
        .map(n => ({
          id: n.id, title: n.title || '(未命名)',
          summary: n.summary, tags: n.tags || [], created_at: n.created_at,
          relevance: (n.overlap >= 2 ? 'high' : 'medium') as MemoryCard['relevance'],
          reason: `与「${source.title?.slice(0,12) || '当前节点'}」共享 ${n.overlap} 个标签`,
        }));
      setCards(related);
    } else {
      const recent = [...notes]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 6)
        .map((n, i) => ({
          id: n.id, title: n.title || '(未命名)',
          summary: n.summary, tags: n.tags || [], created_at: n.created_at,
          relevance: (i < 2 ? 'high' : i < 4 ? 'medium' : 'low') as MemoryCard['relevance'],
          reason: i === 0 ? '最近创建' : i < 3 ? '近期记录' : '早期记忆',
        }));
      setCards(recent);
    }
  }, [notes, mode]);

  useEffect(() => {
    if (hoveredNoteId && hoveredNoteId !== anchor) {
      setAnchor(hoveredNoteId);
      setMode('hover');
    }
  }, [hoveredNoteId, anchor]);

  // Drag-to-pod: pinnedNoteId takes priority over hover
  useEffect(() => {
    if (pinnedNoteId && pinnedNoteId !== anchor) {
      setAnchor(pinnedNoteId);
      setMode('hover');
    }
  }, [pinnedNoteId, anchor]);

  useEffect(() => { buildCards(anchor); }, [anchor, buildCards]);

  const relevanceColor = (r: MemoryCard['relevance']) =>
    r === 'high' ? A : r === 'medium' ? `${A}88` : `${A}44`;

  const anchorNote = anchor ? notes.find(n => n.id === anchor) : null;

  const handleConnect = (card: MemoryCard) => {
    if (!card.summary) return;
    workflow.sendRelay(card.summary, 'memory', 'insight');
  };

  const handleDistill = (card: MemoryCard) => {
    const content = [card.title, card.summary].filter(Boolean).join(': ');
    workflow.sendRelay(content, 'memory', 'insight');
  };

  const handleSaveLater = (id: string) => {
    setSavedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid rgba(255,165,64,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: A, opacity: 0.7 }} />
          <span style={{ fontFamily: MONO, fontSize: 8, color: `${A}60`, letterSpacing: '0.06em' }}>
            {mode === 'hover' && anchorNote
              ? `关联唤起 · ${anchorNote.title?.slice(0, 14) || ''}…`
              : '近期记忆脉冲'
            }
          </span>
        </div>
        <button onClick={() => { setMode('recent'); setAnchor(null); buildCards(null); }}
          title="重置为近期记忆"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: `${A}50`, display: 'flex', padding: 2 }}>
          <RefreshCw size={10} />
        </button>
      </div>

      {/* Cards */}
      <div style={{ maxHeight: 380, overflowY: 'auto' }}>
        {cards.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', fontFamily: MONO, fontSize: 9, color: 'rgba(60,72,95,0.50)', letterSpacing: '0.05em', lineHeight: 1.8 }}>
            悬停星图节点<br />记忆将自动唤起
          </div>
        ) : cards.map(card => {
          const isHovered = hoveredCard === card.id;
          const isSaved   = savedIds.has(card.id);
          return (
            <div
              key={card.id}
              style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                padding: '9px 12px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                cursor: 'default',
                transition: 'background 0.12s',
                background: isHovered ? 'rgba(255,165,64,0.05)' : 'transparent',
                position: 'relative' as const,
              }}
              onMouseEnter={() => setHoveredCard(card.id)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              {/* Relevance bar */}
              <div style={{
                width: 3, alignSelf: 'stretch',
                borderRadius: 2, background: relevanceColor(card.relevance),
                flexShrink: 0, minHeight: 32,
              }} />

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* WHY it appears */}
                <div style={{
                  fontFamily: MONO, fontSize: 7.5, color: `${A}60`,
                  letterSpacing: '0.04em', marginBottom: 3,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: relevanceColor(card.relevance), flexShrink: 0 }} />
                  {card.reason}
                </div>

                <div style={{ fontFamily: INTER, fontSize: 11.5, color: 'rgba(210,218,238,0.85)', lineHeight: 1.4, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {card.title}
                  {isSaved && (
                    <span style={{ marginLeft: 6, fontFamily: MONO, fontSize: 7, color: A, background: `${A}18`, padding: '1px 5px', borderRadius: 3 }}>稍后</span>
                  )}
                </div>

                {card.summary && (
                  <div style={{ fontFamily: INTER, fontSize: 10, color: 'rgba(130,142,168,0.68)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                    {card.summary}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Clock size={8} color="rgba(100,110,135,0.45)" />
                  <span style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(90,100,128,0.50)' }}>
                    {formatDistanceToNow(new Date(card.created_at), { locale: zhCN, addSuffix: true })}
                  </span>
                  {card.tags.slice(0, 2).map(t => (
                    <span key={t} style={{ fontFamily: MONO, fontSize: 8, color: `${A}55`, background: `${A}0d`, padding: '1px 5px', borderRadius: 3 }}>{t}</span>
                  ))}
                </div>

                {/* 4 hover actions */}
                {isHovered && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 7 }}>
                    <ActionBtn icon={Link2}    label="连接" color={A}         onClick={() => handleConnect(card)} />
                    <ActionBtn icon={Eye}       label="检视" color="#66f0ff"   onClick={() => navigate(`/app/note/${card.id}`)} />
                    <ActionBtn icon={Sparkles}  label="蒸馏" color="#b496ff"   onClick={() => handleDistill(card)} />
                    <ActionBtn icon={Bookmark}  label={isSaved ? '已存' : '稍后'} color="rgba(150,160,185,0.70)" onClick={() => handleSaveLater(card.id)} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, color, onClick }: { icon: typeof Link2; label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick(); }} style={{
      display: 'flex', alignItems: 'center', gap: 3,
      fontFamily: MONO, fontSize: 7.5, letterSpacing: '0.04em',
      color, background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 4, padding: '3px 6px', cursor: 'pointer',
      transition: 'all 0.12s',
    }}>
      <Icon size={8} />
      {label}
    </button>
  );
}
