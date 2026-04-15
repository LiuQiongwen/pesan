/**
 * Insight Pod — 洞察舱
 * Accent: #b496ff
 * Features: 4 interpretation modes, auto-receive relay, layered output, Send to Action
 */
import { useState, useEffect } from 'react';
import { Loader2, ChevronDown, ChevronUp, Sparkles, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import { supabase } from '@/integrations/supabase/client';
import { useAgentWorkflow } from '@/contexts/AgentWorkflowContext';
import { toast } from 'sonner';

const P     = '#b496ff';
const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

type InterpMode = 'summary' | 'research' | 'writing' | 'reflection';

const INTERP_MODES: { key: InterpMode; label: string; hint: string }[] = [
  { key: 'summary',    label: '摘要', hint: '提炼核心观点' },
  { key: 'research',   label: '研究', hint: '深度分析拆解' },
  { key: 'writing',    label: '写作', hint: '转化为写作素材' },
  { key: 'reflection', label: '反思', hint: '个人意义提炼' },
];

function hexInts(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

interface Layer { label: string; color: string; items: string[] }

function InsightLayer({ label, color, items }: Layer) {
  const [open, setOpen] = useState(true);
  if (!items?.length) return null;
  return (
    <div style={{ border: `1px solid rgba(${hexInts(color)},0.15)`, borderRadius: 7, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px', background: `rgba(${hexInts(color)},0.07)`, border: 'none', cursor: 'pointer',
      }}>
        <span style={{ fontFamily: MONO, fontSize: 8, color: `rgba(${hexInts(color)},0.75)`, letterSpacing: '0.07em' }}>
          {label.toUpperCase()}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontFamily: MONO, fontSize: 8, color: `rgba(${hexInts(color)},0.40)` }}>{items.length}</span>
          {open ? <ChevronUp size={9} color={`rgba(${hexInts(color)},0.45)`} /> : <ChevronDown size={9} color={`rgba(${hexInts(color)},0.45)`} />}
        </div>
      </button>
      {open && (
        <div style={{ padding: '6px 10px 8px' }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 4, alignItems: 'flex-start' }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: `rgba(${hexInts(color)},0.55)`, flexShrink: 0, marginTop: 5 }} />
              <span style={{ fontFamily: INTER, fontSize: 11.5, color: 'rgba(200,215,240,0.82)', lineHeight: 1.6 }}>{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface InsightResult {
  summary?: string;
  key_points?: string[];
  insights?: string[];
  actionables?: string[];
}

export default function InsightBox() {
  const { user }  = useAuth();
  const { notes } = useNotes(user?.id);
  const workflow  = useAgentWorkflow();

  const [interpMode,   setInterpMode]   = useState<InterpMode>('summary');
  const [selectedId,   setSelectedId]   = useState('');
  const [freeText,     setFreeText]     = useState('');
  const [inputMode,    setInputMode]    = useState<'note' | 'text'>('note');
  const [loading,      setLoading]      = useState(false);
  const [result,       setResult]       = useState<InsightResult | null>(null);
  const [relayBanner,  setRelayBanner]  = useState<string | null>(null);

  // Auto-receive relay (supports __noteId__:xxx prefix for direct note selection)
  useEffect(() => {
    const relayed = workflow.consumeRelay('insight');
    if (relayed) {
      if (relayed.startsWith('__noteId__:')) {
        // Drag-to-pod: extract note ID and auto-select it
        const noteId = relayed.slice('__noteId__:'.length).split('\n')[0].trim();
        setSelectedId(noteId);
        setInputMode('note');
        setRelayBanner('← 来自星图拖拽');
        workflow.setActiveStep('insight');
        setTimeout(() => setRelayBanner(null), 4000);
      } else {
        setFreeText(relayed);
        setInputMode('text');
        const src = workflow.relay?.sourcePod === 'retrieval' ? '检索舱' : '捕获舱';
        setRelayBanner(`← 来自${src}`);
        workflow.setActiveStep('insight');
        setTimeout(() => setRelayBanner(null), 4000);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow.relay?.timestamp]);

  const canRun = inputMode === 'note' ? !!selectedId : freeText.trim().length > 10;

  const handleRun = async () => {
    if (!canRun || loading) return;
    setLoading(true); setResult(null);
    try {
      let content = '';
      let title   = '';
      if (inputMode === 'note') {
        const note = notes.find(n => n.id === selectedId);
        if (!note) throw new Error('笔记未找到');
        content = [note.content_markdown || '', note.summary_markdown || '', note.summary || ''].join(' ').slice(0, 3000);
        title   = note.title || '';
      } else {
        content = freeText.slice(0, 3000);
        title   = '自由输入内容';
      }
      const { data, error } = await supabase.functions.invoke('distill-insight', {
        body: { note_id: selectedId || 'free', content, title, mode: interpMode },
      });
      if (error) throw new Error(error?.message || '调用失败');
      if (!data?.success) throw new Error(data?.error || '洞察失败');
      // new format: { success, summary, key_points, insights, actionables }
      setResult(data);
      workflow.markStepComplete('insight');
      toast.success('洞察完成');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSendToAction = () => {
    if (!result) return;
    const parts: string[] = [];
    if (result.summary) parts.push('摘要：' + result.summary);
    if (result.key_points?.length) parts.push('要点：' + result.key_points.map(p => '• ' + p).join(' '));
    if (result.insights?.length)   parts.push('洞见：' + result.insights.map(p => '• ' + p).join(' '));
    if (result.actionables?.length) parts.push('下一步：' + result.actionables.map(p => '• ' + p).join(' '));
    workflow.sendRelay(parts.join(' | '), 'insight', 'action');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {relayBanner && (
        <div style={{
          padding: '5px 14px',
          background: 'rgba(180,150,255,0.08)',
          borderBottom: '1px solid rgba(180,150,255,0.12)',
          fontFamily: MONO, fontSize: 8, letterSpacing: '0.07em',
          color: `${P}80`, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: P, boxShadow: `0 0 5px ${P}` }} />
          {relayBanner} · 内容已预填
        </div>
      )}

      {/* Interpretation mode */}
      <div style={{ padding: '8px 14px 6px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ fontFamily: MONO, fontSize: 7.5, color: 'rgba(80,90,115,0.55)', letterSpacing: '0.08em', marginBottom: 5 }}>
          解读模式
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          {INTERP_MODES.map(({ key, label, hint }) => (
            <button key={key} onClick={() => setInterpMode(key)} title={hint} style={{
              flex: 1, fontFamily: MONO, fontSize: 7.5, letterSpacing: '0.04em',
              color: interpMode === key ? '#0d0a18' : `${P}60`,
              background: interpMode === key ? P : 'rgba(180,150,255,0.05)',
              border: `1px solid rgba(180,150,255,${interpMode === key ? '0' : '0.12'})`,
              borderRadius: 5, padding: '4px 0', cursor: 'pointer', transition: 'all 0.12s',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Input area */}
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 3 }}>
          {(['note', 'text'] as const).map(m => (
            <button key={m} onClick={() => setInputMode(m)} style={{
              fontFamily: MONO, fontSize: 7.5, letterSpacing: '0.05em',
              color: inputMode === m ? '#0d0a18' : 'rgba(100,110,135,0.55)',
              background: inputMode === m ? 'rgba(180,150,255,0.60)' : 'rgba(255,255,255,0.04)',
              border: 'none', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', transition: 'all 0.12s',
            }}>
              {m === 'note' ? '选节点' : '自由输入'}
            </button>
          ))}
        </div>

        {inputMode === 'note' ? (
          <div style={{ position: 'relative' }}>
            <select value={selectedId} onChange={e => { setSelectedId(e.target.value); setResult(null); }} disabled={loading}
              style={{
                width: '100%', padding: '8px 28px 8px 10px',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid rgba(180,150,255,${selectedId ? '0.22' : '0.12'})`,
                borderRadius: 7, fontFamily: INTER, fontSize: 11,
                color: selectedId ? 'rgba(210,220,240,0.88)' : 'rgba(100,110,135,0.55)',
                outline: 'none', appearance: 'none' as const, cursor: 'pointer',
              }}>
              <option value="">选择知识节点…</option>
              {notes.map(n => <option key={n.id} value={n.id}>{n.title || '(未命名)'}</option>)}
            </select>
            <ChevronDown size={10} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', color: 'rgba(100,110,135,0.50)', pointerEvents: 'none' }} />
          </div>
        ) : (
          <textarea value={freeText} onChange={e => setFreeText(e.target.value)} rows={4} disabled={loading}
            placeholder="粘贴或输入需要洞察的内容…"
            style={{
              width: '100%', boxSizing: 'border-box' as const, padding: '9px 11px',
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid rgba(180,150,255,${freeText.trim() ? '0.20' : '0.10'})`,
              borderRadius: 7, fontFamily: INTER, fontSize: 12,
              color: 'rgba(210,220,240,0.88)',
              outline: 'none', resize: 'none' as const, lineHeight: 1.65, transition: 'border-color 0.15s',
            }} />
        )}

        <button onClick={handleRun} disabled={!canRun || loading} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em',
          color: canRun && !loading ? '#0d0a18' : `${P}35`,
          background: canRun && !loading ? P : 'rgba(180,150,255,0.07)',
          border: 'none', borderRadius: 7, padding: '9px 0',
          cursor: canRun && !loading ? 'pointer' : 'not-allowed', transition: 'all 0.15s',
        }}>
          {loading
            ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> 精炼中…</>
            : <><Sparkles size={11} /> 运行{INTERP_MODES.find(m => m.key === interpMode)?.hint || '洞察'}</>
          }
        </button>
      </div>

      {/* Layered output */}
      {result && (
        <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {result.summary && (
            <div style={{
              padding: '9px 11px',
              background: 'rgba(180,150,255,0.05)',
              border: '1px solid rgba(180,150,255,0.14)', borderRadius: 7,
            }}>
              <div style={{ fontFamily: MONO, fontSize: 8, color: `${P}60`, letterSpacing: '0.07em', marginBottom: 5 }}>SUMMARY</div>
              <p style={{ fontFamily: INTER, fontSize: 11.5, color: 'rgba(200,215,240,0.85)', lineHeight: 1.72, margin: 0 }}>{result.summary}</p>
            </div>
          )}
          <InsightLayer label="关键点" color="#b496ff" items={result.key_points  || []} />
          <InsightLayer label="洞见"   color="#66f0ff" items={result.insights    || []} />
          <InsightLayer label="下一步" color="#00ff66" items={result.actionables || []} />
          <button onClick={handleSendToAction} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontFamily: MONO, fontSize: 9, letterSpacing: '0.07em',
            color: P, background: 'rgba(180,150,255,0.07)',
            border: '1px solid rgba(180,150,255,0.20)',
            borderRadius: 6, padding: '7px 0', cursor: 'pointer', transition: 'all 0.15s',
          }}>
            <ArrowRight size={10} />
            发送至行动舱
          </button>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
