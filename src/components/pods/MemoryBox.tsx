/**
 * Memory Pod — 记忆舱
 * Accent: #ffa040 (amber)
 * Philosophy: Quiet recall. Context-aware. Non-intrusive echoes.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import { RefreshCw, Clock, Layers } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const A = '#ffa040';
const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

interface MemoryCard {
  id: string;
  title: string;
  summary: string | null;
  tags: string[];
  created_at: string;
  relevance: 'high' | 'medium' | 'low';
}

function getTagOverlap(a: string[], b: string[]): number {
  return a.filter(t => b.includes(t)).length;
}

interface Props {
  hoveredNoteId?: string | null;
}

export default function MemoryBox({ hoveredNoteId }: Props) {
  const { user } = useAuth();
  const { notes } = useNotes(user?.id);
  const navigate = useNavigate();
  const [cards, setCards]     = useState<MemoryCard[]>([]);
  const [anchor, setAnchor]   = useState<string | null>(null);
  const [mode, setMode]       = useState<'hover' | 'recent'>('recent');

  const buildCards = useCallback((sourceId: string | null) => {
    if (!notes.length) return;
    const source = notes.find(n => n.id === sourceId);

    if (source && mode === 'hover') {
      // Related by tag overlap
      const related = notes
        .filter(n => n.id !== source!.id)
        .map(n => ({ ...n, overlap: getTagOverlap(n.tags || [], source!.tags || []) }))
        .filter(n => n.overlap > 0)
        .sort((a, b) => b.overlap - a.overlap)
        .slice(0, 5)
        .map(n => ({
          id: n.id, title: n.title || '(未命名)',
          summary: n.summary, tags: n.tags || [], created_at: n.created_at,
          relevance: (n.overlap >= 2 ? 'high' : n.overlap === 1 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
        }));
      setCards(related);
    } else {
      // Recent notes
      const recent = [...notes]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 6)
        .map((n, i) => ({
          id: n.id, title: n.title || '(未命名)',
          summary: n.summary, tags: n.tags || [], created_at: n.created_at,
          relevance: (i < 2 ? 'high' : i < 4 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
        }));
      setCards(recent);
    }
  }, [notes, mode]);

  // When hovered node changes
  useEffect(() => {
    if (hoveredNoteId && hoveredNoteId !== anchor) {
      setAnchor(hoveredNoteId);
      setMode('hover');
    }
  }, [hoveredNoteId, anchor]);

  useEffect(() => {
    buildCards(anchor);
  }, [anchor, buildCards]);

  const relevanceColor = (r: MemoryCard['relevance']) =>
    r === 'high' ? A : r === 'medium' ? `${A}88` : `${A}44`;

  const anchorNote = anchor ? notes.find(n => n.id === anchor) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Header info */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid rgba(255,165,64,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Layers size={10} color={`${A}70`} />
          <span style={{ fontFamily: MONO, fontSize: 8, color: `${A}60`, letterSpacing: '0.06em' }}>
            {mode === 'hover' && anchorNote
              ? `关联 · ${anchorNote.title?.slice(0, 16) || ''}…`
              : '近期记忆'
            }
          </span>
        </div>
        <button
          onClick={() => { setMode('recent'); setAnchor(null); buildCards(null); }}
          title="重置为近期记忆"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: `${A}50`, display: 'flex', padding: 2 }}
        >
          <RefreshCw size={10} />
        </button>
      </div>

      {/* Cards */}
      <div style={{ maxHeight: 340, overflowY: 'auto' }}>
        {cards.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', fontFamily: MONO, fontSize: 9, color: 'rgba(60,72,95,0.50)', letterSpacing: '0.05em', lineHeight: 1.8 }}>
            悬停星图节点<br />记忆将自动唤起
          </div>
        ) : cards.map(card => (
          <div
            key={card.id}
            onClick={() => navigate(`/app/note/${card.id}`)}
            style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              padding: '9px 12px',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              cursor: 'pointer',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,165,64,0.05)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
          >
            {/* Relevance indicator */}
            <div style={{
              width: 3, height: 'auto', alignSelf: 'stretch',
              borderRadius: 2, background: relevanceColor(card.relevance),
              flexShrink: 0, minHeight: 32,
            }} />

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* "You previously recorded…" framing */}
              <div style={{ fontFamily: MONO, fontSize: 8, color: `${A}50`, letterSpacing: '0.04em', marginBottom: 3 }}>
                {card.relevance === 'high' ? '● 高度相关' : card.relevance === 'medium' ? '○ 相关' : '· 可能相关'}
              </div>

              <div style={{ fontFamily: INTER, fontSize: 11.5, color: 'rgba(210,218,238,0.85)', lineHeight: 1.4, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {card.title}
              </div>

              {card.summary && (
                <div style={{ fontFamily: INTER, fontSize: 10, color: 'rgba(130,142,168,0.68)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {card.summary}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Clock size={8} color="rgba(100,110,135,0.45)" />
                <span style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(90,100,128,0.50)' }}>
                  {formatDistanceToNow(new Date(card.created_at), { locale: zhCN, addSuffix: true })}
                </span>
                {card.tags.slice(0, 2).map(t => (
                  <span key={t} style={{ fontFamily: MONO, fontSize: 8, color: `${A}55`, background: `${A}0d`, padding: '1px 5px', borderRadius: 3 }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
