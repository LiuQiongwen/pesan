import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ArrowRight, Brain, BookOpen, Share2, Lock } from 'lucide-react';

const features = [
  {
    icon: Brain,
    title: 'AI 深度分析',
    desc: '输入任意来源内容，AI 自动提炼关键信息、批判性洞见和创新观点',
  },
  {
    icon: Share2,
    title: '思维导图',
    desc: '自动生成知识结构图，支持拖拽编辑，可视化你的思维框架',
  },
  {
    icon: BookOpen,
    title: '知识库管理',
    desc: '多格式下载（Markdown/PDF/Word），随时搜索和二次编辑',
  },
  {
    icon: Lock,
    title: '完全私密',
    desc: '所有笔记默认私密加密，知识库只属于你一个人',
  },
];

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate('/dashboard');
  }, [user, loading, navigate]);

  return (
    <div className="flex flex-col min-h-full bg-background overflow-auto">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center animate-flow-light">
            <span className="text-white font-bold">平</span>
          </div>
          <span className="font-bold text-foreground text-lg">平</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/auth')}>登录</Button>
          <Button
            className="bg-gradient-primary hover:opacity-90 transition-opacity"
            onClick={() => navigate('/auth')}
          >
            开始使用 <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-8 py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-glow pointer-events-none" />
        <div className="relative z-10 max-w-3xl animate-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            个人智能知识管理平台
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-foreground leading-tight mb-6">
            将信息碎片<br />
            <span className="bg-gradient-primary bg-clip-text text-transparent">凝炼为洞见</span>
          </h1>
          <p className="text-muted-foreground text-xl leading-relaxed mb-10">
            支持网站、文件、图片、文字、视频多源输入，AI 自动完成深度分析、结构整理，构建你的私密知识体系。
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              className="bg-gradient-primary hover:opacity-90 transition-opacity h-12 px-8 text-base"
              onClick={() => navigate('/auth')}
            >
              免费开始使用 <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-8 py-20 max-w-6xl mx-auto w-full">
        <h2 className="text-center text-3xl font-bold text-foreground mb-3">
          让每一条信息都有价值
        </h2>
        <p className="text-center text-muted-foreground mb-12">
          从输入到洞见，全流程 AI 辅助
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((f, i) => (
            <div
              key={i}
              className="p-6 rounded-xl border border-border bg-card shadow-card hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 group"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-8 py-16 text-center bg-gradient-hero">
        <div className="max-w-2xl mx-auto animate-fade-up">
          <h2 className="text-3xl font-bold text-white mb-4">
            准备好构建你的知识体系了吗？
          </h2>
          <p className="text-sidebar-foreground mb-8">
            立即免费注册，开始你的智识之旅
          </p>
          <Button
            size="lg"
            className="bg-gradient-primary hover:opacity-90 transition-opacity h-12 px-8"
            onClick={() => navigate('/auth')}
          >
            立即注册 <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-8 py-6 border-t border-border text-center text-sm text-muted-foreground">
        <span>© 2026 平 · 个人知识管理平台</span>
      </footer>
    </div>
  );
}
