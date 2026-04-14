import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Repeat2, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useT } from '@/contexts/LanguageContext';

const C = { bg:'#070809', surface:'#0e1012', border:'#1e2226', text:'#dde1e8', textSub:'#7a7f8a', textMute:'#4a4f5a', accent:'#00ff66', amber:'#ffaa44', cyan:'#66e3ff', purple:'#b49cff' };
const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

const LENSES = [
  { id:'Economics',        color:'#00ff66' },
  { id:'Systems Theory',   color:'#66e3ff' },
  { id:'Psychology',       color:'#b49cff' },
  { id:'Philosophy',       color:'#ffaa44' },
  { id:'Design',           color:'#00d4aa' },
  { id:'Devil\'s Advocate',color:'#ff6666' },
  { id:'Steelman',         color:'#7a7f8a' },
  { id:'10-Year View',     color:'#ffaa44' },
  { id:'First Principles', color:'#66e3ff' },
  { id:'Biology',          color:'#00d4aa' },
];

interface Props {
  noteTitle: string;
  noteContent: string;
  onClose: () => void;
}

export default function PerspectiveSwitch({ noteTitle, noteContent, onClose }: Props) {
  const [lens, setLens]           = useState('');
  const [result, setResult]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [err, setErr]             = useState('');
  const [history, setHistory]     = useState<{lens:string,md:string}[]>([]);
  const t = useT();

  const analyze = async (selectedLens: string) => {
    if (!selectedLens || loading) return;
    setLens(selectedLens);
    setLoading(true); setErr(''); setResult('');
    try {
      const { data, error } = await supabase.functions.invoke('perspective-switch', {
        body: { content: `# ${noteTitle}\n\n${noteContent.slice(0,2000)}`, lens: selectedLens },
      });
      if (error || !data?.success) throw new Error(error?.message || 'AI error');
      setResult(data.markdown || '');
      setHistory(h => [{ lens: selectedLens, md: data.markdown }, ...h.slice(0,4)]);
    } catch(e: unknown) {
      setErr(e instanceof Error ? e.message : 'AI error');
    } finally {
      setLoading(false);
    }
  };

  const activeLens = LENSES.find(l => l.id === lens);

  return (
    <div style={{ position:'fixed', top:0, right:0, width:500, height:'100vh', background:C.bg, borderLeft:`1px solid ${C.border}`, display:'flex', flexDirection:'column', zIndex:100, boxShadow:'-8px 0 40px rgba(0,0,0,0.5)' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Repeat2 size={14} color={C.purple} />
          <span style={{ fontFamily:MONO, fontSize:10, fontWeight:700, color:C.purple, letterSpacing:'0.1em' }}>{t('persp.title')}</span>
          <span style={{ fontFamily:MONO, fontSize:9, color:C.textMute }}>· {noteTitle.slice(0,28)}</span>
        </div>
        <div role="button" onClick={onClose} style={{ cursor:'pointer', padding:4, opacity:0.5 }} onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.opacity='1';}} onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.opacity='0.5';}}>
          <X size={14} color={C.textSub} />
        </div>
      </div>

      {/* Lens selector */}
      <div style={{ padding:'12px 16px', borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        <div style={{ fontFamily:MONO, fontSize:9, color:C.textMute, marginBottom:8, letterSpacing:'0.06em' }}>{t('persp.selectLens')}</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
          {LENSES.map(l => (
            <button key={l.id} onClick={()=>analyze(l.id)} disabled={loading}
              style={{ padding:'5px 10px', borderRadius:4, cursor: loading ? 'wait' : 'pointer', background: lens===l.id ? `${l.color}14` : 'rgba(255,255,255,0.02)', border:`1px solid ${lens===l.id ? l.color+'50' : C.border}`, fontFamily:MONO, fontSize:9, color: lens===l.id ? l.color : C.textSub, transition:'all 0.15s' }}
              onMouseEnter={e=>{ if(lens!==l.id) (e.currentTarget as HTMLElement).style.borderColor=l.color+'40'; }}
              onMouseLeave={e=>{ if(lens!==l.id) (e.currentTarget as HTMLElement).style.borderColor=C.border; }}>
              {l.id}
            </button>
          ))}
        </div>
      </div>

      {/* History breadcrumbs */}
      {history.length > 1 && (
        <div style={{ display:'flex', gap:4, padding:'6px 16px', borderBottom:`1px solid ${C.border}`, overflowX:'auto', flexShrink:0 }}>
          {history.map((h,i) => {
            const lCfg = LENSES.find(l => l.id === h.lens);
            return (
              <button key={i} onClick={()=>{ setLens(h.lens); setResult(h.md); }}
                style={{ fontFamily:MONO, fontSize:8, color: lens===h.lens ? (lCfg?.color||C.text) : C.textMute, padding:'2px 7px', borderRadius:3, background: lens===h.lens ? `${lCfg?.color||C.text}10` : 'transparent', border:`1px solid ${lens===h.lens ? (lCfg?.color||C.text)+'30' : C.border}`, cursor:'pointer', flexShrink:0, whiteSpace:'nowrap' }}>
                {h.lens}
              </button>
            );
          })}
        </div>
      )}

      {/* Content area */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px' }}>
        {!lens && !loading && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'70%', gap:10, textAlign:'center' }}>
            <Repeat2 size={24} color='rgba(180,156,255,0.3)' />
            <div style={{ fontFamily:INTER, fontSize:13, color:C.textMute, maxWidth:280 }}>
              {t('persp.instruction')}
            </div>
          </div>
        )}

        {loading && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'70%', gap:12 }}>
            <Loader2 size={20} color={activeLens?.color || C.purple} style={{ animation:'spin 1s linear infinite' }} />
            <span style={{ fontFamily:MONO, fontSize:10, color:C.textMute }}>{t('persp.applying')} {lens}…</span>
          </div>
        )}

        {err && <div style={{ fontFamily:MONO, fontSize:11, color:'#ff6666', padding:'8px 10px', background:'rgba(255,102,102,0.08)', borderRadius:4, border:'1px solid rgba(255,102,102,0.20)' }}>{err}</div>}

        {!loading && result && (
          <div style={{ fontFamily:INTER, fontSize:13, color:C.text, lineHeight:1.7 }} className="persp-prose">
            <div style={{ fontFamily:MONO, fontSize:9, color:activeLens?.color||C.purple, marginBottom:12, letterSpacing:'0.06em' }}>
              {lens.toUpperCase()} {t('persp.lens')}
            </div>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .persp-prose h2{font-size:14px;color:${C.text};margin:14px 0 6px;font-family:${MONO};letter-spacing:.06em;} .persp-prose h3{font-size:12px;color:${C.textSub};margin:10px 0 4px;font-family:${MONO};} .persp-prose ul{padding-left:16px;} .persp-prose li{margin:4px 0;} .persp-prose strong{color:${C.text};}`}</style>
    </div>
  );
}
