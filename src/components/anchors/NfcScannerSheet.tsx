/**
 * NfcScannerSheet — full-screen overlay for reading NFC tags.
 * Parses anchor URL and navigates to /anchor/:id.
 */
import { useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, Nfc, AlertTriangle, Loader2, Check } from 'lucide-react';
import { useNfc } from '@/hooks/useNfc';

const INTER = "'Inter',system-ui,sans-serif";
const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NfcScannerSheet({ open, onClose }: Props) {
  const navigate = useNavigate();
  const nfc = useNfc();
  const [success, setSuccess] = useState(false);

  const handleRead = useCallback((text: string) => {
    try {
      const url = new URL(text);
      const match = url.pathname.match(/^\/anchor\/([a-f0-9-]+)$/i);
      if (match) { setSuccess(true); setTimeout(() => { onClose(); navigate(`/anchor/${match[1]}`); }, 600); return; }
    } catch { /* not a URL */ }
    const m = text.match(/\/anchor\/([a-f0-9-]+)/i);
    if (m) { setSuccess(true); setTimeout(() => { onClose(); navigate(`/anchor/${m[1]}`); }, 600); }
  }, [navigate, onClose]);

  useEffect(() => {
    if (open) { setSuccess(false); nfc.scan(handleRead); }
    return () => { nfc.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const isPermError = nfc.error?.includes('permission') || nfc.error?.includes('not allowed');

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9995,
      background: 'rgba(1,4,13,0.97)',
      backdropFilter: 'blur(20px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Close */}
      <button onClick={() => { nfc.stop(); onClose(); }} style={{
        position: 'absolute', top: 'calc(env(safe-area-inset-top, 12px) + 12px)', right: 16,
        width: 40, height: 40, borderRadius: 12,
        background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.20)',
        color: 'rgba(255,80,80,0.75)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <X size={18} />
      </button>

      {/* NFC icon with pulse */}
      <div style={{
        position: 'relative',
        width: 120, height: 120,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 28,
      }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: `2px solid ${success ? 'rgba(0,255,102,0.30)' : 'rgba(102,240,255,0.25)'}`,
          animation: nfc.scanning && !success ? 'nfc-ring 2s ease-out infinite' : 'none',
        }} />
        <div style={{
          position: 'absolute', inset: 10, borderRadius: '50%',
          border: `1.5px solid ${success ? 'rgba(0,255,102,0.20)' : 'rgba(102,240,255,0.15)'}`,
          animation: nfc.scanning && !success ? 'nfc-ring 2s ease-out 0.4s infinite' : 'none',
        }} />
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: success ? 'rgba(0,255,102,0.08)' : nfc.error ? 'rgba(255,68,102,0.08)' : 'rgba(102,240,255,0.08)',
          border: `1.5px solid ${success ? 'rgba(0,255,102,0.35)' : nfc.error ? 'rgba(255,68,102,0.25)' : 'rgba(102,240,255,0.30)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.3s',
        }}>
          {success
            ? <Check size={28} color="#00ff66" />
            : nfc.scanning
              ? <Nfc size={28} color="#66f0ff" />
              : nfc.error
                ? <AlertTriangle size={28} color="#ff4466" />
                : <Loader2 size={28} color="#66f0ff" style={{ animation: 'spin 1s linear infinite' }} />}
        </div>
      </div>

      {/* Status text */}
      <h2 style={{
        fontFamily: INTER, fontSize: 18, fontWeight: 700,
        color: success ? 'rgba(0,255,102,0.90)' : nfc.error ? 'rgba(255,68,102,0.90)' : 'rgba(225,235,255,0.92)',
        margin: '0 0 8px', textAlign: 'center',
      }}>
        {success ? '已识别' : nfc.error ? 'NFC 读取失败' : nfc.scanning ? '轻触 NFC 标签' : '正在初始化...'}
      </h2>

      <p style={{
        fontFamily: INTER, fontSize: 14, color: 'rgba(160,180,220,0.55)',
        textAlign: 'center', maxWidth: 280, margin: '0 0 24px',
        lineHeight: 1.6,
      }}>
        {success
          ? '正在跳转...'
          : nfc.error
            ? isPermError
              ? 'NFC 权限被拒绝，请在系统设置中开启'
              : '当前设备不支持 NFC，请使用 Android Chrome'
            : '将手机背面靠近物体上的标签'}
      </p>

      {nfc.error && (
        <button onClick={() => nfc.scan(handleRead)} style={{
          padding: '10px 28px',
          fontFamily: INTER, fontSize: 14, fontWeight: 600,
          color: '#66f0ff', background: 'rgba(102,240,255,0.10)',
          border: '1px solid rgba(102,240,255,0.30)',
          borderRadius: 10, cursor: 'pointer',
        }}>
          重试
        </button>
      )}

      {/* Footer */}
      <div style={{
        position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom, 16px) + 16px)',
        fontFamily: MONO, fontSize: 10, color: 'rgba(80,100,140,0.45)',
        letterSpacing: '0.06em', textAlign: 'center',
      }}>
        仅支持 Android Chrome &middot; 桌面端请使用 QR 码
      </div>

      <style>{`
        @keyframes nfc-ring {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>,
    document.body,
  );
}
