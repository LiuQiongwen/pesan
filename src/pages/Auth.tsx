import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

type Mode = 'login' | 'register' | 'forgot';

export default function Auth() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, resetPassword, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) { toast.error(error.message); return; }
        navigate('/dashboard');
      } else if (mode === 'register') {
        if (password !== confirmPassword) { toast.error('两次密码不一致'); return; }
        if (password.length < 6) { toast.error('密码至少6位'); return; }
        const { error } = await signUp(email, password);
        if (error) { toast.error(error.message); return; }
        toast.success('注册成功！请登录');
        setMode('login');
      } else if (mode === 'forgot') {
        const { error } = await resetPassword(email);
        if (error) { toast.error(error.message); return; }
        toast.success('重置密码邮件已发送，请查收邮箱');
        setMode('login');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left - Branding Panel */}
      <div className="hidden lg:flex flex-col w-1/2 bg-gradient-hero relative overflow-hidden p-12">
        <div className="absolute inset-0 bg-gradient-glow" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center animate-flow-light">
              <span className="text-white font-bold text-sm">Pe</span>
            </div>
            <span className="text-white font-semibold text-xl">Pesan · 知识管理</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-6">
            让信息<br />
            <span className="bg-gradient-primary bg-clip-text text-transparent">成为智识</span>
          </h1>
          <p className="text-sidebar-foreground text-lg leading-relaxed">
            多源内容 AI 深度分析，自动提炼关键洞见，构建属于你的私密知识体系。
          </p>
        </div>

        {/* Feature list */}
        <div className="relative z-10 mt-auto space-y-4">
          {[
            '支持网站、文件、图片、视频等多源输入',
            'AI 深度分析提炼多维度洞见',
            '思维导图可视化知识结构',
            '完全私密的个人知识空间',
          ].map(f => (
            <div key={f} className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-primary-glow flex-shrink-0" />
              <span className="text-sidebar-foreground text-sm">{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right - Auth Form */}
      <div className="flex flex-col flex-1 items-center justify-center p-8">
        <div className="w-full max-w-md animate-fade-up">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <span className="text-white font-bold text-xs">Pe</span>
            </div>
            <span className="font-semibold text-foreground">Pesan · 知识管理</span>
          </div>

          <div className="mb-8">
            {mode === 'forgot' && (
              <button
                onClick={() => setMode('login')}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> 返回登录
              </button>
            )}
            <h2 className="text-2xl font-bold text-foreground">
              {mode === 'login' ? '欢迎回来' : mode === 'register' ? '创建账号' : '找回密码'}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {mode === 'login' ? '登录继续构建你的知识库'
               : mode === 'register' ? '开始你的智识之旅'
               : '输入邮箱，我们将发送重置链接'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>

            {mode !== 'forgot' && (
              <div className="space-y-1.5">
                <Label htmlFor="password">密码</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div className="space-y-1.5">
                <Label htmlFor="confirm">确认密码</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
            )}

            {mode === 'login' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-sm text-primary hover:underline"
                >
                  忘记密码？
                </button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-gradient-primary hover:opacity-90 transition-opacity"
              disabled={loading}
            >
              {loading ? '处理中...' : mode === 'login' ? '登录' : mode === 'register' ? '注册' : '发送重置邮件'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            {mode === 'login' ? (
              <p className="text-sm text-muted-foreground">
                还没有账号？{' '}
                <button onClick={() => setMode('register')} className="text-primary hover:underline font-medium">
                  立即注册
                </button>
              </p>
            ) : mode === 'register' ? (
              <p className="text-sm text-muted-foreground">
                已有账号？{' '}
                <button onClick={() => setMode('login')} className="text-primary hover:underline font-medium">
                  立即登录
                </button>
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
