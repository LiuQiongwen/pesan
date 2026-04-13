import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { User, Lock, Shield, LogOut, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export default function Settings() {
  const { user, signOut, resetPassword } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [username, setUsername] = useState('');
  const [loadingUsername, setLoadingUsername] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  const initials = user?.email?.charAt(0).toUpperCase() || 'U';
  const emailPrefix = user?.email?.split('@')[0] || '';

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('username').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        const prefix = user.email?.split('@')[0] || '';
        if (data?.username) setUsername(data.username);
        else setUsername(prefix);
      });
  }, [user]);

  const handleSaveUsername = async () => {
    if (!user) return;
    setLoadingUsername(true);
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, username, updated_at: new Date().toISOString() });
    if (error) toast.error('更新失败');
    else toast.success('用户名已更新');
    setLoadingUsername(false);
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    setResettingPassword(true);
    const { error } = await resetPassword(user.email);
    if (error) toast.error(error.message);
    else toast.success('密码重置邮件已发送，请查收邮箱');
    setResettingPassword(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="flex flex-col h-full overflow-auto p-8 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="mb-8 animate-fade-up">
        <h1 className="text-2xl font-bold text-foreground">设置</h1>
        <p className="text-muted-foreground mt-1">管理你的账号和偏好设置</p>
      </div>

      {/* Profile section */}
      <section className="mb-6 animate-fade-up" style={{ animationDelay: '0.05s' }}>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">个人资料</h2>
        <div className="bg-card rounded-xl border border-border p-6 space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <Avatar className="w-14 h-14">
              <AvatarFallback className="bg-gradient-primary text-white text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-foreground">{username || emailPrefix}</p>
              <p className="text-muted-foreground text-sm">{user?.email}</p>
            </div>
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <Label htmlFor="username">用户名</Label>
            <div className="flex gap-2">
              <Input
                id="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="输入用户名..."
                className="flex-1"
              />
              <Button
                onClick={handleSaveUsername}
                disabled={loadingUsername}
                variant="outline"
              >
                {loadingUsername ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Appearance */}
      <section className="mb-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">外观</h2>
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? <Moon className="w-4 h-4 text-muted-foreground" /> : <Sun className="w-4 h-4 text-muted-foreground" />}
              <div>
                <p className="text-sm font-medium text-foreground">深色模式</p>
                <p className="text-xs text-muted-foreground">切换界面明暗主题</p>
              </div>
            </div>
            <Switch
              checked={theme === 'dark'}
              onCheckedChange={checked => setTheme(checked ? 'dark' : 'light')}
            />
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="mb-6 animate-fade-up" style={{ animationDelay: '0.15s' }}>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">安全</h2>
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">修改密码</p>
                <p className="text-xs text-muted-foreground">发送密码重置邮件到 {user?.email}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetPassword}
              disabled={resettingPassword}
            >
              {resettingPassword ? '发送中...' : '发送重置邮件'}
            </Button>
          </div>
        </div>
      </section>

      {/* Privacy notice */}
      <section className="mb-6 animate-fade-up" style={{ animationDelay: '0.2s' }}>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">隐私</h2>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground mb-1">完全私密保护</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                你的所有笔记都经过行级安全控制（RLS）保护，只有你本人才能访问。任何其他用户（包括管理员）均无法查看你的笔记内容。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Account */}
      <section className="animate-fade-up" style={{ animationDelay: '0.25s' }}>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">账号</h2>
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          <div className="p-4">
            <p className="text-xs text-muted-foreground">邮箱</p>
            <p className="text-sm text-foreground mt-0.5">{user?.email}</p>
          </div>
          <div className="p-4">
            <p className="text-xs text-muted-foreground">账号 ID</p>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{user?.id}</p>
          </div>
        </div>
      </section>

      {/* Logout */}
      <div className="mt-8 animate-fade-up" style={{ animationDelay: '0.3s' }}>
        <Button
          variant="outline"
          className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4 mr-2" /> 退出登录
        </Button>
      </div>
    </div>
  );
}
