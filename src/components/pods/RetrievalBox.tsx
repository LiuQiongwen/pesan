/**
 * Retrieval Pod — 检索舱 (Private Cloud RAG)
 * Accent: #66f0ff (cyan)
 *
 * Three-layer result structure:
 *   1. Answer Layer — AI synthesis with inline citations
 *   2. Citation Layer — expandable source cards with fly-to-star
 *   3. Scope Layer — search statistics
 */
import { useState, useRef, useEffect } from 'react';
import {
  Search, MessageCircle, Loader2, ChevronDown, ChevronUp,
  ArrowRight, Star, Feather, Database, Crosshair,
} from 'lucide-react';
import { useRAG, type Citation, type ScopeMeta } from '@/hooks/useRAG';
import { useAgentWorkflow } from '@/contexts/AgentWorkflowContext';
import { useToolbox } from '@/contexts/ToolboxContext';
import { useHintState } from '@/hooks/useHintState';

const C    = '#66f0ff';
const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";
const SUPS = ['\u00b9','\u00b2','\u00b3','\u2074','\u2075','\u2076'];

type Mode = 'search' | 'ask';

function renderCited(text: string) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  text.replace(/\[(\d+)\]/g, (match, n, idx) => {
    if (idx > last) parts.push(text.slice(last, idx));
    parts.push(<sup key={idx} style={{ color: C, fontWeight: 700, fontSize: '0.72em' }}>{SUPS[+n-1] ?? match}</sup>);
    last = idx + match.length;
    return match;
  });
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/* ── Scope Bar ─────────────────────────────────────────────────────────── */
function ScopeBar({ meta }: { meta?: ScopeMeta }) {
  if (!meta) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '5px 12px',
      borderBottom: '1px solid rgba(102,240,255,0.06)',
    }}>
      <Database size={9} color={`${C}50`} />
      <span style={{
        fontFamily: MONO, fontSize: 8, letterSpacing: '0.05em',
        color: `${C}55`,
      }}>
        {meta.universe_name} · {meta.note_count} 篇笔记 · {meta.chunk_count} 知识片段
      </span>
    </div>
  );
}

/* ── Source Card ────────────────────────────────────────────────────────── */
function SourceCard({ c, idx, onFlyTo }: {
  c: Citation; idx: number;
  onFlyTo?: (id: string, title: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      border: `1px solid rgba(102,240,255,${open ? '0.18' : '0.10'})`,
      borderRadius: 6, overflow: 'hidden', transition: 'border-color 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button onClick={() => setOpen(o => !o)} style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 7,
          padding: '6px 9px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}>
          <span style={{ fontFamily: MONO, fontSize: 9, color: C, fontWeight: 700, flexShrink: 0 }}>{SUPS[idx]}</span>
          <span style={{ fontFamily: INTER, fontSize: 11, color: 'rgba(200,215,235,0.80)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.note_title}
          </span>
          {open ? <ChevronUp size={9} color="rgba(140,155,180,0.45)" /> : <ChevronDown size={9} color="rgba(140,155,180,0.45)" />}
        </button>
        {onFlyTo && (
          <button
            onClick={() => onFlyTo(c.note_id, c.note_title)}
            title="在星图中定位"
            style={{
              display: 'flex', alignItems: 'center', gap: 3,
              padding: '5px 8px', background: 'none', border: 'none', cursor: 'pointer',
            }}
          >
            <Star size={9} color={`${C}70`} />
            <span style={{ fontFamily: MONO, fontSize: 7, color: `${C}45`, letterSpacing: '0.05em' }}>定位</span>
          </button>
        )}
      </div>
      {open && (
        <div style={{ padding: '0 9px 8px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <p style={{ fontFamily: INTER, fontSize: 10.5, color: 'rgba(140,155,180,0.72)', lineHeight: 1.65, margin: 0 }}>
            {c.excerpt}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── No Evidence State ─────────────────────────────────────────────────── */
function NoEvidenceState({ meta, onOpenCapture }: { meta?: ScopeMeta; onOpenCapture: () => void }) {
  return (
    <div style={{ padding: '20px 16px', textAlign: 'center' }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'rgba(102,240,255,0.06)',
        border: '1px solid rgba(102,240,255,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 10px',
      }}>
        <Search size={14} color={`${C}45`} />
      </div>
      <div style={{ fontFamily: INTER, fontSize: 12, color: 'rgba(200,215,235,0.75)', marginBottom: 6 }}>
        知识库中未找到相关依据
      </div>
      <div style={{ fontFamily: INTER, fontSize: 10, color: 'rgba(130,145,175,0.55)', lineHeight: 1.65, marginBottom: 12 }}>
        {meta ? `你的「${meta.universe_name}」中有 ${meta.note_count} 篇笔记，但未涵盖此主题。` : '知识库暂无内容。'}
        <br />导入更多相关资料后，答案会自动更新。
      </div>
      <button onClick={onOpenCapture} style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontFamily: MONO, fontSize: 9, letterSpacing: '0.06em',
        color: '#00ff66', background: 'rgba(0,255,102,0.06)',
        border: '1px solid rgba(0,255,102,0.20)',
        borderRadius: 6, padding: '6px 14px', cursor: 'pointer',
        transition: 'all 0.15s',
      }}>
        <Feather size={10} />
        打开 Capture 舱导入资料
      </button>
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────────────── */
interface Props { onHighlight?: (ids: string[]) => void }

export default function RetrievalBox({ onHighlight }: Props) {
  const { search, loading } = useRAG();
  const workflow            = useAgentWorkflow();
  const { openPod }         = useToolbox();
  const hints               = useHintState();
  const showScopeHint       = hints.shouldShowHint('retrieval_scope');
  const showTraceHint       = hints.shouldShowHint('trace_source');

  const [mode,      setMode]      = useState<Mode>('search');
  const [query,     setQuery]     = useState('');
  const [answer,    setAnswer]    = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [scopeMeta, setScopeMeta] = useState<ScopeMeta | undefined>();
  const [noEvidence, setNoEvidence] = useState(false);
  const [showSrc,   setShowSrc]   = useState(true); // default open
  const inputRef       = useRef<HTMLInputElement>(null);
  const autoSearchRef  = useRef(false);

  // Auto-receive from workflow relay
  useEffect(() => {
    const relayed = workflow.consumeRelay('retrieval');
    if (relayed) {
      setQuery(relayed.slice(0, 200));
      autoSearchRef.current = true;
      workflow.setActiveStep('retrieval');
      inputRef.current?.focus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow.relay?.timestamp]);

  // Auto-search when relay pre-fills the query
  useEffect(() => {
    if (autoSearchRef.current && query.trim() && !loading) {
      autoSearchRef.current = false;
      handleSearch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleSearch = async () => {
    if (!query.trim() || loading) return;
    workflow.setActiveStep('retrieval');
    setNoEvidence(false);
    const res = await search(query);
    if (res) {
      setAnswer(res.answer);
      setCitations(res.citations);
      setScopeMeta(res.scope_meta);
      setNoEvidence(res.no_evidence ?? false);
      setShowSrc(true);
      onHighlight?.(res.citations.map(c => c.note_id));
      workflow.markStepComplete('retrieval');
      hints.markCompleted('retrieval_scope');
    }
  };

  const handleFlyTo = (noteId: string, noteTitle: string) => {
    onHighlight?.([noteId]);
    hints.markCompleted('trace_source');
    // Dispatch event so StarMapLayout can show trace toast
    window.dispatchEvent(new CustomEvent('hint-trace-source', { detail: { noteTitle } }));
  };

  const handleSendToInsight = () => {
    const content = answer
      ? `问题: ${query}\n\n回答: ${answer}`
      : citations.map(c => `${c.note_title}: ${c.excerpt}`).join('\n\n');
    workflow.sendRelay(content, 'retrieval', 'insight');
    openPod('insight');
  };

  const hasResults = (answer && !noEvidence) || citations.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Scope bar */}
      <ScopeBar meta={scopeMeta} />

      {/* Mode toggle + relay indicator */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px 6px',
        borderBottom: '1px solid rgba(102,240,255,0.08)',
      }}>
        <div style={{
          display: 'flex', gap: 2,
          background: 'rgba(102,240,255,0.05)',
          border: '1px solid rgba(102,240,255,0.10)',
          borderRadius: 7, padding: 2,
        }}>
          {(['search', 'ask'] as Mode[]).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontFamily: MONO, fontSize: 8, letterSpacing: '0.06em',
              color: mode === m ? '#040b0f' : `${C}60`,
              background: mode === m ? C : 'transparent',
              border: 'none', borderRadius: 5, padding: '4px 9px',
              cursor: 'pointer', transition: 'all 0.14s',
            }}>
              {m === 'search' ? <Search size={8} /> : <MessageCircle size={8} />}
              {m === 'search' ? '检索' : '提问'}
            </button>
          ))}
        </div>

        {workflow.relay?.targetPod === 'retrieval' && (
          <div style={{
            fontFamily: MONO, fontSize: 7, letterSpacing: '0.06em',
            color: `${C}70`,
            background: 'rgba(102,240,255,0.08)',
            border: '1px solid rgba(102,240,255,0.15)',
            borderRadius: 4, padding: '2px 7px',
          }}>
            \u2190 来自捕获舱
          </div>
        )}
      </div>

      {/* Search bar */}
      <div style={{ display: 'flex', gap: 0, padding: '10px 12px', borderBottom: '1px solid rgba(102,240,255,0.06)' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          {mode === 'search'
            ? <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: `${C}60`, pointerEvents: 'none' }} />
            : <MessageCircle size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: `${C}60`, pointerEvents: 'none' }} />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder={mode === 'search' ? '关键词语义检索...' : '直接提问，获取引用式回答...'}
            disabled={loading}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '8px 10px 8px 30px',
              background: 'rgba(102,240,255,0.04)',
              border: '1px solid rgba(102,240,255,0.18)',
              borderRight: 'none', borderRadius: '7px 0 0 7px',
              fontFamily: INTER, fontSize: 12,
              color: 'rgba(210,225,245,0.88)', outline: 'none',
            }}
          />
        </div>
        <button onClick={handleSearch} disabled={loading || !query.trim()} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38,
          background: loading ? 'rgba(102,240,255,0.06)' : 'rgba(102,240,255,0.16)',
          border: `1px solid rgba(102,240,255,${loading ? '0.12' : '0.30'})`,
          borderRadius: '0 7px 7px 0',
          cursor: loading || !query.trim() ? 'not-allowed' : 'pointer', transition: 'all 0.14s',
        }}>
          {loading
            ? <Loader2 size={12} color={C} style={{ animation: 'spin 1s linear infinite' }} />
            : <Search size={12} color={C} />
          }
        </button>
      </div>

      {/* No evidence state */}
      {noEvidence && !loading && (
        <NoEvidenceState meta={scopeMeta} onOpenCapture={() => openPod('capture')} />
      )}

      {/* Results — three-layer structure */}
      {hasResults && (
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Layer 1: Answer */}
          {answer && (
            <div style={{
              background: 'rgba(102,240,255,0.04)',
              border: '1px solid rgba(102,240,255,0.10)',
              borderRadius: 8, padding: '10px 12px',
            }}>
              <div style={{ fontFamily: MONO, fontSize: 8, color: `${C}55`, letterSpacing: '0.07em', marginBottom: 6 }}>
                {mode === 'ask' ? 'ANSWER' : 'SYNTHESIS'}
              </div>
              <p style={{ fontFamily: INTER, fontSize: 12, color: 'rgba(210,225,245,0.88)', lineHeight: 1.78, margin: 0 }}>
                {renderCited(answer)}
              </p>
              {/* Scope stamp */}
              {scopeMeta && (
                <div style={{
                  fontFamily: MONO, fontSize: 7.5, letterSpacing: '0.05em',
                  color: `${C}35`, marginTop: 8, paddingTop: 6,
                  borderTop: '1px solid rgba(102,240,255,0.06)',
                }}>
                  仅基于你的 {scopeMeta.note_count} 篇笔记生成 · 非通用 AI 回答
                </div>
              )}
            </div>
          )}

          {/* Layer 2: Citations (default open) */}
          {citations.length > 0 && (
            <div>
              <button onClick={() => setShowSrc(o => !o)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontFamily: MONO, fontSize: 8, color: `${C}60`,
                background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.05em',
                marginBottom: showSrc ? 6 : 0,
              }}>
                <Star size={7} color={C} fill={showSrc ? C : 'transparent'} />
                来源引用 · {citations.length} 个知识节点
                {showSrc ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
              </button>

              {/* Trace source hint */}
              {showSrc && showTraceHint && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 8px', marginBottom: 6,
                  background: 'rgba(102,240,255,0.04)',
                  border: '1px solid rgba(102,240,255,0.10)',
                  borderRadius: 5, pointerEvents: 'none',
                }}>
                  <Star size={9} color={`${C}60`} style={{ flexShrink: 0 }} />
                  <div>
                    <span style={{ fontFamily: INTER, fontSize: 10, color: 'rgba(102,240,255,0.65)', fontWeight: 500 }}>
                      点击引用，飞回来源节点
                    </span>
                    <span style={{ fontFamily: INTER, fontSize: 8.5, color: 'rgba(102,240,255,0.30)', marginLeft: 6 }}>
                      每个答案都可以回到你的原始资料
                    </span>
                  </div>
                </div>
              )}
              {showSrc && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {citations.map((c, i) => (
                    <SourceCard key={c.chunk_id} c={c} idx={i} onFlyTo={handleFlyTo} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Layer 3: Scope stats (collapsed) */}
          {scopeMeta && (
            <div style={{
              fontFamily: MONO, fontSize: 7.5, letterSpacing: '0.05em',
              color: 'rgba(80,95,125,0.45)', lineHeight: 1.6,
              padding: '4px 0',
            }}>
              检索范围: {scopeMeta.universe_name} · 扫描 {scopeMeta.chunk_count} 个知识片段 · 匹配 {citations.length} 个来源
            </div>
          )}

          {/* Send to Insight */}
          <button onClick={handleSendToInsight} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontFamily: MONO, fontSize: 9, letterSpacing: '0.07em',
            color: C, background: 'rgba(102,240,255,0.06)',
            border: '1px solid rgba(102,240,255,0.18)',
            borderRadius: 6, padding: '7px 0', cursor: 'pointer',
            transition: 'all 0.15s',
          }}>
            <ArrowRight size={10} />
            \u2192 发送至洞察舱
          </button>
        </div>
      )}

      {/* Empty hint (no search yet) */}
      {!hasResults && !noEvidence && !loading && (
        <div style={{ padding: '20px 16px', textAlign: 'center' }}>
          {showScopeHint ? (
            <>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'rgba(102,240,255,0.06)',
                border: '1px solid rgba(102,240,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 10px',
              }}>
                <Crosshair size={13} color={`${C}70`} />
              </div>
              <div style={{ fontFamily: INTER, fontSize: 12, color: 'rgba(102,240,255,0.70)', marginBottom: 4, fontWeight: 500 }}>
                先选知识范围，再提问
              </div>
              <div style={{ fontFamily: INTER, fontSize: 10, color: 'rgba(102,240,255,0.35)', lineHeight: 1.7 }}>
                这次回答只会基于你选中的知识范围
              </div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: INTER, fontSize: 11, color: 'rgba(102,240,255,0.40)', marginBottom: 4 }}>
                你的私人知识库
              </div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(60,72,95,0.55)', letterSpacing: '0.05em', lineHeight: 1.8 }}>
                {mode === 'search'
                  ? '只从你的笔记中检索 · 每个回答都有来源'
                  : '直接提问 · AI 仅基于你导入的资料回答'}
              </div>
            </>
          )}
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
