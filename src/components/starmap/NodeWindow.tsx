import { useState, useCallback, useEffect } from 'react';
import { X, Edit3, Check, XCircle, Tag, Clock, ExternalLink,
         RefreshCw, FlaskConical, Zap, HelpCircle, Bell, GitBranch } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { NodeType } from '@/types';
import { getEdgeTypeConfig } from './connect-types';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

// Node type visual config
const NODE_TYPE_CFG: Record<NodeType, { label: string; color: string }> = {
  capture:  { label: 'CAPTURE',  color: '#00ff66' },
  summary:  { label: 'SUMMARY',  color: '#66f0ff' },
  insight:  { label: 'INSIGHT',  color: '#b496ff' },
  action:   { label: 'ACTION',   color: '#ff4466' },
  question: { label: 'QUESTION', color: '#ffa040' },
  relation: { label: 'RELATION', color: '#c0c8d8' },
};

interface NoteData {
  id: string;
  user_id?: string;
  title: string | null;
  summary: string | null;
  tags: string[];
  created_at: string;
  node_type?: NodeType;
}

interface NodeWindowProps {
  note: NoteData;
  accentColor: string;
  onClose: () => void;
  onNavigate?: (noteId: string) => void;
  onNewNode?: (noteId: string) => void;   // flash a newly created derived node
}

export function NodeWindow({ note, accentColor, onClose, onNavigate, onNewNode }: NodeWindowProps) {
  const [editing,  setEditing]  = useState(false);
  const [title,    setTitle]    = useState(note.title    ?? '');
  const [summary,  setSummary]  = useState(note.summary  ?? '');
  const [saving,   setSaving]   = useState(false);
  const [delegating, setDelegating] = useState<string | null>(null); // which action is running

  const nodeType = note.node_type ?? 'capture';
  const typeCfg  = NODE_TYPE_CFG[nodeType];

  const r = parseInt(accentColor.slice(1, 3), 16);
  const g = parseInt(accentColor.slice(3, 5), 16);
  const b = parseInt(accentColor.slice(5, 7), 16);
  const accent     = accentColor;
  const accentFade = `rgba(${r},${g},${b},0.55)`;
  const accentBg   = `rgba(${r},${g},${b},0.10)`;
  const border     = `rgba(${r},${g},${b},0.28)`;

  // ── SAVE ────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('notes')
        .update({ title: title || null, summary: summary || null })
        .eq('id', note.id);
      if (error) throw error;
      toast.success('已保存');
      setEditing(false);
    } catch { toast.error('保存失败'); }
    finally { setSaving(false); }
  }, [note.id, title, summary]);

  const handleCancel = () => {
    setTitle(note.title ?? '');
    setSummary(note.summary ?? '');
    setEditing(false);
  };

  // ── DERIVED NODE CREATION ────────────────────────────────────────
  const createDerived = useCallback(async (
    node_type: NodeType,
    titlePrefix: string,
    summaryText: string,
  ) => {
    if (!note.user_id) { toast.error('无法确认用户'); return; }
    setDelegating(node_type);
    try {
      const { data, error } = await supabase.from('notes').insert({
        user_id: note.user_id,
        analysis_id: null,
        node_type,
        title: `${titlePrefix} · ${(note.title || '未命名').slice(0, 30)}`,
        summary: summaryText,
        tags: note.tags?.slice(0, 3) || [],
        key_points: [], analysis_content: {}, mindmap_data: {},
        content_markdown: null, summary_markdown: null,
        analysis_markdown: null, mindmap_markdown: null,
        is_edited: false,
      }).select().maybeSingle();
      if (error) throw error;
      if (data?.id) {
        toast.success(`已生成 ${NODE_TYPE_CFG[node_type].label} 节点`);
        onNewNode?.(data.id);
      }
    } catch { toast.error('节点创建失败'); }
    finally { setDelegating(null); }
  }, [note, onNewNode]);

  const timeAgo = note.created_at
    ? formatDistanceToNow(new Date(note.created_at), { locale: zhCN, addSuffix: true })
    : '';

  return (
    <div
      style={{
        width: 285,
        background: 'rgba(3, 5, 12, 0.96)',
        backdropFilter: 'blur(22px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(22px) saturate(1.5)',
        border: `1px solid ${border}`,
        borderRadius: 10,
        boxShadow: `0 0 0 1px rgba(${r},${g},${b},0.07), 0 24px 64px rgba(0,0,0,0.85)`,
        overflow: 'hidden',
        animation: 'cosmos-window-in 0.20s cubic-bezier(0.16,1,0.3,1)',
        pointerEvents: 'all',
        userSelect: 'none',
      }}
      onPointerDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {/* Accent glow bar */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />

      {/* Node type badge + header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: '8px 10px 7px',
        borderBottom: `1px solid rgba(${r},${g},${b},0.09)`,
        background: accentBg,
      }}>
        {/* Type badge */}
        <div style={{
          padding: '1px 5px', borderRadius: 3, flexShrink: 0, marginTop: 1,
          background: `${typeCfg.color}15`,
          border: `1px solid ${typeCfg.color}30`,
        }}>
          <span style={{
            fontFamily: MONO, fontSize: 7, letterSpacing: '0.10em',
            color: typeCfg.color, textTransform: 'uppercase',
          }}>{typeCfg.label}</span>
        </div>

        {/* Title */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${border}`, borderRadius: 5, padding: '3px 6px',
                fontFamily: INTER, fontSize: 11, fontWeight: 600,
                color: 'rgba(220,230,250,0.95)', outline: 'none',
              }}
            />
          ) : (
            <div style={{
              fontFamily: INTER, fontSize: 11, fontWeight: 600,
              color: 'rgba(220,230,250,0.95)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {note.title || '(未命名)'}
            </div>
          )}
        </div>

        {/* Header controls */}
        <div style={{ display: 'flex', gap: 3, flexShrink: 0, marginTop: 1 }}>
          {!editing && (
            <button onClick={() => setEditing(true)} style={btnStyle(accentFade)} title="编辑">
              <Edit3 size={10} />
            </button>
          )}
          <button onClick={onClose} style={btnStyle('rgba(255,80,80,0.50)')} title="关闭">
            <X size={10} />
          </button>
        </div>
      </div>

      {/* Summary body */}
      <div style={{ padding: '9px 11px 7px' }}>
        {editing ? (
          <textarea
            value={summary}
            onChange={e => setSummary(e.target.value)}
            rows={4}
            style={{
              width: '100%', boxSizing: 'border-box', resize: 'vertical',
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${border}`, borderRadius: 5, padding: '6px 8px',
              fontFamily: INTER, fontSize: 11, lineHeight: 1.65,
              color: 'rgba(200,215,240,0.88)', outline: 'none',
            }}
          />
        ) : (
          <p style={{
            fontFamily: INTER, fontSize: 11, lineHeight: 1.72,
            color: 'rgba(160,175,205,0.82)', margin: 0,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
          }}>
            {note.summary || (
              <span style={{ color: 'rgba(100,110,135,0.45)', fontStyle: 'italic' }}>暂无摘要</span>
            )}
          </p>
        )}
      </div>

      {/* Tags + time */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap',
        padding: '4px 11px 6px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <Tag size={8} color="rgba(90,102,130,0.50)" />
        {note.tags?.length
          ? note.tags.slice(0, 3).map(t => (
            <span key={t} style={{
              fontFamily: MONO, fontSize: 8, letterSpacing: '0.04em', color: accentFade,
              background: `rgba(${r},${g},${b},0.08)`,
              border: `1px solid rgba(${r},${g},${b},0.18)`,
              padding: '1px 5px', borderRadius: 3,
            }}>{t}</span>
          ))
          : <span style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(70,80,100,0.45)' }}>无标签</span>
        }
        {timeAgo && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Clock size={8} color="rgba(80,90,115,0.45)" />
            <span style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(80,90,115,0.50)' }}>{timeAgo}</span>
          </div>
        )}
      </div>

      {/* Primary action row */}
      <div style={{ display: 'flex', gap: 5, padding: '7px 10px 6px' }}>
        {editing ? (
          <>
            <button onClick={handleSave} disabled={saving} style={primaryBtn(accent, r, g, b)}>
              <Check size={9} />{saving ? '保存中…' : '保存'}
            </button>
            <button onClick={handleCancel} style={ghostBtn}>
              <XCircle size={9} />取消
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} style={primaryBtn(accent, r, g, b)}>
              <Edit3 size={9} />编辑
            </button>
            <button onClick={() => onNavigate?.(note.id)} style={primaryBtn('#66f0ff', 102, 240, 255)}>
              <ExternalLink size={9} />详情
            </button>
          </>
        )}
      </div>

      {/* ── RELATIONS SECTION ────────────────────────────────────── */}
      {!editing && <NodeRelationsBlock noteId={note.id} userId={note.user_id} accent={accent} onNavigate={onNavigate} />}

      {/* ── AGENT CONTINUE PANEL ──────────────────────────────────── */}
      {!editing && (
        <div style={{
          padding: '6px 10px 9px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          background: 'rgba(255,255,255,0.015)',
        }}>
          <div style={{
            fontFamily: MONO, fontSize: 7, letterSpacing: '0.12em',
            color: 'rgba(60,72,95,0.55)', marginBottom: 5, textTransform: 'uppercase',
          }}>
            继续委托 Agent
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <AgentActionBtn
              icon={<RefreshCw size={8} />}
              label="再检索"
              color="#66f0ff"
              loading={delegating === 'retrieve-hint'}
              onClick={() => toast.info('请在 Retrieval Pod 中输入: ' + (note.title || ''), { duration: 3000 })}
            />
            <AgentActionBtn
              icon={<FlaskConical size={8} />}
              label="再蒸馏"
              color="#b496ff"
              loading={delegating === 'insight'}
              onClick={() => createDerived('insight', '洞见', note.summary || '提炼自: ' + (note.title || ''))}
            />
            <AgentActionBtn
              icon={<Zap size={8} />}
              label="转行动"
              color="#ff4466"
              loading={delegating === 'action'}
              onClick={() => createDerived('action', '行动', '基于「' + (note.title || '此节点') + '」的后续行动')}
            />
            <AgentActionBtn
              icon={<HelpCircle size={8} />}
              label="提问题"
              color="#ffa040"
              loading={delegating === 'question'}
              onClick={() => createDerived('question', '问题', '关于「' + (note.title || '此节点') + '」的深度问题')}
            />
            <AgentActionBtn
              icon={<Bell size={8} />}
              label="标记唤醒"
              color="#c0c8d8"
              loading={false}
              onClick={() => toast.success('已加入唤醒队列', { description: 'Memory Pod 将在适当时机召回此节点' })}
            />
          </div>
        </div>
      )}

      <style>{`
        @keyframes cosmos-window-in {
          from { opacity: 0; transform: scale(0.88) translateY(5px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
      `}</style>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function AgentActionBtn({
  icon, label, color, loading, onClick
}: {
  icon: React.ReactNode; label: string; color: string;
  loading: boolean; onClick: () => void;
}) {
  const [r, g, b] = [
    parseInt(color.slice(1, 3), 16),
    parseInt(color.slice(3, 5), 16),
    parseInt(color.slice(5, 7), 16),
  ];
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        fontFamily: MONO, fontSize: 8, letterSpacing: '0.05em',
        color: `rgba(${r},${g},${b},0.80)`,
        background: `rgba(${r},${g},${b},0.08)`,
        border: `1px solid rgba(${r},${g},${b},0.20)`,
        borderRadius: 5, padding: '4px 7px',
        cursor: loading ? 'wait' : 'pointer',
        transition: 'all 0.15s',
        opacity: loading ? 0.6 : 1,
      }}
    >
      {icon}{label}
    </button>
  );
}

// ── Style helpers ──────────────────────────────────────────────────────────

function btnStyle(color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 20, height: 20, borderRadius: 4,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    cursor: 'pointer', color,
  };
}

function primaryBtn(color: string, r: number, g: number, b: number): React.CSSProperties {
  return {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    fontFamily: MONO, fontSize: 9, letterSpacing: '0.05em', color,
    background: `rgba(${r},${g},${b},0.09)`,
    border: `1px solid rgba(${r},${g},${b},0.22)`,
    borderRadius: 6, padding: '5px 0', cursor: 'pointer',
  };
}

const ghostBtn: React.CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
  fontFamily: MONO, fontSize: 9, letterSpacing: '0.05em',
  color: 'rgba(160,175,200,0.55)',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 6, padding: '5px 0', cursor: 'pointer',
};

// ── Relations block inside NodeWindow ───────────────────────────────────────

interface RelRow {
  id: string;
  edge_type: string;
  description: string | null;
  confidence: number | null;
  peer_id: string;
  peer_title: string;
  direction: 'out' | 'in';
}

function NodeRelationsBlock({
  noteId, userId, accent, onNavigate,
}: {
  noteId: string; userId: string; accent: string;
  onNavigate?: (id: string) => void;
}) {
  const [rels, setRels] = useState<RelRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [outRes, inRes] = await Promise.all([
        supabase.from('thought_edges')
          .select('id, edge_type, description, confidence, target_id')
          .eq('user_id', userId).eq('source_id', noteId),
        supabase.from('thought_edges')
          .select('id, edge_type, description, confidence, source_id')
          .eq('user_id', userId).eq('target_id', noteId),
      ]);

      const peerIds = new Set<string>();
      (outRes.data ?? []).forEach(e => peerIds.add(e.target_id));
      (inRes.data ?? []).forEach(e => peerIds.add(e.source_id));

      const titleMap = new Map<string, string>();
      if (peerIds.size > 0) {
        const { data: peerNotes } = await supabase.from('notes')
          .select('id, title').in('id', [...peerIds]);
        (peerNotes ?? []).forEach(n => titleMap.set(n.id, n.title ?? 'Untitled'));
      }

      if (cancelled) return;
      const rows: RelRow[] = [];
      (outRes.data ?? []).forEach(e => rows.push({
        id: e.id, edge_type: e.edge_type,
        description: e.description, confidence: e.confidence,
        peer_id: e.target_id, peer_title: titleMap.get(e.target_id) ?? '?',
        direction: 'out',
      }));
      (inRes.data ?? []).forEach(e => rows.push({
        id: e.id, edge_type: e.edge_type,
        description: e.description, confidence: e.confidence,
        peer_id: e.source_id, peer_title: titleMap.get(e.source_id) ?? '?',
        direction: 'in',
      }));
      setRels(rows);
    })();
    return () => { cancelled = true; };
  }, [noteId, userId]);

  if (rels.length === 0) return null;

  return (
    <div style={{
      padding: '6px 10px 8px',
      borderTop: '1px solid rgba(255,255,255,0.04)',
      background: 'rgba(255,255,255,0.015)',
    }}>
      <div style={{
        fontFamily: MONO, fontSize: 7, letterSpacing: '0.12em',
        color: 'rgba(60,72,95,0.55)', marginBottom: 5, textTransform: 'uppercase',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <GitBranch size={8} /> 关联 ({rels.length})
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {rels.slice(0, 8).map(rel => {
          const cfg = getEdgeTypeConfig(rel.edge_type);
          const arrow = rel.direction === 'out' ? '\u2192' : '\u2190';
          return (
            <div
              key={rel.id}
              onClick={() => onNavigate?.(rel.peer_id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '3px 6px', borderRadius: 5, cursor: 'pointer',
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.04)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
            >
              {/* type badge */}
              <span style={{
                fontFamily: MONO, fontSize: 7, letterSpacing: '0.08em',
                color: cfg.color, padding: '1px 4px',
                background: `${cfg.color}18`, borderRadius: 3,
                whiteSpace: 'nowrap',
              }}>
                {cfg.icon} {cfg.label}
              </span>

              {/* arrow */}
              <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(160,175,200,0.35)' }}>
                {arrow}
              </span>

              {/* peer title */}
              <span style={{
                fontFamily: INTER, fontSize: 10, color: accent,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                flex: 1,
              }}>
                {rel.peer_title}
              </span>

              {/* confidence */}
              {rel.confidence != null && (
                <span style={{
                  fontFamily: MONO, fontSize: 7, color: 'rgba(120,135,160,0.4)',
                }}>
                  {Math.round(Number(rel.confidence) * 100)}%
                </span>
              )}
            </div>
          );
        })}
        {rels.length > 8 && (
          <div style={{
            fontFamily: MONO, fontSize: 8, color: 'rgba(120,135,160,0.4)',
            textAlign: 'center', padding: 2,
          }}>
            +{rels.length - 8} more
          </div>
        )}
      </div>
    </div>
  );
}

