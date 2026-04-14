/**
 * Insight Pod — 洞察舱
 * Accent: #b496ff (lavender purple)
 * Philosophy: Distill. Structure. Elevate. A knowledge refinery.
 */
import { useState } from 'react';
import { FlaskConical, Loader2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const P = '#b496ff';
const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

interface Layer { label: string; color: string; items: string[] }

function InsightLayer({ label, color, items }: Layer) {
  const [open, setOpen] = useState(true);
  if (!items?.length) return null;
  return (
    <div style={{
      border: `1px solid rgba(${hexToInts(color)},0.15)`,
      borderRadius: 7, overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px',
          background: `rgba(${hexToInts(color)},0.07)`,
          border: 'none', cursor: 'pointer',
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 8, color: `rgba(${hexToInts(color)},0.75)`, letterSpacing: '0.07em' }}>
          {label.toUpperCase()}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontFamily: MONO, fontSize: 8, color: `rgba(${hexToInts(color)},0.40)` }}>
            {items.length}
          </span>
          {open ? <ChevronUp size={9} color={`rgba(${hexToInts(color)},0.45)`} /> : <ChevronDown size={9} color={`rgba(${hexToInts(color)},0.45)`} />}
        </div>
      </button>
      {open && (
        <div style={{ padding: '6px 10px 8px' }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 4, alignItems: 'flex-start' }}>
              <div style={{
                width: 4, height: 4, borderRadius: '50%',
                background: `rgba(${hexToInts(color)},0.55)`,
                flexShrink: 0, marginTop: 5,
              }} />
              <span style={{ fontFamily: INTER, fontSize: 11.5, color: 'rgba(200,215,240,0.82)', lineHeight: 1.6 }}>
                {item}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function hexToInts(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

interface InsightResult {
  summary?: string;
  key_points?: string[];
  insights?: string[];
  actionables?: string[];
}

export default function InsightBox() {
  const { user } = useAuth();
  const { notes } = useNotes(user?.id);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InsightResult | null>(null);

  const handleRun = async () => {
    if (!selectedId || loading) return;
    const note = notes.find(n => n.id === selectedId);
    if (!note) return;
    setLoading(true);
    setResult(null);
    try {
      const content = [note.content_markdown || '', note.summary_markdown || '', note.summary || '']
        .join('\n').slice(0, 3000);
      const { data, error } = await supabase.functions.invoke('distill-insight', {
        body: { note_id: note.id, content, title: note.title },
      });
      if (error || !data?.success) throw new Error(error?.message || '洞察失败');
      setResult(data.data || data);
      toast.success('洞察完成');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Select + run */}
      <div style={{ padding: '12px 14px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ position: 'relative' }}>
          <select
            value={selectedId}
            onChange={e => { setSelectedId(e.target.value); setResult(null); }}
            disabled={loading}
            style={{
              width: '100%', padding: '8px 28px 8px 10px',
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid rgba(180,150,255,${selectedId ? '0.22' : '0.12'})`,
              borderRadius: 7, fontFamily: INTER, fontSize: 11,
              color: selectedId ? 'rgba(210,220,240,0.88)' : 'rgba(100,110,135,0.55)',
              outline: 'none', appearance: 'none', cursor: 'pointer',
            }}
          >
            <option value="">选择笔记节点…</option>
            {notes.map(n => (
              <option key={n.id} value={n.id}>{n.title || '(未命名)'}</option>
            ))}
          </select>
          <ChevronDown size={10} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', color: 'rgba(100,110,135,0.50)', pointerEvents: 'none' }} />
        </div>

        <button
          onClick={handleRun}
          disabled={!selectedId || loading}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em',
            color: selectedId && !loading ? '#0d0a18' : `${P}35`,
            background: selectedId && !loading ? P : 'rgba(180,150,255,0.07)',
            border: 'none', borderRadius: 7, padding: '9px 0',
            cursor: selectedId && !loading ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
          }}
        >
          {loading
            ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> 精炼中…</>
            : <><Sparkles size={11} /> 运行洞察</>
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
              border: '1px solid rgba(180,150,255,0.14)',
              borderRadius: 7,
            }}>
              <div style={{ fontFamily: MONO, fontSize: 8, color: `${P}60`, letterSpacing: '0.07em', marginBottom: 5 }}>SUMMARY</div>
              <p style={{ fontFamily: INTER, fontSize: 11.5, color: 'rgba(200,215,240,0.85)', lineHeight: 1.72, margin: 0 }}>
                {result.summary}
              </p>
            </div>
          )}
          <InsightLayer label="关键点" color="#b496ff" items={result.key_points || []} />
          <InsightLayer label="洞见"   color="#66f0ff" items={result.insights   || []} />
          <InsightLayer label="可执行项" color="#00ff66" items={result.actionables|| []} />
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
