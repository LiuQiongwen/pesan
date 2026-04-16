import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Crown, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const INTER = "'Inter',system-ui,sans-serif";
const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const PLAN_COLORS: Record<string, string> = { pro: '#b496ff', team: '#66f0ff', free: '#555870' };
const PLAN_LABELS: Record<string, string> = { pro: 'Pro', team: 'Team', free: '免费' };

interface UserSub {
  id: string; username: string | null; email: string | null; credits: number;
  subscription: { plan: string; status: string; current_period_end: string | null } | null;
}

export default function PlansPage() {
  const [users, setUsers]     = useState<UserSub[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);
  const [target, setTarget]   = useState<UserSub | null>(null);
  const [plan, setPlan]       = useState<'pro' | 'team' | 'free'>('pro');
  const [days, setDays]       = useState('30');
  const [submitting, setSubmitting] = useState(false);

  const showToast = (msg: string, ok: boolean) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-user-list', { body: { page: 0, limit: 100 } });
      if (error) throw error;
      setUsers(data?.users ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openGrant = (u: UserSub) => { setTarget(u); setPlan('pro'); setDays('30'); };

  const submitGrant = async () => {
    if (!target) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-grant-benefits', {
        body: { targetUserId: target.id, grantType: 'subscription', plan, durationDays: parseInt(days, 10) },
      });
      if (error || data?.error) throw new Error(data?.error ?? error?.message);
      showToast(`已设置 ${PLAN_LABELS[plan]} · ${days} 天`, true);
      setTarget(null); fetchUsers();
    } catch (e) { showToast(`操作失败: ${(e as Error).message}`, false); }
    finally { setSubmitting(false); }
  };

  const activeCount   = users.filter(u => u.subscription?.status === 'active' && u.subscription?.current_period_end && new Date(u.subscription.current_period_end) > new Date()).length;
  const proCount      = users.filter(u => u.subscription?.plan === 'pro').length;
  const teamCount     = users.filter(u => u.subscription?.plan === 'team').length;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: INTER, fontSize: 20, fontWeight: 700, color: 'rgba(220,230,248,0.92)', margin: 0 }}>套餐管理</h1>
        <p style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(120,132,158,0.60)', margin: '4px 0 0', letterSpacing: '0.04em' }}>查看订阅状态 · 手动开通 · 延长有效期</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: '有效订阅', value: activeCount, color: '#00e5c8' },
          { label: 'Pro 用户', value: proCount, color: '#b496ff' },
          { label: 'Team 用户', value: teamCount, color: '#66f0ff' },
        ].map(s => (
          <div key={s.label} style={{ padding: '16px 18px', borderRadius: 10, border: `1px solid ${s.color}18`, background: `${s.color}06` }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: `${s.color}80`, letterSpacing: '0.06em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={fetchUsers} style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <RefreshCw size={12} color="rgba(140,150,175,0.70)" style={{ animation: loading ? 'spin 1s linear infinite' : undefined }} />
        </button>
      </div>

      <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 12, padding: '9px 16px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {['用户', '当前套餐', '状态', '到期时间', '操作'].map(h => <div key={h} style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(120,132,158,0.55)', letterSpacing: '0.06em' }}>{h}</div>)}
        </div>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(180,150,255,0.20)', borderTopColor: '#b496ff', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
          </div>
        ) : users.map((u, i) => {
          const sub = u.subscription;
          const planKey = sub?.plan ?? 'free';
          const isActive = sub?.status === 'active' && sub?.current_period_end && new Date(sub.current_period_end) > new Date();
          const endDate = sub?.current_period_end ? new Date(sub.current_period_end) : null;
          const isExpiring = endDate && endDate > new Date() && endDate < new Date(Date.now() + 7 * 86400000);
          return (
            <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 12, padding: '12px 16px', borderBottom: i < users.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: INTER, fontSize: 12, fontWeight: 600, color: 'rgba(220,230,248,0.88)' }}>{u.username ?? '—'}</div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(120,132,158,0.50)', marginTop: 1 }}>{u.email ?? '—'}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Crown size={10} color={PLAN_COLORS[planKey]} />
                <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: PLAN_COLORS[planKey] }}>{PLAN_LABELS[planKey]}</span>
              </div>
              <div>
                <span style={{ fontFamily: MONO, fontSize: 9, padding: '2px 7px', borderRadius: 4, background: isActive ? 'rgba(0,229,200,0.08)' : 'rgba(120,132,158,0.08)', border: `1px solid ${isActive ? 'rgba(0,229,200,0.25)' : 'rgba(120,132,158,0.20)'}`, color: isActive ? '#00e5c8' : 'rgba(120,132,158,0.60)' }}>
                  {isActive ? '生效中' : '未激活'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {endDate ? (
                  <>
                    <Calendar size={10} color={isExpiring ? '#ffa040' : 'rgba(120,132,158,0.50)'} />
                    <span style={{ fontFamily: MONO, fontSize: 10, color: isExpiring ? '#ffa040' : 'rgba(140,150,175,0.65)' }}>{endDate.toLocaleDateString('zh-CN')}</span>
                  </>
                ) : <span style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(80,90,115,0.45)' }}>—</span>}
              </div>
              <button onClick={() => openGrant(u)} style={{ padding: '6px 12px', fontFamily: INTER, fontSize: 11, fontWeight: 600, color: '#b496ff', background: 'rgba(180,150,255,0.10)', border: '1px solid rgba(180,150,255,0.25)', borderRadius: 6, cursor: 'pointer' }}>
                调整套餐
              </button>
            </div>
          );
        })}
      </div>

      {/* Grant modal */}
      {target && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ width: 380, background: '#0d1117', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: 24 }}>
            <div style={{ fontFamily: INTER, fontSize: 15, fontWeight: 700, color: 'rgba(220,230,248,0.92)', marginBottom: 4 }}>调整套餐</div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(120,132,158,0.60)', marginBottom: 20 }}>{target.email ?? target.username}</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(120,132,158,0.60)', display: 'block', marginBottom: 6 }}>套餐计划</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['pro', 'team', 'free'] as const).map(p => (
                  <button key={p} onClick={() => setPlan(p)} style={{ flex: 1, padding: '8px', fontFamily: INTER, fontSize: 11, fontWeight: 600, color: plan === p ? PLAN_COLORS[p] : 'rgba(120,132,158,0.55)', background: plan === p ? `${PLAN_COLORS[p]}15` : 'rgba(255,255,255,0.04)', border: plan === p ? `1px solid ${PLAN_COLORS[p]}35` : '1px solid rgba(255,255,255,0.08)', borderRadius: 7, cursor: 'pointer' }}>{PLAN_LABELS[p]}</button>
                ))}
              </div>
            </div>
            {plan !== 'free' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(120,132,158,0.60)', display: 'block', marginBottom: 6 }}>时长（天）</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['30', '90', '180', '365'].map(v => (
                    <button key={v} onClick={() => setDays(v)} style={{ flex: 1, padding: '7px', fontFamily: MONO, fontSize: 10, color: days === v ? '#66f0ff' : 'rgba(140,150,175,0.60)', background: days === v ? 'rgba(102,240,255,0.10)' : 'rgba(255,255,255,0.04)', border: days === v ? '1px solid rgba(102,240,255,0.30)' : '1px solid rgba(255,255,255,0.08)', borderRadius: 6, cursor: 'pointer' }}>{v}天</button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setTarget(null)} style={{ flex: 1, padding: '10px', fontFamily: INTER, fontSize: 12, color: 'rgba(140,150,175,0.70)', background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 9, cursor: 'pointer' }}>取消</button>
              <button onClick={submitGrant} disabled={submitting} style={{ flex: 2, padding: '10px', fontFamily: INTER, fontSize: 13, fontWeight: 700, color: '#040b10', background: submitting ? 'rgba(180,150,255,0.40)' : 'linear-gradient(135deg,#b496ff,#9b74ff)', border: 'none', borderRadius: 9, cursor: submitting ? 'wait' : 'pointer' }}>
                {submitting ? '操作中…' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', padding: '10px 20px', background: toast.ok ? 'rgba(0,229,200,0.15)' : 'rgba(255,68,102,0.15)', border: `1px solid ${toast.ok ? 'rgba(0,229,200,0.35)' : 'rgba(255,68,102,0.35)'}`, borderRadius: 10, zIndex: 999, fontFamily: INTER, fontSize: 12, color: toast.ok ? '#00e5c8' : '#ff4466', whiteSpace: 'nowrap' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
