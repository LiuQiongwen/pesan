import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, Plus, Crown, Zap, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { MONO, INTER } from './shared';

interface UserRow {
  id: string;
  username: string | null;
  email: string | null;
  is_admin: boolean;
  created_at: string;
  credits: number;
  subscription: { plan: string; status: string; current_period_end: string | null } | null;
  usage: { notes: number; distillations: number; rag_queries: number; actions: number; analyses: number };
}

const PLANS = ['pro', 'team', 'free'] as const;
const PLAN_LABELS: Record<string, string> = { pro: 'Pro', team: 'Team', free: '免费' };
const PLAN_COLORS: Record<string, string> = { pro: '#b496ff', team: '#66f0ff', free: '#555' };

interface GrantModalProps {
  user: UserRow;
  onClose: () => void;
  onToast: (msg: string, ok: boolean) => void;
  onRefresh: () => void;
}

function GrantModal({ user, onClose, onToast, onRefresh }: GrantModalProps) {
  const [tab, setTab]             = useState<'credits' | 'subscription'>('credits');
  const [creditsAmount, setCreditsAmount] = useState('100');
  const [plan, setPlan]           = useState<'pro' | 'team'>('pro');
  const [days, setDays]           = useState('30');
  const [notes, setNotes]         = useState('');
  const [loading, setLoading]     = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        targetUserId: user.id,
        grantType:    tab,
        notes:        notes || undefined,
      };
      if (tab === 'credits') body.creditsAmount = parseInt(creditsAmount, 10);
      else { body.plan = plan; body.durationDays = parseInt(days, 10); }

      const { data, error } = await supabase.functions.invoke('admin-grant-benefits', { body });
      if (error || data?.error) throw new Error(data?.error ?? error?.message);
      onToast(tab === 'credits' ? `已发放 ${creditsAmount} Credits` : `已设置 ${PLAN_LABELS[plan]} · ${days} 天`, true);
      onRefresh();
      onClose();
    } catch (e) {
      onToast(`操作失败: ${(e as Error).message}`, false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ width: 420, background: '#070d1c', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 18, padding: 24, boxShadow: '0 24px 80px rgba(0,0,0,0.70)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: INTER, fontSize: 15, fontWeight: 700, color: 'rgba(220,230,250,0.95)' }}>发放权益</div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(100,110,140,0.65)', marginTop: 3 }}>{user.email ?? user.username}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={16} color="rgba(140,150,175,0.70)" />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {(['credits', 'subscription'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '8px', fontFamily: MONO, fontSize: 9, letterSpacing: '0.05em', color: tab === t ? (t === 'credits' ? '#ffa040' : '#b496ff') : 'rgba(100,110,140,0.55)', background: tab === t ? (t === 'credits' ? 'rgba(255,160,64,0.10)' : 'rgba(180,150,255,0.10)') : 'transparent', border: tab === t ? `1px solid ${t === 'credits' ? 'rgba(255,160,64,0.30)' : 'rgba(180,150,255,0.30)'}` : '1px solid rgba(255,255,255,0.07)', borderRadius: 8, cursor: 'pointer' }}>
              {t === 'credits' ? '发放 Credits' : '设置订阅'}
            </button>
          ))}
        </div>

        {tab === 'credits' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(100,110,140,0.60)', marginBottom: 6 }}>当前余额：{user.credits} Credits</div>
              <label style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(140,150,175,0.70)', display: 'block', marginBottom: 6 }}>发放数量</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['50', '100', '500', '1000'].map(v => (
                  <button key={v} onClick={() => setCreditsAmount(v)} style={{ flex: 1, padding: '7px', fontFamily: MONO, fontSize: 10, color: creditsAmount === v ? '#ffa040' : 'rgba(140,150,175,0.60)', background: creditsAmount === v ? 'rgba(255,160,64,0.12)' : 'rgba(255,255,255,0.04)', border: creditsAmount === v ? '1px solid rgba(255,160,64,0.35)' : '1px solid rgba(255,255,255,0.08)', borderRadius: 7, cursor: 'pointer' }}>{v}</button>
                ))}
              </div>
              <input value={creditsAmount} onChange={e => setCreditsAmount(e.target.value)} type="number" min="1" placeholder="自定义数量" style={{ marginTop: 8, width: '100%', padding: '8px 12px', fontFamily: INTER, fontSize: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, color: 'rgba(220,230,250,0.90)', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(140,150,175,0.70)', display: 'block', marginBottom: 6 }}>订阅计划</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['pro', 'team'] as const).map(p => (
                  <button key={p} onClick={() => setPlan(p)} style={{ flex: 1, padding: '8px', fontFamily: INTER, fontSize: 12, fontWeight: 600, color: plan === p ? PLAN_COLORS[p] : 'rgba(140,150,175,0.60)', background: plan === p ? `${PLAN_COLORS[p]}15` : 'rgba(255,255,255,0.04)', border: plan === p ? `1px solid ${PLAN_COLORS[p]}40` : '1px solid rgba(255,255,255,0.08)', borderRadius: 8, cursor: 'pointer' }}>{PLAN_LABELS[p]}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(140,150,175,0.70)', display: 'block', marginBottom: 6 }}>时长（天）</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['30', '90', '180', '365'].map(v => (
                  <button key={v} onClick={() => setDays(v)} style={{ flex: 1, padding: '7px', fontFamily: MONO, fontSize: 10, color: days === v ? '#66f0ff' : 'rgba(140,150,175,0.60)', background: days === v ? 'rgba(102,240,255,0.10)' : 'rgba(255,255,255,0.04)', border: days === v ? '1px solid rgba(102,240,255,0.30)' : '1px solid rgba(255,255,255,0.08)', borderRadius: 7, cursor: 'pointer' }}>{v}天</button>
                ))}
              </div>
              <input value={days} onChange={e => setDays(e.target.value)} type="number" min="1" placeholder="自定义天数" style={{ marginTop: 8, width: '100%', padding: '8px 12px', fontFamily: INTER, fontSize: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, color: 'rgba(220,230,250,0.90)', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
        )}

        {/* Notes */}
        <div style={{ marginTop: 14 }}>
          <label style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(100,110,140,0.55)', display: 'block', marginBottom: 5 }}>备注（可选）</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="操作原因…" style={{ width: '100%', padding: '8px 12px', fontFamily: INTER, fontSize: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: 'rgba(220,230,250,0.88)', outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', fontFamily: INTER, fontSize: 12, color: 'rgba(140,150,175,0.70)', background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 9, cursor: 'pointer' }}>取消</button>
          <button onClick={submit} disabled={loading} style={{ flex: 2, padding: '10px', fontFamily: INTER, fontSize: 13, fontWeight: 700, color: '#040b10', background: loading ? 'rgba(0,229,200,0.40)' : 'linear-gradient(135deg,#00e5c8,#00b4ff)', border: 'none', borderRadius: 9, cursor: loading ? 'wait' : 'pointer' }}>
            {loading ? '发放中…' : '确认发放'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface Props {
  onToast: (msg: string, ok: boolean) => void;
}

export function UsersPanel({ onToast }: Props) {
  const [users, setUsers]     = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState('');
  const [grantTarget, setGrantTarget] = useState<UserRow | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-user-list', { body: { page: 0, limit: 50 } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setUsers(data.users ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = search
    ? users.filter(u => (u.username ?? '').toLowerCase().includes(search.toLowerCase()) || (u.email ?? '').toLowerCase().includes(search.toLowerCase()))
    : users;

  return (
    <div>
      {/* Search + refresh */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10 }}>
          <Search size={13} color="rgba(100,110,140,0.55)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索用户名 / 邮箱…" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontFamily: INTER, fontSize: 12, color: 'rgba(210,220,245,0.90)' }} />
        </div>
        <button onClick={fetchUsers} style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <RefreshCw size={13} color="rgba(140,150,175,0.70)" style={{ animation: loading ? 'spin 1s linear infinite' : undefined }} />
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(0,229,200,0.20)', borderTopColor: '#00e5c8', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(u => {
            const sub = u.subscription;
            const planColor = sub?.plan ? PLAN_COLORS[sub.plan] : PLAN_COLORS.free;
            const planLabel = sub?.plan ? PLAN_LABELS[sub.plan] : '免费';
            const isActive = sub?.status === 'active' && sub?.current_period_end && new Date(sub.current_period_end) > new Date();

            return (
              <div key={u.id} style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                {/* User info */}
                <div style={{ minWidth: 120, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    {u.is_admin && <Crown size={11} color="#ffa040" />}
                    <span style={{ fontFamily: INTER, fontSize: 12, fontWeight: 600, color: 'rgba(210,220,245,0.90)' }}>{u.username ?? '—'}</span>
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(100,110,140,0.55)' }}>{u.email ?? '—'}</div>
                </div>

                {/* Credits */}
                <div style={{ minWidth: 80, textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                    <Zap size={10} color="#ffa040" />
                    <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: '#ffa040' }}>{u.credits}</span>
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(100,110,140,0.50)' }}>Credits</div>
                </div>

                {/* Subscription */}
                <div style={{ minWidth: 80, textAlign: 'center' }}>
                  <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: isActive ? planColor : 'rgba(80,90,115,0.55)' }}>{planLabel}</div>
                  {isActive && sub?.current_period_end && (
                    <div style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(100,110,140,0.45)', marginTop: 2 }}>
                      {new Date(sub.current_period_end).toLocaleDateString('zh-CN')} 到期
                    </div>
                  )}
                </div>

                {/* Usage counts */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[
                    { label: '笔记', value: u.usage.notes, color: '#66f0ff' },
                    { label: '蒸馏', value: u.usage.distillations, color: '#b496ff' },
                    { label: 'RAG', value: u.usage.rag_queries, color: '#00e5c8' },
                  ].map(stat => (
                    <div key={stat.label} style={{ textAlign: 'center', minWidth: 36 }}>
                      <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: stat.color }}>{stat.value}</div>
                      <div style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(100,110,140,0.45)' }}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* Grant button */}
                <button
                  onClick={() => setGrantTarget(u)}
                  style={{ padding: '7px 14px', fontFamily: INTER, fontSize: 11, fontWeight: 600, color: '#040b10', background: 'linear-gradient(135deg,rgba(0,229,200,0.90),rgba(0,180,255,0.80))', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
                >
                  <Plus size={12} /> 发放权益
                </button>
              </div>
            );
          })}
        </div>
      )}

      {grantTarget && (
        <GrantModal
          user={grantTarget}
          onClose={() => setGrantTarget(null)}
          onToast={onToast}
          onRefresh={fetchUsers}
        />
      )}
    </div>
  );
}
