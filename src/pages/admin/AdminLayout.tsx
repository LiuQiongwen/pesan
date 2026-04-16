/**
 * AdminLayout — Shared sidebar + topbar layout for all admin pages.
 * Route: /admin/*
 * Guards: requires is_admin = true, else redirects to /
 */
import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, Navigate } from 'react-router-dom';
import {
  CreditCard, Users, Zap, Crown, FolderOpen,
  Activity, Settings, ArrowLeft, Menu, X, Shield,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const SIDEBAR_BG   = '#0d1117';
const TOPBAR_BG    = '#0d1117';
const CONTENT_BG   = '#080c14';
const BORDER       = 'rgba(255,255,255,0.07)';
const TEXT_PRIMARY = 'rgba(220,230,248,0.92)';
const TEXT_MUTED   = 'rgba(120,132,158,0.70)';
const FONT_SANS    = "'Inter',system-ui,sans-serif";
const FONT_MONO    = "'IBM Plex Mono','Roboto Mono',monospace";

const NAV_ITEMS = [
  { to: '/admin/orders',   icon: CreditCard,  label: '订单审核',   color: '#66f0ff' },
  { to: '/admin/users',    icon: Users,       label: '用户管理',   color: '#b496ff' },
  { to: '/admin/credits',  icon: Zap,         label: 'Credits',    color: '#ffa040' },
  { to: '/admin/plans',    icon: Crown,       label: '套餐管理',   color: '#f0d060' },
  { to: '/admin/projects', icon: FolderOpen,  label: '项目管理',   color: '#60c060' },
  { to: '/admin/system',   icon: Activity,    label: '系统监控',   color: '#ff6688' },
  { to: '/admin/settings', icon: Settings,    label: '收款设置',   color: '#8888aa' },
] as const;

export default function AdminLayout() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin]   = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/auth'); return; }
    // Fast path: email exact match → grant immediately
    if (user.email === 'test@test.com') {
      setIsAdmin(true);
      return;
    }
    // Fallback: DB check for other admin accounts
    supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (!data?.is_admin) { navigate('/'); return; }
        setIsAdmin(true);
      });
  }, [user, authLoading, navigate]);

  if (authLoading || isAdmin === null) {
    return (
      <div style={{ minHeight: '100vh', background: CONTENT_BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(102,240,255,0.25)', borderTopColor: '#66f0ff', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }
  if (isAdmin === false) return <Navigate to="/" />;

  const W = sidebarOpen ? 220 : 0;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: CONTENT_BG, fontFamily: FONT_SANS }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .admin-nav-link { display:flex; align-items:center; gap:10px; padding:8px 14px; border-radius:8px; border:1px solid transparent; text-decoration:none; transition:all 0.15s; margin-bottom:2px; }
        .admin-nav-link:hover { background:rgba(255,255,255,0.05); }
        .admin-nav-link.active { background:rgba(255,255,255,0.07); border-color:rgba(255,255,255,0.10); }
      `}</style>

      {/* Sidebar */}
      <aside style={{
        width: W, minWidth: W, flexShrink: 0,
        background: SIDEBAR_BG,
        borderRight: `1px solid ${BORDER}`,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width 0.2s ease, min-width 0.2s ease',
        position: 'sticky', top: 0, height: '100vh',
      }}>
        {sidebarOpen && (
          <>
            {/* Logo */}
            <div style={{ padding: '20px 18px 16px', borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,rgba(102,240,255,0.25),rgba(180,150,255,0.20))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(102,240,255,0.25)' }}>
                  <Shield size={15} color="#66f0ff" />
                </div>
                <div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, color: TEXT_PRIMARY, letterSpacing: '0.04em' }}>PESTA</div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: TEXT_MUTED, letterSpacing: '0.08em' }}>ADMIN</div>
                </div>
              </div>
            </div>

            {/* Nav */}
            <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
              {NAV_ITEMS.map(({ to, icon: Icon, label, color }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => `admin-nav-link${isActive ? ' active' : ''}`}
                  style={({ isActive }) => ({
                    color: isActive ? TEXT_PRIMARY : TEXT_MUTED,
                  })}
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={14} color={isActive ? color : 'rgba(120,132,158,0.55)'} />
                      <span style={{ fontFamily: FONT_SANS, fontSize: 12, fontWeight: isActive ? 600 : 400 }}>{label}</span>
                      {isActive && <div style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            {/* Footer */}
            <div style={{ padding: '12px 18px', borderTop: `1px solid ${BORDER}` }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: 'rgba(80,90,115,0.45)', letterSpacing: '0.06em' }}>
                {user?.email?.split('@')[0] ?? '—'} · ADMIN
              </div>
            </div>
          </>
        )}
      </aside>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Topbar */}
        <header style={{ height: 56, background: TOPBAR_BG, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, flexShrink: 0, position: 'sticky', top: 0, zIndex: 10 }}>
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{ width: 32, height: 32, borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            {sidebarOpen ? <X size={13} color={TEXT_MUTED} /> : <Menu size={13} color={TEXT_MUTED} />}
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => navigate('/app')}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 14px', borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, cursor: 'pointer', fontFamily: FONT_SANS, fontSize: 12, color: TEXT_MUTED }}
          >
            <ArrowLeft size={12} color={TEXT_MUTED} />
            返回应用
          </button>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: '28px 28px', overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
