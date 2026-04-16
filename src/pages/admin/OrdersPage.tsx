import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { OrdersPanel } from '@/components/admin/OrdersPanel';

export default function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const statusFilter = (searchParams.get('status') as 'submitted' | 'all' | 'fulfilled' | 'rejected') || 'submitted';
  const setStatus = (s: string) => setSearchParams(prev => { prev.set('status', s); return prev; });

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Inter',system-ui,sans-serif", fontSize: 20, fontWeight: 700, color: 'rgba(220,230,248,0.92)', margin: 0 }}>订单审核</h1>
        <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: 'rgba(120,132,158,0.60)', margin: '4px 0 0', letterSpacing: '0.04em' }}>手动支付订单 · 凭证审核 · 权益发放</p>
      </div>
      <OrdersPanel onToast={showToast} statusFilter={statusFilter} onStatusChange={setStatus} />
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', padding: '10px 20px', background: toast.ok ? 'rgba(0,229,200,0.15)' : 'rgba(255,68,102,0.15)', border: `1px solid ${toast.ok ? 'rgba(0,229,200,0.35)' : 'rgba(255,68,102,0.35)'}`, borderRadius: 10, zIndex: 999, fontFamily: "'Inter',system-ui,sans-serif", fontSize: 12, color: toast.ok ? '#00e5c8' : '#ff4466', whiteSpace: 'nowrap' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
