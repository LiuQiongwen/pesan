import { useState } from 'react';
import { FlaskConical, Loader2, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import { useT } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";
const ORANGE = '#ffa040';

export default function DistillerBox() {
  const { user } = useAuth();
  const { notes } = useNotes(user?.id);
  const t = useT();
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ essence?: string[]; implications?: string[]; questions?: string[] } | null>(null);

  const handleDistill = async () => {
    if (!selectedId || loading) return;
    const note = notes.find(n => n.id === selectedId);
    if (!note) return;
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('distill-insight', {
        body: {
          note_id: note.id,
          content: [note.content_markdown || note.summary_markdown || note.summary || ''].join('\n').slice(0, 3000),
          title: note.title,
        },
      });
      if (error || !data?.success) throw new Error(error?.message || data?.error || 'Failed');
      setResult(data.data || data);
      toast.success(t('distiller.success') || '蒸馏完成');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>

      {/* Select note */}
      <div style={{ position:'relative' }}>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          disabled={loading}
          style={{
            width:'100%', padding:'8px 28px 8px 10px',
            background:'rgba(255,255,255,0.04)',
            border:'1px solid rgba(255,165,64,0.18)',
            borderRadius:6,
            fontFamily:INTER, fontSize:11,
            color: selectedId ? 'rgba(200,210,230,0.85)' : 'rgba(100,110,130,0.55)',
            outline:'none',
            appearance:'none', cursor:'pointer',
          }}
        >
          <option value="">{t('distiller.selectNote') || '选择一篇笔记…'}</option>
          {notes.map(n => (
            <option key={n.id} value={n.id}>{n.title || '(untitled)'}</option>
          ))}
        </select>
        <ChevronDown size={10} style={{ position:'absolute', right:9, top:'50%', transform:'translateY(-50%)', color:'rgba(100,110,130,0.50)', pointerEvents:'none' }} />
      </div>

      {/* Run button */}
      <button
        onClick={handleDistill}
        disabled={!selectedId || loading}
        style={{
          display:'flex', alignItems:'center', justifyContent:'center', gap:6,
          fontFamily:MONO, fontSize:10, letterSpacing:'0.05em',
          color: !selectedId ? 'rgba(255,165,64,0.30)' : '#040508',
          background: !selectedId ? 'rgba(255,165,64,0.06)' : ORANGE,
          border:'none', borderRadius:6, padding:'9px 0',
          cursor: !selectedId || loading ? 'not-allowed' : 'pointer',
          transition:'all 0.15s',
        }}
      >
        {loading ? <Loader2 size={12} style={{ animation:'spin 1s linear infinite' }} /> : <FlaskConical size={12} />}
        {loading ? '蒸馏中…' : (t('distiller.run') || '运行蒸馏')}
      </button>

      {/* Results */}
      {result && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {[
            { key:'essence', label:'核心洞见', color:'#ffa040' },
            { key:'implications', label:'深层含义', color:'#b496ff' },
            { key:'questions', label:'关键问题', color:'#66f0ff' },
          ].map(({ key, label, color }) => {
            const items = result[key as keyof typeof result] as string[] | undefined;
            if (!items?.length) return null;
            return (
              <div key={key}>
                <div style={{ fontFamily:MONO, fontSize:8, color:`${color}80`, letterSpacing:'0.07em', marginBottom:4 }}>{label.toUpperCase()}</div>
                {items.map((item, i) => (
                  <div key={i} style={{ display:'flex', gap:6, marginBottom:3 }}>
                    <span style={{ color:`${color}60`, fontSize:10 }}>·</span>
                    <span style={{ fontFamily:INTER, fontSize:11, color:'rgba(180,190,210,0.82)', lineHeight:1.5 }}>{item}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
