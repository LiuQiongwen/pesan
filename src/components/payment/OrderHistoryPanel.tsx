/**
 * OrderHistoryPanel — user's manual order list inside BillingPanel.
 */
import { useState } from 'react';
import { Clock, Check, X, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { type ManualOrder } from '@/hooks/useManualOrders';
import { type OrderCreatedPayload } from './ManualPayModal';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending:   { label: '待付款', color: '#ffa040', bg: 'rgba(255,160,64,0.12)',  icon: Clock      },
  submitted: { label: '审核中', color: '#66f0ff', bg: 'rgba(102,240,255,0.10)', icon: Clock      },
  paid:      { label: '已付款', color: '#00e5c8', bg: 'rgba(0,229,200,0.10)',   icon: Check      },
  fulfilled: { label: '已发放', color: '#b496ff', bg: 'rgba(180,150,255,0.12)', icon: Check      },
  rejected:  { label: '已拒绝', color: '#ff4466', bg: 'rgba(255,68,102,0.10)',  icon: X          },
  expired:   { label: '已过期', color: '#555870', bg: 'rgba(80,90,115,0.12)',   icon: AlertCircle },
};

interface Props {
  orders: ManualOrder[];
  loading: boolean;
  onRefetch: () => void;
  onReopen?: (order: ManualOrder) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function OrderRow({ order, onReopen }: { order: ManualOrder; onReopen?: (o: ManualOrder) => void }) {
  const [expanded, setExpanded] = useState(false);
  const meta = STATUS_META[order.status] ?? STATUS_META.pending;
  const Icon = meta.icon;
  const yuan = (order.amount_fen / 100).toFixed(2);
  const isExpired = order.status === 'pending' && new Date(order.expires_at) < new Date();

  return (
    <div style={{
      borderRadius: 10,
      border: '1px solid rgba(255,255,255,0.07)',
      background: 'rgba(255,255,255,0.02)',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'transparent', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Status badge */}
        <div style={{
          padding: '2px 8px', borderRadius: 4,
          background: isExpired ? STATUS_META.expired.bg : meta.bg,
          border: `1px solid ${isExpired ? STATUS_META.expired.color : meta.color}44`,
          display: 'flex', alignItems: 'center', gap: 4,
          flexShrink: 0,
        }}>
          <Icon size={9} color={isExpired ? STATUS_META.expired.color : meta.color} />
          <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '0.06em', color: isExpired ? STATUS_META.expired.color : meta.color }}>
            {isExpired ? '已过期' : meta.label}
          </span>
        </div>

        {/* Product name */}
        <span style={{ flex: 1, fontFamily: INTER, fontSize: 11, color: 'rgba(190,200,225,0.80)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {order.product_name}
        </span>

        {/* Amount */}
        <span style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(100,110,140,0.70)', flexShrink: 0 }}>
          ¥{yuan}
        </span>

        {expanded ? <ChevronUp size={12} color="rgba(100,110,140,0.50)" /> : <ChevronDown size={12} color="rgba(100,110,140,0.50)" />}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: '0 14px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 10 }}>
            <Row label="订单号" value={order.order_no} mono />
            <Row label="创建时间" value={formatDate(order.created_at)} />
            {order.status === 'rejected' && order.reject_reason && (
              <div style={{
                marginTop: 4, padding: '7px 10px',
                background: 'rgba(255,68,102,0.08)', border: '1px solid rgba(255,68,102,0.20)',
                borderRadius: 7,
              }}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,100,120,0.80)' }}>
                  拒绝原因：{order.reject_reason}
                </span>
              </div>
            )}
            {order.status === 'fulfilled' && (
              <div style={{
                marginTop: 4, padding: '7px 10px',
                background: 'rgba(180,150,255,0.08)', border: '1px solid rgba(180,150,255,0.20)',
                borderRadius: 7,
              }}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(200,180,255,0.80)' }}>
                  权益已发放 · {order.fulfilled_at ? formatDate(order.fulfilled_at) : ''}
                </span>
              </div>
            )}
            {/* Re-submit button for pending/rejected */}
            {(order.status === 'pending' || order.status === 'rejected') && !isExpired && onReopen && (
              <button
                onClick={() => onReopen(order)}
                style={{
                  marginTop: 4, padding: '7px 14px',
                  fontFamily: INTER, fontSize: 11, fontWeight: 600,
                  color: '#00e5c8',
                  background: 'rgba(0,229,200,0.08)',
                  border: '1px solid rgba(0,229,200,0.25)',
                  borderRadius: 7, cursor: 'pointer', alignSelf: 'flex-start',
                }}
              >
                {order.status === 'rejected' ? '重新提交凭证' : '继续付款'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(100,110,140,0.55)', letterSpacing: '0.04em' }}>{label}</span>
      <span style={{ fontFamily: mono ? MONO : INTER, fontSize: 10, color: 'rgba(180,190,215,0.75)' }}>{value}</span>
    </div>
  );
}

export function OrderHistoryPanel({ orders, loading, onRefetch, onReopen }: Props) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(100,110,140,0.55)', letterSpacing: '0.06em' }}>
          手动支付订单 · {orders.length} 条
        </span>
        <button
          onClick={onRefetch}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
        >
          <RefreshCw size={11} color="rgba(100,110,140,0.50)" style={{ animation: loading ? 'spin 1s linear infinite' : undefined }} />
        </button>
      </div>

      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 0', fontFamily: INTER, fontSize: 12, color: 'rgba(100,110,140,0.45)' }}>
          暂无订单
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {orders.map(o => (
            <OrderRow key={o.id} order={o} onReopen={onReopen} />
          ))}
        </div>
      )}
    </div>
  );
}
