import { useState, useEffect, useCallback } from 'react';
import { Check, X, RefreshCw, User, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { MONO, INTER, STATUS_COLOR, formatDate } from './shared';
import { AnalyticsBar } from './AnalyticsBar';
import { QrSettings } from './QrSettings';

type StatusFilter = 'submitted' | 'all' | 'fulfilled' | 'rejected';

interface Order {
  id: string;
  order_no: string;
  user_id: string;
  user_email: string | null;
  product_name: string;
  product_code: string;
  product_type: string;
  amount_fen: number;
  status: string;
  reject_reason: string | null;
  fulfilled_at: string | null;
  created_at: string;
  profiles: { username: string } | null;
  manual_order_submissions: Array<{
    id: string;
    proof_image_url: string;
    payment_method: string | null;
    payer_nickname: string | null;
    payment_time: string | null;
    payment_amount_fen: number | null;
    note: string | null;
    submitted_at: string;
  }>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
      <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(100,110,140,0.55)', letterSpacing: '0.04em', flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: INTER, fontSize: 11, color: 'rgba(180,190,215,0.75)', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function OrderCard({ order, onReview }: { order: Order; onReview: (id: string, action: 'approved' | 'rejected', reason?: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [rejReason, setRejReason] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const subs = order.manual_order_submissions ?? [];
  const latestSub = subs.length > 0 ? [...subs].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0] : null;
  const yuan = (order.amount_fen / 100).toFixed(2);

  const doApprove = async () => { setActing('approve'); await onReview(order.id, 'approved'); setActing(null); };
  const doReject  = async () => { if (!rejReason.trim()) return; setActing('reject'); await onReview(order.id, 'rejected', rejReason); setActing(null); setRejReason(''); };

  return (
    <div style={{ borderRadius: 14, border: `1px solid ${STATUS_COLOR[order.status] ?? '#444'}33`, background: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
      <button onClick={() => setExpanded(e => !e)} style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: STATUS_COLOR[order.status] ?? '#666', boxShadow: `0 0 8px ${STATUS_COLOR[order.status] ?? '#666'}80` }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 90 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <User size={11} color="rgba(120,130,160,0.60)" />
            <span style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(160,170,200,0.75)' }}>{order.profiles?.username ?? order.user_id.slice(0, 8)}</span>
          </div>
          {order.user_email && <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(100,110,140,0.50)', paddingLeft: 16 }}>{order.user_email}</span>}
        </div>
        <span style={{ flex: 1, fontFamily: INTER, fontSize: 11, color: 'rgba(190,200,225,0.80)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.product_name}</span>
        <span style={{ fontFamily: INTER, fontSize: 13, fontWeight: 700, color: 'rgba(0,229,200,0.85)', flexShrink: 0 }}>¥{yuan}</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(80,90,115,0.60)', flexShrink: 0 }}>{formatDate(order.created_at)}</span>
        <div style={{ padding: '2px 8px', borderRadius: 4, flexShrink: 0, background: `${STATUS_COLOR[order.status] ?? '#666'}15`, border: `1px solid ${STATUS_COLOR[order.status] ?? '#666'}40` }}>
          <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '0.06em', color: STATUS_COLOR[order.status] ?? '#666' }}>{order.status.toUpperCase()}</span>
        </div>
        {expanded ? <ChevronUp size={13} color="rgba(100,110,140,0.50)" /> : <ChevronDown size={13} color="rgba(100,110,140,0.50)" />}
      </button>

      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: latestSub?.proof_image_url ? '1fr 1fr' : '1fr', gap: 16, paddingTop: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <InfoRow label="订单号" value={order.order_no} />
              <InfoRow label="商品" value={order.product_name} />
              <InfoRow label="类型" value={order.product_type === 'subscription' ? '订阅' : 'Credits'} />
              <InfoRow label="金额" value={`¥${yuan}`} />
              {latestSub && (
                <>
                  <InfoRow label="付款方式" value={latestSub.payment_method === 'wechat' ? '微信支付' : '支付宝'} />
                  {latestSub.payer_nickname && <InfoRow label="付款人" value={latestSub.payer_nickname} />}
                  {latestSub.payment_time && <InfoRow label="付款时间" value={formatDate(latestSub.payment_time)} />}
                  {latestSub.note && <InfoRow label="备注" value={latestSub.note} />}
                </>
              )}
            </div>
            {latestSub?.proof_image_url && (
              <div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(100,110,140,0.55)', letterSpacing: '0.06em', marginBottom: 6 }}>付款截图</div>
                <a href={latestSub.proof_image_url} target="_blank" rel="noopener noreferrer">
                  <img src={latestSub.proof_image_url} alt="proof" crossOrigin="anonymous" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(255,255,255,0.10)', cursor: 'zoom-in' }} />
                </a>
              </div>
            )}
          </div>

          {order.status === 'submitted' && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input value={rejReason} onChange={e => setRejReason(e.target.value)} placeholder="拒绝原因（拒绝时必填）" style={{ padding: '8px 12px', fontFamily: INTER, fontSize: 11, color: 'rgba(210,220,245,0.88)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 7, outline: 'none' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={doApprove} disabled={acting !== null} style={{ flex: 1, padding: '9px 0', fontFamily: INTER, fontSize: 12, fontWeight: 600, color: '#fff', background: acting === 'approve' ? 'rgba(0,229,200,0.30)' : 'linear-gradient(135deg,rgba(0,229,200,0.80),rgba(0,180,255,0.70))', border: 'none', borderRadius: 8, cursor: acting ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Check size={13} /> {acting === 'approve' ? '发放中…' : '通过 · 发放权益'}
                </button>
                <button onClick={doReject} disabled={acting !== null || !rejReason.trim()} style={{ flex: 1, padding: '9px 0', fontFamily: INTER, fontSize: 12, fontWeight: 600, color: !rejReason.trim() ? 'rgba(255,68,102,0.30)' : '#ff4466', background: 'rgba(255,68,102,0.08)', border: '1px solid rgba(255,68,102,0.25)', borderRadius: 8, cursor: (acting || !rejReason.trim()) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <X size={13} /> {acting === 'reject' ? '拒绝中…' : '拒绝'}
                </button>
              </div>
            </div>
          )}
          {order.status === 'fulfilled' && order.fulfilled_at && (
            <div style={{ marginTop: 10, padding: '7px 10px', background: 'rgba(180,150,255,0.08)', border: '1px solid rgba(180,150,255,0.20)', borderRadius: 7 }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(200,180,255,0.80)' }}>权益已发放 · {formatDate(order.fulfilled_at)}</span>
            </div>
          )}
          {order.status === 'rejected' && order.reject_reason && (
            <div style={{ marginTop: 10, padding: '7px 10px', background: 'rgba(255,68,102,0.08)', border: '1px solid rgba(255,68,102,0.20)', borderRadius: 7 }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,100,120,0.80)' }}>拒绝原因：{order.reject_reason}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  onToast: (msg: string, ok: boolean) => void;
  statusFilter: StatusFilter;
  onStatusChange: (s: StatusFilter) => void;
}

export function OrdersPanel({ onToast, statusFilter, onStatusChange }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal]     = useState(0);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manual-pay-admin-list', {
        body: { status: statusFilter, page: 0, limit: 40 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleReview = async (orderId: string, action: 'approved' | 'rejected', rejectReason?: string) => {
    const { data, error } = await supabase.functions.invoke('manual-pay-admin-review', { body: { orderId, action, rejectReason } });
    if (error || data?.error) onToast(`操作失败: ${error?.message ?? data?.error}`, false);
    else { onToast(action === 'approved' ? '已通过，权益已发放' : '已拒绝', true); fetchOrders(); }
  };

  return (
    <div>
      <AnalyticsBar />
      <QrSettings />

      {/* Filter + refresh */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, alignItems: 'center' }}>
        {(['submitted', 'all', 'fulfilled', 'rejected'] as StatusFilter[]).map(s => (
          <button key={s} onClick={() => onStatusChange(s)} style={{ padding: '6px 14px', fontFamily: MONO, fontSize: 9, letterSpacing: '0.06em', color: statusFilter === s ? 'rgba(220,230,250,0.90)' : 'rgba(100,110,140,0.55)', background: statusFilter === s ? 'rgba(255,255,255,0.08)' : 'transparent', border: statusFilter === s ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.06)', borderRadius: 7, cursor: 'pointer' }}>
            {s === 'submitted' ? '待审核' : s === 'all' ? '全部' : s === 'fulfilled' ? '已发放' : '已拒绝'}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(80,90,115,0.55)' }}>共 {total} 条</span>
        <button onClick={fetchOrders} style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <RefreshCw size={12} color="rgba(140,150,175,0.70)" style={{ animation: loading ? 'spin 1s linear infinite' : undefined }} />
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(0,229,200,0.20)', borderTopColor: '#00e5c8', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
        </div>
      ) : orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(100,110,140,0.45)', fontFamily: INTER, fontSize: 13 }}>
          暂无{statusFilter === 'submitted' ? '待审核' : ''}订单
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {orders.map(o => <OrderCard key={o.id} order={o} onReview={handleReview} />)}
        </div>
      )}
    </div>
  );
}
