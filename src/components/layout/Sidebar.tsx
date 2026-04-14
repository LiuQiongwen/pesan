import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Settings, LogOut, Brain, Plus, FlaskConical, CheckSquare, Scan, Sparkles, Languages, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function Sidebar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { lang, setLang } = useLanguage();
  const t = useT();

  const navItems = [
    { to: '/dashboard',    icon: LayoutDashboard, label: t('sidebar.home') },
    { to: '/search',       icon: Search,           label: t('sidebar.search') },
    { to: '/analyze',      icon: Brain,            label: t('sidebar.analyze') },
    { to: '/distiller',    icon: FlaskConical,     label: t('sidebar.distiller') },
    { to: '/actions',      icon: CheckSquare,      label: t('sidebar.actions') },
    { to: '/mirror',       icon: Scan,             label: t('sidebar.mirror') },
    { to: '/anticipation', icon: Sparkles,         label: t('sidebar.anticipation') },
    { to: '/library',      icon: BookOpen,         label: t('sidebar.library') },
    { to: '/settings',     icon: Settings,         label: t('sidebar.settings') },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const initials = user?.email?.charAt(0).toUpperCase() || 'U';

  return (
    <aside className="flex flex-col w-16 h-full bg-sidebar border-r border-sidebar-border py-4 items-center gap-2">
      {/* Logo */}
      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-primary mb-2 animate-flow-light">
        <span className="text-white font-bold text-sm">Pe</span>
      </div>

      {/* New Analysis shortcut */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="w-10 h-10 rounded-xl text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground mb-2"
            onClick={() => navigate('/analyze')}
          >
            <Plus className="w-5 h-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">{t('sidebar.newAnalysis')}</TooltipContent>
      </Tooltip>

      <div className="w-8 h-px bg-sidebar-border" />

      {/* Nav items */}
      <nav className="flex flex-col gap-1 flex-1 mt-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <Tooltip key={to}>
            <TooltipTrigger asChild>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-glow'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )
                }
              >
                <Icon className="w-5 h-5" />
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        ))}
      </nav>

      {/* Bottom: language toggle + logout + avatar */}
      <div className="flex flex-col items-center gap-2 mt-auto">
        {/* Language toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10 rounded-xl text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            >
              <Languages className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {lang === 'zh' ? 'Switch to English' : '切换为中文'}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10 rounded-xl text-sidebar-foreground hover:bg-sidebar-accent hover:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{t('sidebar.signOut')}</TooltipContent>
        </Tooltip>

        <Avatar className="w-8 h-8 cursor-pointer" onClick={() => navigate('/settings')}>
          <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-sm font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>
    </aside>
  );
}
