/**
 * MobileNodeCard — full-screen-width bottom card for viewing a node on phone.
 * Replaces the drei-based NodeWindow which is unusable on small screens.
 */
import { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, Send, Link2, Trash2, Tag, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { NodeType } from '@/types';
import { useHintState } from '@/hooks/useHintState';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

const NODE_TYPE_CFG: Record<NodeType, { label: string; color: string }> = {
  capture:  { label: 'CAPTURE',  color: '#00ff66' },
  summary:  { label: 'SUMMARY',  color: '#66f0ff' },
  insight:  { label: 'INSIGHT',  color: '#b496ff' },
  action:   { label: 'ACTION',   color: '#ff4466' },
  question: { label: 'QUESTION', color: '#ffa040' },
  relation: { label: 'RELATION', color: '#c0c8d8' },
};

const PODS = [
  { id: 'retrieval', label: '检索',  color: '#66f0ff' },
  { id: 'insight',   label: '洞察',  color: '#b496ff' },
  { id: 'action',    label: '行动',  color: '#ff4466' },
  { id: 'memory',    label: '记忆',  color: '#ffa040' },
];

interface NoteData {
  id: string;
  title: string | null;
  summary: string | null;
  tags: string[];
  created_at: string;
  node_type?: NodeType;
}

interface Props {
  note: NoteData;
  accentColor: string;
  onClose: () => void;
  onNavigate?: (noteId: string) => void;
  onSendToPod?: (noteId: string, podId: string) => void;
  onConnect?: (noteId: string) => void;
  onDelete?: (noteId: string) => void;
}

export function MobileNodeCard({ note, accentColor, onClose, onNavigate, onSendToPod, onConnect, onDelete }: Props) {
  const hints = useHintState();
  const [showPods, setShowPods] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Drag-to-dismiss
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    setDragging(true);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging) return;
    const dy = e.touches[0].clientY - startY.current;
    setDragY(Math.max(0, dy));
  }, [dragging]);

  const onTouchEnd = useCallback(() => {
    setDragging(false);
    if (dragY > 100) {
      onClose();
    }
    setDragY(0);
  }, [dragY, onClose]);

  const typeCfg = NODE_TYPE_CFG[(note.node_type as NodeType) ?? 'capture'];

  const handleSendToPod = (podId: string) => {
    onSendToPod?.(note.id, podId);
    hints.markCompleted('drag_to_pod');
    setShowPods(false);
    onClose();
  };

  const handleConnect = () => {
    onConnect?.(note.id);
    onClose();
  };

  const handleDelete = () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    onDelete?.(note.id);
    onClose();
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9990,
          background: 'rgba(0,0,0,0.50)',
          animation: 'fade-in 0.15s ease-out',
        }}
      />

      {/* Card */}
      <div
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          zIndex: 9991,
          transform: `translateY(${dragY}px)`,
          transition: dragging ? 'none' : 'transform 0.28s cubic-bezier(0.22,1,0.36,1)',
          background: 'rgba(3,5,13,0.98)',
          backdropFilter: 'blur(40px)',
          borderTop: `1.5px solid ${accentColor}44`,
          borderRadius: '20px 20px 0 0',
          boxShadow: `0 -4px 40px rgba(0,0,0,0.70), 0 0 30px ${accentColor}18`,
          overflow: 'hidden',
          animation: 'slide-up 0.25s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {/* Drag handle */}
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{
            display: 'flex', justifyContent: 'center',
            padding: '10px 0 6px',
            touchAction: 'none',
          }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: '0 16px 12px',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Type badge */}
            <div style={{
              display: 'inline-block',
              fontFamily: MONO, fontSize: 9, fontWeight: 700,
              letterSpacing: '0.10em',
              color: typeCfg.color,
              background: `${typeCfg.color}15`,
              border: `1px solid ${typeCfg.color}30`,
              borderRadius: 4, padding: '2px 6px',
              marginBottom: 6,
            }}>
              {typeCfg.label}
            </div>

            {/* Title */}
            <div style={{
              fontFamily: INTER, fontSize: 17, fontWeight: 700,
              color: 'rgba(225,235,255,0.95)', lineHeight: 1.3,
            }}>
              {note.title || '(Unnamed)'}
            </div>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: 'rgba(255,255,255,0.60)',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Summary */}
        {note.summary && (
          <div style={{
            padding: '0 16px 12px',
            fontFamily: INTER, fontSize: 14, lineHeight: 1.6,
            color: 'rgba(200,210,235,0.75)',
            maxHeight: 120, overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}>
            {note.summary}
          </div>
        )}

        {/* Meta: tags + time */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 16px 14px',
          flexWrap: 'wrap',
        }}>
          {note.tags.slice(0, 4).map(t => (
            <span key={t} style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontFamily: MONO, fontSize: 10,
              color: `${accentColor}aa`,
              background: `${accentColor}12`,
              border: `1px solid ${accentColor}25`,
              borderRadius: 4, padding: '2px 6px',
            }}>
              <Tag size={8} />
              {t}
            </span>
          ))}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontFamily: MONO, fontSize: 10,
            color: 'rgba(160,175,200,0.50)',
          }}>
            <Clock size={8} />
            {formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: zhCN })}
          </span>
        </div>

        {/* Pod picker (expanded) */}
        {showPods && (
          <div style={{
            display: 'flex', gap: 8, padding: '0 16px 12px',
            animation: 'fade-in 0.15s ease',
          }}>
            {PODS.map(pod => (
              <button
                key={pod.id}
                onClick={() => handleSendToPod(pod.id)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  fontFamily: MONO, fontSize: 11, fontWeight: 600,
                  color: pod.color,
                  background: `${pod.color}12`,
                  border: `1px solid ${pod.color}30`,
                  borderRadius: 10,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {pod.label}
              </button>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
          padding: '0 16px',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        }}>
          {/* Open Note */}
          <button
            onClick={() => { onNavigate?.(note.id); onClose(); }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '12px 4px',
              fontFamily: INTER, fontSize: 11, fontWeight: 500,
              color: 'rgba(220,230,250,0.85)',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              cursor: 'pointer',
            }}
          >
            <ExternalLink size={18} />
            <span>打开</span>
          </button>

          {/* Send to Pod */}
          <button
            onClick={() => setShowPods(v => !v)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '12px 4px',
              fontFamily: INTER, fontSize: 11, fontWeight: 500,
              color: showPods ? '#b496ff' : 'rgba(220,230,250,0.85)',
              background: showPods ? 'rgba(180,150,255,0.10)' : 'rgba(255,255,255,0.04)',
              border: showPods ? '1px solid rgba(180,150,255,0.30)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <Send size={18} />
            <span>发送</span>
          </button>

          {/* Connect */}
          <button
            onClick={handleConnect}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '12px 4px',
              fontFamily: INTER, fontSize: 11, fontWeight: 500,
              color: 'rgba(220,230,250,0.85)',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              cursor: 'pointer',
            }}
          >
            <Link2 size={18} />
            <span>连接</span>
          </button>

          {/* Delete */}
          <button
            onClick={handleDelete}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '12px 4px',
              fontFamily: INTER, fontSize: 11, fontWeight: 500,
              color: confirmDelete ? '#ff4466' : 'rgba(220,230,250,0.85)',
              background: confirmDelete ? 'rgba(255,68,102,0.10)' : 'rgba(255,255,255,0.04)',
              border: confirmDelete ? '1px solid rgba(255,68,102,0.30)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <Trash2 size={18} />
            <span>{confirmDelete ? '确认' : '删除'}</span>
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
