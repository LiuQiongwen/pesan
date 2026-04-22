/**
 * AnchorsManage — list & manage all reality anchors for the current user.
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  QrCode, Trash2, Copy, ExternalLink, Plus, Loader2,
  FileText, Orbit, LayoutDashboard, Globe, Nfc, ScanLine,
} from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { useDevice } from '@/hooks/useDevice';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

interface Anchor {
  id: string;
  name: string;
  label: string;
  description: string | null;
  anchor_type: string;
  target_type: string;
  target_id: string;
  anchor_slug: string;
  scan_count: number;
  created_at: string;
}

const TARGET_ICONS: Record<string, typeof FileText> = {
  note: FileText, galaxy: Orbit, workbench: LayoutDashboard, universe: Globe,
};

const TARGET_COLORS: Record<string, string> = {
  note: '#66f0ff', galaxy: '#ff9f43', workbench: '#a78bfa', universe: '#4ecdc4',
};

export default function AnchorsManage() {
  const navigate = useNavigate();
  const { isPhone } = useDevice();
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [qrCache, setQrCache] = useState<Record<string, string>>({});

  const loadAnchors = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate('/auth'); return; }

    const { data } = await supabase
      .from('reality_anchors')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    setAnchors((data as unknown as Anchor[]) || []);
    setLoading(false);
  }, [navigate]);

  useEffect(() => { loadAnchors(); }, [loadAnchors]);

  const generateQr = useCallback(async (slug: string) => {
    if (qrCache[slug]) return;
    const url = `${window.location.origin}/a/${slug}`;
    const dataUrl = await QRCode.toDataURL(url, {
      width: 512, margin: 2,
      color: { dark: '#e1ebffee', light: '#01040d00' },
      errorCorrectionLevel: 'H',
    });
    setQrCache(prev => ({ ...prev, [slug]: dataUrl }));
  }, [qrCache]);

  const handleExpand = useCallback((id: string, slug: string) => {
    const next = expandedId === id ? null : id;
    setExpandedId(next);
    if (next) generateQr(slug);
  }, [expandedId, generateQr]);

  const handleDelete = useCallback(async (id: string) => {
    const { error } = await supabase.from('reality_anchors').delete().eq('id', id);
    if (error) { toast.error('Delete failed'); return; }
    setAnchors(prev => prev.filter(a => a.id !== id));
    setExpandedId(null);
    toast.success('Anchor deleted');
  }, []);

  const handleCopy = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/a/${slug}`);
    toast.success('Link copied');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #01040d, #060e1f)',
      padding: isPhone ? '16px 12px env(safe-area-inset-bottom, 16px)' : '32px 24px',
    }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: INTER, fontSize: 20, fontWeight: 700, color: 'rgba(225,235,255,0.95)', margin: 0 }}>
              Reality Anchors
            </h1>
            <p style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(102,240,255,0.45)', letterSpacing: '0.06em', marginTop: 4 }}>
              {anchors.length} ANCHOR{anchors.length !== 1 ? 'S' : ''}
            </p>
          </div>
          <button onClick={() => navigate('/app')} style={{
            padding: '8px 16px',
            fontFamily: INTER, fontSize: 12, fontWeight: 600,
            color: '#66f0ff', background: 'rgba(102,240,255,0.08)',
            border: '1px solid rgba(102,240,255,0.25)',
            borderRadius: 8, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <Plus size={14} /> Create New
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <Loader2 size={28} color="#66f0ff" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : anchors.length === 0 ? (
          <div style={{
            padding: 40, textAlign: 'center',
            background: 'rgba(8,14,30,0.90)',
            border: '1px dashed rgba(102,240,255,0.20)',
            borderRadius: 16,
          }}>
            <QrCode size={40} color="rgba(102,240,255,0.30)" style={{ marginBottom: 12 }} />
            <p style={{ fontFamily: INTER, fontSize: 14, color: 'rgba(200,210,235,0.55)', margin: '0 0 16px' }}>
              No anchors yet. Create one from the star map.
            </p>
            <button onClick={() => navigate('/app')} style={{
              padding: '10px 20px',
              fontFamily: INTER, fontSize: 13, fontWeight: 600,
              color: '#66f0ff', background: 'rgba(102,240,255,0.10)',
              border: '1px solid rgba(102,240,255,0.25)',
              borderRadius: 10, cursor: 'pointer',
            }}>
              Go to Star Map
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {anchors.map(a => {
              const Icon = TARGET_ICONS[a.target_type] || QrCode;
              const color = TARGET_COLORS[a.target_type] || '#66f0ff';
              const expanded = expandedId === a.id;

              return (
                <div key={a.id} style={{
                  background: 'rgba(8,14,30,0.95)',
                  border: `1px solid ${expanded ? `${color}40` : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 14, overflow: 'hidden',
                  transition: 'border-color 0.2s',
                }}>
                  {/* Row */}
                  <button
                    onClick={() => handleExpand(a.id, a.anchor_slug)}
                    style={{
                      width: '100%', padding: '14px 16px',
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: `${color}15`, border: `1px solid ${color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={16} color={color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: INTER, fontSize: 13, fontWeight: 600,
                        color: 'rgba(225,235,255,0.90)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {a.name || a.label || 'Untitled'}
                      </div>
                      <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(160,180,220,0.45)', marginTop: 2, letterSpacing: '0.04em' }}>
                        /a/{a.anchor_slug} {a.anchor_type === 'nfc' ? '(NFC)' : '(QR)'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: MONO, fontSize: 10, color, fontWeight: 700 }}>
                        {a.scan_count} {a.scan_count === 1 ? 'scan' : 'scans'}
                      </div>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(160,180,220,0.35)', marginTop: 2 }}>
                        {new Date(a.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {expanded && (
                    <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      {/* QR preview */}
                      {qrCache[a.anchor_slug] && (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0' }}>
                          <div style={{
                            padding: 10, borderRadius: 12,
                            background: 'rgba(102,240,255,0.04)',
                            border: '1px solid rgba(102,240,255,0.12)',
                          }}>
                            <img src={qrCache[a.anchor_slug]} alt="QR" style={{ width: 120, height: 120, display: 'block' }} />
                          </div>
                        </div>
                      )}

                      {a.description && (
                        <p style={{ fontFamily: INTER, fontSize: 12, color: 'rgba(200,210,235,0.55)', margin: '0 0 12px', lineHeight: 1.4 }}>
                          {a.description}
                        </p>
                      )}

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <SmallBtn icon={Copy} label="Copy" onClick={() => handleCopy(a.anchor_slug)} />
                        <SmallBtn icon={ExternalLink} label="Open" onClick={() => window.open(`/a/${a.anchor_slug}`, '_blank')} />
                        <SmallBtn icon={Trash2} label="Delete" color="#ff4466" onClick={() => handleDelete(a.id)} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SmallBtn({ icon: Icon, label, color, onClick }: {
  icon: typeof Copy; label: string; color?: string; onClick: () => void;
}) {
  const c = color || 'rgba(200,210,235,0.65)';
  return (
    <button onClick={onClick} style={{
      padding: '6px 12px',
      fontFamily: "'Inter',system-ui,sans-serif", fontSize: 11, fontWeight: 600,
      color: c, background: `${c}10`, border: `1px solid ${c}25`,
      borderRadius: 8, cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 5,
    }}>
      <Icon size={12} /> {label}
    </button>
  );
}
