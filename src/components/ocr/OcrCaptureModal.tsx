/**
 * OcrCaptureModal — Full OCR capture flow
 * Phase 1: Upload/Camera → Phase 2: OCR → Phase 3: Candidate review → Phase 4: Done
 */
import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera, Upload, X, RotateCcw, Check, ChevronDown, ChevronUp,
  Loader2, Tag, Crosshair, Zap, FileText,
} from 'lucide-react';
import { useOcr } from '@/hooks/useOcr';
import { useAuth } from '@/hooks/useAuth';
import { useActiveUniverse } from '@/contexts/UniverseContext';
import { useCandidateNodes } from '@/hooks/useCandidateNodes';
import { supabase } from '@/integrations/supabase/client';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";
const ACCENT = '#66f0ff';

interface CandidateNode {
  type: 'topic' | 'keypoint' | 'action';
  title: string;
  summary: string;
  tags: string[];
  selected: boolean;
}

type Phase = 'upload' | 'ocr' | 'candidates' | 'done';

interface Props {
  onClose: () => void;
  onFlashNote?: (id: string) => void;
  onOpenStaging?: () => void;
  /** Pre-loaded image (e.g. from clipboard paste) — skips upload phase */
  initialImage?: File | null;
  /** Auto-trigger camera input on mount (mobile UX) */
  autoCamera?: boolean;
}

const TYPE_META: Record<string, { label: string; color: string; icon: typeof Tag }> = {
  topic:    { label: '主题', color: '#66f0ff', icon: Crosshair },
  keypoint: { label: '要点', color: '#b496ff', icon: FileText },
  action:   { label: '行动', color: '#ff4466', icon: Zap },
};

const NODE_TYPE_MAP: Record<string, string> = {
  topic: 'capture',
  keypoint: 'summary',
  action: 'action',
};

export function OcrCaptureModal({ onClose, onOpenStaging, initialImage, autoCamera }: Props) {
  const { user } = useAuth();
  const { activeUniverseId } = useActiveUniverse();
  const cn = useCandidateNodes(user?.id, activeUniverseId);
  const ocr = useOcr();

  const [phase, setPhase] = useState<Phase>('upload');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CandidateNode[]>([]);
  const [rawCleaned, setRawCleaned] = useState('');
  const [rawExpanded, setRawExpanded] = useState(false);
  const [structurizing, setStructurizing] = useState(false);
  const [writing, setWriting] = useState(false);
  const [writtenCount, setWrittenCount] = useState(0);
  const [structError, setStructError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const autoTriggered = useRef(false);

  /* ── Auto-start from initialImage or autoCamera ── */
  // Use useEffect-like pattern via ref check
  if (initialImage && phase === 'upload' && !autoTriggered.current) {
    autoTriggered.current = true;
    // Defer to avoid setState during render
    setTimeout(() => handleImage(initialImage), 0);
  }
  if (autoCamera && phase === 'upload' && !initialImage && !autoTriggered.current) {
    autoTriggered.current = true;
    setTimeout(() => cameraRef.current?.click(), 100);
  }

  /* ── Phase 1: Image selection ── */
  const handleImage = useCallback(async (file: File) => {
    // PDF: extract text directly, skip tesseract
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      setPhase('ocr');
      setStructurizing(true);
      try {
        const pdfText = await file.text();
        if (pdfText.trim().length < 5) {
          setStructError('PDF 文本过少，请尝试图片模式');
          setPhase('upload');
          setStructurizing(false);
          return;
        }
        await structurize(pdfText.trim().slice(0, 6000));
      } catch {
        setStructError('PDF 读取失败');
        setPhase('upload');
        setStructurizing(false);
      }
      return;
    }

    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setPhase('ocr');

    try {
      const text = await ocr.recognize(file);
      if (!text || text.trim().length < 5) {
        setStructError('识别到的文字太少，请换一张更清晰的图片');
        setPhase('upload');
        ocr.reset();
        return;
      }
      // Phase 2 → structurize
      await structurize(text);
    } catch {
      setPhase('upload');
    }
  }, [ocr]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleImage(f);
  };

  /* ── Phase 2→3: LLM structurize ── */
  const structurize = async (text: string) => {
    setStructurizing(true);
    setStructError(null);
    try {
      const { data, error } = await supabase.functions.invoke('ocr-structurize', {
        body: { raw_text: text },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || '结构化失败');

      const result = data.data;
      setCandidates(
        (result.candidates || []).map((c: Omit<CandidateNode, 'selected'>) => ({ ...c, selected: true }))
      );
      setRawCleaned(result.raw_cleaned || text);
      setPhase('candidates');
    } catch (e) {
      setStructError(e instanceof Error ? e.message : '结构化失败');
      setPhase('candidates');
      setCandidates([]);
      setRawCleaned(text);
    } finally {
      setStructurizing(false);
    }
  };

  /* ── Phase 3→4: Write to candidate staging ── */
  const handleConfirm = async () => {
    if (!user?.id || !activeUniverseId) return;
    const selected = candidates.filter(c => c.selected);
    if (selected.length === 0) return;

    setWriting(true);

    await cn.insertBatch(
      selected.map(c => ({
        candidate_type: c.type as 'topic' | 'keypoint' | 'action',
        title: c.title,
        summary: c.summary,
        tags: c.tags,
        source: 'ocr' as const,
        raw_text: rawCleaned || ocr.text,
      }))
    );

    setWrittenCount(selected.length);
    setPhase('done');
    setWriting(false);
  };

  /* ── Toggle candidate selection ── */
  const toggleCandidate = (idx: number) => {
    setCandidates(prev => prev.map((c, i) => i === idx ? { ...c, selected: !c.selected } : c));
  };

  const editCandidate = (idx: number, field: 'title' | 'summary', value: string) => {
    setCandidates(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  /* ── Reset to upload ── */
  const handleRetry = () => {
    ocr.reset();
    setPhase('upload');
    setImageUrl(null);
    setCandidates([]);
    setRawCleaned('');
    setStructError(null);
  };

  const selectedCount = candidates.filter(c => c.selected).length;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520, maxHeight: '85vh',
          background: 'rgba(8,12,24,0.97)',
          border: `1px solid ${ACCENT}20`,
          borderRadius: 14,
          boxShadow: `0 0 40px ${ACCENT}15`,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding: '14px 18px 12px',
          borderBottom: `1px solid rgba(255,255,255,0.06)`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT, boxShadow: `0 0 6px ${ACCENT}` }} />
            <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.10em', color: `${ACCENT}90`, textTransform: 'uppercase' }}>
              OCR 知识捕获
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={14} color="rgba(140,150,180,0.6)" />
          </button>
        </div>

        {/* ── Content ── */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 18px' }}>

          {/* Phase 1: Upload */}
          {phase === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
              {structError && (
                <div style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8,
                  background: 'rgba(255,68,102,0.08)', border: '1px solid rgba(255,68,102,0.20)',
                  fontFamily: INTER, fontSize: 11, color: 'rgba(255,68,102,0.80)',
                }}>
                  {structError}
                </div>
              )}

              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
                onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
                onDrop={e => {
                  e.preventDefault(); e.stopPropagation(); setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f && (f.type.startsWith('image/') || f.type === 'application/pdf')) handleImage(f);
                }}
                style={{
                  width: '100%', padding: '40px 20px',
                  border: `2px dashed ${dragOver ? `${ACCENT}80` : `${ACCENT}25`}`,
                  borderRadius: 12,
                  background: dragOver ? `${ACCENT}0a` : `${ACCENT}04`,
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { if (!dragOver) (e.currentTarget).style.borderColor = `${ACCENT}50`; }}
                onMouseLeave={e => { if (!dragOver) (e.currentTarget).style.borderColor = `${ACCENT}25`; }}
              >
                <Upload size={28} color={`${ACCENT}60`} />
                <span style={{ fontFamily: INTER, fontSize: 13, color: 'rgba(200,210,230,0.75)', fontWeight: 500 }}>
                  {dragOver ? '松开以识别' : '点击选择 / 拖放图片到此处'}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(120,130,160,0.50)', letterSpacing: '0.04em' }}>
                  支持 JPG / PNG / WebP / HEIC / PDF
                </span>
              </div>

              <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={onFileChange} style={{ display: 'none' }} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onFileChange} style={{ display: 'none' }} />

              <button
                onClick={() => cameraRef.current?.click()}
                style={{
                  width: '100%', padding: '11px 0',
                  fontFamily: MONO, fontSize: 10, letterSpacing: '0.07em',
                  color: `${ACCENT}90`,
                  background: `${ACCENT}08`,
                  border: `1px solid ${ACCENT}20`,
                  borderRadius: 8, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'background 0.15s',
                }}
              >
                <Camera size={13} />拍照识别
              </button>
            </div>
          )}

          {/* Phase 2: OCR in progress */}
          {phase === 'ocr' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="OCR source"
                  style={{ width: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 8, opacity: 0.7 }}
                />
              )}

              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Loader2
                    size={14}
                    color={ACCENT}
                    style={{ animation: 'spin 1s linear infinite' }}
                  />
                  <span style={{ fontFamily: INTER, fontSize: 12, color: 'rgba(200,210,230,0.80)' }}>
                    {ocr.status === 'loading' ? '加载识别引擎...' :
                     structurizing ? '正在结构化知识...' :
                     `正在识别文字 ${Math.round(ocr.progress * 100)}%`}
                  </span>
                </div>

                <div style={{
                  width: '100%', height: 4, borderRadius: 2,
                  background: 'rgba(255,255,255,0.06)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${structurizing ? 100 : Math.round(ocr.progress * 100)}%`,
                    height: '100%',
                    background: structurizing
                      ? `linear-gradient(90deg, ${ACCENT}, #b496ff)`
                      : ACCENT,
                    borderRadius: 2,
                    transition: 'width 0.3s ease',
                    ...(structurizing ? { animation: 'pulse 1.5s ease-in-out infinite' } : {}),
                  }} />
                </div>
              </div>
            </div>
          )}

          {/* Phase 3: Candidate review */}
          {phase === 'candidates' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Raw OCR text (collapsible) */}
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8, overflow: 'hidden',
              }}>
                <button
                  onClick={() => setRawExpanded(v => !v)}
                  style={{
                    width: '100%', padding: '8px 12px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(140,150,180,0.60)', letterSpacing: '0.05em' }}>
                    OCR 原始文本
                  </span>
                  {rawExpanded ? <ChevronUp size={12} color="rgba(140,150,180,0.5)" /> : <ChevronDown size={12} color="rgba(140,150,180,0.5)" />}
                </button>
                {rawExpanded && (
                  <div style={{
                    padding: '0 12px 10px',
                    fontFamily: INTER, fontSize: 11, color: 'rgba(180,190,210,0.65)',
                    lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 160, overflow: 'auto',
                  }}>
                    {rawCleaned || ocr.text}
                  </div>
                )}
              </div>

              {/* Candidate cards */}
              {candidates.length === 0 && structError && (
                <div style={{
                  padding: '16px', textAlign: 'center',
                  fontFamily: INTER, fontSize: 12, color: 'rgba(255,68,102,0.70)',
                }}>
                  {structError}
                </div>
              )}

              {candidates.map((c, idx) => {
                const meta = TYPE_META[c.type] || TYPE_META.topic;
                const Icon = meta.icon;
                return (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 14px',
                      background: c.selected ? `${meta.color}06` : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${c.selected ? `${meta.color}25` : 'rgba(255,255,255,0.06)'}`,
                      borderRadius: 10,
                      transition: 'all 0.15s',
                      opacity: c.selected ? 1 : 0.5,
                    }}
                  >
                    {/* Top row: checkbox + type badge + title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <button
                        onClick={() => toggleCandidate(idx)}
                        style={{
                          width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                          background: c.selected ? meta.color : 'transparent',
                          border: `1.5px solid ${c.selected ? meta.color : 'rgba(255,255,255,0.15)'}`,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.12s',
                        }}
                      >
                        {c.selected && <Check size={11} color="#040508" strokeWidth={3} />}
                      </button>

                      <span style={{
                        fontFamily: MONO, fontSize: 8, letterSpacing: '0.06em',
                        color: meta.color, background: `${meta.color}12`,
                        padding: '2px 7px', borderRadius: 4,
                        display: 'flex', alignItems: 'center', gap: 3,
                      }}>
                        <Icon size={9} />{meta.label}
                      </span>

                      <input
                        value={c.title}
                        onChange={e => editCandidate(idx, 'title', e.target.value)}
                        style={{
                          flex: 1, background: 'none', border: 'none', outline: 'none',
                          fontFamily: INTER, fontSize: 12, fontWeight: 600,
                          color: 'rgba(220,230,250,0.88)',
                        }}
                      />
                    </div>

                    {/* Summary (editable) */}
                    <textarea
                      value={c.summary}
                      onChange={e => editCandidate(idx, 'summary', e.target.value)}
                      rows={2}
                      style={{
                        width: '100%', background: 'none', border: 'none', outline: 'none', resize: 'none',
                        fontFamily: INTER, fontSize: 11, lineHeight: 1.55,
                        color: 'rgba(180,190,210,0.72)',
                        padding: '0 0 0 26px',
                      }}
                    />

                    {/* Tags */}
                    {c.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', paddingLeft: 26, marginTop: 4 }}>
                        {c.tags.map((t, ti) => (
                          <span key={ti} style={{
                            fontFamily: MONO, fontSize: 8, letterSpacing: '0.04em',
                            color: 'rgba(140,150,180,0.55)',
                            background: 'rgba(255,255,255,0.04)',
                            padding: '2px 6px', borderRadius: 3,
                          }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Phase 4: Done */}
          {phase === 'done' && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '30px 0',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: `${ACCENT}15`, border: `2px solid ${ACCENT}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Check size={22} color={ACCENT} />
              </div>
              <span style={{ fontFamily: INTER, fontSize: 14, fontWeight: 600, color: 'rgba(220,230,250,0.88)' }}>
                已生成 {writtenCount} 个候选节点
              </span>
              <span style={{ fontFamily: INTER, fontSize: 11, color: 'rgba(140,150,180,0.55)' }}>
                前往候选工作台审阅后发布到星图
              </span>
            </div>
          )}
        </div>

        {/* ── Footer actions ── */}
        <div style={{
          padding: '12px 18px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', gap: 8,
        }}>
          {phase === 'candidates' && (
            <>
              <button
                onClick={handleRetry}
                style={{
                  flex: 1, padding: '9px 0',
                  fontFamily: MONO, fontSize: 9, letterSpacing: '0.06em',
                  color: 'rgba(140,150,180,0.65)',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 7, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}
              >
                <RotateCcw size={10} />重新识别
              </button>
              <button
                onClick={handleConfirm}
                disabled={selectedCount === 0 || writing}
                style={{
                  flex: 2, padding: '9px 0',
                  fontFamily: MONO, fontSize: 10, letterSpacing: '0.07em',
                  color: selectedCount > 0 ? '#040508' : `${ACCENT}30`,
                  background: selectedCount > 0
                    ? `linear-gradient(135deg, ${ACCENT}, #40d0ff)`
                    : `${ACCENT}08`,
                  border: 'none', borderRadius: 7,
                  cursor: selectedCount > 0 ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  boxShadow: selectedCount > 0 ? `0 0 16px ${ACCENT}20` : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {writing ? (
                  <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Check size={12} />
                )}
                确认入图 ({selectedCount})
              </button>
            </>
          )}

          {phase === 'done' && (
            <>
              <button
                onClick={handleRetry}
                style={{
                  flex: 1, padding: '9px 0',
                  fontFamily: MONO, fontSize: 9, letterSpacing: '0.06em',
                  color: `${ACCENT}80`,
                  background: `${ACCENT}08`,
                  border: `1px solid ${ACCENT}20`,
                  borderRadius: 7, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}
              >
                <Camera size={10} />继续扫描
              </button>
              <button
                onClick={() => { onClose(); onOpenStaging?.(); }}
                style={{
                  flex: 1, padding: '9px 0',
                  fontFamily: MONO, fontSize: 9, letterSpacing: '0.06em',
                  color: '#040508',
                  background: 'linear-gradient(135deg, #ffa040, #ffb870)',
                  border: 'none',
                  borderRadius: 7, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  boxShadow: '0 2px 12px rgba(255,160,64,0.25)',
                }}
              >
                <Check size={10} />前往工作台
              </button>
            </>
          )}

          {phase === 'upload' && (
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: '9px 0',
                fontFamily: MONO, fontSize: 9, letterSpacing: '0.06em',
                color: 'rgba(140,150,180,0.55)',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 7, cursor: 'pointer',
              }}
            >
              取消
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
      `}</style>
    </div>,
    document.body
  );
}
