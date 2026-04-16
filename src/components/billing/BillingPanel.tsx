/**
 * BillingPanel — slide-in right panel for subscription & credits purchase.
 * Uses manual payment flow: QR code → proof upload → admin review → auto-fulfillment.
 */
import { useState } from 'react';
import {
  X, Zap, Check, Star, Users, Sparkles, CreditCard, History,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBilling } from '@/hooks/useBilling';
import { useManualOrders, type ManualOrder } from '@/hooks/useManualOrders';
import { useAuth } from '@/hooks/useAuth';
import { ManualPayModal, type OrderCreatedPayload } from '@/components/payment/ManualPayModal';
import { OrderHistoryPanel } from '@/components/payment/OrderHistoryPanel';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

// ── Catalogue ─────────────────────────────────────────────────────────────────
const SUBSCRIPTION_PLANS = [
  {
    id:       'free',
    label:    'Free',
    sublabel: '入门探索',
    price:    '¥0',
    period:   '',
    accent:   '#888fa8',
    icon:     Star,
    features: [
      '50 个知识节点',
      '基础 AI 辅助 · 10 次/天',
      '3 个星系（主题簇）',
      '基础检索',
    ],
    cta:      null,
  },
  {
    id:       'pro_monthly',
    planKey:  'pro',
    label:    'Pro',
    sublabel: 'Pesta 全解锁',
    price:    '¥29',
    period:   '/月',
    accent:   '#b496ff',
    icon:     Zap,
    features: [
      '无限知识节点',
      '全量 AI 功能 · 200 次/天',
      '无限星系',
      'RAG 深度检索',
      '洞见、行动、记忆舱全功能',
      '优先客服支持',
    ],
    badge:    '最受欢迎',
    cta:      '升级 Pro',
  },
  {
    id:       'team_monthly',
    planKey:  'team',
    label:    'Team',
    sublabel: '团队协同知识库',
    price:    '¥99',
    period:   '/月',
    accent:   '#ffa040',
    icon:     Users,
    features: [
      'Pro 权益 × 5 人',
      '团队共享星图',
      '协作编辑',
      'API 接入',
      '专属客户经理',
    ],
    cta:      '选择 Team',
  },
];

const CREDIT_PACKS = [
  {
    id: 'credits_100', credits: 100, price: '¥9.9',
    label: '轻量包', desc: '适合偶尔使用 AI 功能', accent: '#66f0ff', saving: null,
  },
  {
    id: 'credits_500', credits: 500, price: '¥39',
    label: '标准包', desc: '日常知识处理首选', accent: '#b496ff', saving: '省 20%', badge: '推荐',
  },
  {
    id: 'credits_2000', credits: 2000, price: '¥129',
    label: '超值包', desc: '重度用户最优选择', accent: '#ffa040', saving: '省 35%',
  },
];

type Tab = 'subscription' | 'credits' | 'orders';

interface Props { onClose: () => void }

export function BillingPanel({ onClose }: Props) {
  const { user }     = useAuth();
  const billing      = useBilling(user?.id);
  const manualOrders = useManualOrders(user?.id);
  const [tab, setTab]         = useState<Tab>('subscription');
  const [loading, setLoading] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<OrderCreatedPayload | null>(null);

  const currentPlan = billing.plan;
  const periodEnd   = billing.periodEnd
    ? new Date(billing.periodEnd).toLocaleDateString('zh-CN')
    : null;

  // ── Create manual payment order ────────────────────────────────────────────
  const handlePurchase = async (productCode: string) => {
    if (!user) return;
    setLoading(productCode);
    try {
      const { data, error } = await supabase.functions.invoke('manual-pay-create', {
        body: { productCode },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setActiveOrder(data as OrderCreatedPayload);
    } catch (e) {
      console.error('create manual order error:', e);
    } finally {
      setLoading(null);
    }
  };

  const handleOrderSubmitted = () => {
    setActiveOrder(null);
    billing.refetch();
    manualOrders.refetch();
    setTab('orders');
  };

  const handleReopenOrder = (order: ManualOrder) => {
    // Reconstruct minimal payload to show the payment modal again
    setActiveOrder({
      orderId:     order.id,
      orderNo:     order.order_no,
      productName: order.product_name,
      productCode: order.product_code,
      productType: order.product_type,
      amountFen:   order.amount_fen,
      expiresAt:   order.expires_at,
      wechatQrUrl: null,
      alipayQrUrl: null,
      wechatPayee: 'Pesta',
      alipayPayee: 'Pesta',
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 49,
          background: 'rgba(0,0,0,0.50)',
          backdropFilter: 'blur(4px)',
          animation: 'billing-backdrop-in 0.22s ease-out',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'clamp(380px, 42vw, 560px)',
        zIndex: 50,
        background: 'rgba(4,6,16,0.98)',
        backdropFilter: 'blur(40px) saturate(1.8)',
        borderLeft: '1px solid rgba(255,255,255,0.10)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-24px 0 80px rgba(0,0,0,0.80)',
        animation: 'billing-panel-in 0.28s cubic-bezier(0.22,1,0.36,1)',
        overflowY: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Sparkles size={15} color="#b496ff" />
              <span style={{ fontFamily: INTER, fontSize: 16, fontWeight: 700, color: 'rgba(230,238,255,0.92)' }}>
                Pesta 订阅中心
              </span>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(80,90,115,0.65)', letterSpacing: '0.06em' }}>
              PESTA BILLING · 微信 / 支付宝扫码付款
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 7,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.14s', flexShrink: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.10)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
          >
            <X size={13} color="rgba(140,150,175,0.70)" />
          </button>
        </div>

        {/* Current plan bar */}
        <div style={{
          padding: '10px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(180,150,255,0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              padding: '3px 10px', borderRadius: 5,
              background: currentPlan === 'free' ? 'rgba(136,143,168,0.15)'
                : currentPlan === 'pro'  ? 'rgba(180,150,255,0.18)'
                : 'rgba(255,160,64,0.18)',
              border: `1px solid ${
                currentPlan === 'free' ? 'rgba(136,143,168,0.30)'
                : currentPlan === 'pro'  ? 'rgba(180,150,255,0.40)'
                : 'rgba(255,160,64,0.40)'}`,
              fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em', fontWeight: 600,
              color: currentPlan === 'free' ? '#888fa8'
                : currentPlan === 'pro'  ? '#c4aaff'
                : '#ffb84d',
            }}>
              {currentPlan.toUpperCase()}
            </div>
            {periodEnd && (
              <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(100,110,135,0.60)', letterSpacing: '0.04em' }}>
                有效至 {periodEnd}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={10} color="#b496ff" />
            <span style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(180,160,255,0.80)', letterSpacing: '0.04em' }}>
              {billing.credits.toLocaleString()} Credits
            </span>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ padding: '10px 24px 0', display: 'flex', gap: 4, flexShrink: 0 }}>
          {([
            { key: 'subscription', label: '订阅计划' },
            { key: 'credits',      label: 'AI Credits' },
            { key: 'orders',       label: '我的订单' },
          ] as { key: Tab; label: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '7px 14px',
                fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em',
                color: tab === t.key ? 'rgba(220,228,250,0.92)' : 'rgba(100,110,140,0.60)',
                background: tab === t.key ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: tab === t.key ? '1px solid rgba(255,255,255,0.14)' : '1px solid transparent',
                borderRadius: 7, cursor: 'pointer', transition: 'all 0.14s',
                position: 'relative',
              }}
            >
              {t.label}
              {t.key === 'orders' && manualOrders.orders.filter(o => o.status === 'submitted').length > 0 && (
                <span style={{
                  position: 'absolute', top: 3, right: 3,
                  width: 6, height: 6, borderRadius: '50%',
                  background: '#66f0ff',
                }} />
              )}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}>

          {/* ── Subscription tab ──────────────────────────────────────────── */}
          {tab === 'subscription' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {SUBSCRIPTION_PLANS.map(plan => {
                const Icon      = plan.icon;
                const isCurrent = currentPlan === (plan.planKey ?? plan.id);
                const isFree    = plan.id === 'free';
                return (
                  <div
                    key={plan.id}
                    style={{
                      borderRadius: 14,
                      border: isCurrent ? `1.5px solid ${plan.accent}55` : '1px solid rgba(255,255,255,0.07)',
                      background: isCurrent ? `linear-gradient(140deg, rgba(255,255,255,0.04), transparent)` : 'rgba(255,255,255,0.02)',
                      padding: '16px 18px',
                      position: 'relative', overflow: 'hidden',
                    }}
                  >
                    {plan.badge && (
                      <div style={{
                        position: 'absolute', top: 12, right: 14,
                        fontFamily: MONO, fontSize: 8, letterSpacing: '0.08em',
                        color: plan.accent, background: `${plan.accent}22`,
                        border: `1px solid ${plan.accent}44`,
                        borderRadius: 4, padding: '2px 7px',
                      }}>
                        {plan.badge}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 9,
                        background: `${plan.accent}18`, border: `1px solid ${plan.accent}33`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Icon size={16} color={plan.accent} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                          <span style={{ fontFamily: INTER, fontSize: 15, fontWeight: 700, color: 'rgba(225,232,250,0.92)' }}>{plan.label}</span>
                          <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(100,110,140,0.60)' }}>{plan.sublabel}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginTop: 3 }}>
                          <span style={{ fontFamily: INTER, fontSize: 22, fontWeight: 700, color: isFree ? '#888fa8' : plan.accent }}>{plan.price}</span>
                          <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(100,110,140,0.55)' }}>{plan.period}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
                      {plan.features.map((f, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <Check size={10} color={isFree ? '#888fa8' : plan.accent} style={{ flexShrink: 0 }} />
                          <span style={{ fontFamily: INTER, fontSize: 11, color: 'rgba(180,190,215,0.75)' }}>{f}</span>
                        </div>
                      ))}
                    </div>
                    {isFree ? (
                      <div style={{ textAlign: 'center', fontFamily: MONO, fontSize: 9, color: 'rgba(80,90,115,0.55)', letterSpacing: '0.05em' }}>
                        {isCurrent ? '当前方案' : '基础方案'}
                      </div>
                    ) : isCurrent ? (
                      <div style={{
                        width: '100%', padding: '8px', textAlign: 'center',
                        fontFamily: MONO, fontSize: 9, letterSpacing: '0.06em',
                        color: `${plan.accent}cc`, background: `${plan.accent}12`,
                        border: `1px solid ${plan.accent}30`, borderRadius: 7,
                      }}>
                        当前方案 · 使用中
                      </div>
                    ) : (
                      <button
                        onClick={() => handlePurchase(plan.id)}
                        disabled={loading === plan.id}
                        style={{
                          width: '100%', padding: '10px',
                          fontFamily: INTER, fontSize: 13, fontWeight: 600,
                          color: '#040b10',
                          background: loading === plan.id ? `${plan.accent}88` : `linear-gradient(135deg, ${plan.accent}, ${plan.accent}cc)`,
                          border: 'none', borderRadius: 8, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          boxShadow: `0 4px 20px ${plan.accent}40`,
                        }}
                      >
                        {loading === plan.id
                          ? '创建订单…'
                          : <><CreditCard size={12} /> {plan.cta}</>
                        }
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Credits tab ───────────────────────────────────────────────── */}
          {tab === 'credits' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                padding: '14px 16px',
                background: 'rgba(180,150,255,0.06)', border: '1px solid rgba(180,150,255,0.18)',
                borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'rgba(180,150,255,0.14)', border: '1px solid rgba(180,150,255,0.30)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Zap size={17} color="#b496ff" />
                </div>
                <div>
                  <div style={{ fontFamily: INTER, fontSize: 22, fontWeight: 700, color: '#c4aaff' }}>
                    {billing.credits.toLocaleString()}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(140,150,180,0.60)', letterSpacing: '0.04em' }}>
                    可用 AI Credits
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 8, color: 'rgba(80,90,115,0.55)', textAlign: 'right' }}>
                  用于 AI 洞见<br />语义检索<br />行动生成
                </div>
              </div>

              {CREDIT_PACKS.map(pack => (
                <div
                  key={pack.id}
                  style={{
                    borderRadius: 14, border: `1px solid ${pack.accent}22`,
                    background: `${pack.accent}06`, padding: '16px 18px', position: 'relative',
                  }}
                >
                  {(pack as { badge?: string }).badge && (
                    <div style={{
                      position: 'absolute', top: 12, right: 14,
                      fontFamily: MONO, fontSize: 8, color: pack.accent,
                      background: `${pack.accent}22`, border: `1px solid ${pack.accent}44`,
                      borderRadius: 4, padding: '2px 7px', letterSpacing: '0.06em',
                    }}>
                      {(pack as { badge?: string }).badge}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 10,
                      background: `${pack.accent}15`, border: `1px solid ${pack.accent}33`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: pack.accent }}>
                        {pack.credits >= 1000 ? `${pack.credits/1000}k` : pack.credits}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontFamily: INTER, fontSize: 14, fontWeight: 700, color: 'rgba(220,228,250,0.90)' }}>
                          {pack.credits} Credits
                        </span>
                        <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(100,110,140,0.55)' }}>· {pack.label}</span>
                      </div>
                      <div style={{ fontFamily: INTER, fontSize: 11, color: 'rgba(150,160,190,0.65)', marginTop: 2 }}>{pack.desc}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: INTER, fontSize: 20, fontWeight: 700, color: pack.accent }}>{pack.price}</div>
                      {pack.saving && (
                        <div style={{
                          fontFamily: MONO, fontSize: 8, color: '#00ff66',
                          background: 'rgba(0,255,102,0.10)', border: '1px solid rgba(0,255,102,0.22)',
                          borderRadius: 4, padding: '1px 6px', marginTop: 2, display: 'inline-block',
                        }}>
                          {pack.saving}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handlePurchase(pack.id)}
                    disabled={loading === pack.id}
                    style={{
                      width: '100%', padding: '9px',
                      fontFamily: INTER, fontSize: 12, fontWeight: 600, color: '#040b10',
                      background: loading === pack.id ? `${pack.accent}88` : `linear-gradient(135deg, ${pack.accent}, ${pack.accent}cc)`,
                      border: 'none', borderRadius: 8, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      boxShadow: `0 4px 16px ${pack.accent}35`,
                    }}
                  >
                    {loading === pack.id ? '创建订单…' : <><Zap size={12} /> 购买 {pack.credits} Credits</>}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── Orders tab ───────────────────────────────────────────────── */}
          {tab === 'orders' && (
            <OrderHistoryPanel
              orders={manualOrders.orders}
              loading={manualOrders.loading}
              onRefetch={manualOrders.refetch}
              onReopen={handleReopenOrder}
            />
          )}

          {/* Payment notice */}
          {tab !== 'orders' && (
            <div style={{
              marginTop: 16, padding: '10px 14px',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 8, fontFamily: MONO, fontSize: 8.5,
              color: 'rgba(80,90,115,0.55)', lineHeight: 1.6, letterSpacing: '0.03em',
            }}>
              扫码付款 · 上传凭证 · 人工审核 · 自动发放权益 · 24 小时内完成
            </div>
          )}
        </div>
      </div>

      {/* Manual pay modal */}
      {activeOrder && (
        <ManualPayModal
          order={activeOrder}
          onClose={() => setActiveOrder(null)}
          onSubmitted={handleOrderSubmitted}
          onViewOrders={() => { setActiveOrder(null); setTab('orders'); }}
        />
      )}

      <style>{`
        @keyframes billing-panel-in {
          from { transform: translateX(100%); opacity: 0.8; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes billing-backdrop-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
