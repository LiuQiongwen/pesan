/**
 * CreateAnchorModal — create a QR Reality Anchor for a note, tag, or universe.
 * Renders as centered modal on desktop, drag-to-dismiss bottom sheet on phone.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, QrCode, Download, Copy, Check, Nfc, Smartphone, ScanLine, Printer, ArrowRight } from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNfc } from '@/hooks/useNfc';
import { NfcWriterSheet } from '@/components/anchors/NfcWriterSheet';
import { useDevice } from '@/hooks/useDevice';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

type AnchorType = 'note' | 'tag' | 'universe';

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  universeId: string;
  /** Pre-fill anchor type + target */
  defaultType?: AnchorType;
  defaultTargetId?: string;
  defaultLabel?: string;
}

export function CreateAnchorModal({
  open, onClose, userId, universeId,
  defaultType = 'note', defaultTargetId = '', defaultLabel = '',
}: Props) {
  const [anchorType, setAnchorType] = useState<AnchorType>(defaultType);
  const [targetId, setTargetId] = useState(defaultTargetId);
  const [label, setLabel] = useState(defaultLabel);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [anchorUrl, setAnchorUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [nfcWriteOpen, setNfcWriteOpen] = useState(false);
  const nfc = useNfc();
  const { isPhone } = useDevice();

  // Drag-to-dismiss (phone only)
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);

  // Reset on open
  useEffect(() => {
    if (open) {
      setAnchorType(defaultType);
      setTargetId(defaultTargetId);
      setLabel(defaultLabel);
      setQrDataUrl('');
      setAnchorUrl('');
      setCopied(false);
      setDragY(0);
    }
  }, [open, defaultType, defaultTargetId, defaultLabel]);

  const handleCreate = useCallback(async () => {
    if (!label.trim()) { toast.error('Please enter a label'); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from('reality_anchors')
      .insert({
        user_id: userId,
        universe_id: universeId,
        anchor_type: anchorType,
        target_id: targetId || universeId,
        label: label.trim(),
      })
      .select('id')
      .single();

    if (error || !data) {
      toast.error('Failed to create anchor');
      setSaving(false);
      return;
    }

    const url = `${window.location.origin}/anchor/${data.id}`;
    setAnchorUrl(url);

    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 512,
        margin: 2,
        color: { dark: '#e1ebffee', light: '#01040d00' },
        errorCorrectionLevel: 'H',
      });
      setQrDataUrl(dataUrl);
    } catch {
      toast.error('QR generation failed');
    }
    setSaving(false);
  }, [userId, universeId, anchorType, targetId, label]);

  const handleCopy = () => {
    navigator.clipboard.writeText(anchorUrl);
    setCopied(true);
    toast.success('Link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `anchor-${label.trim().replace(/\s+/g, '-')}.png`;
    a.click();
  };

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    setDragging(true);
  }, []);
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging) return;
    setDragY(Math.max(0, e.touches[0].clientY - startY.current));
  }, [dragging]);
  const onTouchEnd = useCallback(() => {
    setDragging(false);
    if (dragY > 120) { onClose(); setDragY(0); } else { setDragY(0); }
  }, [dragY, onClose]);

  if (!open) return null;

  // ── Shared content ────────────────────────────────────
  const content = (
    <>
      {!qrDataUrl ? (
        <>
          {/* Step Guide */}
          <StepGuide />

          {/* Label input */}
          <label style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(160,180,220,0.60)', letterSpacing: '0.08em' }}>
            LABEL
          </label>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g. AI Papers Folder"
            style={{
              width: '100%', padding: '10px 12px', marginTop: 6, marginBottom: 16,
              fontFamily: INTER, fontSize: 14,
              color: 'rgba(225,235,255,0.90)',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, outline: 'none',
            }}
          />

          {/* Type selector */}
          <label style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(160,180,220,0.60)', letterSpacing: '0.08em' }}>
            ANCHOR TYPE
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, marginBottom: 20 }}>
            {(['note', 'tag', 'universe'] as AnchorType[]).map(t => (
              <button
                key={t}
                onClick={() => setAnchorType(t)}
                style={{
                  flex: 1, padding: '8px 0',
                  fontFamily: MONO, fontSize: 11, fontWeight: 600,
                  color: anchorType === t ? '#66f0ff' : 'rgba(200,210,235,0.50)',
                  background: anchorType === t ? 'rgba(102,240,255,0.12)' : 'rgba(255,255,255,0.03)',
                  border: anchorType === t ? '1px solid rgba(102,240,255,0.35)' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8, cursor: 'pointer',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  transition: 'all 0.15s',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Create button */}
          <button
            onClick={handleCreate}
            disabled={saving || !label.trim()}
            style={{
              width: '100%', padding: '12px 0',
              fontFamily: INTER, fontSize: 14, fontWeight: 700,
              color: saving ? 'rgba(225,235,255,0.40)' : '#01040d',
              background: saving ? 'rgba(102,240,255,0.15)' : 'linear-gradient(135deg, #66f0ff, #4ecdc4)',
              border: 'none', borderRadius: 10,
              cursor: saving ? 'default' : 'pointer',
              boxShadow: saving ? 'none' : '0 4px 16px rgba(102,240,255,0.25)',
            }}
          >
            {saving ? 'Creating...' : 'Generate QR Anchor'}
          </button>
        </>
      ) : (
        <>
          {/* QR display */}
          <div style={{
            display: 'flex', justifyContent: 'center',
            padding: isPhone ? '12px 0 8px' : '16px 0 12px',
          }}>
            <div style={{
              padding: isPhone ? 12 : 16, borderRadius: 16,
              background: 'rgba(102,240,255,0.05)',
              border: '1px solid rgba(102,240,255,0.15)',
            }}>
              <img src={qrDataUrl} alt="QR" style={{ width: isPhone ? 160 : 200, height: isPhone ? 160 : 200, display: 'block' }} />
            </div>
          </div>

          {/* Usage guide */}
          <div style={{
            margin: '8px 0 16px', padding: '10px 14px',
            background: 'rgba(102,240,255,0.04)',
            border: '1px solid rgba(102,240,255,0.10)',
            borderRadius: 10,
          }}>
            <p style={{
              fontFamily: INTER, fontSize: 12, fontWeight: 600,
              color: 'rgba(102,240,255,0.75)', margin: '0 0 8px',
            }}>
              如何使用这个锚点？
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { step: '1', text: '下载二维码图片，打印后贴到书本/物品/墙壁上' },
                { step: '2', text: '用手机摄像头扫码，或在设置中使用 QR 扫码器' },
                { step: '3', text: '扫码后自动跳转到对应的知识节点' },
              ].map(item => (
                <div key={item.step} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                    background: 'rgba(102,240,255,0.12)',
                    fontFamily: MONO, fontSize: 9, fontWeight: 700,
                    color: '#66f0ff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{item.step}</div>
                  <span style={{
                    fontFamily: INTER, fontSize: 11, lineHeight: 1.4,
                    color: 'rgba(200,210,235,0.65)',
                  }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleDownload} style={{
              flex: 1, padding: '10px 0',
              fontFamily: INTER, fontSize: 13, fontWeight: 600,
              color: '#66f0ff', background: 'rgba(102,240,255,0.08)',
              border: '1px solid rgba(102,240,255,0.25)',
              borderRadius: 10, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Download size={14} /> 下载
            </button>
            <button onClick={handleCopy} style={{
              flex: 1, padding: '10px 0',
              fontFamily: INTER, fontSize: 13, fontWeight: 600,
              color: copied ? '#00ff66' : 'rgba(225,235,255,0.75)',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? '已复制' : '复制链接'}
            </button>
          </div>

          {/* NFC section */}
          {nfc.supported ? (
            <button onClick={() => setNfcWriteOpen(true)} style={{
              width: '100%', marginTop: 10, padding: '10px 0',
              fontFamily: INTER, fontSize: 13, fontWeight: 600,
              color: 'rgba(180,150,255,0.85)',
              background: 'rgba(180,150,255,0.08)',
              border: '1px solid rgba(180,150,255,0.25)',
              borderRadius: 10, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Nfc size={14} /> 写入 NFC 标签
            </button>
          ) : (
            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 10,
              background: 'rgba(180,150,255,0.04)',
              border: '1px solid rgba(180,150,255,0.10)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <Smartphone size={16} color="rgba(180,150,255,0.50)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontFamily: INTER, fontSize: 12, fontWeight: 600, color: 'rgba(180,150,255,0.65)' }}>
                  NFC 标签？用手机写入
                </div>
                <div style={{ fontFamily: INTER, fontSize: 11, color: 'rgba(160,170,200,0.40)', marginTop: 2, lineHeight: 1.4 }}>
                  NFC 写入需要 Android 手机，在手机端打开此锚点即可操作
                </div>
              </div>
            </div>
          )}

          {/* NFC Writer Sheet */}
          <NfcWriterSheet
            open={nfcWriteOpen}
            onClose={() => setNfcWriteOpen(false)}
            anchorId={anchorUrl.split('/').pop() || ''}
            label={label}
          />
        </>
      )}
    </>
  );

  // ── Phone: bottom sheet ────────────────────────────────
  if (isPhone) {
    return createPortal(
      <>
        {/* Backdrop */}
        <div onClick={onClose} style={{
          position: 'fixed', inset: 0, zIndex: 9990,
          background: 'rgba(0,0,0,0.50)',
          backdropFilter: 'blur(4px)',
          animation: 'fade-in var(--dur-standard) var(--spring-snap)',
        }} />

        {/* Bottom sheet */}
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9991,
          maxHeight: 'calc(92vh - env(safe-area-inset-bottom, 0px))',
          transform: `translateY(${dragY}px)`,
          transition: dragging ? 'none' : 'transform var(--dur-gentle) var(--spring)',
          display: 'flex', flexDirection: 'column',
          background: 'rgba(3,5,13,0.98)',
          backdropFilter: 'blur(40px) saturate(2)',
          WebkitBackdropFilter: 'blur(40px) saturate(2)',
          borderTop: '1.5px solid rgba(102,240,255,0.30)',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -4px 40px rgba(0,0,0,0.80), 0 0 40px rgba(102,240,255,0.08)',
          overflow: 'hidden',
          animation: dragY === 0 && !dragging ? 'spring-up var(--dur-gentle) var(--spring)' : 'none',
        }}>
          {/* Drag handle */}
          <div
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
            style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px', cursor: 'grab', touchAction: 'none' }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }} />
          </div>

          {/* Title bar */}
          <div
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
            style={{
              display: 'flex', alignItems: 'center', padding: '4px 16px 12px',
              borderBottom: '1px solid rgba(102,240,255,0.14)',
              background: 'linear-gradient(90deg, rgba(102,240,255,0.10), rgba(102,240,255,0.03) 60%, rgba(255,255,255,0.02))',
              touchAction: 'none',
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(102,240,255,0.12)', border: '1.5px solid rgba(102,240,255,0.30)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: '0 0 14px rgba(102,240,255,0.20)',
            }}>
              <QrCode size={18} color="#66f0ff" style={{ filter: 'drop-shadow(0 0 5px rgba(102,240,255,0.70))' }} />
            </div>
            <div style={{ flex: 1, marginLeft: 12 }}>
              <div style={{ fontFamily: INTER, fontSize: 15, fontWeight: 700, color: 'rgba(225,235,255,0.95)' }}>
                {qrDataUrl ? '锚点已创建' : '创建现实锚点'}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(102,240,255,0.45)', letterSpacing: '0.04em', marginTop: 2 }}>
                REALITY ANCHOR
              </div>
            </div>
            <button onClick={onClose} style={{
              width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.20)',
              color: 'rgba(255,80,80,0.75)', cursor: 'pointer', flexShrink: 0,
            }}>
              <X size={16} />
            </button>
          </div>

          {/* Scrollable body */}
          <div style={{
            flex: 1, overflowY: 'auto', overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch', padding: '16px 16px calc(env(safe-area-inset-bottom, 0px) + 16px)',
          }}>
            {content}
          </div>

          {/* Bottom accent line */}
          <div style={{
            height: 2, flexShrink: 0,
            background: 'linear-gradient(90deg, transparent, #66f0ff, transparent)',
            boxShadow: '0 0 12px rgba(102,240,255,0.50)',
          }} />
        </div>
      </>,
      document.body,
    );
  }

  // ── Desktop: centered modal ────────────────────────────
  return createPortal(
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 9990,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)', zIndex: 9991,
        width: 'calc(100% - 32px)', maxWidth: 400,
        background: 'rgba(5,10,24,0.98)',
        border: '1px solid rgba(102,240,255,0.20)',
        borderRadius: 20, padding: 24,
        boxShadow: '0 0 60px rgba(0,0,0,0.60)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <QrCode size={20} color="#66f0ff" style={{ marginRight: 10 }} />
          <span style={{ fontFamily: INTER, fontSize: 16, fontWeight: 700, color: 'rgba(225,235,255,0.95)', flex: 1 }}>
            {qrDataUrl ? 'Anchor Created' : 'Create Reality Anchor'}
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

        {content}
      </div>
    </>,
    document.body,
  );
}

// ── Step Guide sub-component ─────────────────────────────
function StepGuide() {
  const steps = [
    { icon: QrCode, label: '创建', desc: '生成二维码' },
    { icon: Printer, label: '部署', desc: '打印/NFC' },
    { icon: ScanLine, label: '使用', desc: '扫码直达' },
  ];
  return (
    <div style={{
      display: 'flex', gap: 6, marginBottom: 18, padding: '10px 12px',
      background: 'rgba(102,240,255,0.04)',
      border: '1px solid rgba(102,240,255,0.10)',
      borderRadius: 10,
    }}>
      {steps.map((step, i) => (
        <div key={step.label} style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          position: 'relative',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(102,240,255,0.10)',
            border: '1px solid rgba(102,240,255,0.20)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <step.icon size={13} color="#66f0ff" />
          </div>
          <span style={{ fontFamily: INTER, fontSize: 10, fontWeight: 700, color: 'rgba(102,240,255,0.80)' }}>
            {step.label}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(160,180,220,0.45)', letterSpacing: '0.03em' }}>
            {step.desc}
          </span>
          {i < 2 && (
            <ArrowRight size={10} color="rgba(102,240,255,0.25)" style={{
              position: 'absolute', right: -8, top: 8,
            }} />
          )}
        </div>
      ))}
    </div>
  );
}
