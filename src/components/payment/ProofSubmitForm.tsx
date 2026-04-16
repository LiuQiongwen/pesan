/**
 * ProofSubmitForm — upload proof screenshot + fill payment details.
 */
import { useState, useRef } from 'react';
import { ArrowLeft, Upload, ImageIcon, Check, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

interface Props {
  orderId: string;
  orderNo: string;
  productName: string;
  amountFen: number;
  defaultMethod: 'wechat' | 'alipay';
  onBack: () => void;
  onSubmitted: () => void;
}

type SubmitState = 'idle' | 'uploading' | 'submitting' | 'done' | 'error';

export function ProofSubmitForm({
  orderId, orderNo, productName, amountFen, defaultMethod, onBack, onSubmitted,
}: Props) {
  const [imageFile, setImageFile]           = useState<File | null>(null);
  const [imagePreview, setImagePreview]     = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod]   = useState<'wechat' | 'alipay'>(defaultMethod);
  const [payerNickname, setPayerNickname]   = useState('');
  const [note, setNote]                     = useState('');
  const [paymentTime, setPaymentTime]       = useState('');
  const [state, setState]                   = useState<SubmitState>('idle');
  const [errorMsg, setErrorMsg]             = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const yuan = (amountFen / 100).toFixed(2);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('请选择图片文件');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('图片不能超过 10MB');
      return;
    }
    setImageFile(file);
    setErrorMsg('');
    const reader = new FileReader();
    reader.onload = e => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleSubmit = async () => {
    if (!imageFile) { setErrorMsg('请上传付款截图'); return; }
    if (!payerNickname.trim()) { setErrorMsg('请填写付款人昵称'); return; }
    setErrorMsg('');

    try {
      // 1. Upload image to Supabase Storage
      setState('uploading');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('未登录');

      const ext  = imageFile.name.split('.').pop() ?? 'jpg';
      const path = `${user.id}/${orderId}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('payment-proofs')
        .upload(path, imageFile, { contentType: imageFile.type, upsert: false });

      if (upErr) throw new Error(`上传失败: ${upErr.message}`);

      const { data: urlData } = supabase.storage.from('payment-proofs').getPublicUrl(path);
      const proofImageUrl = urlData.publicUrl;

      // 2. Submit proof via edge function
      setState('submitting');
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('manual-pay-submit-proof', {
        body: {
          orderId,
          proofImageUrl,
          paymentTime:       paymentTime || null,
          paymentAmountFen:  amountFen,
          paymentMethod,
          payerNickname:     payerNickname.trim(),
          note:              note.trim() || null,
        },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      setState('done');
      setTimeout(() => onSubmitted(), 1800);

    } catch (e) {
      console.error(e);
      setErrorMsg((e as Error).message ?? '提交失败，请重试');
      setState('error');
    }
  };

  if (state === 'done') {
    return (
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)', zIndex: 201,
        width: 'clamp(320px, 90vw, 420px)',
        background: 'rgba(6,9,22,0.98)',
        border: '1px solid rgba(0,229,200,0.30)',
        borderRadius: 20, padding: '40px 24px',
        boxShadow: '0 32px 96px rgba(0,0,0,0.85)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: 'rgba(0,229,200,0.12)',
          border: '1px solid rgba(0,229,200,0.30)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Check size={24} color="#00e5c8" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: INTER, fontSize: 16, fontWeight: 700, color: 'rgba(220,230,250,0.95)', marginBottom: 6 }}>
            凭证已提交
          </div>
          <div style={{ fontFamily: INTER, fontSize: 12, color: 'rgba(140,150,175,0.65)', lineHeight: 1.6 }}>
            我们会在 24 小时内完成审核<br />审核通过后权益自动发放
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(6px)' }} />

      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)', zIndex: 201,
        width: 'clamp(320px, 92vw, 480px)',
        maxHeight: '90vh',
        background: 'rgba(6,9,22,0.98)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 20,
        boxShadow: '0 32px 96px rgba(0,0,0,0.85)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', gap: 10,
          flexShrink: 0,
        }}>
          <button
            onClick={onBack}
            style={{
              width: 28, height: 28, borderRadius: 7,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={13} color="rgba(140,150,175,0.70)" />
          </button>
          <div>
            <div style={{ fontFamily: INTER, fontSize: 14, fontWeight: 700, color: 'rgba(220,230,250,0.95)' }}>
              提交付款凭证
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(80,90,115,0.60)', letterSpacing: '0.05em', marginTop: 1 }}>
              {orderNo} · {productName} · ¥{yuan}
            </div>
          </div>
        </div>

        {/* Form */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Image upload */}
          <div>
            <label style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(140,150,175,0.65)', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              付款截图 *
            </label>
            {imagePreview ? (
              <div style={{ position: 'relative' }}>
                <img
                  src={imagePreview}
                  alt="proof"
                  style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(0,229,200,0.30)' }}
                />
                <button
                  onClick={() => { setImageFile(null); setImagePreview(null); }}
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    width: 24, height: 24, borderRadius: 6,
                    background: 'rgba(0,0,0,0.70)', border: '1px solid rgba(255,255,255,0.15)',
                    color: 'rgba(200,210,235,0.80)', fontSize: 12, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  ×
                </button>
              </div>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                style={{
                  width: '100%', height: 110,
                  border: '1.5px dashed rgba(255,255,255,0.15)',
                  borderRadius: 10, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 7,
                  background: 'rgba(255,255,255,0.02)',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,229,200,0.35)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.15)'; }}
              >
                <Upload size={20} color="rgba(100,110,140,0.50)" />
                <span style={{ fontFamily: INTER, fontSize: 11, color: 'rgba(120,130,160,0.60)' }}>
                  点击或拖拽上传截图
                </span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(80,90,115,0.45)' }}>
                  JPG / PNG · 最大 10MB
                </span>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
            />
          </div>

          {/* Payment method */}
          <div>
            <label style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(140,150,175,0.65)', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              支付方式 *
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['wechat', 'alipay'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  style={{
                    flex: 1, padding: '8px 0',
                    fontFamily: INTER, fontSize: 12,
                    color: paymentMethod === m ? (m === 'wechat' ? '#07c160' : '#1677ff') : 'rgba(140,150,175,0.55)',
                    background: paymentMethod === m
                      ? (m === 'wechat' ? 'rgba(7,193,96,0.10)' : 'rgba(22,119,255,0.10)')
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${paymentMethod === m ? (m === 'wechat' ? 'rgba(7,193,96,0.30)' : 'rgba(22,119,255,0.30)') : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 8, cursor: 'pointer', transition: 'all 0.14s',
                  }}
                >
                  {m === 'wechat' ? '微信支付' : '支付宝'}
                </button>
              ))}
            </div>
          </div>

          {/* Payer nickname */}
          <div>
            <label style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(140,150,175,0.65)', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              付款人昵称 * <span style={{ color: 'rgba(100,110,140,0.45)' }}>（便于核对）</span>
            </label>
            <input
              value={payerNickname}
              onChange={e => setPayerNickname(e.target.value)}
              placeholder="如：张三 / 微信昵称"
              style={{
                width: '100%', padding: '9px 12px',
                fontFamily: INTER, fontSize: 12, color: 'rgba(210,220,245,0.88)',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 8, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Payment time */}
          <div>
            <label style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(140,150,175,0.65)', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              付款时间 <span style={{ color: 'rgba(100,110,140,0.45)' }}>（选填）</span>
            </label>
            <input
              type="datetime-local"
              value={paymentTime}
              onChange={e => setPaymentTime(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px',
                fontFamily: INTER, fontSize: 12, color: 'rgba(210,220,245,0.88)',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 8, outline: 'none',
                boxSizing: 'border-box',
                colorScheme: 'dark',
              }}
            />
          </div>

          {/* Note */}
          <div>
            <label style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(140,150,175,0.65)', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              备注 <span style={{ color: 'rgba(100,110,140,0.45)' }}>（选填）</span>
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="如有问题或特殊说明请在此填写"
              rows={2}
              style={{
                width: '100%', padding: '9px 12px',
                fontFamily: INTER, fontSize: 12, color: 'rgba(210,220,245,0.88)',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 8, outline: 'none', resize: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Error */}
          {errorMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'rgba(255,68,102,0.10)', border: '1px solid rgba(255,68,102,0.25)', borderRadius: 8 }}>
              <AlertCircle size={12} color="#ff4466" style={{ flexShrink: 0 }} />
              <span style={{ fontFamily: INTER, fontSize: 11, color: '#ff6680' }}>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Submit */}
        <div style={{ padding: '12px 20px 18px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <button
            onClick={handleSubmit}
            disabled={state === 'uploading' || state === 'submitting'}
            style={{
              width: '100%', padding: '11px',
              fontFamily: INTER, fontSize: 13, fontWeight: 600,
              color: '#fff',
              background: (state === 'uploading' || state === 'submitting')
                ? 'rgba(0,229,200,0.30)'
                : 'linear-gradient(135deg, rgba(0,229,200,0.85), rgba(0,180,255,0.75))',
              border: 'none', borderRadius: 10, cursor: state === 'idle' || state === 'error' ? 'pointer' : 'wait',
              transition: 'opacity 0.15s',
            }}
          >
            {state === 'uploading' ? '上传截图中…'
              : state === 'submitting' ? '提交中…'
              : '提交凭证，等待审核'}
          </button>
        </div>
      </div>
    </>
  );
}
