/**
 * BillingPanel — slide-in right panel for subscription & credits purchase.
 * Design language: cosmic dark, consistent with CommandDock / CosmosScene.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Zap, Check, Star, Users, Sparkles,
  CreditCard, RefreshCcw, ExternalLink, Clock,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBilling } from '@/hooks/useBilling';
import { useAuth } from '@/hooks/useAuth';

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
    cta:      null, // not purchasable
  },
  {
    id:       'pro_monthly',
    planKey:  'pro',
    label:    'Pro',
    sublabel: '知识宇宙全解锁',
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
    id:       'credits_100',
    credits:  100,
    price:    '¥9.9',
    amountFen: 990,
    label:    '轻量包',
    desc:     '适合偶尔使用 AI 功能',
    accent:   '#66f0ff',
    saving:   null,
  },
  {
    id:       'credits_500',
    credits:  500,
    price:    '¥39',
    amountFen: 3900,
    label:    '标准包',
    desc:     '日常知识处理首选',
    accent:   '#b496ff',
    saving:   '省 20%',
    badge:    '推荐',
  },
  {
    id:       'credits_2000',
    credits:  2000,
    price:    '¥129',
    amountFen: 12900,
    label:    '超值包',
    desc:     '重度用户最优选择',
    accent:   '#ffa040',
    saving:   '省 35%',
  },
];

type Tab = 'subscription' | 'credits';
type OrderState = { orderNo: string; payUrl: string | null; demoMode: boolean } | null;

interface Props { onClose: () => void }

export function BillingPanel({ onClose }: Props) {
  const { user }           = useAuth();
  const billing            = useBilling(user?.id);
  const [tab, setTab]      = useState<Tab>('subscription');
  const [loading, setLoading] = useState<string | null>(null);
  const [order,   setOrder]   = useState<OrderState>(null);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Poll order status after payment window opens ──────────────────────────
  const startPolling = useCallback((orderNo: string) => {
    setPolling(true);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      const { data } = await supabase
        .from('payment_orders')
        .select('status')
        .eq('order_no', orderNo)
        .maybeSingle();

      if (data?.status === 'paid') {
        clearInterval(pollRef.current!);
        setPolling(false);
        setOrder(null);
        billing.refetch();
      } else if (attempts >= 100) { // 5 min timeout
        clearInterval(pollRef.current!);
        setPolling(false);
      }
    }, 3000);
  }, [billing]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── Create order & open Alipay window ─────────────────────────────────────
  const handlePurchase = async (type: 'subscription' | 'credits', itemId: string) => {
    if (!user) return;
    setLoading(itemId);
    try {
      const { data, error } = await supabase.functions.invoke('alipay-create-order', {
        body: { type, itemId },
      });
      if (error) throw error;

      setOrder(data);
      if (data.payUrl) {
        window.open(data.payUrl, '_blank', 'noopener');
        startPolling(data.orderNo);
      }
    } catch (e) {
      console.error('create order error:', e);
    } finally {
      setLoading(null);
    }
  };

  const currentPlan = billing.plan;
  const periodEnd   = billing.periodEnd
    ? new Date(billing.periodEnd).toLocaleDateString('zh-CN')
    : null;

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
                知识宇宙订阅中心
              </span>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(80,90,115,0.65)', letterSpacing: '0.06em' }}>
              COSMOS BILLING · 支付宝安全支付
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
        <div style={{
          padding: '10px 24px 0',
          display: 'flex', gap: 4,
          flexShrink: 0,
        }}>
          {([
            { key: 'subscription', label: '订阅计划' },
            { key: 'credits',      label: 'AI Credits' },
          ] as { key: Tab; label: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '7px 16px',
                fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em',
                color: tab === t.key ? 'rgba(220,228,250,0.92)' : 'rgba(100,110,140,0.60)',
                background: tab === t.key ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: tab === t.key ? '1px solid rgba(255,255,255,0.14)' : '1px solid transparent',
                borderRadius: 7,
                cursor: 'pointer',
                transition: 'all 0.14s',
              }}
            >
              {t.label}
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
                      border: isCurrent
                        ? `1.5px solid ${plan.accent}55`
                        : '1px solid rgba(255,255,255,0.07)',
                      background: isCurrent
                        ? `linear-gradient(140deg, rgba(255,255,255,0.04), transparent)`
                        : 'rgba(255,255,255,0.02)',
                      padding: '16px 18px',
                      position: 'relative', overflow: 'hidden',
                      transition: 'border-color 0.18s',
                    }}
                  >
                    {/* Badge */}
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

                    {/* Plan header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 9,
                        background: `${plan.accent}18`,
                        border: `1px solid ${plan.accent}33`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Icon size={16} color={plan.accent} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                          <span style={{ fontFamily: INTER, fontSize: 15, fontWeight: 700, color: 'rgba(225,232,250,0.92)' }}>
                            {plan.label}
                          </span>
                          <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(100,110,140,0.60)' }}>
                            {plan.sublabel}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginTop: 3 }}>
                          <span style={{ fontFamily: INTER, fontSize: 22, fontWeight: 700, color: isFree ? '#888fa8' : plan.accent }}>
                            {plan.price}
                          </span>
                          <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(100,110,140,0.55)' }}>
                            {plan.period}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Features */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
                      {plan.features.map((f, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <Check size={10} color={isFree ? '#888fa8' : plan.accent} style={{ flexShrink: 0 }} />
                          <span style={{ fontFamily: INTER, fontSize: 11, color: 'rgba(180,190,215,0.75)' }}>{f}</span>
                        </div>
                      ))}
                    </div>

                    {/* CTA */}
                    {isFree ? (
                      <div style={{
                        textAlign: 'center',
                        fontFamily: MONO, fontSize: 9, color: 'rgba(80,90,115,0.55)', letterSpacing: '0.05em',
                      }}>
                        {isCurrent ? '当前方案' : '基础方案'}
                      </div>
                    ) : isCurrent ? (
                      <div style={{
                        width: '100%', padding: '8px',
                        textAlign: 'center',
                        fontFamily: MONO, fontSize: 9, letterSpacing: '0.06em',
                        color: `${plan.accent}cc`,
                        background: `${plan.accent}12`,
                        border: `1px solid ${plan.accent}30`,
                        borderRadius: 7,
                      }}>
                        当前方案 · 使用中
                      </div>
                    ) : (
                      <button
                        onClick={() => handlePurchase('subscription', plan.id)}
                        disabled={loading === plan.id}
                        style={{
                          width: '100%', padding: '10px',
                          fontFamily: INTER, fontSize: 13, fontWeight: 600,
                          color: '#040b10',
                          background: loading === plan.id
                            ? `${plan.accent}88`
                            : `linear-gradient(135deg, ${plan.accent}, ${plan.accent}cc)`,
                          border: 'none', borderRadius: 8, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          transition: 'opacity 0.15s',
                          boxShadow: `0 4px 20px ${plan.accent}40`,
                        }}
                      >
                        {loading === plan.id ? (
                          <><RefreshCcw size={12} style={{ animation: 'spin 1s linear infinite' }} /> 创建订单…</>
                        ) : (
                          <><CreditCard size={12} /> {plan.cta}</>
                        )}
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
              {/* Balance info */}
              <div style={{
                padding: '14px 16px',
                background: 'rgba(180,150,255,0.06)',
                border: '1px solid rgba(180,150,255,0.18)',
                borderRadius: 12,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'rgba(180,150,255,0.14)',
                  border: '1px solid rgba(180,150,255,0.30)',
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

              {/* Credit packs */}
              {CREDIT_PACKS.map(pack => (
                <div
                  key={pack.id}
                  style={{
                    borderRadius: 14,
                    border: `1px solid ${pack.accent}22`,
                    background: `${pack.accent}06`,
                    padding: '16px 18px',
                    position: 'relative',
                    transition: 'border-color 0.18s',
                  }}
                >
                  {pack.badge && (
                    <div style={{
                      position: 'absolute', top: 12, right: 14,
                      fontFamily: MONO, fontSize: 8,
                      color: pack.accent, background: `${pack.accent}22`,
                      border: `1px solid ${pack.accent}44`,
                      borderRadius: 4, padding: '2px 7px',
                      letterSpacing: '0.06em',
                    }}>
                      {pack.badge}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 10,
                      background: `${pack.accent}15`,
                      border: `1px solid ${pack.accent}33`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <span style={{
                        fontFamily: MONO, fontSize: 13, fontWeight: 700,
                        color: pack.accent,
                      }}>
                        {pack.credits >= 1000 ? `${pack.credits/1000}k` : pack.credits}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontFamily: INTER, fontSize: 14, fontWeight: 700, color: 'rgba(220,228,250,0.90)' }}>
                          {pack.credits} Credits
                        </span>
                        <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(100,110,140,0.55)' }}>
                          · {pack.label}
                        </span>
                      </div>
                      <div style={{ fontFamily: INTER, fontSize: 11, color: 'rgba(150,160,190,0.65)', marginTop: 2 }}>
                        {pack.desc}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: INTER, fontSize: 20, fontWeight: 700, color: pack.accent }}>
                        {pack.price}
                      </div>
                      {pack.saving && (
                        <div style={{
                          fontFamily: MONO, fontSize: 8, color: '#00ff66',
                          background: 'rgba(0,255,102,0.10)',
                          border: '1px solid rgba(0,255,102,0.22)',
                          borderRadius: 4, padding: '1px 6px', marginTop: 2,
                          display: 'inline-block',
                        }}>
                          {pack.saving}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handlePurchase('credits', pack.id)}
                    disabled={loading === pack.id}
                    style={{
                      width: '100%', padding: '9px',
                      fontFamily: INTER, fontSize: 12, fontWeight: 600,
                      color: '#040b10',
                      background: loading === pack.id
                        ? `${pack.accent}88`
                        : `linear-gradient(135deg, ${pack.accent}, ${pack.accent}cc)`,
                      border: 'none', borderRadius: 8, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      transition: 'opacity 0.15s',
                      boxShadow: `0 4px 16px ${pack.accent}35`,
                    }}
                  >
                    {loading === pack.id ? (
                      <><RefreshCcw size={12} style={{ animation: 'spin 1s linear infinite' }} /> 创建订单…</>
                    ) : (
                      <><Zap size={12} /> 购买 {pack.credits} Credits</>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Alipay notice */}
          <div style={{
            marginTop: 16,
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8,
            fontFamily: MONO, fontSize: 8.5, color: 'rgba(80,90,115,0.55)',
            lineHeight: 1.6, letterSpacing: '0.03em',
          }}>
            支付宝安全支付 · 点击购买后将跳转至支付宝完成支付 · 支付成功后自动激活服务
          </div>
        </div>

        {/* Polling / order state banner */}
        {(polling || order?.demoMode) && (
          <div style={{
            padding: '12px 24px',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            background: order?.demoMode
              ? 'rgba(255,170,64,0.08)'
              : 'rgba(0,255,102,0.06)',
            flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            {polling ? (
              <>
                <Clock size={13} color="#00ff66" style={{ animation: 'spin 2s linear infinite', flexShrink: 0 }} />
                <div>
                  <div style={{ fontFamily: INTER, fontSize: 11, color: 'rgba(200,215,240,0.85)', fontWeight: 600 }}>
                    等待支付完成…
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(100,110,140,0.60)', marginTop: 2, letterSpacing: '0.03em' }}>
                    已在新窗口打开支付宝，支付完成后自动刷新
                  </div>
                </div>
                {order?.payUrl && (
                  <a href={order.payUrl} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                    <ExternalLink size={12} color="rgba(100,110,140,0.55)" />
                  </a>
                )}
              </>
            ) : order?.demoMode ? (
              <>
                <Zap size={13} color="#ffa040" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontFamily: INTER, fontSize: 11, color: 'rgba(255,180,80,0.90)', fontWeight: 600 }}>
                    演示模式
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(180,130,60,0.60)', marginTop: 2, letterSpacing: '0.03em' }}>
                    订单已创建（#{order.orderNo}）· 填入支付宝密钥后即可激活真实支付
                  </div>
                </div>
                <button
                  onClick={() => setOrder(null)}
                  style={{ marginLeft: 'auto', flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                >
                  <X size={11} color="rgba(180,130,60,0.55)" />
                </button>
              </>
            ) : null}
          </div>
        )}

      </div>

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
