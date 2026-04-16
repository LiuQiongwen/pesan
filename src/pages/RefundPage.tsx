/**
 * RefundPage — 退款政策 (Refund Policy)
 */
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCcw } from 'lucide-react';

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

interface TableRowProps { label: string; value: string; highlight?: boolean }

function TableRow({ label, value, highlight }: TableRowProps) {
  return (
    <tr style={{ background: highlight ? 'rgba(180,150,255,0.05)' : 'transparent' }}>
      <td style={{
        padding: '10px 14px', color: '#c0c4d8', fontSize: 13,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        width: '40%',
      }}>
        {label}
      </td>
      <td style={{
        padding: '10px 14px', color: '#888fa8', fontSize: 13,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        {value}
      </td>
    </tr>
  );
}

export default function RefundPage() {
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
            background: 'rgba(255,160,64,0.08)', border: '1px solid rgba(255,160,64,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <RefreshCcw size={20} color="#ffa040" />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>退款政策</h1>
            <p style={{ fontSize: 12, color: '#555a72', margin: '4px 0 0', fontFamily: MONO }}>
              最后更新：{LAST_UPDATED}
            </p>
          </div>
        </div>

        <div style={{
          background: 'rgba(255,160,64,0.04)', border: '1px solid rgba(255,160,64,0.12)',
          borderRadius: 10, padding: '14px 18px', marginBottom: 36,
          fontSize: 13, color: '#c0c4d8', lineHeight: 1.7,
        }}>
          我们致力于提供高质量的服务体验。如果您对购买不满意，请查阅以下退款政策以了解相关条款和申请方式。
        </div>

        {/* Quick overview table */}
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, overflow: 'hidden', marginBottom: 36,
        }}>
          <div style={{
            padding: '10px 14px', background: 'rgba(255,255,255,0.04)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            fontFamily: MONO, fontSize: 11, color: '#888fa8', letterSpacing: '0.06em',
          }}>
            退款概览
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <TableRow label="月度订阅" value="付款后 7 天内，且 AI Credits 使用量 < 20% 时，支持全额退款" highlight />
              <TableRow label="年度订阅" value="付款后 14 天内，且 AI Credits 使用量 < 10% 时，支持全额退款" />
              <TableRow label="AI Credits 点数包" value="未使用的情况下，付款后 7 天内支持全额退款" highlight />
              <TableRow label="降级后剩余时间" value="不提供按比例退款，当前计费周期结束后自动降级" />
              <TableRow label="因服务故障" value="经核实的重大服务中断，按中断时长折算补偿 Credits 或退款" highlight />
            </tbody>
          </table>
        </div>

        <Section title="1. 订阅计划退款">
          <P><strong style={{ color: '#c0c4d8' }}>月度订阅：</strong>自付款成功之日起 7 个自然日内，如您的 AI Credits 实际使用量不超过当期赠送总量的 20%，可申请全额退款。</P>
          <P><strong style={{ color: '#c0c4d8' }}>年度订阅：</strong>自付款成功之日起 14 个自然日内，如您的 AI Credits 实际使用量不超过当期赠送总量的 10%，可申请全额退款。</P>
          <P><strong style={{ color: '#c0c4d8' }}>超期或超量：</strong>超过上述退款窗口期，或 AI 使用量已超过上述比例，恕不支持退款。</P>
          <P>主动取消订阅后，当前计费周期仍可正常使用至到期，不提供剩余时间的按比例退款。</P>
        </Section>

        <Section title="2. AI Credits 点数包退款">
          <P>AI Credits 点数包为一次性购买。退款条件：</P>
          <ul style={{ paddingLeft: 20, margin: '0 0 10px' }}>
            <Li>付款后 7 个自然日内；</Li>
            <Li>购买的 Credits 尚未使用（余额与购买量一致）。</Li>
          </ul>
          <P>已部分使用的 Credits 包，恕不支持退款。</P>
        </Section>

        <Section title="3. 因服务故障的退款">
          <P>若因本平台服务故障（如系统宕机超 24 小时、数据丢失等），经我们核实后将主动联系受影响用户进行补偿，补偿方式包括：</P>
          <ul style={{ paddingLeft: 20, margin: '0 0 10px' }}>
            <Li>按故障时长折算的 AI Credits 补偿；</Li>
            <Li>订阅周期延长；</Li>
            <Li>特殊情况下的部分退款。</Li>
          </ul>
          <P>因不可抗力（自然灾害、第三方服务中断等）导致的服务中断不在退款范围内，但我们会尽快恢复服务。</P>
        </Section>

        <Section title="4. 不支持退款的情形">
          <P>以下情形不在退款范围内：</P>
          <ul style={{ paddingLeft: 20, margin: '0 0 10px' }}>
            <Li>超过退款窗口期的订阅费；</Li>
            <Li>已部分或全部使用的 Credits；</Li>
            <Li>因违反服务条款被终止的账户；</Li>
            <Li>因个人使用习惯或偏好变化（非服务质量问题）导致的退款申请；</Li>
            <Li>重复购买（需在购买前确认）。</Li>
          </ul>
        </Section>

        <Section title="5. 如何申请退款">
          <P>申请退款请按以下步骤操作：</P>
          <ol style={{ paddingLeft: 20, margin: '0 0 10px' }}>
            <li style={{ marginBottom: 8, paddingLeft: 4 }}>
              登录账户 → 设置 → 订阅与 Credits → 点击「申请退款」；
            </li>
            <li style={{ marginBottom: 8, paddingLeft: 4 }}>
              或发送邮件至 <span style={{ color: '#b496ff' }}>refund@ping-app.com</span>，注明订单号、付款时间及退款原因；
            </li>
            <li style={{ marginBottom: 8, paddingLeft: 4 }}>
              我们将在 3 个工作日内审核并回复；
            </li>
            <li style={{ marginBottom: 8, paddingLeft: 4 }}>
              退款审核通过后，原路退回至支付宝账户，到账时间通常为 1–5 个工作日。
            </li>
          </ol>
        </Section>

        <Section title="6. 争议解决">
          <P>如对退款决定有异议，您可进一步联系我们申诉。若双方无法达成一致，可通过支付宝争议处理机制或有管辖权的人民法院寻求解决。</P>
        </Section>

        <Section title="7. 政策变更">
          <P>本退款政策可能不定期更新。变更后的政策仅适用于政策更新后发生的新购买，不影响已产生的购买订单的退款权利。</P>
        </Section>

        <Section title="8. 联系我们">
          <P>退款相关咨询请联系：</P>
          <P>邮箱：refund@ping-app.com</P>
          <P>工作时间：周一至周五 10:00–18:00（北京时间）</P>
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
          {[{ label: '定价', path: '/pricing' }, { label: '服务条款', path: '/terms' }, { label: '隐私政策', path: '/privacy' }].map(({ label, path }) => (
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
