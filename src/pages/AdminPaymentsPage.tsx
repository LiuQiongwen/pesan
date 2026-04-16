/**
 * AdminPaymentsPage — Admin dashboard.
 * Route: /admin/payments
 * Tabs stored in URL: ?tab=orders|users|analytics&status=submitted
 * Requires profiles.is_admin = true.
 */
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CreditCard, Users, BarChart2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { OrdersPanel } from '@/components/admin/OrdersPanel';
import { UsersPanel }  from '@/components/admin/UsersPanel';
import { AnalyticsPanel } from '@/components/admin/AnalyticsPanel';
import { MONO, INTER } from '@/components/admin/shared';

type AdminTab = 'orders' | 'users' | 'analytics';

const TABS: { id: AdminTab; label: string; icon: typeof CreditCard; color: string }[] = [
  { id: 'orders',    label: '订单审核', icon: CreditCard, color: '#66f0ff' },
  { id: 'users',     label: '用户管理', icon: Users,      color: '#b496ff' },
  { id: 'analytics', label: '数据分析', icon: BarChart2,  color: '#ffa040' },
];

export default function AdminPaymentsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);

  // URL-persisted state
  const activeTab    = (searchParams.get('tab') as AdminTab) || 'orders';
  const statusFilter = (searchParams.get('status') as 'submitted' | 'all' | 'fulfilled' | 'rejected') || 'submitted';

  const setTab = (tab: AdminTab) => setSearchParams(prev => { prev.set('tab', tab); return prev; });
  const setStatus = (s: string)  => setSearchParams(prev => { prev.set('status', s); return prev; });

  // Auth check
  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/auth'); return; }
    supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (!data?.is_admin) { navigate('/'); return; }
        setIsAdmin(true);
      });
  }, [user, authLoading, navigate]);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  if (authLoading || isAdmin === null) {
    return (
      <div style={{ minHeight: '100vh', background: '#040610', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(0,229,200,0.30)', borderTopColor: '#00e5c8', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#040610 0%,#060a1a 100%)', color: 'rgba(220,230,250,0.90)', fontFamily: INTER }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Top bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(4,6,16,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={() => navigate('/app')} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ArrowLeft size={14} color="rgba(140,150,175,0.80)" />
        </button>
        <div>
          <div style={{ fontFamily: INTER, fontSize: 15, fontWeight: 700 }}>管理后台</div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(80,90,115,0.65)', letterSpacing: '0.06em' }}>PESTA · ADMIN DASHBOARD</div>
        </div>
        <div style={{ flex: 1 }} />

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 4, padding: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
          {TABS.map(t => {
            const isActive = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, background: isActive ? `${t.color}15` : 'transparent', border: isActive ? `1px solid ${t.color}35` : '1px solid transparent', cursor: 'pointer', transition: 'all 0.2s' }}>
                <t.icon size={12} color={isActive ? t.color : 'rgba(100,110,140,0.55)'} />
                <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.04em', color: isActive ? t.color : 'rgba(100,110,140,0.55)' }}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 20px' }}>
        {activeTab === 'orders' && (
          <OrdersPanel onToast={showToast} statusFilter={statusFilter} onStatusChange={setStatus} />
        )}
        {activeTab === 'users' && (
          <UsersPanel onToast={showToast} />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsPanel />
        )}
      </div>

      {/* Global toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', padding: '10px 20px', background: toast.ok ? 'rgba(0,229,200,0.15)' : 'rgba(255,68,102,0.15)', border: `1px solid ${toast.ok ? 'rgba(0,229,200,0.35)' : 'rgba(255,68,102,0.35)'}`, borderRadius: 10, zIndex: 999, fontFamily: INTER, fontSize: 12, color: toast.ok ? '#00e5c8' : '#ff4466', whiteSpace: 'nowrap' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
