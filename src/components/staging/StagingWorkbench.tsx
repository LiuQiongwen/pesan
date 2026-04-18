/**
 * StagingWorkbench — Floating panel for reviewing candidate nodes
 * before publishing to the main star map.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  X, Minus, ChevronRight, Trash2, Check, Loader2,
  Crosshair, FileText, Zap, ScanLine, Sparkles, Import, Merge,
  CheckSquare, Square, AlertTriangle,
} from 'lucide-react';
import { useCandidateNodes, type CandidateType, type CandidateSource } from '@/hooks/useCandidateNodes';
import { useAuth } from '@/hooks/useAuth';
import { useActiveUniverse } from '@/contexts/UniverseContext';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

const TYPE_META: Record<CandidateType, { label: string; color: string; icon: typeof Crosshair; next: CandidateType }> = {
  topic:    { label: '主题', color: '#66f0ff', icon: Crosshair, next: 'keypoint' },
  keypoint: { label: '要点', color: '#b496ff', icon: FileText,  next: 'action' },
  action:   { label: '行动', color: '#ff4466', icon: Zap,       next: 'topic' },
};

const SOURCE_META: Record<CandidateSource, { label: string; icon: typeof ScanLine }> = {
  ocr:    { label: 'OCR',  icon: ScanLine },
  ai:     { label: 'AI',   icon: Sparkles },
  import: { label: '导入', icon: Import },
};

interface Props {
  onClose: () => void;
  onFlashNote?: (id: string) => void;
}

export function StagingWorkbench({ onClose, onFlashNote }: Props) {
  const { user } = useAuth();
  const { activeUniverseId } = useActiveUniverse();
  const cn = useCandidateNodes(user?.id, activeUniverseId);

  const [minimized, setMinimized] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sourceFilter, setSourceFilter] = useState<CandidateSource | null>(null);
  const [typeFilter, setTypeFilter] = useState<CandidateType | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [merging, setMerging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // ── Panel drag ───────────────────────────────────────────────
  const [position, setPosition] = useState(() => ({
    x: Math.round(window.innerWidth * 0.12),
    y: Math.round(window.innerHeight * 0.10),
  }));
  const dragOrigin = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  const onHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
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
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // ── Filtered candidates ──────────────────────────────────────
  const filtered = cn.candidates.filter(c => {
    if (sourceFilter && c.source !== sourceFilter) return false;
    if (typeFilter && c.candidate_type !== typeFilter) return false;
    return true;
  });

  // ── Selection helpers ────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(c => c.id)));
    }
  };

  // Clean up selection when candidates change
  useEffect(() => {
    setSelected(prev => {
      const ids = new Set(cn.candidates.map(c => c.id));
      const next = new Set([...prev].filter(id => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [cn.candidates]);

  // ── Actions ──────────────────────────────────────────────────
  const handlePublish = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setPublishing(true);
    await cn.publishCandidates(ids, onFlashNote);
    setSelected(new Set());
    setPublishing(false);
  };

  const handleDeleteSelected = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    await cn.deleteBatch(ids);
    setSelected(new Set());
  };

  const handleMerge = async () => {
    const ids = [...selected];
    if (ids.length < 2) return;
    setMerging(true);
    await cn.mergeCandidates(ids);
    setSelected(new Set());
    setMerging(false);
  };

  const cycleType = async (id: string, current: CandidateType) => {
    const next = TYPE_META[current].next;
    await cn.updateCandidate(id, { candidate_type: next });
  };

  const selectedCount = selected.size;
  const totalCount = cn.candidates.length;

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 56,
        width: minimized ? 280 : Math.min(680, window.innerWidth * 0.85),
        maxHeight: '80vh',
        background: 'rgba(3,7,22,0.96)',
        backdropFilter: 'blur(44px) saturate(1.9)',
        WebkitBackdropFilter: 'blur(44px) saturate(1.9)',
        borderRadius: 14,
        border: '1px solid rgba(102,240,255,0.12)',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 24px 80px rgba(0,0,0,0.75), 0 0 40px rgba(102,240,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'staging-in 0.22s cubic-bezier(0.22,1,0.36,1)',
        userSelect: 'none',
      }}
    >
      {/* ── Header ── */}
      <div
        onMouseDown={onHeaderMouseDown}
        style={{
          padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 8,
          borderBottom: minimized ? 'none' : '1px solid rgba(255,255,255,0.07)',
          cursor: 'grab',
        }}
      >
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ffa040', boxShadow: '0 0 6px #ffa040' }} />
        <span style={{
          fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.08em',
          color: 'rgba(255,160,64,0.80)', flex: 1,
        }}>
          候选工作台
        </span>

        {totalCount > 0 && (
          <span style={{
            fontFamily: MONO, fontSize: 8, letterSpacing: '0.05em',
            color: '#ffa040', background: 'rgba(255,160,64,0.12)',
            border: '1px solid rgba(255,160,64,0.25)',
            borderRadius: 4, padding: '1px 7px',
          }}>
            {totalCount} 待审
          </span>
        )}

        <button onClick={() => setMinimized(m => !m)} style={iconBtnStyle}>
          {minimized
            ? <ChevronRight size={10} color="rgba(140,150,175,0.65)" />
            : <Minus size={10} color="rgba(140,150,175,0.65)" />}
        </button>
        <button onClick={onClose} style={iconBtnStyle}>
          <X size={10} color="rgba(140,150,175,0.65)" />
        </button>
      </div>

      {/* ── Body ── */}
      {!minimized && (
        <>
          {/* Filter bar */}
          <div style={{
            padding: '8px 14px 6px', display: 'flex', gap: 4, flexWrap: 'wrap',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}>
            {/* Source filters */}
            <FilterChip label="全部" active={!sourceFilter} onClick={() => setSourceFilter(null)} color="#888" />
            {(['ocr', 'ai', 'import'] as CandidateSource[]).map(s => (
              <FilterChip
                key={s}
                label={SOURCE_META[s].label}
                active={sourceFilter === s}
                onClick={() => setSourceFilter(sourceFilter === s ? null : s)}
                color="#888"
              />
            ))}
            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.06)', margin: '0 4px', alignSelf: 'center' }} />
            {(['topic', 'keypoint', 'action'] as CandidateType[]).map(t => (
              <FilterChip
                key={t}
                label={TYPE_META[t].label}
                active={typeFilter === t}
                onClick={() => setTypeFilter(typeFilter === t ? null : t)}
                color={TYPE_META[t].color}
              />
            ))}
          </div>

          {/* Overflow warning */}
          {totalCount > 10 && (
            <div style={{
              margin: '8px 14px 0', padding: '6px 10px', borderRadius: 6,
              background: 'rgba(255,160,64,0.06)', border: '1px solid rgba(255,160,64,0.15)',
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: INTER, fontSize: 10, color: 'rgba(255,160,64,0.70)',
            }}>
              <AlertTriangle size={11} />
              已有 {totalCount} 个候选节点，建议先审阅发布再添加更多
            </div>
          )}

          {/* Card grid */}
          <div style={{
            flex: 1, overflow: 'auto', padding: '10px 14px',
            display: filtered.length > 0 ? 'grid' : 'flex',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 8,
            alignItems: filtered.length > 0 ? 'start' : 'center',
            justifyContent: filtered.length > 0 ? undefined : 'center',
            minHeight: 120,
          }}>
            {filtered.length === 0 && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: '32px 20px',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(255,160,64,0.06)', border: '1px solid rgba(255,160,64,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CheckSquare size={16} color="rgba(255,160,64,0.35)" />
                </div>
                <span style={{ fontFamily: INTER, fontSize: 12, color: 'rgba(140,150,180,0.55)' }}>
                  {cn.candidates.length === 0 ? '暂无候选节点' : '当前筛选无结果'}
                </span>
                {cn.candidates.length === 0 && (
                  <span style={{ fontFamily: INTER, fontSize: 10, color: 'rgba(100,110,140,0.40)', textAlign: 'center', maxWidth: 220 }}>
                    通过 OCR 扫描或 AI 提炼生成的候选节点会出现在这里
                  </span>
                )}
              </div>
            )}

            {filtered.map(c => {
              const meta = TYPE_META[c.candidate_type];
              const Icon = meta.icon;
              const isSelected = selected.has(c.id);
              const isEditing = editingId === c.id;

              return (
                <CandidateCard
                  key={c.id}
                  candidate={c}
                  meta={meta}
                  Icon={Icon}
                  isSelected={isSelected}
                  isEditing={isEditing}
                  onToggleSelect={() => toggleSelect(c.id)}
                  onStartEdit={() => setEditingId(c.id)}
                  onStopEdit={() => setEditingId(null)}
                  onCycleType={() => cycleType(c.id, c.candidate_type)}
                  onUpdateTitle={(v) => cn.updateCandidate(c.id, { title: v })}
                  onUpdateSummary={(v) => cn.updateCandidate(c.id, { summary: v })}
                  onDelete={() => cn.deleteCandidate(c.id)}
                />
              );
            })}
          </div>

          {/* Bottom action bar */}
          {cn.candidates.length > 0 && (
            <div style={{
              padding: '10px 14px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {/* Select all toggle */}
              <button onClick={toggleAll} style={{
                ...iconBtnStyle, width: 'auto', padding: '0 6px',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {selected.size === filtered.length && filtered.length > 0
                  ? <CheckSquare size={11} color="rgba(255,160,64,0.70)" />
                  : <Square size={11} color="rgba(140,150,175,0.50)" />}
                <span style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(140,150,180,0.55)' }}>
                  {selectedCount > 0 ? `已选 ${selectedCount}` : '全选'}
                </span>
              </button>

              <div style={{ flex: 1 }} />

              {/* Delete selected */}
              {selectedCount > 0 && (
                <button onClick={handleDeleteSelected} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '5px 10px',
                  fontFamily: MONO, fontSize: 8, letterSpacing: '0.05em',
                  color: 'rgba(255,68,102,0.70)',
                  background: 'rgba(255,68,102,0.06)',
                  border: '1px solid rgba(255,68,102,0.15)',
                  borderRadius: 6, cursor: 'pointer',
                }}>
                  <Trash2 size={10} />删除
                </button>
              )}

              {/* Merge */}
              {selectedCount >= 2 && (
                <button onClick={handleMerge} disabled={merging} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '5px 10px',
                  fontFamily: MONO, fontSize: 8, letterSpacing: '0.05em',
                  color: 'rgba(180,150,255,0.80)',
                  background: 'rgba(180,150,255,0.08)',
                  border: '1px solid rgba(180,150,255,0.20)',
                  borderRadius: 6, cursor: merging ? 'default' : 'pointer',
                }}>
                  {merging ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <Merge size={10} />}
                  合并
                </button>
              )}

              {/* Publish */}
              {selectedCount > 0 && (
                <button onClick={handlePublish} disabled={publishing} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 14px',
                  fontFamily: MONO, fontSize: 9, letterSpacing: '0.06em',
                  fontWeight: 600,
                  color: publishing ? 'rgba(255,160,64,0.50)' : '#040508',
                  background: publishing
                    ? 'rgba(255,160,64,0.15)'
                    : 'linear-gradient(135deg, #ffa040, #ffb870)',
                  border: 'none', borderRadius: 7,
                  cursor: publishing ? 'default' : 'pointer',
                  boxShadow: publishing ? 'none' : '0 2px 14px rgba(255,160,64,0.30)',
                }}>
                  {publishing
                    ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Check size={11} />}
                  发布入图 ({selectedCount})
                </button>
              )}
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes staging-in { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Candidate Card ──────────────────────────────────────────────
function CandidateCard({
  candidate: c, meta, Icon, isSelected, isEditing,
  onToggleSelect, onStartEdit, onStopEdit, onCycleType,
  onUpdateTitle, onUpdateSummary, onDelete,
}: {
  candidate: { id: string; candidate_type: CandidateType; source: CandidateSource; title: string; summary: string; tags: string[]; created_at: string };
  meta: { label: string; color: string };
  Icon: typeof Crosshair;
  isSelected: boolean;
  isEditing: boolean;
  onToggleSelect: () => void;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onCycleType: () => void;
  onUpdateTitle: (v: string) => void;
  onUpdateSummary: (v: string) => void;
  onDelete: () => void;
}) {
  const sourceMeta = SOURCE_META[c.source];
  const SourceIcon = sourceMeta.icon;

  return (
    <div
      onDoubleClick={() => { if (!isEditing) onStartEdit(); }}
      style={{
        padding: '10px 12px',
        background: isSelected ? `${meta.color}08` : 'rgba(255,255,255,0.02)',
        border: `1px solid ${isSelected ? `${meta.color}30` : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 10,
        transition: 'all 0.15s',
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {/* Checkbox */}
        <button onClick={onToggleSelect} style={{
          width: 16, height: 16, borderRadius: 3, flexShrink: 0,
          background: isSelected ? meta.color : 'transparent',
          border: `1.5px solid ${isSelected ? meta.color : 'rgba(255,255,255,0.15)'}`,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isSelected && <Check size={10} color="#040508" strokeWidth={3} />}
        </button>

        {/* Type badge (clickable to cycle) */}
        <button onClick={onCycleType} title="切换类型" style={{
          fontFamily: MONO, fontSize: 7.5, letterSpacing: '0.05em',
          color: meta.color, background: `${meta.color}12`,
          border: `1px solid ${meta.color}25`,
          padding: '1px 6px', borderRadius: 4, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 3,
        }}>
          <Icon size={8} />{meta.label}
        </button>

        {/* Source badge */}
        <span style={{
          fontFamily: MONO, fontSize: 7, letterSpacing: '0.04em',
          color: 'rgba(140,150,180,0.45)',
          display: 'flex', alignItems: 'center', gap: 2,
        }}>
          <SourceIcon size={8} />{sourceMeta.label}
        </span>

        <div style={{ flex: 1 }} />

        {/* Delete */}
        <button onClick={onDelete} style={{
          ...iconBtnStyle, width: 18, height: 18,
        }}>
          <X size={8} color="rgba(140,150,175,0.45)" />
        </button>
      </div>

      {/* Title */}
      {isEditing ? (
        <input
          autoFocus
          defaultValue={c.title}
          onBlur={e => { onUpdateTitle(e.target.value); onStopEdit(); }}
          onKeyDown={e => { if (e.key === 'Enter') { onUpdateTitle((e.target as HTMLInputElement).value); onStopEdit(); } }}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 4, padding: '3px 6px', outline: 'none',
            fontFamily: INTER, fontSize: 11.5, fontWeight: 600,
            color: 'rgba(220,230,250,0.90)',
            marginBottom: 4,
          }}
        />
      ) : (
        <div style={{
          fontFamily: INTER, fontSize: 11.5, fontWeight: 600,
          color: 'rgba(220,230,250,0.88)',
          lineHeight: 1.35, marginBottom: 4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {c.title || '(未命名)'}
        </div>
      )}

      {/* Summary */}
      {isEditing ? (
        <textarea
          defaultValue={c.summary}
          onBlur={e => { onUpdateSummary(e.target.value); onStopEdit(); }}
          rows={3}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 4, padding: '3px 6px', outline: 'none', resize: 'none',
            fontFamily: INTER, fontSize: 10, lineHeight: 1.55,
            color: 'rgba(180,190,210,0.72)',
            marginBottom: 4,
          }}
        />
      ) : (
        c.summary && (
          <p style={{
            fontFamily: INTER, fontSize: 10, lineHeight: 1.5,
            color: 'rgba(160,170,200,0.60)',
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
            overflow: 'hidden', margin: '0 0 4px',
          }}>
            {c.summary}
          </p>
        )
      )}

      {/* Tags */}
      {c.tags.length > 0 && !isEditing && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {c.tags.slice(0, 4).map((t, i) => (
            <span key={i} style={{
              fontFamily: MONO, fontSize: 7, letterSpacing: '0.04em',
              color: 'rgba(100,110,145,0.55)',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 3, padding: '1px 5px',
            }}>
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Filter chip ─────────────────────────────────────────────────
function FilterChip({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick} style={{
      fontFamily: MONO, fontSize: 8, letterSpacing: '0.04em',
      color: active ? color : 'rgba(120,130,160,0.50)',
      background: active ? `${color}12` : 'transparent',
      border: `1px solid ${active ? `${color}25` : 'transparent'}`,
      borderRadius: 4, padding: '2px 8px', cursor: 'pointer',
      transition: 'all 0.12s',
    }}>
      {label}
    </button>
  );
}

const iconBtnStyle: React.CSSProperties = {
  width: 22, height: 22,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 5, cursor: 'pointer',
};
