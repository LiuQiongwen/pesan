import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Settings, LogOut, Brain, Plus, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const navItems = [
  { to: '/dashboard',  icon: LayoutDashboard, label: '总览' },
  { to: '/analyze',    icon: Brain,            label: '分析' },
  { to: '/distiller',  icon: FlaskConical,     label: 'Distiller' },
  { to: '/library',    icon: BookOpen,         label: '知识库' },
  { to: '/settings',   icon: Settings,         label: '设置' },
];

export function Sidebar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

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
        <TooltipContent side="right">新建分析</TooltipContent>
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

      {/* Bottom: user avatar + logout */}
      <div className="flex flex-col items-center gap-2 mt-auto">
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
          <TooltipContent side="right">退出登录</TooltipContent>
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
