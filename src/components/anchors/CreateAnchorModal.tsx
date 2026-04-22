/**
 * CreateAnchorModal — create a QR / NFC Reality Anchor.
 * Supports 5 target types: note, galaxy, project, workbench, universe.
 * Renders as centered modal on desktop, drag-to-dismiss bottom sheet on phone.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, QrCode, Download, Copy, Check, Nfc, Smartphone,
  ScanLine, Printer, ArrowRight, FileText, Orbit, FolderKanban, LayoutDashboard, Globe,
} from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNfc } from '@/hooks/useNfc';
import { NfcWriterSheet } from '@/components/anchors/NfcWriterSheet';
import { useDevice } from '@/hooks/useDevice';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

export type TargetType = 'note' | 'galaxy' | 'project' | 'workbench' | 'universe';
type AnchorMedium = 'qr' | 'nfc';

const TARGET_TYPES: { id: TargetType; label: string; icon: typeof FileText }[] = [
  { id: 'note',      label: '节点',   icon: FileText },
  { id: 'galaxy',    label: '星系',   icon: Orbit },
  { id: 'workbench', label: '工作台', icon: LayoutDashboard },
  { id: 'universe',  label: '宇宙',   icon: Globe },
];

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  universeId: string;
  defaultTargetType?: TargetType;
  defaultTargetId?: string;
  defaultName?: string;
}

export function CreateAnchorModal({
  open, onClose, userId, universeId,
  defaultTargetType = 'note', defaultTargetId = '', defaultName = '',
}: Props) {
  const [targetType, setTargetType] = useState<TargetType>(defaultTargetType);
  const [targetId, setTargetId] = useState(defaultTargetId);
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  const [medium, setMedium] = useState<AnchorMedium>('qr');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [anchorUrl, setAnchorUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [nfcWriteOpen, setNfcWriteOpen] = useState(false);
  const [anchorSlug, setAnchorSlug] = useState('');
  const nfc = useNfc();
  const { isPhone } = useDevice();

  // Drag-to-dismiss (phone)
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);

  useEffect(() => {
    if (open) {
      setTargetType(defaultTargetType);
      setTargetId(defaultTargetId);
      setName(defaultName);
      setDescription('');
      setMedium('qr');
      setQrDataUrl('');
      setAnchorUrl('');
      setAnchorSlug('');
      setCopied(false);
      setDragY(0);
    }
  }, [open, defaultTargetType, defaultTargetId, defaultName]);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) { toast.error('Please enter a name'); return; }
    setSaving(true);

    const resolvedTarget = targetType === 'universe' ? universeId : targetId;
    if (!resolvedTarget) { toast.error('Please select a target'); setSaving(false); return; }

    const { data, error } = await supabase
      .from('reality_anchors')
      .insert({
        user_id: userId,
        universe_id: universeId,
        anchor_type: medium,
        target_type: targetType,
        target_id: resolvedTarget,
        name: name.trim(),
        label: name.trim(),
        description: description.trim() || null,
      })
      .select('id, anchor_slug')
      .single();

    if (error || !data) {
      toast.error('Failed to create anchor');
      setSaving(false);
      return;
    }

    const slug = (data as { id: string; anchor_slug: string }).anchor_slug;
    setAnchorSlug(slug);
    const url = `${window.location.origin}/a/${slug}`;
    setAnchorUrl(url);

    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 512, margin: 2,
        color: { dark: '#e1ebffee', light: '#01040d00' },
        errorCorrectionLevel: 'H',
      });
      setQrDataUrl(dataUrl);
    } catch {
      toast.error('QR generation failed');
    }
    setSaving(false);
  }, [userId, universeId, targetType, targetId, name, description, medium]);

  const handleCopy = () => {
    navigator.clipboard.writeText(anchorUrl);
    setCopied(true);
    toast.success('Link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `anchor-${name.trim().replace(/\s+/g, '-')}.png`;
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

  // ── Form content ──────────────────────────────────────
  const formContent = (
    <>
      <StepGuide />

      {/* Name */}
      <FieldLabel text="NAME" />
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="e.g. AI Papers Folder"
        style={inputStyle}
      />

      {/* Target Type */}
      <FieldLabel text="TARGET TYPE" />
      <div style={{ display: 'flex', gap: 6, marginTop: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {TARGET_TYPES.map(t => {
          const active = targetType === t.id;
          return (
            <button
              key={t.id}
              onClick={() => { setTargetType(t.id); if (t.id === 'universe') setTargetId(universeId); }}
              style={{
                flex: '1 1 auto', minWidth: 70, padding: '8px 4px',
                fontFamily: INTER, fontSize: 11, fontWeight: 600,
                color: active ? '#66f0ff' : 'rgba(200,210,235,0.50)',
                background: active ? 'rgba(102,240,255,0.12)' : 'rgba(255,255,255,0.03)',
                border: active ? '1px solid rgba(102,240,255,0.35)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                transition: 'all 0.15s',
              }}
            >
              <t.icon size={12} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Target ID (hidden when universe — auto-filled) */}
      {targetType !== 'universe' && (
        <>
          <FieldLabel text="TARGET ID" />
          <input
            value={targetId}
            onChange={e => setTargetId(e.target.value)}
            placeholder={targetType === 'note' ? 'Node ID (auto-filled from menu)' : targetType === 'galaxy' ? 'Galaxy tag name' : 'Workbench ID'}
            disabled={!!defaultTargetId}
            style={{ ...inputStyle, opacity: defaultTargetId ? 0.6 : 1 }}
          />
        </>
      )}

      {/* Description */}
      <FieldLabel text="DESCRIPTION (OPTIONAL)" />
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Describe the physical object this anchor is attached to..."
        rows={2}
        style={{ ...inputStyle, resize: 'vertical', minHeight: 48 }}
      />

      {/* Medium selector */}
      <FieldLabel text="ANCHOR MEDIUM" />
      <div style={{ display: 'flex', gap: 8, marginTop: 6, marginBottom: 20 }}>
        {([{ id: 'qr' as const, label: 'QR Code', icon: QrCode }, { id: 'nfc' as const, label: 'NFC', icon: Nfc }]).map(m => {
          const active = medium === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setMedium(m.id)}
              style={{
                flex: 1, padding: '8px 0',
                fontFamily: MONO, fontSize: 11, fontWeight: 600,
                color: active ? '#66f0ff' : 'rgba(200,210,235,0.50)',
                background: active ? 'rgba(102,240,255,0.12)' : 'rgba(255,255,255,0.03)',
                border: active ? '1px solid rgba(102,240,255,0.35)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                transition: 'all 0.15s',
              }}
            >
              <m.icon size={13} />
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Create button */}
      <button
        onClick={handleCreate}
        disabled={saving || !name.trim()}
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
        {saving ? 'Creating...' : 'Generate Anchor'}
      </button>
    </>
  );

  // ── Result content ────────────────────────────────────
  const resultContent = (
    <>
      {/* QR display */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: isPhone ? '12px 0 8px' : '16px 0 12px' }}>
        <div style={{
          padding: isPhone ? 12 : 16, borderRadius: 16,
          background: 'rgba(102,240,255,0.05)',
          border: '1px solid rgba(102,240,255,0.15)',
        }}>
          <img src={qrDataUrl} alt="QR" style={{ width: isPhone ? 160 : 200, height: isPhone ? 160 : 200, display: 'block' }} />
        </div>
      </div>

      {/* Slug badge */}
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <span style={{
          fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em',
          color: 'rgba(102,240,255,0.65)',
          background: 'rgba(102,240,255,0.08)',
          border: '1px solid rgba(102,240,255,0.18)',
          borderRadius: 6, padding: '3px 10px',
        }}>
          /a/{anchorSlug}
        </span>
      </div>

      {/* Usage guide */}
      <div style={{
        margin: '8px 0 16px', padding: '10px 14px',
        background: 'rgba(102,240,255,0.04)',
        border: '1px solid rgba(102,240,255,0.10)',
        borderRadius: 10,
      }}>
        <p style={{ fontFamily: INTER, fontSize: 12, fontWeight: 600, color: 'rgba(102,240,255,0.75)', margin: '0 0 8px' }}>
          How to use this anchor?
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { step: '1', text: 'Download QR image, print and attach to book/object/wall' },
            { step: '2', text: 'Scan with phone camera or use built-in QR scanner' },
            { step: '3', text: 'Automatically redirects to the linked knowledge region' },
          ].map(item => (
            <div key={item.step} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div style={{
                width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                background: 'rgba(102,240,255,0.12)',
                fontFamily: MONO, fontSize: 9, fontWeight: 700, color: '#66f0ff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{item.step}</div>
              <span style={{ fontFamily: INTER, fontSize: 11, lineHeight: 1.4, color: 'rgba(200,210,235,0.65)' }}>{item.text}</span>
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
          border: '1px solid rgba(102,240,255,0.25)', borderRadius: 10, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Download size={14} /> Download
        </button>
        <button onClick={handleCopy} style={{
          flex: 1, padding: '10px 0',
          fontFamily: INTER, fontSize: 13, fontWeight: 600,
          color: copied ? '#00ff66' : 'rgba(225,235,255,0.75)',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy Link'}
        </button>
      </div>

      {/* NFC section */}
      {nfc.supported ? (
        <button onClick={() => setNfcWriteOpen(true)} style={{
          width: '100%', marginTop: 10, padding: '10px 0',
          fontFamily: INTER, fontSize: 13, fontWeight: 600,
          color: 'rgba(180,150,255,0.85)', background: 'rgba(180,150,255,0.08)',
          border: '1px solid rgba(180,150,255,0.25)', borderRadius: 10, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Nfc size={14} /> Write NFC Tag
        </button>
      ) : (
        <div style={{
          marginTop: 12, padding: '10px 14px', borderRadius: 10,
          background: 'rgba(180,150,255,0.04)', border: '1px solid rgba(180,150,255,0.10)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Smartphone size={16} color="rgba(180,150,255,0.50)" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: INTER, fontSize: 12, fontWeight: 600, color: 'rgba(180,150,255,0.65)' }}>
              NFC Tag? Use your phone
            </div>
            <div style={{ fontFamily: INTER, fontSize: 11, color: 'rgba(160,170,200,0.40)', marginTop: 2, lineHeight: 1.4 }}>
              NFC writing requires Android. Open this anchor on mobile to write.
            </div>
          </div>
        </div>
      )}

      <NfcWriterSheet
        open={nfcWriteOpen}
        onClose={() => setNfcWriteOpen(false)}
        anchorId={anchorSlug}
        label={name}
      />
    </>
  );

  const content = qrDataUrl ? resultContent : formContent;

  // ── Phone: bottom sheet ────────────────────────────────
  if (isPhone) {
    return createPortal(
      <>
        <div onClick={onClose} style={{
          position: 'fixed', inset: 0, zIndex: 9990,
          background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)',
        }} />
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9991,
          maxHeight: 'calc(92vh - env(safe-area-inset-bottom, 0px))',
          transform: `translateY(${dragY}px)`,
          transition: dragging ? 'none' : 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
          display: 'flex', flexDirection: 'column',
          background: 'rgba(3,5,13,0.98)',
          backdropFilter: 'blur(40px) saturate(2)',
          WebkitBackdropFilter: 'blur(40px) saturate(2)',
          borderTop: '1.5px solid rgba(102,240,255,0.30)',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -4px 40px rgba(0,0,0,0.80), 0 0 40px rgba(102,240,255,0.08)',
          overflow: 'hidden',
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
              <QrCode size={18} color="#66f0ff" />
            </div>
            <div style={{ flex: 1, marginLeft: 12 }}>
              <div style={{ fontFamily: INTER, fontSize: 15, fontWeight: 700, color: 'rgba(225,235,255,0.95)' }}>
                {qrDataUrl ? 'Anchor Created' : 'Create Reality Anchor'}
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
            WebkitOverflowScrolling: 'touch',
            padding: '16px 16px calc(env(safe-area-inset-bottom, 0px) + 16px)',
          }}>
            {content}
          </div>

          <div style={{ height: 2, flexShrink: 0, background: 'linear-gradient(90deg, transparent, #66f0ff, transparent)', boxShadow: '0 0 12px rgba(102,240,255,0.50)' }} />
        </div>
      </>,
      document.body,
    );
  }

  // ── Desktop: centered modal ────────────────────────────
  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9990, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)', zIndex: 9991,
        width: 'calc(100% - 32px)', maxWidth: 440,
        maxHeight: '90vh', overflowY: 'auto',
        background: 'rgba(5,10,24,0.98)',
        border: '1px solid rgba(102,240,255,0.20)',
        borderRadius: 20, padding: 24,
        boxShadow: '0 0 60px rgba(0,0,0,0.60)',
      }}>
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

// ── Shared helpers ───────────────────────────────────────
function FieldLabel({ text }: { text: string }) {
  return (
    <label style={{ fontFamily: "'IBM Plex Mono','Roboto Mono',monospace", fontSize: 10, color: 'rgba(160,180,220,0.60)', letterSpacing: '0.08em' }}>
      {text}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', marginTop: 6, marginBottom: 14,
  fontFamily: "'Inter',system-ui,sans-serif", fontSize: 14,
  color: 'rgba(225,235,255,0.90)',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10, outline: 'none',
};

function StepGuide() {
  const steps = [
    { icon: QrCode, label: 'Create', desc: 'Generate QR' },
    { icon: Printer, label: 'Deploy', desc: 'Print/NFC' },
    { icon: ScanLine, label: 'Use', desc: 'Scan to enter' },
  ];
  return (
    <div style={{
      display: 'flex', gap: 6, marginBottom: 18, padding: '10px 12px',
      background: 'rgba(102,240,255,0.04)', border: '1px solid rgba(102,240,255,0.10)', borderRadius: 10,
    }}>
      {steps.map((step, i) => (
        <div key={step.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative' }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(102,240,255,0.10)', border: '1px solid rgba(102,240,255,0.20)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <step.icon size={13} color="#66f0ff" />
          </div>
          <span style={{ fontFamily: "'Inter',system-ui,sans-serif", fontSize: 10, fontWeight: 700, color: 'rgba(102,240,255,0.80)' }}>{step.label}</span>
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: 'rgba(160,180,220,0.45)', letterSpacing: '0.03em' }}>{step.desc}</span>
          {i < 2 && <ArrowRight size={10} color="rgba(102,240,255,0.25)" style={{ position: 'absolute', right: -8, top: 8 }} />}
        </div>
      ))}
    </div>
  );
}
