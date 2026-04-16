import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, BarChart2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { MONO, INTER } from './shared';

interface UserRow {
  id: string;
  username: string | null;
  email: string | null;
  credits: number;
  usage: { notes: number; distillations: number; rag_queries: number; actions: number; analyses: number };
}

const FEATURES = [
  { key: 'notes'         as const, label: '知识笔记', color: '#66f0ff' },
  { key: 'distillations' as const, label: '知识蒸馏', color: '#b496ff' },
  { key: 'rag_queries'   as const, label: 'RAG 检索', color: '#00e5c8' },
  { key: 'actions'       as const, label: '行动任务', color: '#ffa040' },
  { key: 'analyses'      as const, label: '分析报告', color: '#ff4466' },
];

export function AnalyticsPanel() {
  const [users, setUsers]     = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-user-list', { body: { page: 0, limit: 100 } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setUsers(data.users ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Aggregate totals
  const totals = FEATURES.map(f => ({
    ...f,
    total: users.reduce((acc, u) => acc + (u.usage[f.key] ?? 0), 0),
  }));
  const maxTotal = Math.max(...totals.map(t => t.total), 1);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart2 size={15} color="rgba(102,240,255,0.70)" />
          <span style={{ fontFamily: INTER, fontSize: 14, fontWeight: 600, color: 'rgba(210,220,245,0.90)' }}>功能使用统计</span>
        </div>
        <button onClick={fetchUsers} style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <RefreshCw size={12} color="rgba(140,150,175,0.70)" style={{ animation: loading ? 'spin 1s linear infinite' : undefined }} />
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(0,229,200,0.20)', borderTopColor: '#00e5c8', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
        </div>
      ) : (
        <>
          {/* Aggregate feature bars */}
          <div style={{ padding: '18px 20px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', marginBottom: 24 }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(100,110,140,0.55)', letterSpacing: '0.06em', marginBottom: 14 }}>全平台功能使用 · 累计次数</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {totals.map(t => (
                <div key={t.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontFamily: INTER, fontSize: 11, color: 'rgba(180,190,215,0.80)' }}>{t.label}</span>
                    <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: t.color }}>{t.total}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(t.total / maxTotal) * 100}%`, background: `linear-gradient(90deg, ${t.color}cc, ${t.color}55)`, transition: 'width 0.8s ease', borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Per-user usage table */}
          <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(100,110,140,0.55)', letterSpacing: '0.06em', marginBottom: 12 }}>用户使用明细</div>
          <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 1fr', padding: '9px 16px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['用户', 'Credits', '笔记', '蒸馏', 'RAG', '任务', '分析'].map(h => (
                <div key={h} style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(100,110,140,0.55)', letterSpacing: '0.06em' }}>{h}</div>
              ))}
            </div>
            {/* Rows */}
            {users.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', fontFamily: INTER, fontSize: 13, color: 'rgba(100,110,140,0.45)' }}>暂无数据</div>
            ) : (
              users.map((u, i) => (
                <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 1fr', padding: '10px 16px', borderBottom: i < users.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontFamily: INTER, fontSize: 11, color: 'rgba(210,220,245,0.85)' }}>{u.username ?? '—'}</div>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(100,110,140,0.45)', marginTop: 1 }}>{(u.email ?? '').slice(0, 16)}</div>
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: '#ffa040' }}>{u.credits}</span>
                  <span style={{ fontFamily: MONO, fontSize: 12, color: '#66f0ff' }}>{u.usage.notes}</span>
                  <span style={{ fontFamily: MONO, fontSize: 12, color: '#b496ff' }}>{u.usage.distillations}</span>
                  <span style={{ fontFamily: MONO, fontSize: 12, color: '#00e5c8' }}>{u.usage.rag_queries}</span>
                  <span style={{ fontFamily: MONO, fontSize: 12, color: '#ffa040' }}>{u.usage.actions}</span>
                  <span style={{ fontFamily: MONO, fontSize: 12, color: '#ff4466' }}>{u.usage.analyses}</span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
