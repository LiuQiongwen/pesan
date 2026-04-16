/**
 * PricingPage — Public pricing page accessible without login.
 * Cosmic dark aesthetic matching the rest of the app.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Star, Zap, Users, Check, Sparkles, ArrowRight, Shield,
  RefreshCcw, FileText, ChevronDown, ChevronUp,
} from 'lucide-react';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

const PLANS = [
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
    cta:     '免费使用',
    popular: false,
  },
  {
    id:       'pro',
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
    cta:     '升级 Pro',
    badge:   '最受欢迎',
    popular: true,
  },
  {
    id:       'team',
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
    cta:     '选择 Team',
    popular: false,
  },
];

const CREDIT_PACKS = [
  {
    id:      'credits_100',
    credits: 100,
    price:   '¥9.9',
    label:   '轻量包',
    desc:    '适合偶尔使用 AI 功能',
    accent:  '#66f0ff',
    saving:  null,
  },
  {
    id:      'credits_500',
    credits: 500,
    price:   '¥39',
    label:   '标准包',
    desc:    '日常知识处理首选',
    accent:  '#b496ff',
    saving:  '省 20%',
    badge:   '推荐',
  },
  {
    id:      'credits_2000',
    credits: 2000,
    price:   '¥129',
    label:   '超值包',
    desc:    '重度用户最优选择',
    accent:  '#ffa040',
    saving:  '省 35%',
  },
];

const FAQS = [
  {
    q: '什么是 AI Credits？',
    a: 'AI Credits 是驱动 RAG 检索、洞见生成、行动推演等 AI 功能的消耗单元。每次 AI 请求消耗 1–5 个 Credits，具体取决于操作复杂度。订阅 Pro / Team 计划后每月赠送基础 Credits，额外用量可单独购买。',
  },
  {
    q: '可以随时取消订阅吗？',
    a: '是的。您可以随时在 设置 → 订阅与 Credits 中取消当前计划，取消后当前计费周期仍可正常使用，到期后自动降回 Free 计划，不产生额外费用。',
  },
  {
    q: '购买的 Credits 会过期吗？',
    a: 'Credits 包永久有效，不会过期。订阅计划赠送的 Credits 在当前计费周期结束后不累计到下期。',
  },
  {
    q: '支持哪些支付方式？',
    a: '目前支持支付宝扫码支付。更多支付方式（微信支付、银行卡）正在接入中。',
  },
  {
    q: '数据安全吗？',
    a: '您的所有知识数据均存储在私有云实例中，端到端加密。我们不会将您的数据用于训练第三方模型，您随时可以导出或删除数据。',
  },
  {
    q: '如何申请退款？',
    a: '支持自助退款，请查看我们的退款政策，或直接联系客服。',
  },
];

function FAQ({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      onClick={() => setOpen(o => !o)}
      style={{
        background:    open ? 'rgba(180,150,255,0.06)' : 'rgba(255,255,255,0.03)',
        border:        `1px solid ${open ? 'rgba(180,150,255,0.25)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius:  10,
        padding:       '16px 20px',
        cursor:        'pointer',
        transition:    'all 0.2s',
        marginBottom:  8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: INTER, fontSize: 14, fontWeight: 500, color: '#d8daf0' }}>{q}</span>
        {open
          ? <ChevronUp size={14} color="#888fa8" />
          : <ChevronDown size={14} color="#888fa8" />}
      </div>
      {open && (
        <p style={{ fontFamily: INTER, fontSize: 13, color: '#888fa8', lineHeight: 1.7, marginTop: 12, marginBottom: 0 }}>
          {a}
        </p>
      )}
    </div>
  );
}

export default function PricingPage() {
  const navigate = useNavigate();
  const [yearly, setYearly] = useState(false);

  const handleCTA = (planId: string) => {
    if (planId === 'free') {
      navigate('/auth');
    } else {
      // Redirect to auth with intent to upgrade
      navigate('/auth?redirect=/app');
    }
  };

  return (
    <div style={{
      minHeight:  '100vh',
      background: 'radial-gradient(ellipse 100% 60% at 50% 0%, rgba(60,20,120,0.35) 0%, #01040d 55%)',
      fontFamily: INTER,
      color:      '#d8daf0',
      overflowX:  'hidden',
    }}>
      {/* Stars bg */}
      <div style={{
        position:   'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(circle at 20% 20%, rgba(100,60,200,0.04) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(0,200,255,0.03) 0%, transparent 50%)',
      }} />

      {/* Nav */}
      <nav style={{
        position:      'sticky', top: 0, zIndex: 50,
        padding:       '0 clamp(16px,5vw,80px)',
        height:        60,
        display:       'flex', alignItems: 'center', justifyContent: 'space-between',
        background:    'rgba(1,4,13,0.85)',
        backdropFilter:'blur(12px)',
        borderBottom:  '1px solid rgba(255,255,255,0.06)',
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            fontFamily: MONO, fontSize: 15, fontWeight: 700,
            color: '#b496ff', background: 'none', border: 'none', cursor: 'pointer',
            letterSpacing: '0.05em',
          }}
        >
          PESTA
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => navigate('/auth')}
            style={{
              fontFamily: INTER, fontSize: 13, color: '#888fa8',
              background: 'none', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '6px 16px', cursor: 'pointer',
            }}
          >
            登录
          </button>
          <button
            onClick={() => navigate('/auth')}
            style={{
              fontFamily: INTER, fontSize: 13, color: '#01040d',
              background: '#b496ff', border: 'none',
              borderRadius: 8, padding: '6px 16px', cursor: 'pointer', fontWeight: 600,
            }}
          >
            免费开始
          </button>
        </div>
      </nav>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Hero */}
        <section style={{ textAlign: 'center', padding: 'clamp(60px,8vh,100px) clamp(16px,5vw,80px) 48px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(180,150,255,0.1)', border: '1px solid rgba(180,150,255,0.2)',
            borderRadius: 20, padding: '4px 14px', marginBottom: 24,
          }}>
            <Sparkles size={12} color="#b496ff" />
            <span style={{ fontFamily: MONO, fontSize: 11, color: '#b496ff', letterSpacing: '0.08em' }}>
              KNOWLEDGE UNIVERSE
            </span>
          </div>
          <h1 style={{
            fontSize: 'clamp(32px,5vw,56px)', fontWeight: 800,
            background: 'linear-gradient(135deg,#fff 0%,#b496ff 60%,#66f0ff 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            margin: '0 0 16px', lineHeight: 1.15, letterSpacing: '-0.02em',
          }}>
            解锁 Pesta 的全部力量
          </h1>
          <p style={{
            fontSize: 16, color: '#888fa8', maxWidth: 480, margin: '0 auto 36px',
            lineHeight: 1.7,
          }}>
            从私人知识图谱到 AI 协同工作台，选择最适合你的计划开始探索。
          </p>

          {/* Yearly toggle */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 12,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 24, padding: '4px',
          }}>
            {['monthly', 'yearly'].map(t => (
              <button
                key={t}
                onClick={() => setYearly(t === 'yearly')}
                style={{
                  fontFamily: INTER, fontSize: 13, fontWeight: 500,
                  padding: '6px 18px', borderRadius: 20,
                  background: (t === 'yearly') === yearly ? 'rgba(180,150,255,0.18)' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  color: (t === 'yearly') === yearly ? '#b496ff' : '#888fa8',
                  transition: 'all 0.2s',
                }}
              >
                {t === 'monthly' ? '月付' : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    年付
                    <span style={{
                      fontSize: 10, background: 'rgba(102,240,255,0.15)',
                      color: '#66f0ff', borderRadius: 4, padding: '1px 5px',
                    }}>省 17%</span>
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Plans */}
        <section style={{
          display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'center',
          padding: '0 clamp(16px,5vw,80px) 80px',
          maxWidth: 1100, margin: '0 auto',
        }}>
          {PLANS.map(plan => {
            const Icon = plan.icon;
            // Calculate yearly price
            const yearlyDiscount = plan.id === 'pro' ? '¥288' : plan.id === 'team' ? '¥996' : null;
            const displayPrice = yearly && yearlyDiscount ? yearlyDiscount : plan.price;
            const displayPeriod = yearly && yearlyDiscount ? '/年' : plan.period;

            return (
              <div
                key={plan.id}
                style={{
                  flex: '1 1 280px', maxWidth: 340,
                  background:    plan.popular
                    ? `linear-gradient(160deg, rgba(180,150,255,0.12) 0%, rgba(1,4,13,0.9) 100%)`
                    : 'rgba(255,255,255,0.03)',
                  border:        `1px solid ${plan.popular ? 'rgba(180,150,255,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius:  16,
                  padding:       '28px 24px 24px',
                  position:      'relative',
                  boxShadow:     plan.popular ? `0 0 60px rgba(180,150,255,0.08)` : 'none',
                }}
              >
                {plan.badge && (
                  <div style={{
                    position:   'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                    background: plan.accent, borderRadius: 20,
                    padding:    '3px 12px',
                    fontFamily: MONO, fontSize: 10, color: '#01040d', fontWeight: 700,
                    letterSpacing: '0.06em', whiteSpace: 'nowrap',
                  }}>
                    {plan.badge}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: `${plan.accent}22`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={16} color={plan.accent} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>{plan.label}</div>
                    <div style={{ fontSize: 11, color: '#888fa8' }}>{plan.sublabel}</div>
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <span style={{ fontSize: 36, fontWeight: 800, color: plan.accent, fontFamily: MONO }}>
                    {displayPrice}
                  </span>
                  <span style={{ fontSize: 13, color: '#888fa8', marginLeft: 4 }}>
                    {displayPeriod}
                  </span>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {plan.features.map((f, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <Check size={12} color={plan.accent} style={{ flexShrink: 0, marginTop: 2 }} />
                      <span style={{ fontSize: 13, color: '#c0c4d8', lineHeight: 1.5 }}>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCTA(plan.id)}
                  style={{
                    width:      '100%',
                    background: plan.popular
                      ? `linear-gradient(135deg, ${plan.accent}99, ${plan.accent}66)`
                      : 'rgba(255,255,255,0.06)',
                    border:     `1px solid ${plan.popular ? plan.accent + '66' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 10,
                    padding:    '11px 0',
                    color:      plan.popular ? '#fff' : '#c0c4d8',
                    fontSize:   14, fontWeight: 600, fontFamily: INTER,
                    cursor:     'pointer',
                    display:    'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  {plan.cta}
                  <ArrowRight size={13} />
                </button>
              </div>
            );
          })}
        </section>

        {/* Credits */}
        <section style={{
          padding:   '0 clamp(16px,5vw,80px) 80px',
          maxWidth:  1100, margin: '0 auto',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>
              AI Credits 点数包
            </h2>
            <p style={{ fontSize: 14, color: '#888fa8', margin: 0 }}>
              一次购买，永久有效。按需补充 AI 使用量。
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
            {CREDIT_PACKS.map(pack => (
              <div
                key={pack.id}
                style={{
                  flex:       '1 1 240px', maxWidth: 300,
                  background: 'rgba(255,255,255,0.03)',
                  border:     `1px solid ${pack.badge ? pack.accent + '40' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 12,
                  padding:    '20px 20px',
                  position:   'relative',
                }}
              >
                {pack.badge && (
                  <span style={{
                    position:   'absolute', top: -10, right: 16,
                    background: pack.accent, color: '#01040d',
                    fontSize: 10, fontWeight: 700, borderRadius: 4,
                    padding: '2px 8px', fontFamily: MONO, letterSpacing: '0.05em',
                  }}>
                    {pack.badge}
                  </span>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>{pack.label}</div>
                    <div style={{ fontSize: 11, color: '#888fa8', marginTop: 2 }}>{pack.desc}</div>
                  </div>
                  {pack.saving && (
                    <span style={{
                      fontSize: 11, color: pack.accent, background: pack.accent + '18',
                      borderRadius: 4, padding: '2px 6px', fontFamily: MONO, fontWeight: 600,
                    }}>
                      {pack.saving}
                    </span>
                  )}
                </div>
                <div style={{ marginBottom: 14 }}>
                  <span style={{ fontFamily: MONO, fontSize: 28, fontWeight: 800, color: pack.accent }}>
                    {pack.credits}
                  </span>
                  <span style={{ fontSize: 12, color: '#888fa8', marginLeft: 4 }}>Credits</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: '#fff' }}>{pack.price}</span>
                  <button
                    onClick={() => navigate('/auth?redirect=/app')}
                    style={{
                      background: pack.accent + '22', border: `1px solid ${pack.accent}44`,
                      borderRadius: 8, padding: '7px 16px',
                      color: pack.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      fontFamily: INTER,
                    }}
                  >
                    购买
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Feature comparison */}
        <section style={{
          padding:  '0 clamp(16px,5vw,80px) 80px',
          maxWidth: 900, margin: '0 auto',
        }}>
          <h2 style={{ textAlign: 'center', fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 32 }}>
            功能对比
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['功能', 'Free', 'Pro', 'Team'].map((h, i) => (
                    <th key={h} style={{
                      padding:     '10px 16px',
                      textAlign:   i === 0 ? 'left' : 'center',
                      color:       i === 2 ? '#b496ff' : '#888fa8',
                      fontWeight:  600, fontFamily: MONO,
                      borderBottom:'1px solid rgba(255,255,255,0.08)',
                      fontSize:    12, letterSpacing: '0.05em',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['知识节点数量', '50 个', '无限', '无限 × 5人'],
                  ['AI 助手调用', '10 次/天', '200 次/天', '500 次/天'],
                  ['RAG 深度检索', '—', '✓', '✓'],
                  ['洞见生成', '—', '✓', '✓'],
                  ['行动规划舱', '—', '✓', '✓'],
                  ['记忆管理舱', '—', '✓', '✓'],
                  ['星系（主题簇）', '3 个', '无限', '无限'],
                  ['团队共享星图', '—', '—', '✓'],
                  ['API 接入', '—', '—', '✓'],
                  ['数据导出', '✓', '✓', '✓'],
                  ['客服支持', '社区', '优先邮件', '专属经理'],
                ].map(([feature, free, pro, team], i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                    <td style={{ padding: '10px 16px', color: '#c0c4d8', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{feature}</td>
                    {[free, pro, team].map((val, j) => (
                      <td key={j} style={{
                        padding:    '10px 16px', textAlign: 'center',
                        borderBottom:'1px solid rgba(255,255,255,0.05)',
                        color:      val === '—' ? 'rgba(255,255,255,0.2)'
                                  : j === 1 ? '#b496ff' : '#888fa8',
                        fontWeight: j === 1 && val !== '—' ? 500 : 400,
                      }}>
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ */}
        <section style={{ padding: '0 clamp(16px,5vw,80px) 80px', maxWidth: 720, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 32 }}>
            常见问题
          </h2>
          {FAQS.map((faq, i) => <FAQ key={i} {...faq} />)}
        </section>

        {/* Trust badges */}
        <section style={{
          display:        'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'center',
          padding:        '0 clamp(16px,5vw,80px) 80px',
        }}>
          {[
            { icon: Shield, label: '数据端到端加密', sub: '您的知识只属于您' },
            { icon: RefreshCcw, label: '随时取消，无捆绑', sub: '无违约金，无隐藏费用' },
            { icon: Zap, label: '支付宝安全支付', sub: '国内主流支付，便捷安全' },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 10, padding: '14px 20px',
            }}>
              <Icon size={20} color="#b496ff" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#d8daf0' }}>{label}</div>
                <div style={{ fontSize: 11, color: '#888fa8', marginTop: 1 }}>{sub}</div>
              </div>
            </div>
          ))}
        </section>

        {/* Footer */}
        <footer style={{
          borderTop:  '1px solid rgba(255,255,255,0.06)',
          padding:    '28px clamp(16px,5vw,80px)',
          display:    'flex', flexWrap: 'wrap', gap: 12,
          alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: MONO, fontSize: 12, color: '#555a72' }}>
            © 2026 Pesta
          </span>
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { label: '服务条款', path: '/terms' },
              { label: '隐私政策', path: '/privacy' },
              { label: '退款政策', path: '/refund' },
            ].map(({ label, path }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                style={{
                  fontFamily: INTER, fontSize: 12, color: '#555a72',
                  background: 'none', border: 'none', cursor: 'pointer',
                  textDecoration: 'none',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#888fa8')}
                onMouseLeave={e => (e.currentTarget.style.color = '#555a72')}
              >
                {label}
              </button>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}
