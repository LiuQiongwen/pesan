import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, HelpCircle, TrendingUp, Zap, CheckCircle, XCircle, AlertCircle, RefreshCw, ArrowUpRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { useAnticipationItems, AnticipationItem } from '@/hooks/useAnticipationItems';
import { formatDistanceToNow } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';

const C = { bg:'#0a0b0d', surface:'#0e1012', border:'#1e2226', text:'#dde1e8', textSub:'#7a7f8a', textMute:'#4a4f5a', accent:'#00ff66', amber:'#ffaa44', cyan:'#66e3ff', purple:'#b49cff', red:'#ff6666', teal:'#00d4aa' };
const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

const STEPS = [
  'Reading knowledge corpus…','Mapping conceptual frontier…','Identifying knowledge gaps…',
  'Generating open questions…','Predicting future needs…','Detecting emerging tensions…',
  'Calibrating confidence…','Finalizing anticipations…',
];

const TYPE_CONFIG = {
  open_question:    { label:'OPEN QUESTION',    icon: HelpCircle,   color:'#66e3ff', bg:'rgba(102,227,255,0.06)',  borderColor:'rgba(102,227,255,0.15)' },
  predicted_need:   { label:'PREDICTED NEED',   icon: TrendingUp,   color:'#00ff66', bg:'rgba(0,255,102,0.06)',   borderColor:'rgba(0,255,102,0.15)' },
  emerging_tension: { label:'EMERGING TENSION', icon: Zap,          color:'#ffaa44', bg:'rgba(255,170,68,0.06)',  borderColor:'rgba(255,170,68,0.15)' },
};
const CONF_COLOR = { high:'#00ff66', medium:'#ffaa44', low:'#7a7f8a' };
const TYPES = ['open_question','predicted_need','emerging_tension'] as const;

function ItemCard({ item, notes, onStatus }: { item: AnticipationItem; notes: {id:string,title:string}[]; onStatus:(id:string,s:AnticipationItem['status'])=>void }) {
  const navigate = useNavigate();
  const t = useT();
  const { lang } = useLanguage();
  const cfg = TYPE_CONFIG[item.item_type];
  const Icon = cfg.icon;
  const related = item.related_note_ids?.map(id => notes.find(n => n.id === id)).filter(Boolean) as {id:string,title:string}[];

  return (
    <div style={{ background:cfg.bg, border:`1px solid ${cfg.borderColor}`, borderRadius:8, padding:14 }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
        <div style={{ width:26, height:26, borderRadius:5, background:`${cfg.color}12`, border:`1px solid ${cfg.color}30`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Icon size={11} color={cfg.color} />
        </div>
        <div style={{ flex:1 }}>
          <p style={{ fontFamily:INTER, fontSize:13, color:C.text, lineHeight:1.6, margin:'0 0 6px' }}>{item.content}</p>
          {item.reasoning && <p style={{ fontFamily:MONO, fontSize:10, color:C.textSub, lineHeight:1.5, margin:0 }}>{item.reasoning}</p>}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:4, flexShrink:0 }}>
          <div style={{ fontFamily:MONO, fontSize:8, color:CONF_COLOR[item.confidence], padding:'2px 6px', background:`${CONF_COLOR[item.confidence]}12`, border:`1px solid ${CONF_COLOR[item.confidence]}28`, borderRadius:3 }}>
            {item.confidence.toUpperCase()}
          </div>
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:10 }}>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {related.map(n => (
            <button key={n.id} onClick={()=>navigate(`/note/${n.id}`)}
              style={{ display:'flex', alignItems:'center', gap:3, background:'transparent', border:`1px solid ${C.border}`, borderRadius:3, padding:'2px 6px', cursor:'pointer', fontFamily:MONO, fontSize:9, color:C.textMute }}>
              <ArrowUpRight size={8} /> {n.title?.slice(0,20)}
            </button>
          ))}
          <span style={{ fontFamily:MONO, fontSize:9, color:C.textMute, padding:'2px 0' }}>
            {formatDistanceToNow(new Date(item.created_at), { locale: lang === 'zh' ? zhCN : enUS, addSuffix:true })}
          </span>
        </div>
        <div style={{ display:'flex', gap:5 }}>
          {item.status === 'open' && (
            <>
              <button onClick={()=>onStatus(item.id,'investigating')}
                style={{ display:'flex', alignItems:'center', gap:3, padding:'3px 8px', borderRadius:3, background:'rgba(0,212,170,0.08)', border:'1px solid rgba(0,212,170,0.20)', cursor:'pointer', fontFamily:MONO, fontSize:9, color:'#00d4aa' }}>
                <AlertCircle size={9} /> {t('anticipation.status.investigate')}
              </button>
              <button onClick={()=>onStatus(item.id,'dismissed')}
                style={{ display:'flex', alignItems:'center', gap:3, padding:'3px 8px', borderRadius:3, background:'rgba(255,255,255,0.03)', border:`1px solid ${C.border}`, cursor:'pointer', fontFamily:MONO, fontSize:9, color:C.textMute }}>
                <XCircle size={9} /> {t('anticipation.status.dismiss')}
              </button>
            </>
          )}
          {item.status === 'investigating' && (
            <button onClick={()=>onStatus(item.id,'resolved')}
              style={{ display:'flex', alignItems:'center', gap:3, padding:'3px 8px', borderRadius:3, background:'rgba(0,255,102,0.08)', border:'1px solid rgba(0,255,102,0.20)', cursor:'pointer', fontFamily:MONO, fontSize:9, color:C.accent }}>
              <CheckCircle size={9} /> {t('anticipation.status.resolved')}
            </button>
          )}
          {item.status !== 'open' && (
            <div style={{ fontFamily:MONO, fontSize:9, color:item.status==='investigating'?'#00d4aa':item.status==='resolved'?C.accent:C.textMute, padding:'3px 8px', borderRadius:3, border:`1px solid currentColor`, opacity:0.6 }}>
              {item.status.toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AnticipationLayer() {
  const { user }   = useAuth();
  const { notes }  = useNotes(user?.id);
  const { items, loading, saveMany, updateStatus } = useAnticipationItems(user?.id);
  const t = useT();
  const { lang } = useLanguage();
  const [running, setRunning] = useState(false);
  const [step, setStep]       = useState(0);
  const [err, setErr]         = useState('');
  const [activeType, setActiveType] = useState<typeof TYPES[number] | 'all'>('all');

  const STEPS_BILINGUAL = [
    { zh: '阅读知识库…',     en: 'Reading knowledge corpus…' },
    { zh: '绘制概念边界…',   en: 'Mapping conceptual frontier…' },
    { zh: '识别知识盲区…',   en: 'Identifying knowledge gaps…' },
    { zh: '生成开放问题…',   en: 'Generating open questions…' },
    { zh: '预测未来需求…',   en: 'Predicting future needs…' },
    { zh: '检测新兴张力…',   en: 'Detecting emerging tensions…' },
    { zh: '校准置信度…',     en: 'Calibrating confidence…' },
    { zh: '完成前瞻报告…',   en: 'Finalizing anticipations…' },
  ];
  const currentStep = STEPS_BILINGUAL[step]?.[lang] || STEPS_BILINGUAL[step]?.en || '';

  const generate = async () => {
    if (!notes?.length) { setErr('No notes to analyze.'); return; }
    setRunning(true); setErr(''); setStep(0);
    const ticker = setInterval(() => setStep(s => Math.min(s+1, STEPS.length-1)), 600);
    try {
      const noteSummaries = notes.map(n => ({ id:(n as {id:string}).id, title:(n as {title?:string}).title||'Untitled', summary:((n as {summary?:string}).summary||'').slice(0,100), tags:(n as {tags?:string[]}).tags||[] }));
      const { data, error } = await supabase.functions.invoke('anticipation-layer', { body: { notes: noteSummaries } });
      if (error || !data?.success) throw new Error(error?.message || data?.error || 'AI error');
      const rawItems = (data.data?.items || []) as {item_type:string;content:string;reasoning?:string;confidence?:string;related_note_ids?:string[]}[];
      await saveMany(rawItems.map(i => ({
        item_type: i.item_type as AnticipationItem['item_type'],
        content: i.content,
        reasoning: i.reasoning || null,
        confidence: (i.confidence || 'medium') as AnticipationItem['confidence'],
        related_note_ids: i.related_note_ids || [],
      })));
    } catch(e: unknown) {
      setErr(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      clearInterval(ticker);
      setRunning(false);
    }
  };

  const filtered = activeType === 'all' ? items : items.filter(i => i.item_type === activeType);
  const counts = TYPES.reduce((acc, t) => ({ ...acc, [t]: items.filter(i => i.item_type === t).length }), {} as Record<string,number>);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:C.bg, overflow:'hidden', fontFamily:INTER }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 24px', borderBottom:`1px solid ${C.border}`, background:C.surface, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:28, height:28, borderRadius:6, background:'rgba(255,170,68,0.08)', border:'1px solid rgba(255,170,68,0.20)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Sparkles size={13} color={C.amber} />
          </div>
          <span style={{ fontFamily:MONO, fontSize:11, fontWeight:700, color:C.text, letterSpacing:'0.12em' }}>ANTICIPATION LAYER</span>
        </div>
        <button onClick={generate} disabled={running}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:5, background: running ? 'rgba(255,170,68,0.08)' : C.amber, border:'none', cursor: running ? 'wait' : 'pointer', fontFamily:MONO, fontSize:10, fontWeight:700, color: running ? C.amber : '#040508', letterSpacing:'0.08em' }}>
          <RefreshCw size={11} style={{ animation: running ? 'spin 1s linear infinite' : 'none' }} />
          {running ? currentStep : t('anticipation.generate')}
        </button>
      </div>

      {/* Type filter tabs */}
      <div style={{ display:'flex', gap:6, padding:'10px 24px', borderBottom:`1px solid ${C.border}`, background:C.surface, flexShrink:0 }}>
        {(['all',...TYPES] as const).map(t => {
          const cfg = t === 'all' ? null : TYPE_CONFIG[t];
          const count = t === 'all' ? items.length : counts[t] || 0;
          return (
            <button key={t} onClick={()=>setActiveType(t)}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:4, cursor:'pointer', background: activeType===t ? (cfg?.bg||'rgba(221,225,232,0.06)') : 'transparent', border:`1px solid ${activeType===t ? (cfg?.borderColor||C.border) : C.border}`, fontFamily:MONO, fontSize:9, color: activeType===t ? (cfg?.color||C.text) : C.textMute }}>
              {t==='all' ? 'ALL' : t.replace('_',' ').toUpperCase()} {count}
            </button>
          );
        })}
      </div>

      {err && <div style={{ padding:'8px 24px', background:'rgba(255,102,102,0.08)', borderBottom:`1px solid rgba(255,102,102,0.20)`, fontFamily:MONO, fontSize:11, color:C.red }}>{err}</div>}

      <div style={{ flex:1, overflowY:'auto', padding:'16px 24px', display:'flex', flexDirection:'column', gap:10 }}>
        {loading && <div style={{ fontFamily:MONO, fontSize:11, color:C.textMute, textAlign:'center', paddingTop:40 }}>Loading…</div>}
        {!loading && items.length === 0 && !running && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60%', gap:14, textAlign:'center' }}>
            <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(255,170,68,0.06)', border:'1px solid rgba(255,170,68,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Sparkles size={20} color='rgba(255,170,68,0.4)' />
            </div>
            <div>
              <div style={{ fontFamily:MONO, fontSize:12, color:C.text, marginBottom:6 }}>{t('anticipation.noItems')}</div>
              <div style={{ fontFamily:INTER, fontSize:13, color:C.textMute, maxWidth:340 }}>
                {t('anticipation.noItems.desc')}
              </div>
            </div>
            <button onClick={generate}
              style={{ padding:'9px 20px', borderRadius:5, background:C.amber, border:'none', cursor:'pointer', fontFamily:MONO, fontSize:10, fontWeight:700, color:'#040508', letterSpacing:'0.08em' }}>
              {t('anticipation.generate')}
            </button>
          </div>
        )}
        {filtered.map(item => (
          <ItemCard key={item.id} item={item} notes={notes as {id:string,title:string}[]} onStatus={updateStatus} />
        ))}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
