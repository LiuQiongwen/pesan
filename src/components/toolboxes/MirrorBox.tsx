import { useState } from 'react';
import { Scan, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import { useT } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";
const CYAN = '#66f0ff';

export default function MirrorBox() {
  const { user } = useAuth();
  const { notes } = useNotes(user?.id);
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<{
    dominant_themes?: string[];
    blind_spots?: string[];
    cognitive_biases?: string[];
    report_markdown?: string;
  } | null>(null);

  const handleRun = async () => {
    if (loading || notes.length < 3) { toast.error(t('mirror.needMore') || '需要至少 3 篇笔记'); return; }
    setLoading(true);
    setReport(null);
    try {
      const noteData = notes.slice(0, 15).map(n => ({
        id: n.id, title: n.title, tags: n.tags || [], summary: n.summary || '',
      }));
      const { data, error } = await supabase.functions.invoke('cognitive-mirror', { body: { notes: noteData, user_id: user?.id } });
      if (error || !data?.success) throw new Error(error?.message || 'Failed');
      setReport(data.data || data);
      toast.success(t('mirror.done') || '认知镜像生成完成');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>

      <div style={{ fontFamily:INTER, fontSize:11, color:'rgba(140,150,175,0.65)', lineHeight:1.6 }}>
        {t('mirror.desc') || '分析你的知识库，识别思维模式与认知偏差'}
      </div>

      <button
        onClick={handleRun}
        disabled={loading}
        style={{
          display:'flex', alignItems:'center', justifyContent:'center', gap:6,
          fontFamily:MONO, fontSize:10, letterSpacing:'0.05em',
          color: loading ? 'rgba(102,240,255,0.40)' : '#040508',
          background: loading ? 'rgba(102,240,255,0.08)' : CYAN,
          border:'none', borderRadius:6, padding:'9px 0',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? <Loader2 size={12} style={{ animation:'spin 1s linear infinite' }} /> : <Scan size={12} />}
        {loading ? '分析中…' : (t('mirror.run') || '生成认知镜像')}
      </button>

      {report && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {report.dominant_themes?.length ? (
            <Section label="主导主题" color="#00ff66" items={report.dominant_themes} />
          ) : null}
          {report.blind_spots?.length ? (
            <Section label="盲点区域" color="#ffa040" items={report.blind_spots} />
          ) : null}
          {report.cognitive_biases?.length ? (
            <Section label="认知偏差" color="#ff64b4" items={report.cognitive_biases} />
          ) : null}
          {report.report_markdown && (
            <div style={{ padding:'8px 10px', background:'rgba(102,240,255,0.04)', border:'1px solid rgba(102,240,255,0.10)', borderRadius:6 }}>
              <p style={{ fontFamily:INTER, fontSize:11, color:'rgba(180,195,220,0.80)', lineHeight:1.7, margin:0 }}>
                {report.report_markdown.slice(0, 300)}{report.report_markdown.length > 300 ? '…' : ''}
              </p>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function Section({ label, color, items }: { label: string; color: string; items: string[] }) {
  return (
    <div>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:`${color}70`, letterSpacing:'0.07em', marginBottom:4 }}>{label.toUpperCase()}</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
        {items.map((item, i) => (
          <span key={i} style={{ fontFamily:"'Inter',sans-serif", fontSize:10, color:`${color}cc`, background:`${color}10`, border:`1px solid ${color}25`, padding:'2px 8px', borderRadius:4 }}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
