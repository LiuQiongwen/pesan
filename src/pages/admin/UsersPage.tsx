import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, Plus, Crown, Zap, Ban, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const INTER = "'Inter',system-ui,sans-serif";
const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const PLAN_COLORS: Record<string, string> = { pro: '#b496ff', team: '#66f0ff', free: '#555870' };
const PLAN_LABELS: Record<string, string> = { pro: 'Pro', team: 'Team', free: '免费' };

interface UserRow {
  id: string; username: string | null; email: string | null;
  is_admin: boolean; created_at: string; banned_at: string | null;
  credits: number;
  subscription: { plan: string; status: string; current_period_end: string | null } | null;
  usage: { notes: number; distillations: number; rag_queries: number; actions: number; analyses: number };
}

interface GrantModalProps { user: UserRow; onClose: () => void; onToast: (m: string, ok: boolean) => void; onRefresh: () => void; }

function GrantModal({ user, onClose, onToast, onRefresh }: GrantModalProps) {
  const [tab, setTab]         = useState<'credits' | 'subscription'>('credits');
  const [creditsAmount, setCA] = useState('100');
  const [plan, setPlan]        = useState<'pro' | 'team'>('pro');
  const [days, setDays]        = useState('30');
  const [notes, setNotes]      = useState('');
  const [loading, setLoading]  = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const body: Record<string, unknown> = { targetUserId: user.id, grantType: tab, notes: notes || undefined };
      if (tab === 'credits') body.creditsAmount = parseInt(creditsAmount, 10);
      else { body.plan = plan; body.durationDays = parseInt(days, 10); }
      const { data, error } = await supabase.functions.invoke('admin-grant-benefits', { body });
      if (error || data?.error) throw new Error(data?.error ?? error?.message);
      onToast(tab === 'credits' ? `已发放 ${creditsAmount} Credits` : `已设置 ${PLAN_LABELS[plan]} · ${days} 天`, true);
      onRefresh(); onClose();
    } catch (e) { onToast(`操作失败: ${(e as Error).message}`, false); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ width: 420, background: '#0d1117', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: 24, boxShadow: '0 24px 80px rgba(0,0,0,0.70)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: INTER, fontSize: 15, fontWeight: 700, color: 'rgba(220,230,248,0.92)' }}>发放权益</div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(120,132,158,0.60)', marginTop: 3 }}>{user.email ?? user.username}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(140,150,175,0.70)', fontSize: 18 }}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {(['credits', 'subscription'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '8px', fontFamily: MONO, fontSize: 9, letterSpacing: '0.05em', color: tab === t ? (t === 'credits' ? '#ffa040' : '#b496ff') : 'rgba(120,132,158,0.55)', background: tab === t ? (t === 'credits' ? 'rgba(255,160,64,0.10)' : 'rgba(180,150,255,0.10)') : 'transparent', border: tab === t ? `1px solid ${t === 'credits' ? 'rgba(255,160,64,0.30)' : 'rgba(180,150,255,0.30)'}` : '1px solid rgba(255,255,255,0.07)', borderRadius: 8, cursor: 'pointer' }}>
              {t === 'credits' ? '发放 Credits' : '设置订阅'}
            </button>
          ))}
        </div>
        {tab === 'credits' ? (
          <div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(120,132,158,0.60)', marginBottom: 8 }}>当前余额：{user.credits} Credits</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {['50', '100', '500', '1000'].map(v => (
                <button key={v} onClick={() => setCA(v)} style={{ flex: 1, padding: '7px', fontFamily: MONO, fontSize: 10, color: creditsAmount === v ? '#ffa040' : 'rgba(140,150,175,0.60)', background: creditsAmount === v ? 'rgba(255,160,64,0.12)' : 'rgba(255,255,255,0.04)', border: creditsAmount === v ? '1px solid rgba(255,160,64,0.35)' : '1px solid rgba(255,255,255,0.08)', borderRadius: 7, cursor: 'pointer' }}>{v}</button>
              ))}
            </div>
            <input value={creditsAmount} onChange={e => setCA(e.target.value)} type="number" min="1" placeholder="自定义数量" style={{ width: '100%', padding: '8px 12px', fontFamily: INTER, fontSize: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, color: 'rgba(220,230,248,0.90)', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['pro', 'team'] as const).map(p => (
                <button key={p} onClick={() => setPlan(p)} style={{ flex: 1, padding: '8px', fontFamily: INTER, fontSize: 12, fontWeight: 600, color: plan === p ? PLAN_COLORS[p] : 'rgba(140,150,175,0.60)', background: plan === p ? `${PLAN_COLORS[p]}15` : 'rgba(255,255,255,0.04)', border: plan === p ? `1px solid ${PLAN_COLORS[p]}40` : '1px solid rgba(255,255,255,0.08)', borderRadius: 8, cursor: 'pointer' }}>{PLAN_LABELS[p]}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['30', '90', '180', '365'].map(v => (
                <button key={v} onClick={() => setDays(v)} style={{ flex: 1, padding: '7px', fontFamily: MONO, fontSize: 10, color: days === v ? '#66f0ff' : 'rgba(140,150,175,0.60)', background: days === v ? 'rgba(102,240,255,0.10)' : 'rgba(255,255,255,0.04)', border: days === v ? '1px solid rgba(102,240,255,0.30)' : '1px solid rgba(255,255,255,0.08)', borderRadius: 7, cursor: 'pointer' }}>{v}天</button>
              ))}
            </div>
            <input value={days} onChange={e => setDays(e.target.value)} type="number" min="1" placeholder="自定义天数" style={{ width: '100%', padding: '8px 12px', fontFamily: INTER, fontSize: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, color: 'rgba(220,230,248,0.90)', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        )}
        <div style={{ marginTop: 14 }}>
          <label style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(120,132,158,0.55)', display: 'block', marginBottom: 5 }}>备注</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="操作原因…" style={{ width: '100%', padding: '8px 12px', fontFamily: INTER, fontSize: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: 'rgba(220,230,248,0.88)', outline: 'none', boxSizing: 'border-box' }} />
        </div>
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

export default function UsersPage() {
  const [users, setUsers]     = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState('');
  const [grantTarget, setGrant] = useState<UserRow | null>(null);
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

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

  const toggleBan = async (u: UserRow) => {
    const action = u.banned_at ? 'unban' : 'ban';
    const reason = action === 'ban' ? prompt('禁用原因（可空）') ?? '' : '';
    const { data, error } = await supabase.functions.invoke('admin-toggle-user', { body: { targetUserId: u.id, action, reason } });
    if (error || data?.error) showToast(`操作失败`, false);
    else { showToast(action === 'ban' ? '账号已禁用' : '账号已恢复', true); fetchUsers(); }
  };

  const filtered = search
    ? users.filter(u => (u.username ?? '').toLowerCase().includes(search.toLowerCase()) || (u.email ?? '').toLowerCase().includes(search.toLowerCase()))
    : users;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: INTER, fontSize: 20, fontWeight: 700, color: 'rgba(220,230,248,0.92)', margin: 0 }}>用户管理</h1>
        <p style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(120,132,158,0.60)', margin: '4px 0 0', letterSpacing: '0.04em' }}>查看用户详情 · 发放权益 · 账号关停</p>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}>
          <Search size={13} color="rgba(120,132,158,0.55)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索用户名 / 邮箱…" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontFamily: INTER, fontSize: 12, color: 'rgba(210,220,245,0.90)' }} />
        </div>
        <button onClick={fetchUsers} style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <RefreshCw size={13} color="rgba(140,150,175,0.70)" style={{ animation: loading ? 'spin 1s linear infinite' : undefined }} />
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(102,240,255,0.20)', borderTopColor: '#66f0ff', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
        </div>
      ) : (
        <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 12, padding: '10px 16px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['用户', 'Credits', '订阅', '笔记/RAG', '状态', '操作'].map(h => (
              <div key={h} style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(120,132,158,0.55)', letterSpacing: '0.06em' }}>{h}</div>
            ))}
          </div>
          {filtered.map((u, i) => {
            const sub = u.subscription;
            const planColor = sub?.plan ? PLAN_COLORS[sub.plan] : PLAN_COLORS.free;
            const planLabel = sub?.plan ? PLAN_LABELS[sub.plan] : '免费';
            const isActive = sub?.status === 'active' && sub?.current_period_end && new Date(sub.current_period_end) > new Date();
            const isBanned = !!u.banned_at;
            return (
              <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 12, padding: '12px 16px', borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', alignItems: 'center', background: isBanned ? 'rgba(255,68,102,0.03)' : 'transparent' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {u.is_admin && <Crown size={10} color="#ffa040" />}
                    <span style={{ fontFamily: INTER, fontSize: 12, fontWeight: 600, color: isBanned ? 'rgba(220,230,248,0.45)' : 'rgba(220,230,248,0.90)' }}>{u.username ?? '—'}</span>
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(120,132,158,0.50)', marginTop: 2 }}>{u.email ?? '—'}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Zap size={10} color="#ffa040" />
                  <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: '#ffa040' }}>{u.credits}</span>
                </div>
                <div>
                  <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: isActive ? planColor : 'rgba(80,90,115,0.55)' }}>{planLabel}</span>
                  {isActive && sub?.current_period_end && <div style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(120,132,158,0.40)', marginTop: 2 }}>{new Date(sub.current_period_end).toLocaleDateString('zh-CN')} 到期</div>}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(180,190,215,0.70)' }}>
                  {u.usage.notes} / {u.usage.rag_queries}
                </div>
                <div>
                  {isBanned
                    ? <span style={{ fontFamily: MONO, fontSize: 9, color: '#ff4466', background: 'rgba(255,68,102,0.12)', border: '1px solid rgba(255,68,102,0.25)', borderRadius: 4, padding: '2px 7px' }}>已禁用</span>
                    : <span style={{ fontFamily: MONO, fontSize: 9, color: '#00e5c8', background: 'rgba(0,229,200,0.08)', border: '1px solid rgba(0,229,200,0.20)', borderRadius: 4, padding: '2px 7px' }}>正常</span>
                  }
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setGrant(u)} style={{ padding: '5px 10px', fontFamily: INTER, fontSize: 11, fontWeight: 600, color: '#040b10', background: 'linear-gradient(135deg,rgba(0,229,200,0.85),rgba(0,180,255,0.75))', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Plus size={11} /> 权益
                  </button>
                  {!u.is_admin && (
                    <button onClick={() => toggleBan(u)} style={{ padding: '5px 10px', fontFamily: INTER, fontSize: 11, fontWeight: 600, color: isBanned ? '#00e5c8' : '#ff4466', background: isBanned ? 'rgba(0,229,200,0.08)' : 'rgba(255,68,102,0.08)', border: `1px solid ${isBanned ? 'rgba(0,229,200,0.25)' : 'rgba(255,68,102,0.25)'}`, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {isBanned ? <CheckCircle size={11} /> : <Ban size={11} />}
                      {isBanned ? '恢复' : '禁用'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', fontFamily: INTER, fontSize: 13, color: 'rgba(120,132,158,0.45)' }}>暂无用户</div>
          )}
        </div>
      )}

      {grantTarget && <GrantModal user={grantTarget} onClose={() => setGrant(null)} onToast={showToast} onRefresh={fetchUsers} />}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', padding: '10px 20px', background: toast.ok ? 'rgba(0,229,200,0.15)' : 'rgba(255,68,102,0.15)', border: `1px solid ${toast.ok ? 'rgba(0,229,200,0.35)' : 'rgba(255,68,102,0.35)'}`, borderRadius: 10, zIndex: 1001, fontFamily: INTER, fontSize: 12, color: toast.ok ? '#00e5c8' : '#ff4466', whiteSpace: 'nowrap' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
