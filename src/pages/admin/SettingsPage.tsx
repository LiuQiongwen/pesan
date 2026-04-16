import { QrSettings } from '@/components/admin/QrSettings';
import { AnalyticsBar } from '@/components/admin/AnalyticsBar';

export default function SettingsPage() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Inter',system-ui,sans-serif", fontSize: 20, fontWeight: 700, color: 'rgba(220,230,248,0.92)', margin: 0 }}>收款设置</h1>
        <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: 'rgba(120,132,158,0.60)', margin: '4px 0 0', letterSpacing: '0.04em' }}>配置微信/支付宝收款码 · 订单统计</p>
      </div>
      <AnalyticsBar />
      <QrSettings />
    </div>
  );
}
