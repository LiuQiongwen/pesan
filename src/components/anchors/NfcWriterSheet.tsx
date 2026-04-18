/**
 * NfcWriterSheet — overlay for writing an anchor URL to an NFC tag.
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Nfc, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { useNfc } from '@/hooks/useNfc';

const INTER = "'Inter',system-ui,sans-serif";
const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";

interface Props {
  open: boolean;
  onClose: () => void;
  anchorId: string;
  label: string;
}

export function NfcWriterSheet({ open, onClose, anchorId, label }: Props) {
  const nfc = useNfc();
  const [done, setDone] = useState(false);

  const url = `${window.location.origin}/anchor/${anchorId}`;

  const handleWrite = async () => {
    setDone(false);
    await nfc.write(url);
    if (!nfc.error) setDone(true);
  };

  if (!open) return null;

  return createPortal(
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 9990,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)', zIndex: 9991,
        width: 'calc(100% - 32px)', maxWidth: 380,
        background: 'rgba(5,10,24,0.98)',
        border: '1px solid rgba(102,240,255,0.20)',
        borderRadius: 20, padding: 28,
        boxShadow: '0 0 60px rgba(0,0,0,0.60)',
        textAlign: 'center',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <Nfc size={20} color="#66f0ff" style={{ marginRight: 10 }} />
          <span style={{ fontFamily: INTER, fontSize: 16, fontWeight: 700, color: 'rgba(225,235,255,0.95)', flex: 1, textAlign: 'left' }}>
            写入 NFC 标签
          </span>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
            color: 'rgba(255,255,255,0.50)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={14} />
          </button>
        </div>

        {/* Anchor info */}
        <div style={{
          padding: '10px 14px', borderRadius: 10, marginBottom: 20,
          background: 'rgba(102,240,255,0.04)',
          border: '1px solid rgba(102,240,255,0.12)',
        }}>
          <div style={{ fontFamily: INTER, fontSize: 14, fontWeight: 600, color: 'rgba(225,235,255,0.85)' }}>
            {label || '现实锚点'}
          </div>
          <div style={{
            fontFamily: MONO, fontSize: 9, color: 'rgba(102,240,255,0.45)',
            marginTop: 4, wordBreak: 'break-all',
          }}>
            {url}
          </div>
        </div>

        {/* Status icon */}
        <div style={{
          width: 80, height: 80, borderRadius: 20,
          margin: '0 auto 16px',
          background: done ? 'rgba(0,255,102,0.08)' : nfc.error ? 'rgba(255,68,102,0.08)' : 'rgba(102,240,255,0.06)',
          border: `1.5px solid ${done ? 'rgba(0,255,102,0.30)' : nfc.error ? 'rgba(255,68,102,0.25)' : 'rgba(102,240,255,0.20)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.3s',
        }}>
          {nfc.writing
            ? <Loader2 size={32} color="#66f0ff" style={{ animation: 'spin 1s linear infinite' }} />
            : done
              ? <Check size={32} color="#00ff66" />
              : nfc.error
                ? <AlertTriangle size={32} color="#ff4466" />
                : <Nfc size={32} color="#66f0ff" />}
        </div>

        <p style={{
          fontFamily: INTER, fontSize: 14,
          color: done ? 'rgba(0,255,102,0.80)' : nfc.error ? 'rgba(255,68,102,0.75)' : 'rgba(200,210,235,0.60)',
          margin: '0 0 20px', lineHeight: 1.6,
        }}>
          {nfc.writing
            ? '正在写入，请保持贴近...'
            : done
              ? '写入成功！标签已关联到锚点'
              : nfc.error
                ? `写入失败 · ${nfc.error}`
                : '点击下方按钮，然后将手机靠近空白 NFC 标签'}
        </p>

        {/* Action button */}
        {!done ? (
          <button
            onClick={handleWrite}
            disabled={nfc.writing}
            style={{
              width: '100%', padding: '12px 0',
              fontFamily: INTER, fontSize: 14, fontWeight: 700,
              color: nfc.writing ? 'rgba(225,235,255,0.40)' : '#01040d',
              background: nfc.writing ? 'rgba(102,240,255,0.15)' : 'linear-gradient(135deg, #66f0ff, #4ecdc4)',
              border: 'none', borderRadius: 10,
              cursor: nfc.writing ? 'default' : 'pointer',
              boxShadow: nfc.writing ? 'none' : '0 4px 16px rgba(102,240,255,0.25)',
            }}
          >
            {nfc.writing ? '写入中...' : nfc.error ? '重新写入' : '写入 NFC 标签'}
          </button>
        ) : (
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '12px 0',
              fontFamily: INTER, fontSize: 14, fontWeight: 600,
              color: 'rgba(200,210,235,0.75)',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, cursor: 'pointer',
            }}
          >
            完成
          </button>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>,
    document.body,
  );
}
