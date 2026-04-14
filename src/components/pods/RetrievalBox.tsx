/**
 * Retrieval Pod — 检索舱
 * Accent: #66f0ff (cyan)
 * Philosophy: Precision. Speed. Trust. A knowledge radar.
 */
import { useState, useRef } from 'react';
import { Search, Loader2, ChevronDown, ChevronUp, Circle } from 'lucide-react';
import { useRAG, type Citation } from '@/hooks/useRAG';

const C = '#66f0ff';
const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";
const SUPS = ['¹','²','³','⁴','⁵','⁶'];

function renderCited(text: string) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  text.replace(/\[(\d+)\]/g, (match, n, idx) => {
    if (idx > last) parts.push(text.slice(last, idx));
    parts.push(<sup key={idx} style={{ color: C, fontWeight: 700, fontSize: '0.72em', cursor: 'default' }}>{SUPS[+n-1] ?? match}</sup>);
    last = idx + match.length;
    return match;
  });
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function SourceCard({ c, idx }: { c: Citation; idx: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      border: `1px solid rgba(102,240,255,${open ? '0.18' : '0.10'})`,
      borderRadius: 6, overflow: 'hidden',
      transition: 'border-color 0.15s',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 7,
          padding: '6px 9px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 9, color: C, fontWeight: 700, flexShrink: 0 }}>{SUPS[idx]}</span>
        <span style={{ fontFamily: INTER, fontSize: 11, color: 'rgba(200,215,235,0.80)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {c.note_title}
        </span>
        {open ? <ChevronUp size={9} color="rgba(140,155,180,0.45)" /> : <ChevronDown size={9} color="rgba(140,155,180,0.45)" />}
      </button>
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
  const [query,    setQuery]    = useState('');
  const [answer,   setAnswer]   = useState<string | null>(null);
  const [citations,setCitations]= useState<Citation[]>([]);
  const [showSrc,  setShowSrc]  = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async () => {
    if (!query.trim() || loading) return;
    const res = await search(query);
    if (res) {
      setAnswer(res.answer);
      setCitations(res.citations);
      setShowSrc(false);
      onHighlight?.(res.citations.map(c => c.note_id));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Search bar — top, full-width, prominent */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '1px solid rgba(102,240,255,0.10)',
        padding: '10px 12px',
      }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={12} style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: `${C}60`, pointerEvents: 'none',
          }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="提问或关键词检索…"
            disabled={loading}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '8px 10px 8px 30px',
              background: 'rgba(102,240,255,0.04)',
              border: `1px solid rgba(102,240,255,0.18)`,
              borderRight: 'none',
              borderRadius: '7px 0 0 7px',
              fontFamily: INTER, fontSize: 12,
              color: 'rgba(210,225,245,0.88)',
              outline: 'none',
            }}
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 38,
            background: loading ? 'rgba(102,240,255,0.06)' : 'rgba(102,240,255,0.16)',
            border: `1px solid rgba(102,240,255,${loading ? '0.12' : '0.30'})`,
            borderRadius: '0 7px 7px 0',
            cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
            transition: 'all 0.14s', flexShrink: 0,
          }}
        >
          {loading
            ? <Loader2 size={12} color={C} style={{ animation: 'spin 1s linear infinite' }} />
            : <Search size={12} color={C} />
          }
        </button>
      </div>

      {/* Answer + sources */}
      {answer && (
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Answer */}
          <div style={{
            background: 'rgba(102,240,255,0.04)',
            border: '1px solid rgba(102,240,255,0.10)',
            borderRadius: 8, padding: '10px 12px',
          }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: `${C}55`, letterSpacing: '0.07em', marginBottom: 6 }}>
              ANSWER
            </div>
            <p style={{ fontFamily: INTER, fontSize: 12, color: 'rgba(210,225,245,0.88)', lineHeight: 1.78, margin: 0 }}>
              {renderCited(answer)}
            </p>
          </div>

          {/* Sources */}
          {citations.length > 0 && (
            <div>
              <button
                onClick={() => setShowSrc(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontFamily: MONO, fontSize: 8, color: `${C}60`,
                  background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.05em',
                  marginBottom: showSrc ? 6 : 0,
                }}
              >
                <Circle size={6} color={C} fill={C} />
                {citations.length} 来源
                {showSrc ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
              </button>
              {showSrc && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {citations.map((c, i) => <SourceCard key={c.chunk_id} c={c} idx={i} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty hint */}
      {!answer && !loading && (
        <div style={{ padding: '20px 16px', textAlign: 'center' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(60,72,95,0.55)', letterSpacing: '0.05em', lineHeight: 1.8 }}>
            直接提问或输入关键词<br />支持语义搜索 + 引用式问答
          </div>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
