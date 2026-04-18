/**
 * NfcDesktopInfoSheet — lightweight explanation overlay for desktop/iOS users
 * who cannot use Web NFC directly.
 */
import { createPortal } from 'react-dom';
import { X, Nfc, Smartphone, QrCode } from 'lucide-react';

const INTER = "'Inter',system-ui,sans-serif";
const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";

interface Props {
  open: boolean;
  onClose: () => void;
}

const STEPS = [
  { icon: Smartphone, color: '#66f0ff', text: '在 Android 手机上打开本应用' },
  { icon: Nfc,        color: '#b496ff', text: '进入锚点详情，写入 NFC 标签' },
  { icon: QrCode,     color: '#00ff66', text: '桌面端可直接使用 QR 码替代' },
] as const;

export function NfcDesktopInfoSheet({ open, onClose }: Props) {
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
        border: '1px solid rgba(180,150,255,0.20)',
        borderRadius: 20, padding: 28,
        boxShadow: '0 0 60px rgba(0,0,0,0.60)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'rgba(180,150,255,0.08)',
            border: '1px solid rgba(180,150,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginRight: 12,
          }}>
            <Nfc size={20} color="#b496ff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: INTER, fontSize: 16, fontWeight: 700, color: 'rgba(225,235,255,0.95)' }}>
              NFC 轻触是什么？
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(180,150,255,0.50)', letterSpacing: '0.06em', marginTop: 2 }}>
              REALITY ANCHOR &middot; NFC
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
            color: 'rgba(255,255,255,0.50)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={14} />
          </button>
        </div>

        {/* Description */}
        <p style={{
          fontFamily: INTER, fontSize: 14, lineHeight: 1.7,
          color: 'rgba(200,210,235,0.65)', margin: '0 0 24px',
        }}>
          用 NFC 标签把现实物体连接到你的知识宇宙。手机轻触标签，即可跳转到对应的节点或星系。
        </p>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {STEPS.map((step, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 12,
              background: `${step.color}06`,
              border: `1px solid ${step.color}18`,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: `${step.color}10`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <step.icon size={16} color={step.color} />
              </div>
              <span style={{
                fontFamily: INTER, fontSize: 13, fontWeight: 500,
                color: 'rgba(225,235,255,0.80)',
              }}>
                {step.text}
              </span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={{
          height: 1, background: 'rgba(255,255,255,0.06)',
          margin: '0 0 16px',
        }} />

        {/* QR fallback */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 8,
        }}>
          <QrCode size={14} color="rgba(0,255,102,0.60)" />
          <span style={{
            fontFamily: INTER, fontSize: 13, color: 'rgba(200,210,235,0.55)',
          }}>
            桌面端推荐使用 QR 码，效果相同
          </span>
        </div>
      </div>
    </>,
    document.body,
  );
}
