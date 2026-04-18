/**
 * WorkbenchPanel — floating temporary workbench for 2-5 knowledge nodes.
 * Supports node comparison, AI quick-actions, reordering, combining, and collapse.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  X, Minus, Layers3, Radar, FlaskConical, Zap,
  GripVertical, Sparkles, ChevronRight, Orbit,
} from 'lucide-react';
import type { CosmosNote } from './cosmos-layout';
import { supabase } from '@/integrations/supabase/client';
import { useHintState } from '@/hooks/useHintState';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

// ── Node type display ─────────────────────────────────────────────────────────
const NODE_TYPE_META: Record<string, { label: string; color: string }> = {
  capture:  { label: 'Capture',  color: '#00ff66' },
  insight:  { label: 'Insight',  color: '#b496ff' },
  action:   { label: 'Action',   color: '#ff4466' },
  question: { label: 'Question', color: '#66f0ff' },
};

function typeColor(note: CosmosNote) {
  return NODE_TYPE_META[note.node_type ?? 'capture']?.color ?? '#888fa8';
}

function typeLabel(note: CosmosNote) {
  return NODE_TYPE_META[note.node_type ?? 'capture']?.label ?? note.node_type ?? '—';
}

// ── Panel border gradient from node colors ────────────────────────────────────
function mixColors(notes: CosmosNote[]): string {
  const colors = notes.map(typeColor);
  if (colors.length === 0) return 'rgba(102,240,255,0.25)';
  if (colors.length === 1) return `${colors[0]}40`;
  return `linear-gradient(135deg, ${colors.map((c, i) => `${c}40 ${Math.round((i / (colors.length - 1)) * 100)}%`).join(', ')})`;
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface WorkbenchPanelProps {
  notes:        CosmosNote[];
  onRemoveNote: (id: string) => void;
  onClose:      () => void;
  onFlashNote:  (id: string) => void;
  onDropToPod:  (noteId: string, podId: string) => void;
  onCombine:    (noteIds: string[]) => Promise<void>;
  userId?:      string;
}

export function WorkbenchPanel({
  notes, onRemoveNote, onClose, onFlashNote, onDropToPod, onCombine,
}: WorkbenchPanelProps) {
  const [minimized,    setMinimized]    = useState(false);
  const [combining,    setCombining]    = useState(false);
  const [combineDone,  setCombineDone]  = useState(false);
  const [noteOrder,    setNoteOrder]    = useState<string[]>(() => notes.map(n => n.id));
  const hints = useHintState();
  const showEmptyHint = hints.shouldShowHint('workbench_empty');
  const [position,     setPosition]     = useState(() => ({
    x: Math.round(window.innerWidth * 0.55),
    y: Math.round(window.innerHeight * 0.18),
  }));

  // Keep noteOrder synced with notes prop changes
  useEffect(() => {
    setNoteOrder(prev => {
      const newIds  = notes.map(n => n.id);
      const kept    = prev.filter(id => newIds.includes(id));
      const added   = newIds.filter(id => !prev.includes(id));
      return [...kept, ...added];
    });
    if (notes.length > 0) hints.markCompleted('workbench_empty');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  // Ordered notes for display
  const orderedNotes = noteOrder
    .map(id => notes.find(n => n.id === id))
    .filter(Boolean) as CosmosNote[];

  // ── Panel drag ───────────────────────────────────────────────────────────
  const panelRef    = useRef<HTMLDivElement>(null);
  const dragOrigin  = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  const onHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return; // don't drag on buttons
    dragOrigin.current = { mx: e.clientX, my: e.clientY, px: position.x, py: position.y };
    e.preventDefault();
  }, [position]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragOrigin.current) return;
      setPosition({
        x: dragOrigin.current.px + (e.clientX - dragOrigin.current.mx),
        y: dragOrigin.current.py + (e.clientY - dragOrigin.current.my),
      });
    };
    const onUp = () => { dragOrigin.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, []);

  // ── Card drag-to-reorder ─────────────────────────────────────────────────
  const dragCardRef = useRef<{ id: string; startX: number; startIdx: number } | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const onCardGripDown = (e: React.MouseEvent, id: string, idx: number) => {
    dragCardRef.current = { id, startX: e.clientX, startIdx: idx };
    e.preventDefault();
    e.stopPropagation();
  };

  useEffect(() => {
    const CARD_W = 196; // approximate card width + gap
    const onMove = (e: MouseEvent) => {
      if (!dragCardRef.current) return;
      const dx    = e.clientX - dragCardRef.current.startX;
      const delta = Math.round(dx / CARD_W);
      const newIdx = Math.max(0, Math.min(orderedNotes.length - 1, dragCardRef.current.startIdx + delta));
      setDragOverIdx(newIdx);
    };
    const onUp = () => {
      if (dragCardRef.current && dragOverIdx !== null) {
        const { id, startIdx } = dragCardRef.current;
        if (dragOverIdx !== startIdx) {
          setNoteOrder(prev => {
            const arr  = [...prev];
            const from = arr.indexOf(id);
            arr.splice(from, 1);
            arr.splice(dragOverIdx, 0, id);
            return arr;
          });
        }
      }
      dragCardRef.current = null;
      setDragOverIdx(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [orderedNotes.length, dragOverIdx]);

  // ── Combine ───────────────────────────────────────────────────────────────
  const handleCombine = async () => {
    if (combining || orderedNotes.length < 2) return;
    setCombining(true);
    try {
      await onCombine(orderedNotes.map(n => n.id));
      setCombineDone(true);
      setTimeout(() => setCombineDone(false), 3000);
    } finally {
      setCombining(false);
    }
  };

  // ── Border style (neon rim from note colors) ──────────────────────────────
  const borderGradient = mixColors(orderedNotes);
  const hasBorderGrad  = borderGradient.startsWith('linear-gradient');

  return (
    <div
      ref={panelRef}
      style={{
        position:   'fixed',
        left:       position.x,
        top:        position.y,
        zIndex:     55,
        width:      minimized ? 260 : Math.min(
          orderedNotes.length * 200 + 64,
          window.innerWidth * 0.82
        ),
        background: 'rgba(3,7,22,0.95)',
        backdropFilter: 'blur(44px) saturate(1.9)',
        WebkitBackdropFilter: 'blur(44px) saturate(1.9)',
        borderRadius: 14,
        // Simulate gradient border with box-shadow + pseudo-rim
        border: `1px solid ${hasBorderGrad ? 'transparent' : borderGradient}`,
        boxShadow: hasBorderGrad
          ? `0 0 0 1px rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.06), 0 24px 80px rgba(0,0,0,0.75)`
          : `0 0 0 1px rgba(255,255,255,0.08), 0 24px 80px rgba(0,0,0,0.75)`,
        animation: 'wb-panel-in 0.22s cubic-bezier(0.22,1,0.36,1)',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Gradient border rim overlay (cosmetic) */}
      {hasBorderGrad && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 14, zIndex: 0,
          padding: 1, pointerEvents: 'none',
          background: borderGradient,
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }} />
      )}

      {/* Header — draggable */}
      <div
        onMouseDown={onHeaderMouseDown}
        style={{
          position: 'relative', zIndex: 1,
          padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 8,
          borderBottom: minimized ? 'none' : '1px solid rgba(255,255,255,0.07)',
          cursor: 'grab',
        }}
      >
        <Layers3 size={12} color="#66f0ff" style={{ flexShrink: 0 }} />
        <span style={{
          fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.08em',
          color: 'rgba(140,200,230,0.75)', flex: 1, whiteSpace: 'nowrap',
        }}>
          临时工作台 · {orderedNotes.length} nodes
        </span>

        {/* Minimize */}
        <button
          onClick={() => setMinimized(m => !m)}
          style={iconBtnStyle}
          title={minimized ? '展开' : '收起'}
        >
          {minimized
            ? <ChevronRight size={10} color="rgba(140,150,175,0.65)" />
            : <Minus       size={10} color="rgba(140,150,175,0.65)" />}
        </button>

        {/* Close */}
        <button onClick={onClose} style={iconBtnStyle} title="关闭工作台">
          <X size={10} color="rgba(140,150,175,0.65)" />
        </button>
      </div>

      {/* Body — hidden when minimized */}
      {!minimized && (
        <div style={{ position: 'relative', zIndex: 1, padding: '12px 14px 14px' }}>

          {/* Node cards row */}
          {orderedNotes.length > 0 ? (<>
          <div style={{
            display: 'flex', gap: 10,
            overflowX: 'auto',
            paddingBottom: 4,
          }}>
            {orderedNotes.map((note, idx) => {
              const color = typeColor(note);
              const isDragOver = dragOverIdx === idx;
              return (
                <div
                  key={note.id}
                  onMouseEnter={() => onFlashNote(note.id)}
                  style={{
                    flexShrink: 0,
                    width: 184,
                    background: isDragOver
                      ? `${color}14`
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isDragOver ? `${color}55` : `${color}25`}`,
                    borderRadius: 10,
                    padding: '10px 10px 9px',
                    transition: 'border-color 0.14s, background 0.14s',
                    cursor: 'default',
                    position: 'relative',
                  }}
                >
                  {/* Card header row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 7 }}>
                    {/* Drag handle */}
                    <div
                      onMouseDown={e => onCardGripDown(e, note.id, idx)}
                      style={{ flexShrink: 0, cursor: 'grab', paddingTop: 1 }}
                    >
                      <GripVertical size={11} color="rgba(100,110,140,0.40)" />
                    </div>

                    {/* Type dot */}
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: color, flexShrink: 0, marginTop: 3,
                      boxShadow: `0 0 6px ${color}`,
                    }} />

                    {/* Title */}
                    <span style={{
                      fontFamily: INTER, fontSize: 11.5, fontWeight: 600,
                      color: 'rgba(215,225,248,0.90)',
                      lineHeight: 1.35,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      flex: 1,
                    }}>
                      {note.title || '(未命名)'}
                    </span>

                    {/* Remove */}
                    <button
                      onClick={() => onRemoveNote(note.id)}
                      style={{
                        ...iconBtnStyle,
                        width: 18, height: 18, flexShrink: 0,
                        marginTop: -2, marginRight: -3,
                      }}
                    >
                      <X size={8} color="rgba(140,150,175,0.50)" />
                    </button>
                  </div>

                  {/* Type badge */}
                  <div style={{ marginBottom: 6 }}>
                    <span style={{
                      fontFamily: MONO, fontSize: 7.5, letterSpacing: '0.07em',
                      color, background: `${color}18`,
                      border: `1px solid ${color}30`,
                      borderRadius: 4, padding: '1px 6px',
                    }}>
                      {typeLabel(note)}
                    </span>
                  </div>

                  {/* Summary excerpt */}
                  {note.summary && (
                    <p style={{
                      fontFamily: INTER, fontSize: 10, lineHeight: 1.5,
                      color: 'rgba(160,170,200,0.62)',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      margin: '0 0 8px',
                    }}>
                      {note.summary}
                    </p>
                  )}

                  {/* Tags */}
                  {(note.tags ?? []).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
                      {(note.tags ?? []).slice(0, 3).map(tag => (
                        <span key={tag} style={{
                          fontFamily: MONO, fontSize: 7, letterSpacing: '0.05em',
                          color: 'rgba(100,110,145,0.65)',
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 4, padding: '1px 5px',
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Quick-action buttons */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    <QuickBtn
                      icon={<Radar size={9} />}
                      label="检索"
                      accent="#66f0ff"
                      onClick={() => onDropToPod(note.id, 'retrieval')}
                    />
                    <QuickBtn
                      icon={<FlaskConical size={9} />}
                      label="洞见"
                      accent="#b496ff"
                      onClick={() => onDropToPod(note.id, 'insight')}
                    />
                    <QuickBtn
                      icon={<Zap size={9} />}
                      label="行动"
                      accent="#ff4466"
                      onClick={() => onDropToPod(note.id, 'action')}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '12px 0 10px' }} />

          {/* Bottom action row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Node count context */}
            <div style={{
              fontFamily: MONO, fontSize: 8, color: 'rgba(80,90,115,0.55)',
              letterSpacing: '0.05em',
            }}>
              {orderedNotes.length} 个节点已就绪 · Shift+点击可添加更多
            </div>

            {/* Combine button */}
            {orderedNotes.length >= 2 && (
              <button
                onClick={handleCombine}
                disabled={combining}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px',
                  fontFamily: INTER, fontSize: 11, fontWeight: 600,
                  color: combineDone ? '#00ff66' : '#040b10',
                  background: combineDone
                    ? 'rgba(0,255,102,0.12)'
                    : combining
                      ? 'rgba(180,150,255,0.50)'
                      : 'linear-gradient(135deg, #b496ff, #c8aaff)',
                  border: combineDone ? '1px solid rgba(0,255,102,0.30)' : 'none',
                  borderRadius: 7, cursor: combining ? 'default' : 'pointer',
                  boxShadow: combining || combineDone ? 'none' : '0 2px 14px rgba(180,150,255,0.40)',
                  transition: 'all 0.18s',
                  whiteSpace: 'nowrap',
                }}
              >
                <Sparkles size={10} />
                {combineDone ? '已融合为新节点' : combining ? '融合中…' : '融合成新节点'}
              </button>
            )}
          </div>
          </>) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 8, padding: '28px 16px',
              border: '1px dashed rgba(102,240,255,0.12)',
              borderRadius: 10,
              background: 'rgba(102,240,255,0.02)',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(102,240,255,0.05)',
                border: '1px solid rgba(102,240,255,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Orbit size={16} color="rgba(102,240,255,0.40)" strokeWidth={1.3} />
              </div>
              <span style={{
                fontFamily: INTER, fontSize: 12, fontWeight: 500,
                color: 'rgba(140,200,230,0.70)',
              }}>
                {showEmptyHint ? '拖入 2–5 个节点，开始整理' : '从星图拖入节点'}
              </span>
              {showEmptyHint && (
                <span style={{
                  fontFamily: INTER, fontSize: 10,
                  color: 'rgba(102,240,255,0.30)', lineHeight: 1.6, textAlign: 'center',
                  maxWidth: 220,
                }}>
                  这里适合比较、合并、提炼，再把结果发布回宇宙
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes wb-panel-in {
          from { opacity: 0; transform: scale(0.88); }
          to   { opacity: 1; transform: scale(1);    }
        }
      `}</style>
    </div>
  );
}

// ── Helper: quick-action button ───────────────────────────────────────────────
function QuickBtn({
  icon, label, accent, onClick,
}: { icon: React.ReactNode; label: string; accent: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
        padding: '4px 0',
        fontFamily: MONO, fontSize: 8, letterSpacing: '0.05em',
        color: accent,
        background: `${accent}12`,
        border: `1px solid ${accent}28`,
        borderRadius: 5, cursor: 'pointer',
        transition: 'background 0.13s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${accent}22`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${accent}12`; }}
    >
      {icon} {label}
    </button>
  );
}

const iconBtnStyle: React.CSSProperties = {
  width: 22, height: 22,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 5, cursor: 'pointer',
  transition: 'background 0.12s',
};
