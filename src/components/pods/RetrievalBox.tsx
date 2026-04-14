/**
 * Retrieval Pod — 检索舱
 * Accent: #66f0ff (cyan)
 *
 * Features:
 * - SEARCH mode: semantic keyword search returning note cards
 * - ASK mode: RAG question-answering with citations
 * - Results convertible to star-map nodes or relayed to Insight
 * - Auto-receives content from CaptureBox via AgentWorkflowContext
 */
import { useState, useRef, useEffect } from 'react';
import { Search, MessageCircle, Loader2, ChevronDown, ChevronUp, Circle, ArrowRight, Star } from 'lucide-react';
import { useRAG, type Citation } from '@/hooks/useRAG';
import { useAgentWorkflow } from '@/contexts/AgentWorkflowContext';
import { useToolbox } from '@/contexts/ToolboxContext';

const C    = '#66f0ff';
const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";
const SUPS = ['¹','²','³','⁴','⁵','⁶'];

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

function SourceCard({ c, idx, onHighlight }: { c: Citation; idx: number; onHighlight?: (id: string) => void }) {
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
        {/* Highlight in star map */}
        {onHighlight && (
          <button onClick={() => onHighlight(c.note_id)} title="在星图中高亮" style={{
            display: 'flex', padding: '6px 8px', background: 'none', border: 'none', cursor: 'pointer',
          }}>
            <Star size={9} color={`${C}50`} />
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

interface Props { onHighlight?: (ids: string[]) => void }

export default function RetrievalBox({ onHighlight }: Props) {
  const { search, loading } = useRAG();
  const workflow            = useAgentWorkflow();
  const { openPod }         = useToolbox();

  const [mode,      setMode]      = useState<Mode>('search');
  const [query,     setQuery]     = useState('');
  const [answer,    setAnswer]    = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [showSrc,   setShowSrc]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-receive from workflow relay
  useEffect(() => {
    const relayed = workflow.consumeRelay('retrieval');
    if (relayed) {
      setQuery(relayed.slice(0, 200));
      workflow.setActiveStep('retrieval');
      inputRef.current?.focus();
    }
  // Only run when relay changes (timestamp-based)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow.relay?.timestamp]);

  const handleSearch = async () => {
    if (!query.trim() || loading) return;
    workflow.setActiveStep('retrieval');
    const res = await search(query);
    if (res) {
      setAnswer(res.answer);
      setCitations(res.citations);
      setShowSrc(false);
      onHighlight?.(res.citations.map(c => c.note_id));
      workflow.markStepComplete('retrieval');
    }
  };

  const handleSendToInsight = () => {
    const content = answer
      ? `问题: ${query}\n\n回答: ${answer}`
      : citations.map(c => `${c.note_title}: ${c.excerpt}`).join('\n\n');
    workflow.sendRelay(content, 'retrieval', 'insight');
    openPod('insight');
  };

  const hasResults = answer || citations.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Mode toggle + relay indicator */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px 6px',
        borderBottom: '1px solid rgba(102,240,255,0.08)',
      }}>
        {/* Search / Ask toggle */}
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

        {/* Relay indicator */}
        {workflow.relay?.targetPod === 'retrieval' && (
          <div style={{
            fontFamily: MONO, fontSize: 7, letterSpacing: '0.06em',
            color: `${C}70`,
            background: 'rgba(102,240,255,0.08)',
            border: '1px solid rgba(102,240,255,0.15)',
            borderRadius: 4, padding: '2px 7px',
          }}>
            ← 来自捕获舱
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
            placeholder={mode === 'search' ? '关键词语义检索…' : '直接提问，获取引用式回答…'}
            disabled={loading}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '8px 10px 8px 30px',
              background: 'rgba(102,240,255,0.04)',
              border: `1px solid rgba(102,240,255,0.18)`,
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

      {/* Results */}
      {hasResults && (
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Answer block */}
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
            </div>
          )}

          {/* Sources */}
          {citations.length > 0 && (
            <div>
              <button onClick={() => setShowSrc(o => !o)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontFamily: MONO, fontSize: 8, color: `${C}60`,
                background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.05em',
                marginBottom: showSrc ? 6 : 0,
              }}>
                <Circle size={6} color={C} fill={C} />
                {citations.length} 来源节点
                {showSrc ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
              </button>
              {showSrc && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {citations.map((c, i) => (
                    <SourceCard key={c.chunk_id} c={c} idx={i}
                      onHighlight={id => onHighlight?.([id])}
                    />
                  ))}
                </div>
              )}
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
            → 发送至洞察舱
          </button>
        </div>
      )}

      {/* Empty hint */}
      {!hasResults && !loading && (
        <div style={{ padding: '20px 16px', textAlign: 'center' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(60,72,95,0.55)', letterSpacing: '0.05em', lineHeight: 1.8 }}>
            {mode === 'search' ? '关键词语义检索 · 定位知识节点' : '直接提问 · 支持引用式问答'}
          </div>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
