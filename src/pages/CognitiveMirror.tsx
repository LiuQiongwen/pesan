import { useState, type ComponentType, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Scan, RefreshCw, AlertTriangle, TrendingUp, Eye, Zap, Activity, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { useCognitiveReports, CognitiveReport } from '@/hooks/useCognitiveReports';
import { format } from 'date-fns';

const C = { bg:'#0a0b0d', surface:'#0e1012', surface2:'#12151a', border:'#1e2226', text:'#dde1e8', textSub:'#7a7f8a', textMute:'#4a4f5a', accent:'#00ff66', amber:'#ffaa44', cyan:'#66e3ff', purple:'#b49cff', red:'#ff6666' };
const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

const STEPS = [
  'Scanning knowledge corpus…','Mapping concept topology…','Identifying dominant themes…',
  'Detecting cognitive patterns…','Surfacing blind spots…','Analyzing intellectual diet…',
  'Composing mirror report…','Calibrating confidence…',
];

function ThemeBar({ theme, weight, count }: { theme: string; weight: number; count: number }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontFamily:MONO, fontSize:11, color:C.text }}>{theme}</span>
        <span style={{ fontFamily:MONO, fontSize:10, color:C.textMute }}>{count} notes · {Math.round(weight*100)}%</span>
      </div>
      <div style={{ height:4, background:'rgba(255,255,255,0.05)', borderRadius:2, overflow:'hidden' }}>
        <div style={{ width:`${weight*100}%`, height:'100%', background:`linear-gradient(90deg,${C.accent},${C.cyan})`, borderRadius:2, transition:'width 0.8s ease' }} />
      </div>
    </div>
  );
}

function DietWheel({ diet }: { diet: Record<string,number> }) {
  const entries = Object.entries(diet).sort((a,b)=>b[1]-a[1]);
  const colors = [C.accent, C.cyan, C.amber, C.purple, '#ff6666'];
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {entries.map(([label, pct], i) => (
        <div key={label} style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:colors[i%colors.length], flexShrink:0 }} />
          <span style={{ fontFamily:INTER, fontSize:12, color:C.text, flex:1 }}>{label}</span>
          <span style={{ fontFamily:MONO, fontSize:10, color:C.textMute }}>{pct}%</span>
          <div style={{ width:60, height:3, background:'rgba(255,255,255,0.05)', borderRadius:2 }}>
            <div style={{ width:`${pct}%`, height:'100%', background:colors[i%colors.length], borderRadius:2 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Card({ title, icon: Icon, color, children }: { title:string; icon:ComponentType<{size?:number,color?:string}>; color:string; children:ReactNode }) {
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
        <div style={{ width:24, height:24, borderRadius:5, background:`${color}12`, border:`1px solid ${color}30`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={11} color={color} />
        </div>
        <span style={{ fontFamily:MONO, fontSize:10, fontWeight:700, color:C.textSub, letterSpacing:'0.1em' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

export default function CognitiveMirror() {
  const { user }     = useAuth();
  const { notes }    = useNotes(user?.id);
  const { latest, loading: reportLoading, save } = useCognitiveReports(user?.id);
  const t = useT();
  const { lang } = useLanguage();
  const [running, setRunning]  = useState(false);
  const [step, setStep]        = useState(0);
  const [err, setErr]          = useState('');

  const STEPS_BILINGUAL = [
    { zh: '扫描知识库…',    en: 'Scanning knowledge corpus…' },
    { zh: '绘制概念图…',    en: 'Mapping concept topology…' },
    { zh: '识别主导主题…',  en: 'Identifying dominant themes…' },
    { zh: '检测认知模式…',  en: 'Detecting cognitive patterns…' },
    { zh: '浮现盲区…',      en: 'Surfacing blind spots…' },
    { zh: '分析知识饮食…',  en: 'Analyzing intellectual diet…' },
    { zh: '撰写镜像报告…',  en: 'Composing mirror report…' },
    { zh: '校准置信度…',    en: 'Calibrating confidence…' },
  ];
  const currentStep = STEPS_BILINGUAL[step]?.[lang] || STEPS_BILINGUAL[step]?.en || '';

  const runAnalysis = async () => {
    if (!notes?.length) { setErr('No notes to analyze.'); return; }
    setRunning(true); setErr(''); setStep(0);
    const ticker = setInterval(() => setStep(s => Math.min(s+1, STEPS.length-1)), 700);
    try {
      const noteSummaries = notes.map(n => ({ title:(n as {title?:string}).title||'Untitled', tags:(n as {tags?:string[]}).tags||[], created_at:(n as {created_at?:string}).created_at||'' }));
      const { data, error } = await supabase.functions.invoke('cognitive-mirror', { body: { notes: noteSummaries } });
      if (error || !data?.success) throw new Error(error?.message || data?.error || 'AI error');
      const r = data.data as Partial<CognitiveReport>;
      await save({
        notes_analyzed: notes.length,
        dominant_themes: r.dominant_themes || [],
        blind_spots: r.blind_spots || [],
        bias_signatures: r.bias_signatures || [],
        thinking_style: r.thinking_style || '',
        intellectual_diet: r.intellectual_diet || {},
        stagnation_alerts: r.stagnation_alerts || [],
        report_markdown: r.report_markdown || '',
      });
    } catch(e: unknown) {
      setErr(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      clearInterval(ticker);
      setRunning(false);
    }
  };

  const report = latest as CognitiveReport | null;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:C.bg, overflow:'hidden', fontFamily:INTER }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 24px', borderBottom:`1px solid ${C.border}`, background:C.surface, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:28, height:28, borderRadius:6, background:`rgba(180,156,255,0.08)`, border:`1px solid rgba(180,156,255,0.20)`, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Scan size={13} color={C.purple} />
          </div>
          <span style={{ fontFamily:MONO, fontSize:11, fontWeight:700, color:C.text, letterSpacing:'0.12em' }}>COGNITIVE MIRROR</span>
          {report && <span style={{ fontFamily:MONO, fontSize:9, color:C.textMute, marginLeft:6 }}>{t('mirror.lastScan')} {format(new Date(report.created_at), 'MM-dd HH:mm')}</span>}
        </div>
        <button onClick={runAnalysis} disabled={running}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:5, background: running ? 'rgba(180,156,255,0.08)' : C.purple, border:'none', cursor: running ? 'wait' : 'pointer', fontFamily:MONO, fontSize:10, fontWeight:700, color: running ? C.purple : '#040508', letterSpacing:'0.08em' }}>
          <RefreshCw size={11} style={{ animation: running ? 'spin 1s linear infinite' : 'none' }} />
          {running ? currentStep : t('mirror.runAnalysis')}
        </button>
      </div>

      {err && <div style={{ padding:'8px 24px', background:'rgba(255,102,102,0.08)', borderBottom:`1px solid rgba(255,102,102,0.20)`, fontFamily:MONO, fontSize:11, color:C.red }}>{err}</div>}

      <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>
        {reportLoading && <div style={{ fontFamily:MONO, fontSize:11, color:C.textMute, textAlign:'center', paddingTop:40 }}>Loading…</div>}

        {!reportLoading && !report && !running && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60%', gap:16 }}>
            <div style={{ width:64, height:64, borderRadius:'50%', background:`rgba(180,156,255,0.06)`, border:`1px solid rgba(180,156,255,0.15)`, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Scan size={24} color={`rgba(180,156,255,0.4)`} />
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontFamily:MONO, fontSize:12, color:C.text, marginBottom:6 }}>{t('mirror.noAnalysis')}</div>
              <div style={{ fontFamily:INTER, fontSize:13, color:C.textMute, maxWidth:320 }}>
                {t('mirror.noAnalysis.desc')}
              </div>
            </div>
            <button onClick={runAnalysis}
              style={{ padding:'9px 20px', borderRadius:5, background:C.purple, border:'none', cursor:'pointer', fontFamily:MONO, fontSize:10, fontWeight:700, color:'#040508', letterSpacing:'0.08em' }}>
              {t('mirror.firstAnalysis')}
            </button>
          </div>
        )}

        {report && !running && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {/* Portrait */}
            {report.report_markdown && (
              <div style={{ background:`rgba(180,156,255,0.04)`, border:`1px solid rgba(180,156,255,0.15)`, borderRadius:8, padding:16 }}>
                <div style={{ fontFamily:MONO, fontSize:9, color:C.purple, letterSpacing:'0.1em', marginBottom:10 }}>{t('mirror.portrait')} · {report.notes_analyzed} {t('mirror.notesAnalyzed')}</div>
                <div style={{ fontFamily:INTER, fontSize:13, color:C.text, lineHeight:1.7 }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.report_markdown}</ReactMarkdown>
                </div>
              </div>
            )}

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              {/* Themes */}
              {report.dominant_themes?.length > 0 && (
                <Card title={t('mirror.themes')} icon={TrendingUp} color={C.accent}>
                  {report.dominant_themes.map(th => <ThemeBar key={th.theme} theme={th.theme} weight={th.weight} count={th.note_count} />)}
                </Card>
              )}

              {/* Intellectual Diet */}
              {report.intellectual_diet && Object.keys(report.intellectual_diet).length > 0 && (
                <Card title={t('mirror.diet')} icon={Activity} color={C.cyan}>
                  <DietWheel diet={report.intellectual_diet} />
                </Card>
              )}

              {/* Blind Spots */}
              {report.blind_spots?.length > 0 && (
                <Card title={t('mirror.blindSpots')} icon={Eye} color={C.amber}>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {report.blind_spots.map((s,i) => (
                      <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                        <ChevronRight size={11} color={C.amber} style={{ flexShrink:0, marginTop:2 }} />
                        <span style={{ fontFamily:INTER, fontSize:12, color:C.text, lineHeight:1.5 }}>{s}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Bias Signatures */}
              {report.bias_signatures?.length > 0 && (
                <Card title={t('mirror.biases')} icon={AlertTriangle} color={C.red}>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {report.bias_signatures.map((s,i) => (
                      <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                        <div style={{ width:4, height:4, borderRadius:'50%', background:C.red, flexShrink:0, marginTop:5 }} />
                        <span style={{ fontFamily:INTER, fontSize:12, color:C.text, lineHeight:1.5 }}>{s}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>

            {/* Thinking style + stagnation */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              {report.thinking_style && (
                <Card title={t('mirror.thinkingStyle')} icon={Zap} color={C.purple}>
                  <p style={{ fontFamily:INTER, fontSize:13, color:C.text, lineHeight:1.6, margin:0 }}>{report.thinking_style}</p>
                </Card>
              )}
              {report.stagnation_alerts?.length > 0 && (
                <Card title={t('mirror.stagnation')} icon={AlertTriangle} color='#ffaa44'>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {report.stagnation_alerts.map((s,i) => (
                      <div key={i} style={{ fontFamily:INTER, fontSize:12, color:C.text, padding:'5px 8px', background:'rgba(255,170,68,0.05)', borderRadius:4, border:'1px solid rgba(255,170,68,0.15)' }}>{s}</div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
