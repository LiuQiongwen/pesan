import { useState, useRef } from 'react';
import { Search, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useRAG, type Citation } from '@/hooks/useRAG';
import { useT } from '@/contexts/LanguageContext';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";
const CYAN = '#66f0ff';
const SUPS = ['¹','²','³','⁴','⁵'];

function renderAnswer(text: string) {
  const parts: React.ReactNode[] = [];
  const re = /\[(\d+)\]/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const n = parseInt(m[1]) - 1;
    parts.push(<sup key={m.index} style={{ color: CYAN, fontWeight: 700, fontSize: '0.7em' }}>{SUPS[n] || m[0]}</sup>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

interface CitationItemProps { c: Citation }
function CitationItem({ c }: CitationItemProps) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderRadius:5, border:`1px solid rgba(102,240,255,0.12)`, overflow:'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width:'100%', display:'flex', alignItems:'center', gap:7, padding:'6px 9px', background:'transparent', border:'none', cursor:'pointer', textAlign:'left' }}
      >
        <span style={{ fontFamily:MONO, fontSize:9, color:CYAN, fontWeight:700, flexShrink:0 }}>{SUPS[c.id-1]||c.id}</span>
        <span style={{ fontFamily:INTER, fontSize:11, color:'rgba(200,210,230,0.80)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.note_title}</span>
        {open ? <ChevronUp size={10} color="rgba(150,158,175,0.5)" /> : <ChevronDown size={10} color="rgba(150,158,175,0.5)" />}
      </button>
      {open && (
        <div style={{ padding:'0 9px 8px', borderTop:'1px solid rgba(255,255,255,0.04)' }}>
          <p style={{ fontFamily:INTER, fontSize:10, color:'rgba(140,150,170,0.70)', lineHeight:1.6, margin:0 }}>{c.excerpt}</p>
        </div>
      )}
    </div>
  );
}

interface Props {
  onHighlight?: (noteIds: string[]) => void;
}

export default function SearchBox({ onHighlight }: Props) {
  const { search, loading } = useRAG();
  const t = useT();
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [showCitations, setShowCitations] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async () => {
    if (!query.trim() || loading) return;
    const result = await search(query);
    if (result) {
      setAnswer(result.answer);
      setCitations(result.citations);
      setShowCitations(false);
      // Highlight cited nodes
      onHighlight?.(result.citations.map(c => c.note_id));
    }
  };

  return (
    <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>

      {/* Search input */}
      <div style={{ display:'flex', gap:6 }}>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder={t('rag.placeholder') || '搜索知识库…'}
          disabled={loading}
          style={{
            flex:1, padding:'8px 10px',
            background:'rgba(255,255,255,0.04)',
            border:'1px solid rgba(102,240,255,0.15)',
            borderRadius:6,
            fontFamily:INTER, fontSize:12,
            color:'rgba(200,210,230,0.85)',
            outline:'none',
          }}
        />
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          style={{
            display:'flex', alignItems:'center', justifyContent:'center',
            width:34, height:34, borderRadius:6,
            background: loading ? 'rgba(102,240,255,0.06)' : 'rgba(102,240,255,0.14)',
            border:`1px solid rgba(102,240,255,${loading?'0.12':'0.30'})`,
            cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
            flexShrink:0,
          }}
        >
          {loading ? <Loader2 size={12} color={CYAN} style={{ animation:'spin 1s linear infinite' }} /> : <Search size={12} color={CYAN} />}
        </button>
      </div>

      {/* Answer */}
      {answer && (
        <div style={{
          background:'rgba(102,240,255,0.04)',
          border:'1px solid rgba(102,240,255,0.10)',
          borderRadius:7, padding:'10px 11px',
        }}>
          <p style={{ fontFamily:INTER, fontSize:12, color:'rgba(200,215,235,0.90)', lineHeight:1.75, margin:0 }}>
            {renderAnswer(answer)}
          </p>

          {citations.length > 0 && (
            <div style={{ marginTop:8 }}>
              <button
                onClick={() => setShowCitations(o => !o)}
                style={{ display:'flex', alignItems:'center', gap:4, fontFamily:MONO, fontSize:9, color:'rgba(102,240,255,0.60)', background:'none', border:'none', cursor:'pointer', letterSpacing:'0.04em' }}
              >
                {citations.length} {showCitations ? <ChevronUp size={9}/> : <ChevronDown size={9}/>} 引用
              </button>
              {showCitations && (
                <div style={{ marginTop:6, display:'flex', flexDirection:'column', gap:4 }}>
                  {citations.map(c => <CitationItem key={c.chunk_id} c={c} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
