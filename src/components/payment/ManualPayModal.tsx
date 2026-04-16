/**
 * ManualPayModal — shows QR codes + order details after order creation.
 * User switches between WeChat/Alipay tabs, then clicks "我已付款".
 */
import { useState, useEffect } from 'react';
import { X, Clock, Copy, Check, QrCode } from 'lucide-react';
import { ProofSubmitForm } from './ProofSubmitForm';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

export interface OrderCreatedPayload {
  orderId: string;
  orderNo: string;
  productName: string;
  productCode: string;
  productType: string;
  amountFen: number;
  expiresAt: string;
  wechatQrUrl: string | null;
  alipayQrUrl: string | null;
  wechatPayee: string;
  alipayPayee: string;
}

interface Props {
  order: OrderCreatedPayload;
  onClose: () => void;
  onSubmitted: () => void;
  onViewOrders?: () => void;
}

function useCountdown(expiresAt: string) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const calc = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemaining(diff);
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  return { remaining, formatted: `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}` };
}

export function ManualPayModal({ order, onClose, onSubmitted, onViewOrders }: Props) {
  const [payMethod, setPayMethod] = useState<'wechat' | 'alipay'>(
    order.wechatQrUrl ? 'wechat' : 'alipay',
  );
  const [showProofForm, setShowProofForm] = useState(false);
  const [copied, setCopied] = useState(false);
  const { remaining, formatted } = useCountdown(order.expiresAt);
  const yuan = (order.amountFen / 100).toFixed(2);

  const qrUrl = payMethod === 'wechat' ? order.wechatQrUrl : order.alipayQrUrl;
  const payee = payMethod === 'wechat' ? order.wechatPayee : order.alipayPayee;

  const copyOrderNo = () => {
    navigator.clipboard.writeText(order.orderNo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (showProofForm) {
    return (
      <ProofSubmitForm
        orderId={order.orderId}
        orderNo={order.orderNo}
        productName={order.productName}
        amountFen={order.amountFen}
        defaultMethod={payMethod}
        onBack={() => setShowProofForm(false)}
        onSubmitted={onSubmitted}
        onViewOrders={onViewOrders}
      />
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.70)',
          backdropFilter: 'blur(6px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 201,
        width: 'clamp(320px, 90vw, 460px)',
        background: 'rgba(6,9,22,0.98)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 20,
        boxShadow: '0 32px 96px rgba(0,0,0,0.85)',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '18px 20px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: INTER, fontSize: 15, fontWeight: 700, color: 'rgba(225,232,250,0.95)' }}>
              扫码付款
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(80,90,115,0.65)', letterSpacing: '0.06em', marginTop: 2 }}>
              {order.productName}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {remaining > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={10} color={remaining < 300 ? '#ff4466' : '#888fa8'} />
                <span style={{
                  fontFamily: MONO, fontSize: 10, letterSpacing: '0.04em',
                  color: remaining < 300 ? '#ff4466' : 'rgba(100,110,140,0.70)',
                }}>
                  {formatted}
                </span>
              </div>
            )}
            <button
              onClick={onClose}
              style={{
                width: 28, height: 28, borderRadius: 7,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={12} color="rgba(140,150,175,0.70)" />
            </button>
          </div>
        </div>

        {/* Amount */}
        <div style={{
          padding: '12px 20px',
          background: 'rgba(255,255,255,0.02)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(100,110,140,0.60)', letterSpacing: '0.06em' }}>
            应付金额
          </span>
          <span style={{ fontFamily: INTER, fontSize: 26, fontWeight: 800, color: '#00e5c8', letterSpacing: '-0.02em' }}>
            ¥{yuan}
          </span>
        </div>

        {/* Method tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          {(['wechat', 'alipay'] as const).map(m => {
            const active = payMethod === m;
            const label  = m === 'wechat' ? '微信支付' : '支付宝';
            const color  = m === 'wechat' ? '#07c160' : '#1677ff';
            const hasQr  = m === 'wechat' ? !!order.wechatQrUrl : !!order.alipayQrUrl;
            if (!hasQr) return null;
            return (
              <button
                key={m}
                onClick={() => setPayMethod(m)}
                style={{
                  flex: 1, padding: '10px 0',
                  fontFamily: MONO, fontSize: 10, letterSpacing: '0.05em',
                  color: active ? color : 'rgba(100,110,140,0.55)',
                  background: active ? `${color}10` : 'transparent',
                  border: 'none',
                  borderBottom: active ? `2px solid ${color}` : '2px solid transparent',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* QR code area */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          {qrUrl ? (
            <div style={{
              width: 180, height: 180,
              background: '#fff',
              borderRadius: 12,
              padding: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.10)',
            }}>
              <img
                src={qrUrl}
                alt={`${payMethod} QR`}
                crossOrigin="anonymous"
                style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 6 }}
              />
            </div>
          ) : (
            <div style={{
              width: 180, height: 180,
              background: 'rgba(255,255,255,0.03)',
              border: '1px dashed rgba(255,255,255,0.15)',
              borderRadius: 12,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <QrCode size={32} color="rgba(100,110,140,0.40)" />
              <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(80,90,115,0.60)' }}>
                收款码尚未配置
              </span>
            </div>
          )}

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(140,150,175,0.60)', marginBottom: 4 }}>
              收款方: <span style={{ color: 'rgba(200,210,235,0.80)' }}>{payee}</span>
            </div>
            <div style={{ fontFamily: INTER, fontSize: 11, color: 'rgba(100,110,140,0.55)' }}>
              请在付款备注中填写订单号
            </div>
          </div>

          {/* Order number */}
          <button
            onClick={copyOrderNo}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 7, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            <span style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(180,190,220,0.70)', letterSpacing: '0.05em' }}>
              {order.orderNo}
            </span>
            {copied
              ? <Check size={11} color="#00e5c8" />
              : <Copy size={11} color="rgba(120,130,160,0.60)" />
            }
          </button>
        </div>

        {/* CTA */}
        <div style={{ padding: '0 20px 20px' }}>
          <button
            onClick={() => setShowProofForm(true)}
            disabled={remaining === 0}
            style={{
              width: '100%', padding: '12px',
              fontFamily: INTER, fontSize: 13, fontWeight: 600,
              color: remaining === 0 ? 'rgba(100,110,140,0.40)' : '#fff',
              background: remaining === 0
                ? 'rgba(255,255,255,0.04)'
                : 'linear-gradient(135deg, rgba(0,229,200,0.85), rgba(0,180,255,0.75))',
              border: 'none', borderRadius: 10,
              cursor: remaining === 0 ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => { if (remaining > 0) (e.currentTarget as HTMLButtonElement).style.opacity = '0.88'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
          >
            {remaining === 0 ? '订单已过期' : '我已付款，提交凭证'}
          </button>
          <div style={{ textAlign: 'center', marginTop: 8, fontFamily: MONO, fontSize: 9, color: 'rgba(80,90,115,0.50)', letterSpacing: '0.04em' }}>
            付款后请上传截图，人工审核后自动发放权益
          </div>
        </div>
      </div>
    </>
  );
}
