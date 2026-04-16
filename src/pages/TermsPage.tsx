/**
 * TermsPage — 服务条款 (Terms of Service)
 * Cosmic dark aesthetic.
 */
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

const INTER = "'Inter',system-ui,sans-serif";
const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";

const LAST_UPDATED = '2026年4月16日';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2 style={{
        fontSize: 16, fontWeight: 700, color: '#d8daf0',
        margin: '0 0 12px', fontFamily: INTER,
        paddingBottom: 8,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
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
  return (
    <li style={{ marginBottom: 6, paddingLeft: 4 }}>{children}</li>
  );
}

export default function TermsPage() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight:  '100vh',
      background: '#01040d',
      fontFamily: INTER,
      color:      '#d8daf0',
    }}>
      {/* Nav */}
      <nav style={{
        position:      'sticky', top: 0, zIndex: 50,
        padding:       '0 clamp(16px,5vw,80px)',
        height:        56,
        display:       'flex', alignItems: 'center', gap: 16,
        background:    'rgba(1,4,13,0.92)',
        backdropFilter:'blur(12px)',
        borderBottom:  '1px solid rgba(255,255,255,0.06)',
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#888fa8', fontSize: 13, fontFamily: INTER,
          }}
        >
          <ArrowLeft size={14} />
          返回
        </button>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />
        <button
          onClick={() => navigate('/')}
          style={{
            fontFamily: MONO, fontSize: 14, fontWeight: 700,
            color: '#b496ff', background: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          PESTA
        </button>
      </nav>

      {/* Content */}
      <main style={{ maxWidth: 760, margin: '0 auto', padding: 'clamp(40px,6vh,80px) clamp(16px,5vw,80px)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 36 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(180,150,255,0.1)', border: '1px solid rgba(180,150,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FileText size={20} color="#b496ff" />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>服务条款</h1>
            <p style={{ fontSize: 12, color: '#555a72', margin: '4px 0 0', fontFamily: MONO }}>
              最后更新：{LAST_UPDATED}
            </p>
          </div>
        </div>

        <div style={{
          background: 'rgba(180,150,255,0.04)', border: '1px solid rgba(180,150,255,0.12)',
          borderRadius: 10, padding: '14px 18px', marginBottom: 36,
          fontSize: 13, color: '#c0c4d8', lineHeight: 1.7,
        }}>
          请在使用 Pesta 平台（以下简称"本平台"）前仔细阅读以下服务条款。注册或使用本平台即表示您同意受本条款约束。
        </div>

        <Section title="1. 服务说明">
          <P>Pesta 是一款面向个人及团队的 AI 增强型知识管理平台，提供知识节点管理、RAG 检索、AI 洞见生成、行动规划等功能（以下简称"服务"）。</P>
          <P>本平台保留随时修改、暂停或终止任何服务功能的权利，并将通过站内通知或电子邮件提前告知用户（紧急情况除外）。</P>
        </Section>

        <Section title="2. 账户与注册">
          <P>您需注册账户方可使用本平台大部分功能。注册时您承诺：</P>
          <ul style={{ paddingLeft: 20, margin: '0 0 10px' }}>
            <Li>提供真实、准确、完整的信息；</Li>
            <Li>账户安全由您负责，请妥善保管密码；</Li>
            <Li>发现账户被盗用时及时联系我们；</Li>
            <Li>每人限注册一个免费账户。</Li>
          </ul>
          <P>本平台有权在违规情形下暂停或终止您的账户。</P>
        </Section>

        <Section title="3. 订阅与付款">
          <P>本平台提供免费计划及付费订阅计划（Pro、Team）。付费计划按月或按年计费，订阅费用不可退还（退款情形详见《退款政策》）。</P>
          <P>AI Credits 点数包为一次性付款，永久有效，不随订阅到期而失效。</P>
          <P>本平台使用支付宝作为支付渠道，支付相关问题请参阅支付宝用户协议。</P>
          <P>价格可能随时调整，调整前我们将提前 30 天通知现有订阅用户。</P>
        </Section>

        <Section title="4. 用户内容">
          <P>您上传、输入或创建的所有内容（知识节点、文本、文件等，以下统称"用户内容"）的知识产权归您所有。</P>
          <P>您授予本平台一项有限的、非独家的、可撤销的许可，仅用于向您提供服务目的处理您的用户内容。</P>
          <P>您承诺用户内容不侵犯任何第三方权益，也不违反任何适用法律。</P>
        </Section>

        <Section title="5. 禁止行为">
          <P>您不得利用本平台：</P>
          <ul style={{ paddingLeft: 20, margin: '0 0 10px' }}>
            <Li>传播违法、有害、诽谤或侵权内容；</Li>
            <Li>干扰、攻击或破坏平台的正常运行；</Li>
            <Li>以自动化方式（爬虫、脚本等）未授权采集数据；</Li>
            <Li>尝试绕过安全措施或访问权限控制；</Li>
            <Li>将服务用于商业转售目的（Team 计划 API 权限除外）。</Li>
          </ul>
        </Section>

        <Section title="6. 知识产权">
          <P>本平台的界面设计、代码、品牌标识、算法及相关文档受著作权法及其他知识产权法律保护，归本平台所有。</P>
          <P>未经书面授权，禁止复制、修改、分发或创建本平台任何部分的衍生作品。</P>
        </Section>

        <Section title="7. 隐私保护">
          <P>我们重视您的隐私。关于数据收集、使用和存储的详细说明，请参阅《隐私政策》。</P>
        </Section>

        <Section title="8. 免责声明">
          <P>本平台"按现状"提供服务，不作任何明示或暗示的保证，包括但不限于适销性、特定用途适用性或不侵权保证。</P>
          <P>在适用法律允许的最大范围内，本平台对任何间接损失、数据丢失、利润损失等不承担责任。</P>
          <P>AI 生成内容仅供参考，不构成专业建议（法律、医疗、财务等），用户应自行判断。</P>
        </Section>

        <Section title="9. 服务终止">
          <P>您可随时注销账户。注销后您的数据将在 30 天内删除（法律要求保留的除外）。</P>
          <P>如因违反服务条款被终止账户，我们将提前通知（紧急情况除外），但不退还未使用的费用。</P>
        </Section>

        <Section title="10. 适用法律">
          <P>本条款受中华人民共和国法律管辖。因本条款引起的任何争议，双方应优先协商解决；协商不成的，提交有管辖权的人民法院诉讼解决。</P>
        </Section>

        <Section title="11. 条款变更">
          <P>我们可能不定期更新本服务条款。重大变更将通过站内通知或邮件提前 14 天告知。继续使用本平台即视为您接受修订后的条款。</P>
        </Section>

        <Section title="12. 联系我们">
          <P>如有任何问题，请联系我们：</P>
          <P>邮箱：support@ping-app.com</P>
        </Section>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop:  '1px solid rgba(255,255,255,0.06)',
        padding:    '20px clamp(16px,5vw,80px)',
        display:    'flex', flexWrap: 'wrap', gap: 12,
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: '#555a72' }}>
          © 2026 Pesta
        </span>
        <div style={{ display: 'flex', gap: 20 }}>
          {[
            { label: '定价', path: '/pricing' },
            { label: '隐私政策', path: '/privacy' },
            { label: '退款政策', path: '/refund' },
          ].map(({ label, path }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              style={{
                fontFamily: INTER, fontSize: 12, color: '#555a72',
                background: 'none', border: 'none', cursor: 'pointer',
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
  );
}
