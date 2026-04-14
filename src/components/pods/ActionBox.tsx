/**
 * Action Pod — 行动舱
 * Accent: #ff4466 (vivid red-pink)
 * Philosophy: Think → Execute. A launchpad for ideas.
 */
import { useState } from 'react';
import { Zap, Loader2, Copy, Check, ListTodo, AlignLeft, HelpCircle, PenLine, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const R = '#ff4466';
const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

type ConvertType = 'task' | 'outline' | 'question' | 'material' | 'action';

const CONVERT_TYPES: { key: ConvertType; label: string; icon: typeof Zap; color: string }[] = [
  { key: 'task',     label: '任务',    icon: ListTodo,  color: '#ff4466' },
  { key: 'outline',  label: '提纲',    icon: AlignLeft, color: '#ff8060' },
  { key: 'question', label: '问题',    icon: HelpCircle,color: '#b496ff' },
  { key: 'material', label: '素材',    icon: PenLine,   color: '#66f0ff' },
  { key: 'action',   label: '行动步',  icon: ArrowRight,color: '#00ff66' },
];

export default function ActionBox() {
  const [input,  setInput]  = useState('');
  const [type,   setType]   = useState<ConvertType | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [loading,setLoading]= useState(false);
  const [copied, setCopied] = useState(false);

  const convert = async (t: ConvertType) => {
    if (!input.trim() || loading) { if (!input.trim()) toast.error('请先输入内容'); return; }
    setType(t);
    setOutput(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('knowledge-convert', {
        body: { content: input.slice(0, 2000), convert_type: t },
      });
      if (error || !data?.success) throw new Error(error?.message || '转化失败');
      setOutput(data.result || data.output || '');
      toast.success('转化完成');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '失败');
      setType(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Input */}
      <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="粘贴洞见、想法、笔记片段…"
        rows={4}
        disabled={loading}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '9px 11px',
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid rgba(255,68,102,${input.trim() ? '0.22' : '0.10'})`,
          borderRadius: 7,
          fontFamily: INTER, fontSize: 12,
          color: 'rgba(210,220,240,0.88)',
          outline: 'none', resize: 'none', lineHeight: 1.65,
          transition: 'border-color 0.15s',
        }}
      />

      {/* Convert buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 4 }}>
        {CONVERT_TYPES.map(({ key, label, icon: Icon, color }) => {
          const isActive = type === key;
          const r = parseInt(color.slice(1,3),16);
          const g = parseInt(color.slice(3,5),16);
          const b = parseInt(color.slice(5,7),16);
          return (
            <button
              key={key}
              onClick={() => convert(key)}
              disabled={loading}
              title={`转化为${label}`}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '7px 4px',
                background: isActive ? `rgba(${r},${g},${b},0.14)` : 'rgba(255,255,255,0.03)',
                border: `1px solid rgba(${r},${g},${b},${isActive ? '0.35' : '0.12'})`,
                borderRadius: 7,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.14s',
              }}
              onMouseEnter={e => {
                if (!loading) {
                  (e.currentTarget as HTMLButtonElement).style.background = `rgba(${r},${g},${b},0.10)`;
                  (e.currentTarget as HTMLButtonElement).style.borderColor = `rgba(${r},${g},${b},0.28)`;
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = `rgba(${r},${g},${b},0.12)`;
                }
              }}
            >
              {loading && isActive
                ? <Loader2 size={12} color={color} style={{ animation: 'spin 1s linear infinite' }} />
                : <Icon size={12} color={isActive ? color : 'rgba(130,140,165,0.55)'} />
              }
              <span style={{ fontFamily: MONO, fontSize: 7.5, color: isActive ? color : 'rgba(100,110,135,0.60)', letterSpacing: '0.04em' }}>
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Result */}
      {output && (
        <div style={{
          background: 'rgba(255,68,102,0.04)',
          border: '1px solid rgba(255,68,102,0.14)',
          borderRadius: 8, overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 10px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}>
            <span style={{ fontFamily: MONO, fontSize: 8, color: `${R}60`, letterSpacing: '0.07em' }}>
              → {CONVERT_TYPES.find(c => c.key === type)?.label?.toUpperCase()}
            </span>
            <button
              onClick={handleCopy}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontFamily: MONO, fontSize: 8, letterSpacing: '0.05em',
                color: copied ? '#00ff66' : `${R}60`,
                background: 'none', border: 'none', cursor: 'pointer',
                transition: 'color 0.12s',
              }}
            >
              {copied ? <><Check size={9} /> 已复制</> : <><Copy size={9} /> 复制</>}
            </button>
          </div>
          <div style={{ padding: '10px 12px' }}>
            <pre style={{
              fontFamily: INTER, fontSize: 11.5, color: 'rgba(200,215,240,0.85)',
              lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {output}
            </pre>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
