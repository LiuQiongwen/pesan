import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  ArrowRight, Zap, Brain, Search, Network, BookOpen, Lock,
  Globe, FileText, Image, Video, Type, ChevronRight,
  Github, Twitter, Linkedin,
} from 'lucide-react';

// ── Design tokens (landing page scoped) ─────────────────────────────────
const C = {
  bg: '#0a0b0d',
  surface: '#15171a',
  elevated: '#1d2024',
  elevated2: '#23262b',
  border: '#2d3136',
  borderAlt: '#333438',
  accent: '#00ff66',
  cyan: '#66e3ff',
  text: '#ffffff',
  textSec: '#8c8e94',
  textMuted: '#6b6e75',
};

const mono: React.CSSProperties = { fontFamily: "'IBM Plex Mono', 'Roboto Mono', monospace" };
const inter: React.CSSProperties = { fontFamily: "'Inter', system-ui, sans-serif" };

// ── Shared primitives ────────────────────────────────────────────────────
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      ...mono, fontSize: 11, color: C.accent, border: `1px solid ${C.accent}33`,
      background: `${C.accent}0d`, padding: '2px 8px', borderRadius: 4, letterSpacing: '0.08em',
    }}>
      {children}
    </span>
  );
}

function MonoLabel({ children, color = C.textMuted }: { children: React.ReactNode; color?: string }) {
  return <span style={{ ...mono, fontSize: 12, color, letterSpacing: '0.06em' }}>{children}</span>;
}

function Divider() {
  return <div style={{ height: 1, background: C.border, width: '100%' }} />;
}

// ── Logo ─────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div style={{
        width: 32, height: 32, background: C.elevated2, border: `1px solid ${C.border}`,
        borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', width: 18, height: 18, border: `2px solid ${C.accent}`,
          borderRadius: '50%', opacity: 0.8,
        }} />
        <div style={{ width: 6, height: 6, background: C.accent, borderRadius: '50%' }} />
      </div>
      <span style={{ ...inter, fontWeight: 700, fontSize: 17, color: C.text, letterSpacing: '-0.02em' }}>
        Pesan
      </span>
    </div>
  );
}

// ── Navbar ───────────────────────────────────────────────────────────────
function Navbar({ onCTA }: { onCTA: () => void }) {
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: `${C.bg}e8`, backdropFilter: 'blur(16px)',
      borderBottom: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 40px', height: 60,
    }}>
      <Logo />
      <div className="hidden md:flex items-center gap-8">
        {['功能', '工作流', '价格', '文档'].map(item => (
          <span key={item} style={{
            ...inter, fontSize: 14, color: C.textSec, cursor: 'pointer', transition: 'color 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.color = C.text)}
            onMouseLeave={e => (e.currentTarget.style.color = C.textSec)}
          >
            {item}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={onCTA} style={{
          ...inter, fontSize: 14, color: C.textSec, background: 'none', border: 'none',
          cursor: 'pointer', padding: '6px 12px', transition: 'color 0.15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.color = C.text)}
          onMouseLeave={e => (e.currentTarget.style.color = C.textSec)}
        >
          登录
        </button>
        <button onClick={onCTA} style={{
          ...inter, fontSize: 14, fontWeight: 600, color: C.bg,
          background: C.accent, border: 'none', cursor: 'pointer',
          padding: '8px 18px', borderRadius: 6, transition: 'opacity 0.15s, box-shadow 0.15s',
        }}
          onMouseEnter={e => {
            e.currentTarget.style.opacity = '0.9';
            e.currentTarget.style.boxShadow = `0 0 20px ${C.accent}55`;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          免费开始
        </button>
      </div>
    </nav>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────
function HeroSection({ onCTA }: { onCTA: () => void }) {
  return (
    <section style={{
      background: C.bg, padding: '100px 40px 80px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
        width: 800, height: 400, background: `radial-gradient(ellipse at center, ${C.accent}0a 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 720, textAlign: 'center' }}>
        {/* Overline tag */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 28 }}>
          <Tag>PERSONAL KNOWLEDGE OS</Tag>
        </div>

        {/* H1 */}
        <h1 style={{
          ...inter, fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 800,
          color: C.text, lineHeight: 1.1, letterSpacing: '-0.03em',
          margin: '0 0 20px',
        }}>
          将散乱信息<br />
          <span style={{ color: C.accent }}>转化为结构化知识</span>
        </h1>

        {/* Subtitle */}
        <p style={{
          ...inter, fontSize: 18, color: C.textSec, lineHeight: 1.65,
          maxWidth: 560, margin: '0 auto 36px',
        }}>
          捕捉想法、整理内容、提取洞见，立刻找到你需要的一切。
          支持网站、文件、图片、文字和视频多源输入。
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={onCTA} style={{
            ...inter, fontWeight: 600, fontSize: 15, color: C.bg,
            background: C.accent, border: 'none', cursor: 'pointer',
            padding: '13px 28px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8,
            transition: 'box-shadow 0.2s, opacity 0.2s',
          }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = `0 0 32px ${C.accent}60`;
              e.currentTarget.style.opacity = '0.92';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.opacity = '1';
            }}
          >
            免费开始使用 <ArrowRight size={16} />
          </button>
          <button style={{
            ...inter, fontWeight: 500, fontSize: 15, color: C.textSec,
            background: 'none', border: `1px solid ${C.border}`, cursor: 'pointer',
            padding: '13px 24px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8,
            transition: 'border-color 0.2s, color 0.2s',
          }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = C.textSec;
              e.currentTarget.style.color = C.text;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = C.border;
              e.currentTarget.style.color = C.textSec;
            }}
          >
            查看工作流 <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Hero product visual */}
      <div style={{
        marginTop: 60, width: '100%', maxWidth: 1000, position: 'relative',
        borderRadius: 12, overflow: 'hidden',
        border: `1px solid ${C.border}`,
        boxShadow: `0 0 80px ${C.accent}18, 0 40px 80px rgba(0,0,0,0.6)`,
        transform: 'perspective(1200px) rotateX(4deg)',
      }}>
        <img
          src="https://grazia-prod.oss-ap-southeast-1.aliyuncs.com/resources/uid_100032059/hero_dashboard_58768ceb.png"
          crossOrigin="anonymous"
          alt="Pesan knowledge dashboard"
          style={{ width: '100%', display: 'block' }}
        />
        {/* Bottom fade */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
          background: `linear-gradient(to top, ${C.bg}, transparent)`,
        }} />
        {/* Status pills overlay */}
        <div style={{
          position: 'absolute', top: 16, right: 16,
          display: 'flex', gap: 8,
        }}>
          {['已索引 412', '分析中 ✦', '已同步'].map((s, i) => (
            <span key={i} style={{
              ...mono, fontSize: 10, color: i === 1 ? C.accent : C.textMuted,
              background: C.elevated2, border: `1px solid ${C.border}`,
              padding: '3px 8px', borderRadius: 4,
            }}>
              {s}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Value Strip ──────────────────────────────────────────────────────────
function ValueStrip() {
  const items = [
    { mono: '< 3s', label: '秒级捕捉' },
    { mono: 'AI →', label: 'AI 自动摘要' },
    { mono: '#query', label: '即时检索' },
    { mono: '∑ struct', label: '结构化知识' },
  ];
  return (
    <div style={{
      background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
    }}>
      <div style={{
        maxWidth: 1000, margin: '0 auto', display: 'flex',
        alignItems: 'stretch',
      }}>
        {items.map((item, i) => (
          <div key={i} style={{
            flex: 1, padding: '20px 32px',
            borderRight: i < items.length - 1 ? `1px solid ${C.border}` : 'none',
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <span style={{ ...mono, fontSize: 16, color: C.accent, minWidth: 64 }}>{item.mono}</span>
            <span style={{ ...inter, fontSize: 13, color: C.textSec }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Feature Grid ─────────────────────────────────────────────────────────
function FeatureGrid() {
  const features = [
    { icon: Zap, title: '快速捕捉', desc: '一键保存笔记、链接、文件和想法，不打断思维流程' },
    { icon: Brain, title: 'AI 智能分析', desc: '自动提取摘要、模式和下一步行动项' },
    { icon: Search, title: '即时检索', desc: '通过自然语言或关键词检索任意内容' },
    { icon: Network, title: '知识图谱', desc: '可视化连接想法、主题和参考资料' },
    { icon: BookOpen, title: '结构化笔记', desc: '将原始信息转化为可复用的长期知识资产' },
    { icon: Lock, title: '完全私密', desc: '所有内容端到端加密，知识库只属于你' },
  ];

  return (
    <section style={{ background: C.bg, padding: '96px 40px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {/* Section header */}
        <div style={{ marginBottom: 56, maxWidth: 520 }}>
          <MonoLabel>FEATURES</MonoLabel>
          <h2 style={{
            ...inter, fontSize: 'clamp(26px, 3.5vw, 38px)', fontWeight: 700,
            color: C.text, margin: '16px 0 16px', lineHeight: 1.2, letterSpacing: '-0.02em',
          }}>
            管理信息所需的一切
          </h2>
          <p style={{ ...inter, fontSize: 15, color: C.textSec, lineHeight: 1.6 }}>
            从输入到洞见，每一步都经过精心设计，让思考更快、更清晰。
          </p>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1,
          border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden',
        }}>
          {features.map((f, i) => (
            <FeatureCard key={i} icon={f.icon} title={f.title} desc={f.desc} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ icon: Icon, title, desc }: { icon: typeof Brain; title: string; desc: string }) {
  return (
    <div
      style={{
        background: C.surface, padding: '28px 28px 24px',
        borderRight: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
        transition: 'background 0.2s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.background = C.elevated;
        (e.currentTarget as HTMLDivElement).style.boxShadow = `inset 0 0 0 1px ${C.accent}40`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.background = C.surface;
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      <div style={{
        width: 36, height: 36, marginBottom: 16,
        background: `${C.accent}14`, border: `1px solid ${C.accent}33`,
        borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={16} color={C.accent} />
      </div>
      <h3 style={{ ...inter, fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 8 }}>{title}</h3>
      <p style={{ ...inter, fontSize: 13, color: C.textSec, lineHeight: 1.6, margin: 0 }}>{desc}</p>
    </div>
  );
}

// ── Workflow Section ─────────────────────────────────────────────────────
function WorkflowSection() {
  const steps = [
    { num: '01', label: '捕捉', desc: '多源输入' },
    { num: '02', label: '清洗', desc: 'AI 预处理' },
    { num: '03', label: '结构化', desc: '自动分类' },
    { num: '04', label: '分析', desc: '深度洞见' },
    { num: '05', label: '检索', desc: '即时调用' },
  ];

  return (
    <section style={{
      background: C.surface, padding: '96px 40px',
      borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
    }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ marginBottom: 56, maxWidth: 480 }}>
          <MonoLabel>WORKFLOW</MonoLabel>
          <h2 style={{
            ...inter, fontSize: 'clamp(26px, 3.5vw, 38px)', fontWeight: 700,
            color: C.text, margin: '16px 0 16px', lineHeight: 1.2, letterSpacing: '-0.02em',
          }}>
            从输入到洞见，一个完整的流程
          </h2>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, position: 'relative' }}>
          {steps.map((step, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div style={{
                  position: 'absolute', top: 18, left: '50%', width: '100%',
                  height: 1, background: `linear-gradient(to right, ${C.accent}80, ${C.border})`,
                  zIndex: 0,
                }} />
              )}
              {/* Node */}
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: i === 0 ? C.accent : C.elevated2,
                border: `1px solid ${i === 0 ? C.accent : C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', zIndex: 1,
                boxShadow: i === 0 ? `0 0 20px ${C.accent}50` : 'none',
              }}>
                <span style={{
                  ...mono, fontSize: 11, fontWeight: 500,
                  color: i === 0 ? C.bg : C.textMuted,
                }}>
                  {step.num}
                </span>
              </div>
              {/* Text */}
              <div style={{ marginTop: 14, textAlign: 'center' }}>
                <div style={{ ...inter, fontSize: 14, fontWeight: 600, color: i === 0 ? C.accent : C.text, marginBottom: 4 }}>
                  {step.label}
                </div>
                <div style={{ ...mono, fontSize: 11, color: C.textMuted }}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Complex UI Section ────────────────────────────────────────────────────
function ComplexUISection() {
  return (
    <section style={{ background: C.bg, padding: '96px 40px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 40, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <MonoLabel>INTERFACE</MonoLabel>
            <h2 style={{
              ...inter, fontSize: 'clamp(24px, 3vw, 34px)', fontWeight: 700,
              color: C.text, margin: '14px 0 0', letterSpacing: '-0.02em',
            }}>
              所有工具，一个工作空间
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['侧边栏', '笔记', 'AI 面板'].map((t, i) => (
              <span key={i} style={{
                ...mono, fontSize: 11, color: i === 1 ? C.accent : C.textMuted,
                border: `1px solid ${i === 1 ? C.accent + '50' : C.border}`,
                background: i === 1 ? `${C.accent}10` : C.elevated2,
                padding: '4px 10px', borderRadius: 4,
              }}>{t}</span>
            ))}
          </div>
        </div>
        <div style={{
          borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}`,
          boxShadow: `0 32px 80px rgba(0,0,0,0.7), 0 0 60px ${C.accent}0c`,
        }}>
          <img
            src="https://grazia-prod.oss-ap-southeast-1.aliyuncs.com/resources/uid_100032059/hero_dashboard_58768ceb.png"
            crossOrigin="anonymous"
            alt="Pesan interface"
            style={{ width: '100%', display: 'block' }}
          />
        </div>
      </div>
    </section>
  );
}

// ── Alternating blocks ────────────────────────────────────────────────────
interface AltBlockProps {
  mono: string;
  heading: string;
  bullets: string[];
  image: string;
  imageAlt: string;
  reverse?: boolean;
}

function AltBlock({ mono: label, heading, bullets, image, imageAlt, reverse }: AltBlockProps) {
  return (
    <div style={{
      maxWidth: 1000, margin: '0 auto',
      display: 'flex', alignItems: 'center', gap: 64,
      flexDirection: reverse ? 'row-reverse' : 'row',
      flexWrap: 'wrap',
    }}>
      {/* Text */}
      <div style={{ flex: '1 1 340px' }}>
        <MonoLabel>{label}</MonoLabel>
        <h2 style={{
          ...inter, fontSize: 'clamp(22px, 2.8vw, 32px)', fontWeight: 700,
          color: C.text, margin: '16px 0 20px', lineHeight: 1.25, letterSpacing: '-0.02em',
        }}>
          {heading}
        </h2>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {bullets.map((b, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.accent, marginTop: 7, flexShrink: 0 }} />
              <span style={{ ...inter, fontSize: 14, color: C.textSec, lineHeight: 1.65 }}>{b}</span>
            </li>
          ))}
        </ul>
      </div>
      {/* Image */}
      <div style={{
        flex: '1 1 400px',
        borderRadius: 10, overflow: 'hidden',
        border: `1px solid ${C.border}`,
        boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 40px ${C.accent}0a`,
      }}>
        <img src={image} crossOrigin="anonymous" alt={imageAlt} style={{ width: '100%', display: 'block' }} />
      </div>
    </div>
  );
}

function AlternatingSection() {
  return (
    <section style={{ background: C.bg, padding: '0 40px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 96 }}>
        <AltBlock
          mono="CAPTURE"
          heading="随时捕捉，不打断思维"
          bullets={[
            '一个地方保存文本、链接、文件和想法',
            '极简输入框，稍后用 AI 整理',
            '支持 5 种输入类型，秒级完成',
          ]}
          image="https://grazia-prod.oss-ap-southeast-1.aliyuncs.com/resources/uid_100032059/capture_panel_176dbb56.png"
          imageAlt="Capture panel"
        />
        <Divider />
        <AltBlock
          mono="AI ANALYSIS"
          heading="让 AI 将原始输入转化为可用知识"
          bullets={[
            '自动摘要长内容，提取关键结论',
            '识别深层洞见和隐藏模式',
            '将混乱信息整理为结构化笔记',
          ]}
          image="https://grazia-prod.oss-ap-southeast-1.aliyuncs.com/resources/uid_100032059/ai_analysis_panel_a6c6cbde.png"
          imageAlt="AI analysis panel"
          reverse
        />
        <Divider />
        <AltBlock
          mono="RETRIEVAL"
          heading="立刻找到你需要的信息"
          bullets={[
            '通过关键词、问题或主题搜索',
            '在关联笔记和引用之间快速跳转',
            '几秒内浮现相关洞见',
          ]}
          image="https://grazia-prod.oss-ap-southeast-1.aliyuncs.com/resources/uid_100032059/search_interface_af9406fd.png"
          imageAlt="Search interface"
        />
        <div style={{ height: 96 }} />
      </div>
    </section>
  );
}

// ── Light Section ─────────────────────────────────────────────────────────
function LightSection() {
  const rows = [
    { task: '收集信息', without: '分散在多处，难以查找', with: '一处捕捉，自动分类' },
    { task: '复习笔记', without: '耗时翻阅，难以提炼', with: 'AI 摘要一目了然' },
    { task: '查找过去的洞见', without: '靠记忆或随机搜索', with: '即时语义检索' },
    { task: '将输入转化为行动', without: '埋在笔记里，容易遗忘', with: 'AI 自动提取行动项' },
  ];

  return (
    <section style={{ background: '#ffffff', padding: '96px 40px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ maxWidth: 480, marginBottom: 48 }}>
          <span style={{ ...mono, fontSize: 11, color: '#6b6e75', letterSpacing: '0.1em' }}>
            COMPARISON
          </span>
          <h2 style={{
            ...inter, fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 700,
            color: '#0a0b0d', margin: '14px 0 16px', lineHeight: 1.25, letterSpacing: '-0.02em',
          }}>
            专为快速思考型知识工作者而生
          </h2>
          <p style={{ ...inter, fontSize: 14, color: '#6b6e75', lineHeight: 1.65 }}>
            体验在使用 Pesan 前后的差异。
          </p>
        </div>

        {/* Table */}
        <div style={{
          border: '1px solid #e2e4e8', borderRadius: 8, overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            background: '#f8f9fa', borderBottom: '1px solid #e2e4e8',
          }}>
            {['任务', '没有工具', '使用 Pesan'].map((h, i) => (
              <div key={i} style={{
                padding: '12px 20px',
                borderRight: i < 2 ? '1px solid #e2e4e8' : 'none',
              }}>
                <span style={{
                  ...inter, fontSize: 12, fontWeight: 600, color: '#0a0b0d',
                  letterSpacing: '0.06em', textTransform: 'uppercase' as const,
                }}>
                  {h}
                </span>
              </div>
            ))}
          </div>
          {/* Rows */}
          {rows.map((row, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
              borderBottom: i < rows.length - 1 ? '1px solid #e2e4e8' : 'none',
              background: i % 2 === 0 ? '#ffffff' : '#fafafa',
            }}>
              <div style={{ padding: '16px 20px', borderRight: '1px solid #e2e4e8' }}>
                <span style={{ ...inter, fontSize: 13, fontWeight: 500, color: '#0a0b0d' }}>{row.task}</span>
              </div>
              <div style={{ padding: '16px 20px', borderRight: '1px solid #e2e4e8' }}>
                <span style={{ ...inter, fontSize: 13, color: '#6b6e75' }}>{row.without}</span>
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00cc55', flexShrink: 0 }} />
                <span style={{ ...inter, fontSize: 13, color: '#0a0b0d', fontWeight: 500 }}>{row.with}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Testimonials ──────────────────────────────────────────────────────────
function TestimonialSection() {
  const lines = [
    { quote: '减少搜索，增加思考。', sub: '用于研究与写作' },
    { quote: '构建个人知识体系的更快方式。', sub: '用于学习与积累' },
    { quote: '从散乱笔记到可用智识。', sub: '用于内容创作' },
  ];

  return (
    <section style={{
      background: C.surface, padding: '88px 40px',
      borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
    }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <MonoLabel>USERS SAY</MonoLabel>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, flexWrap: 'wrap' }}>
          {lines.map((item, i) => (
            <div key={i} style={{
              background: C.elevated, border: `1px solid ${C.border}`,
              borderRadius: 8, padding: '28px 24px',
            }}>
              <div style={{
                width: 24, height: 2, background: C.accent, marginBottom: 20,
              }} />
              <p style={{
                ...inter, fontSize: 16, fontWeight: 600, color: C.text,
                lineHeight: 1.45, marginBottom: 12,
              }}>
                "{item.quote}"
              </p>
              <span style={{ ...mono, fontSize: 11, color: C.textMuted }}>{item.sub}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────
function FooterSection({ onCTA }: { onCTA: () => void }) {
  const cols = [
    { heading: '产品', links: ['功能特性', '工作流程', '价格方案', '更新日志'] },
    { heading: '资源', links: ['使用文档', '快速入门', 'API 参考', '社区'] },
    { heading: '公司', links: ['关于我们', '博客', '招聘', '联系我们'] },
    { heading: '法律', links: ['隐私政策', '服务条款', '数据安全', 'Cookie'] },
  ];

  return (
    <footer style={{ background: C.bg }}>
      {/* CTA block */}
      <div style={{
        borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
        padding: '72px 40px', textAlign: 'center',
      }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <h2 style={{
            ...inter, fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 700,
            color: C.text, letterSpacing: '-0.02em', marginBottom: 20,
          }}>
            构建你的个人智识系统
          </h2>
          <p style={{ ...inter, fontSize: 14, color: C.textSec, marginBottom: 28 }}>
            加入正在用 Pesan 重塑知识工作方式的用户。
          </p>
          <button onClick={onCTA} style={{
            ...inter, fontWeight: 600, fontSize: 15, color: C.bg,
            background: C.accent, border: 'none', cursor: 'pointer',
            padding: '13px 28px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 8,
            transition: 'box-shadow 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 28px ${C.accent}55`; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            立即免费开始 <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Links grid */}
      <div style={{ padding: '56px 40px 32px', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 40, justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 48 }}>
          {/* Brand */}
          <div style={{ minWidth: 180 }}>
            <Logo />
            <p style={{ ...inter, fontSize: 13, color: C.textMuted, marginTop: 12, lineHeight: 1.6 }}>
              个人智能知识管理平台
            </p>
          </div>
          {/* Nav columns */}
          {cols.map(col => (
            <div key={col.heading} style={{ minWidth: 120 }}>
              <p style={{ ...inter, fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 14, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                {col.heading}
              </p>
              {col.links.map(link => (
                <p key={link} style={{ ...inter, fontSize: 13, color: C.textMuted, marginBottom: 10, cursor: 'pointer' }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.color = C.textSec; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.color = C.textMuted; }}
                >
                  {link}
                </p>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom */}
        <Divider />
        <div style={{ paddingTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <MonoLabel>© 2026 Pesan. All rights reserved.</MonoLabel>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {[Github, Twitter, Linkedin].map((Icon, i) => (
              <Icon key={i} size={16} color={C.textMuted} style={{ cursor: 'pointer' }} />
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────
export default function Index({ preview = false }: { preview?: boolean }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!preview && !loading && user) navigate('/dashboard');
  }, [preview, user, loading, navigate]);

  const gotoAuth = () => navigate('/auth');

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Navbar onCTA={gotoAuth} />
      <HeroSection onCTA={gotoAuth} />
      <ValueStrip />
      <FeatureGrid />
      <WorkflowSection />
      <ComplexUISection />
      <AlternatingSection />
      <LightSection />
      <TestimonialSection />
      <FooterSection onCTA={gotoAuth} />
    </div>
  );
}
