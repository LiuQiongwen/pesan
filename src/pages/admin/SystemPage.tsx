import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const INTER = "'Inter',system-ui,sans-serif";
const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";

interface SystemEvent {
  id: string; event_type: string; severity: string; user_id: string | null;
  message: string | null; payload: Record<string, unknown>; created_at: string;
}

const SEV_COLORS: Record<string, string> = { info: '#66f0ff', warn: '#ffa040', error: '#ff4466' };
const TYPE_LABELS: Record<string, string> = {
  order_fulfilled: '订单发放', order_rejected: '订单拒绝',
  grant_credits: 'Credits 发放', user_banned: '用户禁用', user_unbanned: '用户恢复', error: '系统错误',
};

export default function SystemPage() {
  const [events, setEvents]   = useState<SystemEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter]   = useState<'all' | 'warn' | 'error'>('all');

  const fetch = async () => {
    setLoading(true);
    try {
      let q = supabase.from('system_events').select('*').order('created_at', { ascending: false }).limit(200);
      if (filter !== 'all') q = q.eq('severity', filter);
      const { data } = await q;
      setEvents(data ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [filter]);

  const errorCount = events.filter(e => e.severity === 'error').length;
  const warnCount  = events.filter(e => e.severity === 'warn').length;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: INTER, fontSize: 20, fontWeight: 700, color: 'rgba(220,230,248,0.92)', margin: 0 }}>系统监控</h1>
        <p style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(120,132,158,0.60)', margin: '4px 0 0', letterSpacing: '0.04em' }}>支付事件 · 审核记录 · 异常日志</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: '总事件', value: events.length, color: '#66f0ff' },
          { label: '警告', value: warnCount, color: '#ffa040' },
          { label: '错误', value: errorCount, color: '#ff4466' },
        ].map(s => (
          <div key={s.label} style={{ padding: '16px 18px', borderRadius: 10, border: `1px solid ${s.color}18`, background: `${s.color}06` }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: `${s.color}80`, letterSpacing: '0.06em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center' }}>
        {(['all', 'warn', 'error'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', fontFamily: MONO, fontSize: 9, letterSpacing: '0.06em', color: filter === f ? 'rgba(220,230,248,0.88)' : 'rgba(120,132,158,0.55)', background: filter === f ? 'rgba(255,255,255,0.07)' : 'transparent', border: filter === f ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(255,255,255,0.06)', borderRadius: 7, cursor: 'pointer' }}>
            {f === 'all' ? '全部' : f === 'warn' ? '警告' : '错误'}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={fetch} style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <RefreshCw size={12} color="rgba(140,150,175,0.70)" style={{ animation: loading ? 'spin 1s linear infinite' : undefined }} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(255,68,102,0.20)', borderTopColor: '#ff6688', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
          </div>
        ) : events.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', fontFamily: INTER, fontSize: 13, color: 'rgba(120,132,158,0.45)' }}>暂无事件记录</div>
        ) : events.map(ev => {
          const sevColor = SEV_COLORS[ev.severity] ?? '#888';
          const SevIcon = ev.severity === 'error' ? AlertCircle : ev.severity === 'warn' ? AlertCircle : CheckCircle;
          return (
            <div key={ev.id} style={{ padding: '12px 16px', borderRadius: 10, border: `1px solid ${sevColor}18`, background: `${sevColor}04`, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <SevIcon size={14} color={sevColor} style={{ marginTop: 1, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: sevColor, background: `${sevColor}15`, border: `1px solid ${sevColor}25`, borderRadius: 4, padding: '1px 6px' }}>{TYPE_LABELS[ev.event_type] ?? ev.event_type}</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(120,132,158,0.50)' }}>{new Date(ev.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </div>
                {ev.message && <div style={{ fontFamily: INTER, fontSize: 11, color: 'rgba(180,190,215,0.80)' }}>{ev.message}</div>}
                {ev.user_id && <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(120,132,158,0.45)', marginTop: 3 }}>user: {ev.user_id.slice(0, 12)}…</div>}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 8, color: `${sevColor}60`, letterSpacing: '0.05em', flexShrink: 0 }}>{ev.severity.toUpperCase()}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
