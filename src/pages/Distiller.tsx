import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ChevronDown, ChevronRight, FlaskConical, Sparkles,
  BookOpen, CircleDot, MessageSquare, Layers, Zap,
  ArrowRight, Copy, Check, RotateCcw,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { useDistillations, DistillResult } from '@/hooks/useDistillations';

// Design tokens
const C = {
  bg:       '#0a0b0d',
  surface:  '#0e1012',
  border:   '#1e2226',
  text:     '#dde1e8',
  textSub:  '#7a7f8a',
  textMute: '#4a4f5a',
  accent:   '#00ff66',
};
const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

const LAYERS = [
  { id: 'facts'    as const, key: 'facts_markdown'    as const, label: 'Facts',         Icon: CircleDot,     color: '#66e3ff', bg: 'rgba(102,227,255,0.04)', desc: 'Verified claims & data' },
  { id: 'opinions' as const, key: 'opinions_markdown' as const, label: 'Viewpoints',    Icon: MessageSquare, color: '#b49cff', bg: 'rgba(180,156,255,0.04)', desc: 'Perspectives & assertions' },
  { id: 'methods'  as const, key: 'methods_markdown'  as const, label: 'Methods',       Icon: Layers,        color: '#00ff66', bg: 'rgba(0,255,102,0.04)',   desc: 'Frameworks & processes' },
  { id: 'insights' as const, key: 'insights_markdown' as const, label: 'Insights',      Icon: Sparkles,      color: '#ffaa44', bg: 'rgba(255,170,68,0.06)',  desc: 'Non-obvious patterns', special: true as const },
  { id: 'actions'  as const, key: 'actions_markdown'  as const, label: 'Next Actions',  Icon: Zap,           color: '#00d4aa', bg: 'rgba(0,212,170,0.04)',   desc: 'Executable takeaways' },
];

type LayerId = 'facts' | 'opinions' | 'methods' | 'insights' | 'actions';

const STEPS = [
  'Parsing source content',
  'Extracting factual claims',
  'Identifying viewpoints',
  'Mapping methods & frameworks',
  'Surfacing hidden patterns',
  'Generating next actions',
  'Scoring confidence',
  'Finalizing output',
];

function countItems(md: string | null): number {
  if (!md) return 0;
  return (md.match(/^[-0-9→]/gm) || []).length;
}

export default function Distiller() {
  const { user }       = useAuth();
  const { notes }      = useNotes(user?.id);
  const { save }       = useDistillations(user?.id);
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const noteId         = searchParams.get('noteId');
  const t              = useT();
  const { lang }       = useLanguage();

  const [sourceText, setSourceText] = useState('');
  const [noteTitle, setNoteTitle]   = useState('');
  const [result, setResult]         = useState<DistillResult | null>(null);
  const [loading, setLoading]       = useState(false);
  const [step, setStep]             = useState(0);
  const [progress, setProgress]     = useState(0);
  const [expanded, setExpanded]     = useState<Set<LayerId>>(new Set(['facts', 'insights', 'actions']));
  const [copied, setCopied]         = useState<string | null>(null);
  const [savedId, setSavedId]       = useState<string | null>(null);

  useEffect(() => {
    if (!noteId || !notes.length) return;
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    const parts = [
      note.title,
      note.summary,
      ...(note.key_points || []),
      note.analysis_markdown || note.summary_markdown || note.content_markdown,
    ].filter(Boolean) as string[];
    const text = parts.join('\n\n');
    setSourceText(text);
    setNoteTitle(note.title || '');
  }, [noteId, notes]);

  const relatedNotes = useMemo(() => {
    if (!result?.tags?.length) return [];
    return notes.filter(n => (n.tags || []).some(t => result.tags.includes(t))).slice(0, 4);
  }, [result, notes]);

  const toggleLayer = (id: LayerId) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const copyLayer = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDistill = async () => {
    if (!sourceText.trim() || loading) return;
    setLoading(true);
    setResult(null);
    setSavedId(null);
    setStep(0);
    setProgress(0);

    const iv = setInterval(() => {
      setStep(s => { if (s >= STEPS.length - 2) { clearInterval(iv); return s; } return s + 1; });
      setProgress(p => Math.min(p + 11, 85));
    }, 500);

    try {
      const { data, error } = await supabase.functions.invoke('distill-insight', {
        body: { content: sourceText, noteId },
      });
      clearInterval(iv);
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Distillation failed');

      setStep(STEPS.length - 1);
      setProgress(100);

      const r = data.data as DistillResult;
      setResult(r);
      setExpanded(new Set(['facts', 'insights', 'actions']));

      const saved = await save({
        note_id: noteId || null, title: r.title, source_text: sourceText,
        source_label: r.source_label, confidence: r.confidence, key_insight: r.key_insight,
        facts_markdown: r.facts_markdown, opinions_markdown: r.opinions_markdown,
        methods_markdown: r.methods_markdown, insights_markdown: r.insights_markdown,
        actions_markdown: r.actions_markdown, tags: r.tags || [],
      });
      if (saved) setSavedId(saved.id);
    } catch (e) {
      clearInterval(iv);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null); setSourceText(''); setNoteTitle('');
    setStep(0); setProgress(0); setSavedId(null);
    navigate('/distiller');
  };

  const confPct = result ? Math.round(result.confidence * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg, overflow: 'hidden', fontFamily: INTER }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(0,255,102,0.08)', border: '1px solid rgba(0,255,102,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FlaskConical size={13} color={C.accent} />
          </div>
          <div>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: C.text, letterSpacing: '0.12em' }}>INSIGHT DISTILLER</span>
            {noteTitle && <span style={{ fontFamily: MONO, fontSize: 10, color: C.textMute, marginLeft: 12 }}>← {noteTitle.slice(0, 32)}{noteTitle.length > 32 ? '…' : ''}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {savedId && <span style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(0,212,170,0.70)', letterSpacing: '0.06em' }}>✓ saved</span>}
          {(result || sourceText) && (
            <button onClick={handleReset} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 5, padding: '5px 10px', fontFamily: MONO, fontSize: 10, color: C.textSub, cursor: 'pointer' }}>
              <RotateCcw size={10} /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Split pane */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* LEFT: Source */}
        <div style={{ width: '40%', minWidth: 300, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
          <div style={{ padding: '14px 20px 10px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, color: C.textMute, letterSpacing: '0.10em', marginBottom: 4 }}>{lang === 'zh' ? '内容来源' : 'SOURCE CONTENT'}</div>
            {noteId
              ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: MONO, fontSize: 9.5, color: 'rgba(102,227,255,0.65)', background: 'rgba(102,227,255,0.07)', border: '1px solid rgba(102,227,255,0.15)', borderRadius: 3, padding: '2px 7px', letterSpacing: '0.08em' }}>{lang === 'zh' ? '来自笔记' : 'FROM NOTE'}</span>
                  {noteTitle && <span style={{ fontFamily: INTER, fontSize: 12, color: C.textSub }}>{noteTitle}</span>}
                </div>
              : <div style={{ fontFamily: INTER, fontSize: 12, color: C.textSub }}>{lang === 'zh' ? '粘贴任意内容进行提炼' : 'Paste any content to distill'}</div>
            }
          </div>

          <textarea
            value={sourceText}
            onChange={e => setSourceText(e.target.value)}
            placeholder={lang === 'zh' ? '粘贴文章、笔记、PDF内容、研究材料等——提炼器将萃取精华。' : "Paste article, transcript, note, PDF content, research, or any text — the distiller extracts what matters."}
            style={{ flex: 1, resize: 'none', background: 'transparent', border: 'none', outline: 'none', padding: '16px 20px', fontFamily: MONO, fontSize: 12, color: C.text, lineHeight: 1.65, overflowY: 'auto' }}
            disabled={loading}
          />

          <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontFamily: MONO, fontSize: 10, color: C.textMute }}>{sourceText.length.toLocaleString()} chars</span>
              {sourceText.length > 0 && <span style={{ fontFamily: MONO, fontSize: 10, color: C.textMute }}>~{Math.round(sourceText.length / 5)} words</span>}
            </div>
            <button
              onClick={handleDistill}
              disabled={!sourceText.trim() || loading}
              style={{ width: '100%', padding: '10px 0', borderRadius: 6, background: sourceText.trim() && !loading ? C.accent : 'rgba(0,255,102,0.12)', border: 'none', cursor: sourceText.trim() && !loading ? 'pointer' : 'not-allowed', fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', color: sourceText.trim() && !loading ? '#040508' : 'rgba(0,255,102,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s' }}
            >
              {loading ? 'Processing…' : <><FlaskConical size={12} /> DISTILL <ArrowRight size={12} /></>}
            </button>
          </div>
        </div>

        {/* RIGHT: Output */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.bg }}>

          {loading && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 40 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(0,255,102,0.08)', border: '1px solid rgba(0,255,102,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FlaskConical size={16} color={C.accent} />
              </div>
              <div style={{ width: '100%', maxWidth: 360 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: C.accent, letterSpacing: '0.08em' }}>{STEPS[step]}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: C.textMute }}>{progress}%</span>
                </div>
                <div style={{ height: 2, background: C.border, borderRadius: 1 }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: C.accent, borderRadius: 1, transition: 'width 0.4s ease', boxShadow: '0 0 8px rgba(0,255,102,0.5)' }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 360 }}>
                {STEPS.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: i < step ? C.accent : i === step ? '#ffaa44' : C.border, transition: 'background 0.3s', boxShadow: i === step ? '0 0 6px #ffaa44' : 'none', flexShrink: 0 }} />
                    <span style={{ fontFamily: MONO, fontSize: 10, color: i <= step ? C.textSub : C.textMute, transition: 'color 0.3s', letterSpacing: '0.04em' }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && !result && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 32 }}>
              <div style={{ textAlign: 'center', maxWidth: 400 }}>
                <div style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(0,255,102,0.50)', letterSpacing: '0.14em', marginBottom: 12 }}>KNOWLEDGE REFINEMENT ENGINE</div>
                <div style={{ fontFamily: INTER, fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 10, lineHeight: 1.3 }}>Raw input.<br />Structured intelligence.</div>
                <div style={{ fontFamily: INTER, fontSize: 13, color: C.textSub, lineHeight: 1.7 }}>
                  Paste any content on the left. The distiller extracts what's worth keeping — classified, layered, and ready for long-term reuse.
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, width: '100%', maxWidth: 380 }}>
                {LAYERS.map(l => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px', borderBottom: `1px solid ${C.border}`, opacity: 0.55 }}>
                    <div style={{ width: 3, height: 16, borderRadius: 2, background: l.color, flexShrink: 0 }} />
                    <l.Icon size={12} color={l.color} />
                    <span style={{ fontFamily: MONO, fontSize: 10, color: C.text, letterSpacing: '0.08em', flex: 1 }}>{l.label.toUpperCase()}</span>
                    <span style={{ fontFamily: INTER, fontSize: 11, color: C.textMute }}>{l.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && result && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Metadata */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: MONO, fontSize: 9.5, color: 'rgba(102,227,255,0.7)', background: 'rgba(102,227,255,0.07)', border: '1px solid rgba(102,227,255,0.15)', borderRadius: 3, padding: '2.5px 8px', letterSpacing: '0.08em' }}>
                  {result.source_label?.toUpperCase() || 'CONTENT'}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 9.5, color: confPct >= 75 ? 'rgba(0,255,102,0.70)' : 'rgba(255,170,68,0.70)', background: confPct >= 75 ? 'rgba(0,255,102,0.07)' : 'rgba(255,170,68,0.07)', border: `1px solid ${confPct >= 75 ? 'rgba(0,255,102,0.15)' : 'rgba(255,170,68,0.15)'}`, borderRadius: 3, padding: '2.5px 8px', letterSpacing: '0.08em' }}>
                  CONFIDENCE {confPct}%
                </span>
                {relatedNotes.length > 0 && (
                  <span style={{ fontFamily: MONO, fontSize: 9.5, color: 'rgba(180,156,255,0.70)', background: 'rgba(180,156,255,0.07)', border: '1px solid rgba(180,156,255,0.15)', borderRadius: 3, padding: '2.5px 8px', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <BookOpen size={9} /> {relatedNotes.length} RELATED
                  </span>
                )}
                {(result.tags || []).map(t => (
                  <span key={t} style={{ fontFamily: MONO, fontSize: 9.5, color: C.textMute, border: `1px solid ${C.border}`, borderRadius: 3, padding: '2.5px 7px' }}>#{t}</span>
                ))}
              </div>

              {/* Title */}
              <div style={{ fontFamily: INTER, fontSize: 17, fontWeight: 700, color: C.text, lineHeight: 1.35 }}>{result.title}</div>

              {/* Key Insight */}
              {result.key_insight && (
                <div style={{ background: 'rgba(255,170,68,0.05)', border: '1px solid rgba(255,170,68,0.20)', borderRadius: 8, padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                    <Sparkles size={12} color="#ffaa44" />
                    <span style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(255,170,68,0.80)', letterSpacing: '0.12em', fontWeight: 700 }}>KEY INSIGHT</span>
                  </div>
                  <p style={{ fontFamily: INTER, fontSize: 14, color: '#ffe0a8', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>"{result.key_insight}"</p>
                </div>
              )}

              {/* 5 Layers */}
              {LAYERS.map(layer => {
                const content = result[layer.key];
                if (!content) return null;
                const isOpen = expanded.has(layer.id);
                const count  = countItems(content);
                return (
                  <div key={layer.id} style={{ background: isOpen ? layer.bg : 'transparent', border: `1px solid ${isOpen ? layer.color + '28' : C.border}`, borderRadius: 7, overflow: 'hidden', transition: 'border-color 0.2s, background 0.2s' }}>
                    <button
                      onClick={() => toggleLayer(layer.id)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <div style={{ width: 2.5, height: 18, borderRadius: 2, background: layer.color, flexShrink: 0 }} />
                      <layer.Icon size={12} color={layer.color} />
                      <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: isOpen ? C.text : C.textSub, letterSpacing: '0.10em', flex: 1, transition: 'color 0.2s' }}>
                        {layer.label.toUpperCase()}
                      </span>
                      {'special' in layer && layer.special && <Sparkles size={10} color={layer.color} />}
                      {count > 0 && <span style={{ fontFamily: MONO, fontSize: 9, color: layer.color, background: layer.color + '14', border: `1px solid ${layer.color}28`, borderRadius: 3, padding: '1.5px 6px' }}>{count}</span>}
                      {isOpen && (
                        <div role="button" tabIndex={0} onClick={e => { e.stopPropagation(); copyLayer(layer.id, content); }} onKeyDown={e => e.key === 'Enter' && copyLayer(layer.id, content)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center' }}>
                          {copied === layer.id ? <Check size={11} color={layer.color} /> : <Copy size={11} color={C.textMute} />}
                        </div>
                      )}
                      {isOpen ? <ChevronDown size={12} color={C.textMute} /> : <ChevronRight size={12} color={C.textMute} />}
                    </button>
                    {isOpen && (
                      <div style={{ padding: '4px 14px 14px 32px', borderTop: `1px solid ${layer.color}18` }}>
                        <div className="prose-distill">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Related notes */}
              {relatedNotes.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: C.textMute, letterSpacing: '0.10em', marginBottom: 8 }}>RELATED NOTES</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {relatedNotes.map(n => (
                      <button key={n.id} onClick={() => navigate(`/note/${n.id}`)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', textAlign: 'left' }}>
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(180,156,255,0.6)', flexShrink: 0 }} />
                        <span style={{ fontFamily: INTER, fontSize: 12, color: C.textSub, flex: 1 }}>{n.title || '未命名笔记'}</span>
                        <ArrowRight size={11} color={C.textMute} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ height: 16 }} />
            </div>
          )}
        </div>
      </div>

      <style>{`
        .prose-distill { font-family: ${INTER}; font-size: 13px; color: ${C.text}; line-height: 1.7; }
        .prose-distill p { margin: 0 0 8px; }
        .prose-distill ul, .prose-distill ol { margin: 0 0 8px; padding-left: 0; list-style: none; }
        .prose-distill li { margin: 5px 0; color: ${C.text}; }
        .prose-distill strong { color: #fff; font-weight: 600; }
        .prose-distill code { font-family: ${MONO}; font-size: 11px; background: rgba(255,255,255,0.06); padding: 1.5px 5px; border-radius: 3px; color: #b0e8ff; }
        .prose-distill blockquote { border-left: 2px solid rgba(255,255,255,0.12); margin: 0 0 8px; padding: 4px 0 4px 12px; color: ${C.textSub}; }
        .prose-distill h2, .prose-distill h3 { font-family: ${MONO}; font-size: 10px; letter-spacing: 0.10em; color: ${C.textMute}; font-weight: 700; margin: 10px 0 6px; text-transform: uppercase; }
      `}</style>
    </div>
  );
}
