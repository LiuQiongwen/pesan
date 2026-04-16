/**
 * PrivacyPage — 隐私政策 (Privacy Policy)
 */
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

const INTER = "'Inter',system-ui,sans-serif";
const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";

const LAST_UPDATED = '2026年4月16日';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2 style={{
        fontSize: 16, fontWeight: 700, color: '#d8daf0',
        margin: '0 0 12px', fontFamily: INTER,
        paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        {title}
      </h2>
      <div style={{ fontSize: 14, color: '#888fa8', lineHeight: 1.8, fontFamily: INTER }}>
        {children}
      </div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '0 0 10px' }}>{children}</p>;
}

function Li({ children }: { children: React.ReactNode }) {
  return <li style={{ marginBottom: 6, paddingLeft: 4 }}>{children}</li>;
}

export default function PrivacyPage() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: '#01040d', fontFamily: INTER, color: '#d8daf0' }}>
      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        padding: '0 clamp(16px,5vw,80px)', height: 56,
        display: 'flex', alignItems: 'center', gap: 16,
        background: 'rgba(1,4,13,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#888fa8', fontSize: 13, fontFamily: INTER,
          }}
        >
          <ArrowLeft size={14} /> 返回
        </button>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />
        <button
          onClick={() => navigate('/')}
          style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: '#b496ff', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          PESTA
        </button>
      </nav>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: 'clamp(40px,6vh,80px) clamp(16px,5vw,80px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 36 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(102,240,255,0.08)', border: '1px solid rgba(102,240,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldCheck size={20} color="#66f0ff" />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>隐私政策</h1>
            <p style={{ fontSize: 12, color: '#555a72', margin: '4px 0 0', fontFamily: MONO }}>
              最后更新：{LAST_UPDATED}
            </p>
          </div>
        </div>

        <div style={{
          background: 'rgba(102,240,255,0.04)', border: '1px solid rgba(102,240,255,0.12)',
          borderRadius: 10, padding: '14px 18px', marginBottom: 36,
          fontSize: 13, color: '#c0c4d8', lineHeight: 1.7,
        }}>
          Pesta重视您的隐私。本政策说明我们如何收集、使用和保护您的个人信息。请在使用本平台前仔细阅读。
        </div>

        <Section title="1. 我们收集哪些信息">
          <P>我们收集以下类型的信息：</P>
          <ul style={{ paddingLeft: 20, margin: '0 0 10px' }}>
            <Li><strong style={{ color: '#c0c4d8' }}>账户信息：</strong>注册时您提供的电子邮箱、用户名（密码经加密存储）；</Li>
            <Li><strong style={{ color: '#c0c4d8' }}>用户内容：</strong>您创建的知识节点、文本、上传的文件及 AI 交互记录；</Li>
            <Li><strong style={{ color: '#c0c4d8' }}>支付信息：</strong>订单金额、支付状态（完整银行卡/支付宝账号不经我们服务器存储）；</Li>
            <Li><strong style={{ color: '#c0c4d8' }}>使用数据：</strong>功能使用频率、错误日志、IP 地址、浏览器类型（用于安全和改善服务）；</Li>
            <Li><strong style={{ color: '#c0c4d8' }}>设备信息：</strong>操作系统、屏幕分辨率等基本设备参数。</Li>
          </ul>
          <P>我们不主动收集您的生物特征、身份证号或银行账号等敏感信息。</P>
        </Section>

        <Section title="2. 信息的使用目的">
          <P>收集的信息仅用于以下目的：</P>
          <ul style={{ paddingLeft: 20, margin: '0 0 10px' }}>
            <Li>提供、维护和改进平台功能；</Li>
            <Li>处理订阅及支付事务；</Li>
            <Li>响应客户支持请求；</Li>
            <Li>发送服务通知、账单提醒（不发送营销邮件，除非您明确同意）；</Li>
            <Li>检测和防范欺诈及安全威胁；</Li>
            <Li>遵守法律义务。</Li>
          </ul>
          <P>我们不会将您的数据用于训练第三方 AI 模型，也不会将其出售给任何第三方。</P>
        </Section>

        <Section title="3. 数据存储与安全">
          <P>您的数据存储于私有云实例，传输过程使用 HTTPS/TLS 加密。</P>
          <P>我们采用以下技术保护措施：</P>
          <ul style={{ paddingLeft: 20, margin: '0 0 10px' }}>
            <Li>数据库行级安全（RLS）策略，确保用户只能访问自己的数据；</Li>
            <Li>密码经 bcrypt 哈希算法加密存储；</Li>
            <Li>API 访问令牌定期轮换；</Li>
            <Li>云服务器定期安全审计。</Li>
          </ul>
          <P>尽管如此，互联网传输并非绝对安全，请妥善保管您的登录凭证。</P>
        </Section>

        <Section title="4. 数据共享">
          <P>我们不出售、出租或交换您的个人信息。仅在以下情况下可能与第三方共享：</P>
          <ul style={{ paddingLeft: 20, margin: '0 0 10px' }}>
            <Li><strong style={{ color: '#c0c4d8' }}>服务提供商：</strong>云基础设施（仅用于托管服务，受保密协议约束）；</Li>
            <Li><strong style={{ color: '#c0c4d8' }}>支付处理：</strong>支付宝（支付流水仅流向支付宝，我们不存储完整支付信息）；</Li>
            <Li><strong style={{ color: '#c0c4d8' }}>法律要求：</strong>依法律要求或政府命令披露；</Li>
            <Li><strong style={{ color: '#c0c4d8' }}>企业交易：</strong>若发生合并、收购，届时将提前通知您。</Li>
          </ul>
        </Section>

        <Section title="5. Cookie 与追踪技术">
          <P>我们使用必要的 Cookie 维持您的登录状态和偏好设置。不使用第三方广告追踪 Cookie。</P>
          <P>您可通过浏览器设置管理 Cookie，但禁用必要 Cookie 可能影响部分功能。</P>
        </Section>

        <Section title="6. 您的权利">
          <P>根据适用法律，您有权：</P>
          <ul style={{ paddingLeft: 20, margin: '0 0 10px' }}>
            <Li>查阅、更正或删除您的个人信息；</Li>
            <Li>导出您的全部数据（知识节点、关系图谱）；</Li>
            <Li>要求限制或停止处理您的数据；</Li>
            <Li>注销账户（注销后 30 天内数据将被永久删除）。</Li>
          </ul>
          <P>如需行使上述权利，请联系 support@ping-app.com。</P>
        </Section>

        <Section title="7. 未成年人保护">
          <P>本平台不面向 14 周岁以下未成年人提供服务。若发现未成年人注册，我们将删除其账户及相关数据。</P>
        </Section>

        <Section title="8. 第三方服务">
          <P>本平台集成了部分第三方 AI 服务（仅用于处理您提交的查询）。我们选择遵守严格数据保护政策的服务提供商，并对数据传输进行最小化处理。</P>
        </Section>

        <Section title="9. 政策变更">
          <P>本隐私政策可能定期更新。重大变更将提前 14 天通过站内通知或邮件告知。建议定期查看最新版本。</P>
        </Section>

        <Section title="10. 联系我们">
          <P>隐私相关问题请联系：</P>
          <P>邮箱：privacy@ping-app.com</P>
        </Section>
      </main>

      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '20px clamp(16px,5vw,80px)',
        display: 'flex', flexWrap: 'wrap', gap: 12,
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: '#555a72' }}>© 2026 Pesta</span>
        <div style={{ display: 'flex', gap: 20 }}>
          {[{ label: '定价', path: '/pricing' }, { label: '服务条款', path: '/terms' }, { label: '退款政策', path: '/refund' }].map(({ label, path }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              style={{ fontFamily: INTER, fontSize: 12, color: '#555a72', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#888fa8')}
              onMouseLeave={e => (e.currentTarget.style.color = '#555a72')}
            >
              {label}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
