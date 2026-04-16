import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus, Minus, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const INTER = "'Inter',system-ui,sans-serif";
const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";

interface LedgerRow {
  id: string; user_id: string; delta: number; balance_after: number;
  reason: string; ref_id: string | null; created_at: string;
  admin_id: string | null;
  profiles?: { username: string | null } | null;
}

interface UserRow { id: string; username: string | null; email: string | null; credits: number; }

const REASON_LABELS: Record<string, string> = {
  manual_grant: '手动发放', order_fulfill: '订单发放', admin_deduct: '管理员扣减', ai_usage: 'AI 消耗',
};
const REASON_COLORS: Record<string, string> = {
  manual_grant: '#00e5c8', order_fulfill: '#b496ff', admin_deduct: '#ff4466', ai_usage: '#ffa040',
};

export default function CreditsPage() {
  const [ledger, setLedger]   = useState<LedgerRow[]>([]);
  const [users, setUsers]     = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);
  const [form, setForm]       = useState({ userId: '', amount: '100', action: 'add' as 'add' | 'deduct', note: '' });
  const [submitting, setSubmitting] = useState(false);

  const showToast = (msg: string, ok: boolean) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ledgerRes, usersRes] = await Promise.all([
        supabase.from('credit_ledger').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.functions.invoke('admin-user-list', { body: { page: 0, limit: 100 } }),
      ]);
      const userList: UserRow[] = (usersRes.data?.users ?? []) as UserRow[];
      const userMap = Object.fromEntries(userList.map((u: UserRow) => [u.id, u]));
      // Attach username to each ledger row
      const enriched = (ledgerRes.data ?? []).map((row: LedgerRow) => ({
        ...row,
        _username: userMap[row.user_id]?.username ?? null,
      }));
      setLedger(enriched);
      setUsers(userList);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const submit = async () => {
    if (!form.userId || !form.amount) return;
    setSubmitting(true);
    try {
      const amount = parseInt(form.amount, 10);
      const body = {
        targetUserId: form.userId,
        grantType: 'credits',
        creditsAmount: form.action === 'deduct' ? -amount : amount,
        notes: form.note || (form.action === 'deduct' ? 'admin_deduct' : 'manual_grant'),
      };
      const { data, error } = await supabase.functions.invoke('admin-grant-benefits', { body });
      if (error || data?.error) throw new Error(data?.error ?? error?.message);
      showToast(`${form.action === 'add' ? '已发放' : '已扣减'} ${amount} Credits`, true);
      fetchData();
    } catch (e) { showToast(`操作失败: ${(e as Error).message}`, false); }
    finally { setSubmitting(false); }
  };

  const selectedUser = users.find(u => u.id === form.userId);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: INTER, fontSize: 20, fontWeight: 700, color: 'rgba(220,230,248,0.92)', margin: 0 }}>Credits 管理</h1>
        <p style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(120,132,158,0.60)', margin: '4px 0 0', letterSpacing: '0.04em' }}>手动加减 Credits · 查看台账 · 防重复发放</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Form */}
        <div style={{ padding: 20, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ fontFamily: INTER, fontSize: 13, fontWeight: 600, color: 'rgba(220,230,248,0.85)', marginBottom: 16 }}>手动操作</div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(120,132,158,0.60)', display: 'block', marginBottom: 5 }}>选择用户</label>
            <select value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))} style={{ width: '100%', padding: '8px 12px', fontFamily: INTER, fontSize: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, color: 'rgba(220,230,248,0.90)', outline: 'none' }}>
              <option value="" style={{ background: '#0d1117' }}>请选择用户…</option>
              {users.map(u => <option key={u.id} value={u.id} style={{ background: '#0d1117' }}>{u.username ?? u.id.slice(0, 8)} ({u.email}) — {u.credits} credits</option>)}
            </select>
          </div>

          {selectedUser && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(255,160,64,0.08)', border: '1px solid rgba(255,160,64,0.20)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={11} color="#ffa040" />
              <span style={{ fontFamily: MONO, fontSize: 11, color: '#ffa040' }}>当前余额：{selectedUser.credits} Credits</span>
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(120,132,158,0.60)', display: 'block', marginBottom: 5 }}>操作类型</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['add', 'deduct'] as const).map(a => (
                <button key={a} onClick={() => setForm(f => ({ ...f, action: a }))} style={{ flex: 1, padding: '8px', fontFamily: INTER, fontSize: 11, fontWeight: 600, color: form.action === a ? (a === 'add' ? '#00e5c8' : '#ff4466') : 'rgba(120,132,158,0.55)', background: form.action === a ? (a === 'add' ? 'rgba(0,229,200,0.10)' : 'rgba(255,68,102,0.10)') : 'rgba(255,255,255,0.04)', border: form.action === a ? `1px solid ${a === 'add' ? 'rgba(0,229,200,0.30)' : 'rgba(255,68,102,0.30)'}` : '1px solid rgba(255,255,255,0.08)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  {a === 'add' ? <Plus size={11} /> : <Minus size={11} />} {a === 'add' ? '发放' : '扣减'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(120,132,158,0.60)', display: 'block', marginBottom: 5 }}>数量</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              {['50', '100', '500', '1000'].map(v => (
                <button key={v} onClick={() => setForm(f => ({ ...f, amount: v }))} style={{ flex: 1, padding: '6px', fontFamily: MONO, fontSize: 10, color: form.amount === v ? '#ffa040' : 'rgba(140,150,175,0.60)', background: form.amount === v ? 'rgba(255,160,64,0.12)' : 'rgba(255,255,255,0.04)', border: form.amount === v ? '1px solid rgba(255,160,64,0.35)' : '1px solid rgba(255,255,255,0.08)', borderRadius: 6, cursor: 'pointer' }}>{v}</button>
              ))}
            </div>
            <input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} type="number" min="1" placeholder="自定义" style={{ width: '100%', padding: '8px 12px', fontFamily: INTER, fontSize: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, color: 'rgba(220,230,248,0.90)', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(120,132,158,0.60)', display: 'block', marginBottom: 5 }}>备注</label>
            <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="操作原因…" style={{ width: '100%', padding: '8px 12px', fontFamily: INTER, fontSize: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: 'rgba(220,230,248,0.88)', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <button onClick={submit} disabled={submitting || !form.userId || !form.amount} style={{ width: '100%', padding: '10px', fontFamily: INTER, fontSize: 13, fontWeight: 700, color: '#040b10', background: (submitting || !form.userId) ? 'rgba(0,229,200,0.30)' : 'linear-gradient(135deg,#00e5c8,#00b4ff)', border: 'none', borderRadius: 9, cursor: (submitting || !form.userId) ? 'not-allowed' : 'pointer' }}>
            {submitting ? '处理中…' : '确认操作'}
          </button>
        </div>

        {/* Ledger */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontFamily: INTER, fontSize: 13, fontWeight: 600, color: 'rgba(220,230,248,0.85)' }}>台账记录</div>
            <button onClick={fetchData} style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <RefreshCw size={12} color="rgba(140,150,175,0.70)" style={{ animation: loading ? 'spin 1s linear infinite' : undefined }} />
            </button>
          </div>

          <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 80px 80px 1fr auto', gap: 10, padding: '9px 14px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              {['用户', '原因', '变动', '余额', '时间', ''].map(h => <div key={h} style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(120,132,158,0.55)', letterSpacing: '0.06em' }}>{h}</div>)}
            </div>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(102,240,255,0.20)', borderTopColor: '#66f0ff', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
              </div>
            ) : ledger.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', fontFamily: INTER, fontSize: 13, color: 'rgba(120,132,158,0.45)' }}>暂无台账记录</div>
            ) : ledger.map((row, i) => (
              <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 80px 80px 1fr auto', gap: 10, padding: '10px 14px', borderBottom: i < ledger.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', alignItems: 'center' }}>
                <span style={{ fontFamily: INTER, fontSize: 11, color: 'rgba(210,220,245,0.80)' }}>{(row as LedgerRow & { _username?: string | null })._username ?? row.user_id.slice(0, 8)}</span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: REASON_COLORS[row.reason] ?? '#888', background: `${REASON_COLORS[row.reason] ?? '#888'}15`, border: `1px solid ${REASON_COLORS[row.reason] ?? '#888'}25`, borderRadius: 4, padding: '2px 6px' }}>
                  {REASON_LABELS[row.reason] ?? row.reason}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: row.delta > 0 ? '#00e5c8' : '#ff4466' }}>
                  {row.delta > 0 ? '+' : ''}{row.delta}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: '#ffa040' }}>{row.balance_after}</span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(120,132,158,0.50)' }}>{new Date(row.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                <div />
              </div>
            ))}
          </div>
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', padding: '10px 20px', background: toast.ok ? 'rgba(0,229,200,0.15)' : 'rgba(255,68,102,0.15)', border: `1px solid ${toast.ok ? 'rgba(0,229,200,0.35)' : 'rgba(255,68,102,0.35)'}`, borderRadius: 10, zIndex: 999, fontFamily: INTER, fontSize: 12, color: toast.ok ? '#00e5c8' : '#ff4466', whiteSpace: 'nowrap' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
