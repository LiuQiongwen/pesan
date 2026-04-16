import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { PestaLogo } from '@/components/brand/PestaLogo';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
  const t = useT();

  // Redirect on login — admin → /admin/payments, regular → /app
  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        navigate(data?.is_admin ? '/admin/payments' : '/app');
      });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) { toast.error(t('auth.error.signIn')); return; }
        navigate('/app');
      } else if (mode === 'register') {
        if (password !== confirmPassword) { toast.error('两次密码不一致 / Passwords do not match'); return; }
        if (password.length < 6) { toast.error('密码至少6位 / Password must be at least 6 chars'); return; }
        const { error } = await signUp(email, password);
        if (error) { toast.error(t('auth.error.signUp')); return; }
        toast.success(t('auth.success.signUp'));
        setMode('login');
      } else if (mode === 'forgot') {
        const { error } = await resetPassword(email);
        if (error) { toast.error(error.message); return; }
        toast.success(t('settings.passwordSent'));
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
            <PestaLogo size={36} showName />
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-6">
            {t('auth.title.signIn')}<br />
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              {t('auth.subtitle.signIn')}
            </span>
          </h1>
          <p className="text-sidebar-foreground text-lg leading-relaxed">
            {t('auth.subtitle.signUp')}
          </p>
        </div>
        <div className="relative z-10 mt-auto space-y-4">
          {[
            { zh: '支持网站、文件、图片、视频等多源输入', en: 'Multi-source: URL, file, image, video' },
            { zh: 'AI 深度分析提炼多维度洞见', en: 'AI deep analysis and insight extraction' },
            { zh: '思维导图可视化知识结构', en: 'Mind map visualization of knowledge' },
            { zh: '完全私密的个人知识空间', en: 'Fully private personal knowledge space' },
          ].map(f => (
            <div key={f.zh} className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-primary-glow flex-shrink-0" />
              <span className="text-sidebar-foreground text-sm">{f.zh} / {f.en}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right - Auth Form */}
      <div className="flex flex-col flex-1 items-center justify-center p-8">
        <div className="w-full max-w-md animate-fade-up">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <PestaLogo size={28} showName />
          </div>

          <div className="mb-8">
            {mode === 'forgot' && (
              <button
                onClick={() => setMode('login')}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> {t('common.back')}
              </button>
            )}
            <h2 className="text-2xl font-bold text-foreground">
              {mode === 'login'
                ? t('auth.title.signIn')
                : mode === 'register'
                ? t('auth.title.signUp')
                : '找回密码 / Forgot Password'}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {mode === 'login'
                ? t('auth.subtitle.signIn')
                : mode === 'register'
                ? t('auth.subtitle.signUp')
                : '输入邮箱，我们将发送重置链接 / Enter your email for a reset link'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>

            {mode !== 'forgot' && (
              <div className="space-y-1.5">
                <Label htmlFor="password">{t('auth.password')}</Label>
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
                <Label htmlFor="confirm">确认密码 / Confirm Password</Label>
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
                  忘记密码？ / Forgot?
                </button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-gradient-primary hover:opacity-90 transition-opacity"
              disabled={loading}
            >
              {loading
                ? '...'
                : mode === 'login'
                ? t('auth.signIn')
                : mode === 'register'
                ? t('auth.signUp')
                : '发送重置邮件 / Send Reset Email'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            {mode === 'login' ? (
              <p className="text-sm text-muted-foreground">
                {t('auth.switchToSignUp')}{' '}
                <button onClick={() => setMode('register')} className="text-primary hover:underline font-medium">
                  {t('auth.createOne')}
                </button>
              </p>
            ) : mode === 'register' ? (
              <p className="text-sm text-muted-foreground">
                {t('auth.switchToSignIn')}{' '}
                <button onClick={() => setMode('login')} className="text-primary hover:underline font-medium">
                  {t('auth.signInLink')}
                </button>
              </p>
            ) : null}
          </div>

          {/* Legal links */}
          <div className="mt-5 text-center">
            <p className="text-xs text-muted-foreground/50">
              {mode === 'register' ? '注册即表示您同意' : '使用即表示您同意'}{' '}
              <a href="/terms" target="_blank" rel="noreferrer" className="underline hover:text-muted-foreground transition-colors">服务条款</a>
              {' '}与{' '}
              <a href="/privacy" target="_blank" rel="noreferrer" className="underline hover:text-muted-foreground transition-colors">隐私政策</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
