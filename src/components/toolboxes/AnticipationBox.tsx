import { useState } from 'react';
import { Sparkles, Loader2, TrendingUp, AlertTriangle, Lightbulb } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import { useT } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";
const PINK = '#ff64b4';

interface Item { type: string; content: string; reasoning: string }

export default function AnticipationBox() {
  const { user } = useAuth();
  const { notes } = useNotes(user?.id);
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Item[]>([]);

  const handleRun = async () => {
    if (loading) return;
    if (notes.length < 3) { toast.error(t('anticipation.needMore') || '需要更多笔记'); return; }
    setLoading(true);
    setItems([]);
    try {
      const noteData = notes.slice(0, 12).map(n => ({ id: n.id, title: n.title, tags: n.tags || [] }));
      const { data, error } = await supabase.functions.invoke('anticipation-layer', { body: { notes: noteData, user_id: user?.id } });
      if (error || !data?.success) throw new Error(error?.message || 'Failed');
      const all = [...(data.data?.trends||[]), ...(data.data?.risks||[]), ...(data.data?.opportunities||[])];
      setItems(all.slice(0, 6));
      toast.success(t('anticipation.done') || '预判完成');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const iconFor = (type: string) => {
    if (type === 'trend') return <TrendingUp size={10} color="#00ff66" />;
    if (type === 'risk') return <AlertTriangle size={10} color="#ffa040" />;
    return <Lightbulb size={10} color={PINK} />;
  };
  const colorFor = (type: string) => type === 'trend' ? '#00ff66' : type === 'risk' ? '#ffa040' : PINK;

  return (
    <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ fontFamily:INTER, fontSize:11, color:'rgba(140,150,175,0.65)', lineHeight:1.6 }}>
        {t('anticipation.desc') || '基于知识图谱预测趋势、风险与机会'}
      </div>

      <button
        onClick={handleRun}
        disabled={loading}
        style={{
          display:'flex', alignItems:'center', justifyContent:'center', gap:6,
          fontFamily:MONO, fontSize:10, letterSpacing:'0.05em',
          color: loading ? `${PINK}40` : '#040508',
          background: loading ? `${PINK}08` : PINK,
          border:'none', borderRadius:6, padding:'9px 0', cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? <Loader2 size={12} style={{ animation:'spin 1s linear infinite' }} /> : <Sparkles size={12} />}
        {loading ? '预判中…' : (t('anticipation.run') || '运行预判')}
      </button>

      {items.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {items.map((item, i) => (
            <div key={i} style={{ display:'flex', gap:7, padding:'7px 9px', background:`${colorFor(item.type)}08`, border:`1px solid ${colorFor(item.type)}20`, borderRadius:6 }}>
              <span style={{ flexShrink:0, marginTop:1 }}>{iconFor(item.type)}</span>
              <div>
                <div style={{ fontFamily:INTER, fontSize:11, color:'rgba(200,210,230,0.85)', lineHeight:1.5 }}>{item.content}</div>
                {item.reasoning && (
                  <div style={{ fontFamily:INTER, fontSize:10, color:'rgba(120,130,155,0.60)', marginTop:2, lineHeight:1.5 }}>{item.reasoning}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
