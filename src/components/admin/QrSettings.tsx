import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Upload, QrCode, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { MONO, INTER } from './shared';

export function QrSettings() {
  const [open, setOpen]         = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState<string | null>(null);
  const [payee, setPayee]       = useState({ wechat: 'Pesta', alipay: 'Pesta' });
  const wechatRef = useRef<HTMLInputElement>(null);
  const alipayRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('admin_settings')
      .select('key, value')
      .in('key', ['manual_pay_wechat_qr_url', 'manual_pay_alipay_qr_url', 'manual_pay_wechat_payee', 'manual_pay_alipay_payee'])
      .then(({ data }) => {
        const m: Record<string, string> = {};
        (data ?? []).forEach(r => { if (r.value) m[r.key] = r.value; });
        setSettings(m);
        setPayee({ wechat: m['manual_pay_wechat_payee'] ?? 'Pesta', alipay: m['manual_pay_alipay_payee'] ?? 'Pesta' });
      });
  }, []);

  const uploadQr = async (type: 'wechat' | 'alipay', file: File) => {
    setUploading(type);
    try {
      const ext = file.name.split('.').pop() ?? 'png';
      const fileName = `${type}_qr_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('qr-codes').upload(fileName, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('qr-codes').getPublicUrl(fileName);
      const key = `manual_pay_${type}_qr_url`;
      await supabase.from('admin_settings').upsert({ key, value: urlData.publicUrl, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      setSettings(prev => ({ ...prev, [key]: urlData.publicUrl }));
      setToast(`${type === 'wechat' ? '微信' : '支付宝'}收款码上传成功`);
    } catch (e) {
      console.error(e);
      setToast('上传失败，请重试');
    } finally {
      setUploading(null);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const savePayees = async () => {
    setSaving(true);
    try {
      await Promise.all([
        supabase.from('admin_settings').upsert({ key: 'manual_pay_wechat_payee', value: payee.wechat }, { onConflict: 'key' }),
        supabase.from('admin_settings').upsert({ key: 'manual_pay_alipay_payee', value: payee.alipay }, { onConflict: 'key' }),
      ]);
      setToast('收款人名称已保存');
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2500);
    }
  };

  const QrSlot = ({ type, label }: { type: 'wechat' | 'alipay'; label: string }) => {
    const urlKey = `manual_pay_${type}_qr_url`;
    const currentUrl = settings[urlKey];
    const ref = type === 'wechat' ? wechatRef : alipayRef;
    const accent = type === 'wechat' ? '#07c160' : '#1677ff';
    const isUploading = uploading === type;
    return (
      <div style={{ border: `1px solid ${accent}22`, borderRadius: 12, padding: 14, background: `${accent}05`, flex: 1 }}>
        <div style={{ fontFamily: MONO, fontSize: 9, color: `${accent}99`, letterSpacing: '0.06em', marginBottom: 10 }}>{label}</div>
        <div style={{ width: '100%', aspectRatio: '1/1', maxWidth: 140, margin: '0 auto 10px', borderRadius: 8, border: `1px solid ${currentUrl ? accent + '40' : 'rgba(255,255,255,0.08)'}`, background: currentUrl ? 'transparent' : 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {currentUrl ? <img src={currentUrl} alt={`${type} qr`} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <QrCode size={32} color="rgba(100,110,140,0.35)" />}
        </div>
        <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadQr(type, f); e.target.value = ''; }} />
        <button onClick={() => ref.current?.click()} disabled={isUploading} style={{ width: '100%', padding: 7, fontFamily: INTER, fontSize: 11, fontWeight: 600, color: '#040b10', background: isUploading ? `${accent}66` : accent, border: 'none', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          {isUploading ? <><RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> 上传中…</> : <><Upload size={11} /> {currentUrl ? '更换图片' : '上传图片'}</>}
        </button>
      </div>
    );
  };

  return (
    <div style={{ marginBottom: 20, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden', background: 'rgba(255,255,255,0.015)' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', cursor: 'pointer' }}>
        <Settings size={13} color="rgba(180,150,255,0.70)" />
        <span style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(180,150,255,0.80)', letterSpacing: '0.05em', flex: 1, textAlign: 'left' }}>收款设置</span>
        {open ? <ChevronUp size={13} color="rgba(100,110,140,0.50)" /> : <ChevronDown size={13} color="rgba(100,110,140,0.50)" />}
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ paddingTop: 14, display: 'flex', gap: 14 }}>
            <QrSlot type="wechat" label="微信收款码" />
            <QrSlot type="alipay" label="支付宝收款码" />
          </div>
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {(['wechat', 'alipay'] as const).map(t => (
              <div key={t}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(100,110,140,0.55)', letterSpacing: '0.06em', marginBottom: 4 }}>{t === 'wechat' ? '微信' : '支付宝'}显示名称</div>
                <input value={payee[t]} onChange={e => setPayee(prev => ({ ...prev, [t]: e.target.value }))} placeholder="Pesta" style={{ width: '100%', padding: '7px 10px', fontFamily: INTER, fontSize: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 7, color: 'rgba(220,230,250,0.90)', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
          <button onClick={savePayees} disabled={saving} style={{ marginTop: 10, padding: '7px 18px', fontFamily: INTER, fontSize: 11, fontWeight: 600, background: 'rgba(180,150,255,0.20)', border: '1px solid rgba(180,150,255,0.35)', borderRadius: 7, color: '#c4aaff', cursor: 'pointer' }}>
            {saving ? '保存中…' : '保存名称'}
          </button>
        </div>
      )}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', padding: '8px 18px', background: 'rgba(0,229,200,0.15)', border: '1px solid rgba(0,229,200,0.35)', borderRadius: 8, zIndex: 9999, fontFamily: INTER, fontSize: 12, color: '#00e5c8', pointerEvents: 'none' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
