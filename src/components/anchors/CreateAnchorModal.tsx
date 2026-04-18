/**
 * CreateAnchorModal — create a QR Reality Anchor for a note, tag, or universe.
 */
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, QrCode, Download, Copy, Check, Nfc, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNfc } from '@/hooks/useNfc';
import { NfcWriterSheet } from '@/components/anchors/NfcWriterSheet';

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

  // Reset on open
  useEffect(() => {
    if (open) {
      setAnchorType(defaultType);
      setTargetId(defaultTargetId);
      setLabel(defaultLabel);
      setQrDataUrl('');
      setAnchorUrl('');
      setCopied(false);
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

        {!qrDataUrl ? (
          <>
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
              padding: '16px 0 12px',
            }}>
              <div style={{
                padding: 16, borderRadius: 16,
                background: 'rgba(102,240,255,0.05)',
                border: '1px solid rgba(102,240,255,0.15)',
              }}>
                <img src={qrDataUrl} alt="QR" style={{ width: 200, height: 200, display: 'block' }} />
              </div>
            </div>

            <p style={{
              fontFamily: INTER, fontSize: 13, color: 'rgba(200,210,235,0.55)',
              textAlign: 'center', margin: '8px 0 20px',
            }}>
              打印此二维码并贴到现实物体上
            </p>

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
      </div>
    </>,
    document.body,
  );
}
