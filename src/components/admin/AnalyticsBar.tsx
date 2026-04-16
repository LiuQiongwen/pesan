import { useState, useEffect } from 'react';
import { Check, Clock, DollarSign, TrendingUp, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { MONO, INTER } from './shared';

interface StatsData {
  submitted: number;
  fulfilled: number;
  rejected: number;
  pending: number;
  totalRevenueFen: number;
  todayNew: number;
  subscriptionCount: number;
  creditsCount: number;
}

export function AnalyticsBar() {
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    supabase
      .from('manual_orders')
      .select('status, product_type, amount_fen, created_at')
      .then(({ data }) => {
        if (!data) return;
        const s: StatsData = { submitted: 0, fulfilled: 0, rejected: 0, pending: 0, totalRevenueFen: 0, todayNew: 0, subscriptionCount: 0, creditsCount: 0 };
        data.forEach(row => {
          if (row.status === 'submitted') s.submitted++;
          else if (row.status === 'fulfilled') { s.fulfilled++; s.totalRevenueFen += row.amount_fen ?? 0; }
          else if (row.status === 'rejected') s.rejected++;
          else if (row.status === 'pending') s.pending++;
          if (new Date(row.created_at) >= today) s.todayNew++;
          if (row.product_type === 'subscription') s.subscriptionCount++;
          else if (row.product_type === 'credits') s.creditsCount++;
        });
        setStats(s);
      });
  }, []);

  if (!stats) return null;

  const total = stats.subscriptionCount + stats.creditsCount;
  const subPct = total > 0 ? Math.round((stats.subscriptionCount / total) * 100) : 50;

  const cards = [
    { icon: Clock,      label: '待审核',   value: stats.submitted,                              color: '#66f0ff' },
    { icon: Check,      label: '已发放',   value: stats.fulfilled,                              color: '#b496ff' },
    { icon: DollarSign, label: '总收入',   value: `¥${(stats.totalRevenueFen / 100).toFixed(0)}`, color: '#00e5c8' },
    { icon: TrendingUp, label: '今日新增', value: stats.todayNew,                               color: '#ffa040' },
  ];

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 12 }}>
        {cards.map(c => (
          <div key={c.label} style={{ padding: '14px 16px', borderRadius: 12, border: `1px solid ${c.color}18`, background: `${c.color}06` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <c.icon size={12} color={`${c.color}bb`} />
              <span style={{ fontFamily: MONO, fontSize: 8, color: `${c.color}88`, letterSpacing: '0.06em' }}>{c.label}</span>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>
      {total > 0 && (
        <div style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Package size={11} color="rgba(120,130,160,0.60)" />
              <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(100,110,140,0.60)', letterSpacing: '0.06em' }}>订单类型分布 · 共 {total} 笔</span>
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: '#b496ff' }}>订阅 {stats.subscriptionCount}</span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: '#ffa040' }}>Credits {stats.creditsCount}</span>
            </div>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', height: '100%' }}>
              <div style={{ width: `${subPct}%`, background: 'linear-gradient(90deg,#b496ff,#9b74ff)', transition: 'width 0.6s ease' }} />
              <div style={{ flex: 1, background: 'linear-gradient(90deg,#ffa040,#ff8040)' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
