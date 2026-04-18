/**
 * QrScannerSheet — camera-based QR scanner using html5-qrcode.
 * Opens as a full-screen overlay on mobile, center modal on desktop.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertTriangle, Nfc } from 'lucide-react';
import { useNfc } from '@/hooks/useNfc';

const INTER = "'Inter',system-ui,sans-serif";
const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function QrScannerSheet({ open, onClose }: Props) {
  const navigate = useNavigate();
  const nfc = useNfc();
  const [nfcMode, setNfcMode] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<string>('qr-reader-' + Math.random().toString(36).slice(2, 8));
  const [status, setStatus] = useState<'init' | 'scanning' | 'error'>('init');
  const [errorMsg, setErrorMsg] = useState('');
  const stoppedRef = useRef(false);

  const stopScanner = useCallback(async () => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    try {
      const s = scannerRef.current;
      if (s) {
        const state = s.getState();
        // State 2 = SCANNING
        if (state === 2) await s.stop();
        s.clear();
      }
    } catch { /* ignore */ }
    scannerRef.current = null;
  }, []);

  const handleSuccess = useCallback((decodedText: string) => {
    // Parse anchor URL: /{origin}/anchor/{id}
    try {
      const url = new URL(decodedText);
      const match = url.pathname.match(/^\/anchor\/([a-f0-9-]+)$/i);
      if (match) {
        stopScanner();
        onClose();
        navigate(`/anchor/${match[1]}`);
        return;
      }
    } catch { /* not a URL */ }

    // Fallback: if it starts with /anchor/
    const m = decodedText.match(/\/anchor\/([a-f0-9-]+)/i);
    if (m) {
      stopScanner();
      onClose();
      navigate(`/anchor/${m[1]}`);
    }
  }, [navigate, onClose, stopScanner]);

  useEffect(() => {
    if (!open) return;
    stoppedRef.current = false;
    setStatus('init');
    setErrorMsg('');

    // Delay to ensure DOM element exists
    const timer = setTimeout(async () => {
      try {
        const html5Qr = new Html5Qrcode(containerRef.current);
        scannerRef.current = html5Qr;

        const cameras = await Html5Qrcode.getCameras();
        if (!cameras.length) {
          setStatus('error');
          setErrorMsg('No camera found');
          return;
        }

        // Prefer rear camera
        const rearCam = cameras.find(c => /back|rear|environment/i.test(c.label));
        const camId = rearCam?.id ?? cameras[0].id;

        await html5Qr.start(
          camId,
          { fps: 10, qrbox: { width: 250, height: 250 } },
          handleSuccess,
          () => { /* ignore scan errors */ },
        );
        setStatus('scanning');
      } catch (err) {
        setStatus('error');
        setErrorMsg(err instanceof Error ? err.message : 'Camera access denied');
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [open, handleSuccess, stopScanner]);

  const handleClose = () => {
    stopScanner();
    nfc.stop();
    setNfcMode(false);
    onClose();
  };

  const handleNfcRead = useCallback((text: string) => {
    try {
      const url = new URL(text);
      const match = url.pathname.match(/^\/anchor\/([a-f0-9-]+)$/i);
      if (match) { handleClose(); navigate(`/anchor/${match[1]}`); return; }
    } catch { /* not a URL */ }
    const m = text.match(/\/anchor\/([a-f0-9-]+)/i);
    if (m) { handleClose(); navigate(`/anchor/${m[1]}`); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const startNfcMode = useCallback(() => {
    stopScanner();
    setNfcMode(true);
    nfc.scan(handleNfcRead);
  }, [stopScanner, nfc, handleNfcRead]);

  if (!open) return null;

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9995,
      background: '#01040d',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: 'calc(env(safe-area-inset-top, 12px) + 12px) 16px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <Camera size={18} color="#66f0ff" style={{ marginRight: 10 }} />
        <span style={{ fontFamily: INTER, fontSize: 15, fontWeight: 700, color: 'rgba(225,235,255,0.90)', flex: 1 }}>
          Scan Reality Anchor
        </span>
        <button onClick={handleClose} style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.20)',
          color: 'rgba(255,80,80,0.75)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <X size={16} />
        </button>
      </div>

      {/* Scanner viewport */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div id={containerRef.current} style={{ width: '100%', height: '100%' }} />

        {/* Overlay frame */}
        {status === 'scanning' && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{
              width: 260, height: 260,
              border: '2px solid rgba(102,240,255,0.50)',
              borderRadius: 20,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
            }} />
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: 32,
          }}>
            <AlertTriangle size={40} color="#ff4466" />
            <p style={{ fontFamily: INTER, fontSize: 15, color: 'rgba(255,255,255,0.70)', marginTop: 16, textAlign: 'center' }}>
              {errorMsg}
            </p>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div style={{
        padding: '12px 16px calc(env(safe-area-inset-bottom, 12px) + 12px)',
        textAlign: 'center',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <p style={{
          fontFamily: MONO, fontSize: 11,
          color: 'rgba(160,180,220,0.50)', letterSpacing: '0.04em',
          margin: 0,
        }}>
          {nfcMode ? '将手机靠近 NFC 标签' : '将摄像头对准 QR 锚点'}
        </p>
        {nfc.supported && !nfcMode && (
          <button onClick={startNfcMode} style={{
            marginTop: 10, padding: '7px 18px',
            fontFamily: INTER, fontSize: 12, fontWeight: 600,
            color: 'rgba(180,150,255,0.80)',
            background: 'rgba(180,150,255,0.08)',
            border: '1px solid rgba(180,150,255,0.22)',
            borderRadius: 8, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            <Nfc size={13} /> 或轻触 NFC 标签
          </button>
        )}
        {!nfc.supported && !nfcMode && (
          <p style={{
            marginTop: 8, fontFamily: MONO, fontSize: 9,
            color: 'rgba(140,150,180,0.35)', letterSpacing: '0.04em',
          }}>
            NFC 标签？请使用 Android 手机轻触
          </p>
        )}
        {nfcMode && (
          <div style={{
            marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Nfc size={20} color="#b496ff" style={{ animation: 'nfc-pulse 1.5s ease-in-out infinite' }} />
            <span style={{ fontFamily: INTER, fontSize: 13, color: 'rgba(180,150,255,0.70)' }}>
              {nfc.scanning ? '正在监听...' : nfc.error || '正在启动 NFC...'}
            </span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes nfc-pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>,
    document.body,
  );
}
