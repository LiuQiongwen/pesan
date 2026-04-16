import { useState, useEffect } from 'react';
import { RefreshCw, FolderOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const INTER = "'Inter',system-ui,sans-serif";
const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";

interface UserProjects {
  userId: string; username: string | null; email: string | null;
  notes: number; distillations: number; rag_queries: number; analyses: number; actions: number;
  chunks: number;
}

export default function ProjectsPage() {
  const [rows, setRows]       = useState<UserProjects[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-user-list', { body: { page: 0, limit: 100 } });
      if (error) throw error;
      const mapped = (data?.users ?? []).map((u: { id: string; username: string | null; email: string | null; usage: { notes: number; distillations: number; rag_queries: number; analyses: number; actions: number } }) => ({
        userId: u.id, username: u.username, email: u.email,
        notes: u.usage.notes, distillations: u.usage.distillations,
        rag_queries: u.usage.rag_queries, analyses: u.usage.analyses,
        actions: u.usage.actions, chunks: 0,
      }));
      setRows(mapped);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const totalNotes = rows.reduce((a, r) => a + r.notes, 0);
  const totalRAG   = rows.reduce((a, r) => a + r.rag_queries, 0);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: INTER, fontSize: 20, fontWeight: 700, color: 'rgba(220,230,248,0.92)', margin: 0 }}>项目管理</h1>
        <p style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(120,132,158,0.60)', margin: '4px 0 0', letterSpacing: '0.04em' }}>各用户内容统计 · 笔记 · 知识块 · RAG 对话</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: '总笔记数', value: totalNotes, color: '#66f0ff' },
          { label: '总 RAG 对话', value: totalRAG, color: '#00e5c8' },
          { label: '活跃用户', value: rows.filter(r => r.notes > 0).length, color: '#b496ff' },
        ].map(s => (
          <div key={s.label} style={{ padding: '16px 18px', borderRadius: 10, border: `1px solid ${s.color}18`, background: `${s.color}06` }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: `${s.color}80`, letterSpacing: '0.06em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={fetch} style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <RefreshCw size={12} color="rgba(140,150,175,0.70)" style={{ animation: loading ? 'spin 1s linear infinite' : undefined }} />
        </button>
      </div>

      <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 12, padding: '9px 16px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {['用户', '笔记', '蒸馏', 'RAG 对话', '分析', '任务'].map(h => <div key={h} style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(120,132,158,0.55)', letterSpacing: '0.06em' }}>{h}</div>)}
        </div>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(96,192,96,0.20)', borderTopColor: '#60c060', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <FolderOpen size={32} color="rgba(120,132,158,0.30)" />
            <span style={{ fontFamily: INTER, fontSize: 13, color: 'rgba(120,132,158,0.45)' }}>暂无数据</span>
          </div>
        ) : rows.map((r, i) => (
          <div key={r.userId} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 12, padding: '11px 16px', borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: INTER, fontSize: 12, fontWeight: 600, color: 'rgba(220,230,248,0.88)' }}>{r.username ?? '—'}</div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(120,132,158,0.50)', marginTop: 1 }}>{r.email ?? '—'}</div>
            </div>
            <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: '#66f0ff' }}>{r.notes}</span>
            <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: '#b496ff' }}>{r.distillations}</span>
            <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: '#00e5c8' }}>{r.rag_queries}</span>
            <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: '#ff6688' }}>{r.analyses}</span>
            <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: '#ffa040' }}>{r.actions}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
