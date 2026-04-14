import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { User, Lock, Shield, LogOut, Moon, Sun, Languages } from 'lucide-react';
import { useTheme } from 'next-themes';

export default function Settings() {
  const { user, signOut, resetPassword } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { lang, setLang } = useLanguage();
  const t = useT();
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
    if (error) toast.error(t('settings.updateError'));
    else toast.success(t('settings.updateSuccess'));
    setLoadingUsername(false);
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    setResettingPassword(true);
    const { error } = await resetPassword(user.email);
    if (error) toast.error(error.message);
    else toast.success(t('settings.passwordSent'));
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
        <h1 className="text-2xl font-bold text-foreground">{t('settings.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('settings.subtitle')}</p>
      </div>

      {/* Profile section */}
      <section className="mb-6 animate-fade-up" style={{ animationDelay: '0.05s' }}>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
          {t('settings.section.profile')}
        </h2>
        <div className="bg-card rounded-xl border border-border p-6 space-y-5">
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
          <div className="space-y-1.5">
            <Label htmlFor="username">{t('settings.username')}</Label>
            <div className="flex gap-2">
              <Input
                id="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder={t('settings.usernamePlaceholder')}
                className="flex-1"
              />
              <Button onClick={handleSaveUsername} disabled={loadingUsername} variant="outline">
                {loadingUsername ? t('settings.savingUsername') : t('settings.save')}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Appearance */}
      <section className="mb-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
          {t('settings.section.appearance')}
        </h2>
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          {/* Dark mode */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              {theme === 'dark'
                ? <Moon className="w-4 h-4 text-muted-foreground" />
                : <Sun className="w-4 h-4 text-muted-foreground" />}
              <div>
                <p className="text-sm font-medium text-foreground">{t('settings.darkMode')}</p>
                <p className="text-xs text-muted-foreground">{t('settings.darkMode.desc')}</p>
              </div>
            </div>
            <Switch
              checked={theme === 'dark'}
              onCheckedChange={checked => setTheme(checked ? 'dark' : 'light')}
            />
          </div>
          {/* Language */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Languages className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">{t('settings.language')}</p>
                <p className="text-xs text-muted-foreground">{t('settings.language.desc')}</p>
              </div>
            </div>
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              {(['zh', 'en'] as const).map(l => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                    lang === l
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {l === 'zh' ? t('settings.language.zh') : t('settings.language.en')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="mb-6 animate-fade-up" style={{ animationDelay: '0.15s' }}>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
          {t('settings.section.security')}
        </h2>
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">{t('settings.password')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('settings.password.desc')} {user?.email}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetPassword}
              disabled={resettingPassword}
            >
              {resettingPassword ? t('settings.password.sending') : t('settings.password.send')}
            </Button>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="mb-6 animate-fade-up" style={{ animationDelay: '0.2s' }}>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
          {t('settings.section.privacy')}
        </h2>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground mb-1">{t('settings.privacy.title')}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t('settings.privacy.desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Account */}
      <section className="animate-fade-up" style={{ animationDelay: '0.25s' }}>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
          {t('settings.section.account')}
        </h2>
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          <div className="p-4">
            <p className="text-xs text-muted-foreground">{t('settings.email')}</p>
            <p className="text-sm text-foreground mt-0.5">{user?.email}</p>
          </div>
          <div className="p-4">
            <p className="text-xs text-muted-foreground">{t('settings.accountId')}</p>
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
          <LogOut className="w-4 h-4 mr-2" /> {t('settings.signOut')}
        </Button>
      </div>
    </div>
  );
}
