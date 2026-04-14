import { useState, useCallback } from 'react';
import { X, Edit3, Check, XCircle, Tag, Clock, ExternalLink, Link2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

interface NoteData {
  id: string;
  title: string | null;
  summary: string | null;
  tags: string[];
  created_at: string;
}

interface NodeWindowProps {
  note: NoteData;
  accentColor: string;
  onClose: () => void;
}

export function NodeWindow({ note, accentColor, onClose }: NodeWindowProps) {
  const navigate = useNavigate();
  const [editing,  setEditing]  = useState(false);
  const [title,    setTitle]    = useState(note.title    ?? '');
  const [summary,  setSummary]  = useState(note.summary  ?? '');
  const [saving,   setSaving]   = useState(false);

  const r = parseInt(accentColor.slice(1, 3), 16);
  const g = parseInt(accentColor.slice(3, 5), 16);
  const b = parseInt(accentColor.slice(5, 7), 16);
  const accent     = accentColor;
  const accentFade = `rgba(${r},${g},${b},0.55)`;
  const accentBg   = `rgba(${r},${g},${b},0.10)`;
  const border     = `rgba(${r},${g},${b},0.28)`;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('notes')
        .update({ title: title || null, summary: summary || null })
        .eq('id', note.id);
      if (error) throw error;
      toast.success('已保存');
      setEditing(false);
    } catch {
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  }, [note.id, title, summary]);

  const handleCancel = () => {
    setTitle(note.title ?? '');
    setSummary(note.summary ?? '');
    setEditing(false);
  };

  const timeAgo = note.created_at
    ? formatDistanceToNow(new Date(note.created_at), { locale: zhCN, addSuffix: true })
    : '';

  return (
    <div
      style={{
        width: 280,
        background: 'rgba(4, 6, 14, 0.94)',
        backdropFilter: 'blur(20px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
        border: `1px solid ${border}`,
        borderRadius: 10,
        boxShadow: `0 0 0 1px rgba(${r},${g},${b},0.08), 0 20px 60px rgba(0,0,0,0.80)`,
        overflow: 'hidden',
        animation: 'cosmos-window-in 0.18s cubic-bezier(0.16,1,0.3,1)',
        pointerEvents: 'all',
        userSelect: 'none',
      }}
      onPointerDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {/* Accent top bar */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: '9px 10px 8px',
        borderBottom: `1px solid rgba(${r},${g},${b},0.10)`,
        background: accentBg,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${border}`,
                borderRadius: 5, padding: '4px 7px',
                fontFamily: INTER, fontSize: 12, fontWeight: 600,
                color: 'rgba(220,230,250,0.95)', outline: 'none',
              }}
            />
          ) : (
            <div style={{
              fontFamily: INTER, fontSize: 12, fontWeight: 600,
              color: 'rgba(220,230,250,0.95)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {note.title || '(未命名)'}
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginTop: 1 }}>
          {!editing && (
            <button onClick={() => setEditing(true)} style={btnStyle(accentFade)} title="编辑">
              <Edit3 size={10} />
            </button>
          )}
          <button onClick={onClose} style={btnStyle('rgba(255,80,80,0.55)')} title="关闭">
            <X size={10} />
          </button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ padding: '9px 11px 7px' }}>
        {editing ? (
          <textarea
            value={summary}
            onChange={e => setSummary(e.target.value)}
            rows={4}
            style={{
              width: '100%', boxSizing: 'border-box', resize: 'vertical',
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${border}`,
              borderRadius: 5, padding: '6px 8px',
              fontFamily: INTER, fontSize: 11, lineHeight: 1.65,
              color: 'rgba(200,215,240,0.88)', outline: 'none',
            }}
          />
        ) : (
          <p style={{
            fontFamily: INTER, fontSize: 11, lineHeight: 1.72,
            color: 'rgba(165,178,205,0.82)', margin: 0,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
          }}>
            {note.summary || <span style={{ color: 'rgba(100,110,135,0.45)', fontStyle: 'italic' }}>暂无摘要</span>}
          </p>
        )}
      </div>

      {/* Tags + Time */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap',
        padding: '4px 11px 7px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <Tag size={8} color="rgba(90,102,130,0.50)" />
        {note.tags?.length ? note.tags.slice(0, 3).map(t => (
          <span key={t} style={{
            fontFamily: MONO, fontSize: 8, letterSpacing: '0.04em',
            color: accentFade,
            background: `rgba(${r},${g},${b},0.08)`,
            border: `1px solid rgba(${r},${g},${b},0.18)`,
            padding: '1px 5px', borderRadius: 3,
          }}>{t}</span>
        )) : <span style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(70,80,100,0.45)' }}>无标签</span>}
        {timeAgo && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Clock size={8} color="rgba(80,90,115,0.45)" />
            <span style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(80,90,115,0.50)' }}>{timeAgo}</span>
          </div>
        )}
      </div>

      {/* Action row */}
      <div style={{ display: 'flex', gap: 5, padding: '7px 10px 9px' }}>
        {editing ? (
          <>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                fontFamily: MONO, fontSize: 9, letterSpacing: '0.05em',
                color: '#040508',
                background: accent,
                border: 'none', borderRadius: 6, padding: '6px 0', cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              <Check size={9} />{saving ? '保存中…' : '保存'}
            </button>
            <button
              onClick={handleCancel}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                fontFamily: MONO, fontSize: 9, letterSpacing: '0.05em',
                color: 'rgba(180,190,215,0.65)',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 6, padding: '6px 0', cursor: 'pointer',
              }}
            >
              <XCircle size={9} />取消
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setEditing(true)}
              style={actionBtn(accent, r, g, b)}
            >
              <Edit3 size={9} />编辑
            </button>
            <button
              onClick={() => navigate(`/app/note/${note.id}`)}
              style={actionBtn('#66f0ff', 102, 240, 255)}
            >
              <ExternalLink size={9} />详情
            </button>
            <button
              onClick={() => {/* connect feature placeholder */}}
              style={actionBtn('rgba(120,130,155,0.65)', 120, 130, 155)}
            >
              <Link2 size={9} />连接
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function btnStyle(color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 20, height: 20,
    borderRadius: 4,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    cursor: 'pointer',
    color,
  };
}

function actionBtn(color: string, r: number, g: number, b: number): React.CSSProperties {
  return {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    fontFamily: "'IBM Plex Mono','Roboto Mono',monospace",
    fontSize: 9, letterSpacing: '0.05em',
    color: color,
    background: `rgba(${r},${g},${b},0.08)`,
    border: `1px solid rgba(${r},${g},${b},0.20)`,
    borderRadius: 6, padding: '5px 0', cursor: 'pointer',
  };
}

// CSS injected once
const style = document.createElement('style');
style.textContent = `
  @keyframes cosmos-window-in {
    from { opacity: 0; transform: scale(0.88) translateY(4px); }
    to   { opacity: 1; transform: scale(1)    translateY(0);   }
  }
`;
if (!document.head.contains(style)) document.head.appendChild(style);
