import { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ZoomIn, X, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const C = { bg:'#070809', surface:'#0e1012', border:'#1e2226', text:'#dde1e8', textSub:'#7a7f8a', textMute:'#4a4f5a', accent:'#00ff66', amber:'#ffaa44', cyan:'#66e3ff' };
const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

const LEVELS = [
  { n:1, name:'ATOM',    desc:'One sentence', color:'#7a7f8a' },
  { n:2, name:'UNIT',    desc:'Core idea',    color:'#66e3ff' },
  { n:3, name:'CONCEPT', desc:'Full note',    color:'#00ff66' },
  { n:4, name:'CLUSTER', desc:'Note + related', color:'#ffaa44' },
  { n:5, name:'DOMAIN',  desc:'Domain worldview', color:'#b49cff' },
];

interface Note {
  id: string;
  title: string;
  summary: string | null;
  content_markdown?: string | null;
  tags: string[];
}

interface Props {
  note: Note;
  relatedNotes: Note[];
  onClose: () => void;
}

function computeLevel(n: number, note: Note, content: string): string {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (n === 1) {
    return note.summary?.slice(0,160) || sentences[0] || note.title;
  }
  if (n === 2) {
    return [
      `**${note.title}**`,
      '',
      note.summary || sentences.slice(0,3).join('. '),
      '',
      note.tags?.length ? `*Topics: ${note.tags.slice(0,4).join(', ')}*` : '',
    ].join('\n');
  }
  return content; // level 3 = full note
}

export default function KnowledgeZoom({ note, relatedNotes, onClose }: Props) {
  const [level, setLevel]     = useState(3);
  const [aiCache, setAiCache] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);

  const content = note.content_markdown || note.summary || '';

  const displayContent = useMemo(() => {
    if (level <= 3) return computeLevel(level, note, content);
    return aiCache[level] || null;
  }, [level, note, content, aiCache]);

  const generateAI = async (lvl: number) => {
    if (aiCache[lvl]) { setLevel(lvl); return; }
    setLoading(true);
    setLevel(lvl);
    try {
      const body = {
        level: lvl,
        noteTitle: note.title,
        noteContent: content.slice(0, 600),
        relatedNotes: relatedNotes.slice(0,4).map(n => ({ title:n.title, summary:n.summary||'' })),
      };
      const { data } = await supabase.functions.invoke('knowledge-zoom', { body });
      if (data?.success && data.markdown) {
        setAiCache(c => ({ ...c, [lvl]: data.markdown }));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLevel = (lvl: number) => {
    if (lvl <= 3) { setLevel(lvl); return; }
    generateAI(lvl);
  };

  const cfg = LEVELS[level - 1];

  return (
    <div style={{ position:'fixed', top:0, right:0, width:480, height:'100vh', background:C.bg, borderLeft:`1px solid ${C.border}`, display:'flex', flexDirection:'column', zIndex:100, boxShadow:'-8px 0 40px rgba(0,0,0,0.5)' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <ZoomIn size={14} color={cfg.color} />
          <span style={{ fontFamily:MONO, fontSize:10, fontWeight:700, color:cfg.color, letterSpacing:'0.1em' }}>KNOWLEDGE ZOOM</span>
          <span style={{ fontFamily:MONO, fontSize:9, color:C.textMute }}>· {note.title.slice(0,30)}</span>
        </div>
        <div role="button" onClick={onClose} style={{ cursor:'pointer', padding:4, opacity:0.5 }} onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.opacity='1';}} onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.opacity='0.5';}}>
          <X size={14} color={C.textSub} />
        </div>
      </div>

      {/* Zoom Rail */}
      <div style={{ display:'flex', alignItems:'center', padding:'10px 16px', borderBottom:`1px solid ${C.border}`, gap:4, flexShrink:0 }}>
        {LEVELS.map(l => (
          <button key={l.n} onClick={()=>handleLevel(l.n)}
            style={{ flex:1, padding:'8px 4px', borderRadius:5, background: level===l.n ? `${l.color}12` : 'transparent', border:`1px solid ${level===l.n ? l.color+'40' : C.border}`, cursor:'pointer', textAlign:'center' }}>
            <div style={{ fontFamily:MONO, fontSize:10, fontWeight:700, color: level===l.n ? l.color : C.textMute }}>L{l.n}</div>
            <div style={{ fontFamily:MONO, fontSize:8, color: level===l.n ? l.color : C.textMute, opacity:0.7, marginTop:1 }}>{l.name}</div>
          </button>
        ))}
      </div>

      {/* Level description */}
      <div style={{ padding:'8px 16px', borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:cfg.color }} />
          <span style={{ fontFamily:MONO, fontSize:9, color:cfg.color }}>{cfg.name}</span>
          <ChevronRight size={9} color={C.textMute} />
          <span style={{ fontFamily:MONO, fontSize:9, color:C.textMute }}>{cfg.desc}</span>
          {(level === 4 || level === 5) && relatedNotes.length > 0 && (
            <span style={{ fontFamily:MONO, fontSize:9, color:C.textMute }}>· {relatedNotes.length} related notes</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px' }}>
        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60%', gap:12 }}>
            <Loader2 size={20} color={cfg.color} style={{ animation:'spin 1s linear infinite' }} />
            <span style={{ fontFamily:MONO, fontSize:10, color:C.textMute }}>Synthesizing {cfg.name.toLowerCase()}…</span>
          </div>
        ) : !displayContent ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60%', gap:10, textAlign:'center' }}>
            <div style={{ fontFamily:MONO, fontSize:11, color:C.textMute }}>Click to generate {cfg.name.toLowerCase()} synthesis</div>
            <button onClick={()=>handleLevel(level)} style={{ padding:'7px 16px', borderRadius:4, background:`${cfg.color}12`, border:`1px solid ${cfg.color}30`, cursor:'pointer', fontFamily:MONO, fontSize:10, color:cfg.color }}>GENERATE</button>
          </div>
        ) : (
          <div style={{ fontFamily:INTER, fontSize:13, color:C.text, lineHeight:1.7 }} className="zoom-prose">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .zoom-prose h2{font-size:14px;color:${C.text};margin:12px 0 6px;font-family:${MONO};} .zoom-prose h3{font-size:12px;color:${C.textSub};margin:10px 0 4px;font-family:${MONO};} .zoom-prose ul{padding-left:16px;} .zoom-prose li{margin:3px 0;}`}</style>
    </div>
  );
}
