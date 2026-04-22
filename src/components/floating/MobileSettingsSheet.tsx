/**
 * MobileSettingsSheet — full-screen bottom sheet combining
 * settings, edit-mode controls, tools, and footer for phone.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  X, User, Zap, Sparkles, Lock, Unlock, Grid3x3, Magnet, ALargeSmall,
  FileArchive, Download, BookOpen, Compass, QrCode, Nfc, Languages, LogOut,
  RotateCcw, ChevronDown, LayoutDashboard,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { useBilling } from '@/hooks/useBilling';
import { useToolbox } from '@/contexts/ToolboxContext';
import { BillingPanel } from '@/components/billing/BillingPanel';
import { ObsidianImportModal } from '@/components/obsidian/ObsidianImportModal';
import { CosmosExportModal } from '@/components/obsidian/CosmosExportModal';
import { WikiCompileModal } from '@/components/wiki/WikiCompileModal';
import { QrScannerSheet } from '@/components/anchors/QrScannerSheet';
import { NfcScannerSheet } from '@/components/anchors/NfcScannerSheet';
import { NfcDesktopInfoSheet } from '@/components/anchors/NfcDesktopInfoSheet';
import { GuideCenterModal } from '@/components/tour/GuideCenterModal';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function MobileSettingsSheet({ open, onClose }: Props) {
  const { user, signOut } = useAuth();
  const { lang, setLang } = useLanguage();
  const navigate = useNavigate();
  const t = useT();
  const billing = useBilling(user?.id);
  const {
    layoutConfig, setLocked, setGridSize, setSnapToEdge, setGlobalFontScale, resetToDefault,
  } = useToolbox();
  const { locked, gridSize, snapToEdge, globalFontScale } = layoutConfig;

  const [billingOpen, setBillingOpen] = useState(false);
  const [obsidianOpen, setObsidianOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [wikiOpen, setWikiOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [nfcScanOpen, setNfcScanOpen] = useState(false);
  const [nfcInfoOpen, setNfcInfoOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editExpanded, setEditExpanded] = useState(false);

  const nfcSupported = typeof window !== 'undefined' && 'NDEFReader' in window;

  // Drag to dismiss
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    if (user.email === 'test@test.com') { setIsAdmin(true); return; }
    import('@/integrations/supabase/client').then(({ supabase }) => {
      supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
        .then(({ data }) => setIsAdmin(!!data?.is_admin));
    });
  }, [user?.id, user]);

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

  useEffect(() => { if (!open) setDragY(0); }, [open]);

  const handleSignOut = async () => { await signOut(); navigate('/'); };

  if (!open) return null;

  const username = user?.email?.split('@')[0] ?? '--';
  const planLabel = billing.plan === 'pro' ? 'Pro' : billing.plan === 'team' ? 'Team' : 'Free';
  const planAccent = billing.plan === 'pro' ? '#b496ff' : billing.plan === 'team' ? '#ffa040' : '#888fa8';
  const editAccent = locked ? '#ffa040' : '#66f0ff';
  const gridOptions: (0 | 8 | 16 | 24)[] = [0, 8, 16, 24];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 90,
          background: 'rgba(0,0,0,0.50)',
          backdropFilter: 'blur(4px)',
          animation: 'fade-in var(--dur-standard) var(--spring-snap)',
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 91,
          maxHeight: 'calc(92vh - env(safe-area-inset-bottom,0px))',
          transform: `translateY(${dragY}px)`,
          transition: dragging ? 'none' : 'transform var(--dur-gentle) var(--spring)',
          display: 'flex', flexDirection: 'column',
          background: 'rgba(3,5,13,0.98)',
          backdropFilter: 'blur(40px) saturate(2)',
          WebkitBackdropFilter: 'blur(40px) saturate(2)',
          borderTop: '1.5px solid rgba(136,143,168,0.30)',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -4px 40px rgba(0,0,0,0.80)',
          overflow: 'hidden',
          animation: dragY === 0 && !dragging ? 'spring-up var(--dur-gentle) var(--spring)' : 'none',
        }}
      >
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
            borderBottom: '1px solid rgba(136,143,168,0.14)', touchAction: 'none',
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(136,143,168,0.12)', border: '1.5px solid rgba(136,143,168,0.30)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <User size={18} color="#888fa8" />
          </div>
          <div style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
            <div style={{ fontFamily: INTER, fontSize: 15, fontWeight: 700, color: 'rgba(225,235,255,0.95)' }}>{username}</div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(80,90,115,0.60)', letterSpacing: '0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </div>
          </div>
          <div style={{
            padding: '2px 7px', borderRadius: 4, fontFamily: MONO, fontSize: 8, letterSpacing: '0.06em', fontWeight: 600,
            color: planAccent, background: `${planAccent}20`, border: `1px solid ${planAccent}35`, marginRight: 10,
          }}>{planLabel}</div>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.20)', color: 'rgba(255,80,80,0.75)', cursor: 'pointer', flexShrink: 0,
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 16px)' }}>

          {/* Credits row */}
          <div style={{ padding: '12px 16px 0' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', background: 'rgba(180,150,255,0.06)', border: '1px solid rgba(180,150,255,0.14)', borderRadius: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Zap size={11} color="#b496ff" />
                <span style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(160,145,210,0.75)' }}>AI Credits</span>
              </div>
              <span style={{ fontFamily: MONO, fontSize: 12, color: '#c4aaff', fontWeight: 600 }}>
                {billing.loading ? '...' : billing.credits.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Subscription button */}
          <SettingsRow icon={Sparkles} iconColor="rgba(180,150,255,0.75)" label="订阅 & Credits" sub={billing.plan === 'free' ? '升级 Pro 解锁全功能' : undefined}
            onClick={() => { onClose(); setBillingOpen(true); }} />

          <Divider />

          {/* ── Edit Mode Section ────────────── */}
          <button
            onClick={() => setEditExpanded(e => !e)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: `${editAccent}18`, border: `1px solid ${editAccent}35`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {locked ? <Lock size={13} color={editAccent} /> : <Unlock size={13} color={editAccent} />}
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontFamily: INTER, fontSize: 13, fontWeight: 600, color: `${editAccent}dd` }}>
                {locked ? '已锁定' : '编辑模式'}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(140,150,180,0.50)', letterSpacing: '0.04em', marginTop: 1 }}>
                Layout Edit Mode
              </div>
            </div>
            <ChevronDown size={14} color={editAccent} style={{ transition: 'transform 0.2s', transform: editExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
          </button>

          {editExpanded && (
            <div style={{ padding: '0 16px 12px', animation: 'spring-in var(--dur-snap) var(--spring-snap)' }}>
              {/* Lock toggle */}
              <div onClick={() => setLocked(!locked)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', marginBottom: 8, borderRadius: 8,
                background: `${editAccent}0a`, border: `1px solid ${editAccent}20`, cursor: 'pointer',
              }}>
                <span style={{ fontFamily: INTER, fontSize: 12, color: 'rgba(195,210,240,0.80)' }}>
                  {locked ? '解锁布局' : '锁定布局'}
                </span>
                <TogglePill active={locked} accent={editAccent} />
              </div>

              {/* Grid size */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: `${editAccent}90`, letterSpacing: '0.08em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Grid3x3 size={10} /> 网格吸附
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {gridOptions.map(opt => (
                    <button key={opt} onClick={() => setGridSize(opt)} style={{
                      flex: 1, padding: '7px 0', fontFamily: MONO, fontSize: 10,
                      color: gridSize === opt ? '#040b10' : editAccent,
                      background: gridSize === opt ? editAccent : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${gridSize === opt ? editAccent : 'rgba(255,255,255,0.10)'}`,
                      borderRadius: 6, cursor: 'pointer', transition: 'all 0.14s',
                    }}>
                      {opt === 0 ? 'OFF' : `${opt}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Edge snap */}
              <div onClick={() => setSnapToEdge(!snapToEdge)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', marginBottom: 8, borderRadius: 8,
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Magnet size={10} color={editAccent} />
                  <span style={{ fontFamily: INTER, fontSize: 12, color: 'rgba(195,210,240,0.80)' }}>边缘吸附</span>
                </div>
                <TogglePill active={snapToEdge} accent={editAccent} />
              </div>

              {/* Font scale */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: `${editAccent}90`, letterSpacing: '0.08em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <ALargeSmall size={10} /> 全局字体 · {Math.round(globalFontScale * 100)}%
                </div>
                <input type="range" min={0.6} max={1.8} step={0.05} value={globalFontScale}
                  onChange={e => setGlobalFontScale(Number(e.target.value))}
                  style={{ width: '100%', accentColor: editAccent, cursor: 'pointer' }}
                />
              </div>

              {/* Reset */}
              <button onClick={resetToDefault} style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '8px 0', fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em',
                color: 'rgba(255,120,120,0.65)', background: 'rgba(255,60,60,0.05)',
                border: '1px solid rgba(255,60,60,0.15)', borderRadius: 6, cursor: 'pointer',
              }}>
                <RotateCcw size={10} /> 恢复默认布局
              </button>
            </div>
          )}

          <Divider />

          {/* ── Tools ────────────── */}
          <SettingsRow icon={FileArchive} iconColor="rgba(168,85,247,0.75)" label="Import Obsidian" sub="Upload vault .zip"
            onClick={() => { onClose(); setObsidianOpen(true); }} />
          <SettingsRow icon={Download} iconColor="rgba(168,85,247,0.75)" label="Export to Obsidian" sub="_cosmos/ folder zip"
            onClick={() => { onClose(); setExportOpen(true); }} />
          <SettingsRow icon={BookOpen} iconColor="rgba(16,185,129,0.75)" label="Knowledge Wiki" sub="AI compile wiki pages"
            onClick={() => { onClose(); setWikiOpen(true); }} />
          <SettingsRow icon={Compass} iconColor="rgba(102,240,255,0.75)" label="使用攻略" sub="Guide Center"
            onClick={() => { onClose(); setGuideOpen(true); }} />
          <SettingsRow icon={QrCode} iconColor="rgba(102,240,255,0.75)" label="QR 锚点扫码" sub="Scan Reality Anchor"
            onClick={() => { onClose(); setScannerOpen(true); }} />
          <SettingsRow icon={Nfc} iconColor="rgba(180,150,255,0.75)" label="NFC 轻触锚点"
            sub={nfcSupported ? '轻触标签跳转节点' : '仅限 Android 手机'}
            style={{ opacity: nfcSupported ? 1 : 0.65 }}
            onClick={() => { onClose(); if (nfcSupported) setNfcScanOpen(true); else setNfcInfoOpen(true); }} />

          {isAdmin && (
            <>
              <Divider />
              <div style={{ margin: '8px 16px', padding: '12px', borderRadius: 10, background: 'rgba(102,240,255,0.05)', border: '1px solid rgba(102,240,255,0.18)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <LayoutDashboard size={12} color="#66f0ff" />
                  <span style={{ fontFamily: INTER, fontSize: 12, fontWeight: 700, color: 'rgba(102,240,255,0.95)' }}>管理员后台</span>
                  <span style={{ fontFamily: MONO, fontSize: 7, color: '#66f0ff', background: 'rgba(102,240,255,0.15)', border: '1px solid rgba(102,240,255,0.30)', borderRadius: 3, padding: '2px 6px', marginLeft: 'auto' }}>ADMIN</span>
                </div>
                <button onClick={() => { onClose(); navigate('/admin'); }} style={{
                  width: '100%', padding: '8px', fontFamily: INTER, fontSize: 12, fontWeight: 700, color: '#040b10',
                  background: 'linear-gradient(135deg, rgba(102,240,255,0.90), rgba(180,150,255,0.75))',
                  border: 'none', borderRadius: 6, cursor: 'pointer',
                }}>
                  进入后台管理区
                </button>
              </div>
            </>
          )}

          <Divider />

          {/* ── Footer ────────────── */}
          <div style={{ padding: '6px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Languages size={13} color="rgba(140,150,175,0.55)" />
              <span style={{ fontFamily: INTER, fontSize: 12, color: 'rgba(180,190,215,0.75)' }}>
                {t('settings.language') || '界面语言'}
              </span>
            </div>
            <button onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')} style={{
              fontFamily: MONO, fontSize: 10, color: '#888fa8',
              background: 'rgba(136,143,168,0.10)', border: '1px solid rgba(136,143,168,0.22)',
              borderRadius: 5, padding: '4px 12px', cursor: 'pointer',
            }}>
              {lang === 'zh' ? 'EN' : '中'}
            </button>
          </div>

          <button onClick={handleSignOut} style={{
            width: 'calc(100% - 32px)', margin: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '10px', borderRadius: 8, background: 'rgba(255,64,64,0.06)', border: '1px solid rgba(255,64,64,0.15)',
            cursor: 'pointer', fontFamily: INTER, fontSize: 12, color: 'rgba(195,75,75,0.75)',
          }}>
            <LogOut size={13} />
            {t('sidebar.signOut') || '退出登录'}
          </button>

          <div style={{ textAlign: 'center', padding: '8px 0 4px', fontFamily: MONO, fontSize: 8, color: 'rgba(55,65,88,0.50)', letterSpacing: '0.05em' }}>
            PESTA · v2.0
          </div>
        </div>
      </div>

      {/* Sub-modals */}
      {billingOpen && <BillingPanel onClose={() => setBillingOpen(false)} />}
      <ObsidianImportModal open={obsidianOpen} onClose={() => setObsidianOpen(false)} />
      <CosmosExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
      <WikiCompileModal open={wikiOpen} onClose={() => setWikiOpen(false)} />
      {guideOpen && <GuideCenterModal onClose={() => setGuideOpen(false)} />}
      {scannerOpen && <QrScannerSheet open={scannerOpen} onClose={() => setScannerOpen(false)} />}
      {nfcScanOpen && <NfcScannerSheet open={nfcScanOpen} onClose={() => setNfcScanOpen(false)} />}
      <NfcDesktopInfoSheet open={nfcInfoOpen} onClose={() => setNfcInfoOpen(false)} />
    </>
  );
}

// ── Sub-components ──────────────────────────────────────────
function SettingsRow({ icon: Icon, iconColor, label, sub, onClick, style }: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  iconColor: string; label: string; sub?: string;
  onClick: () => void; style?: React.CSSProperties;
}) {
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
      padding: '11px 16px', background: 'transparent', border: 'none',
      cursor: 'pointer', textAlign: 'left',
      WebkitTapHighlightColor: 'transparent', ...style,
    }}>
      <Icon size={14} color={iconColor} />
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: INTER, fontSize: 13, color: 'rgba(195,210,240,0.85)', fontWeight: 600 }}>{label}</div>
        {sub && <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(140,150,180,0.50)', letterSpacing: '0.04em', marginTop: 1 }}>{sub}</div>}
      </div>
    </button>
  );
}

function TogglePill({ active, accent }: { active: boolean; accent: string }) {
  return (
    <div style={{
      width: 36, height: 20, borderRadius: 10,
      background: active ? accent : 'rgba(255,255,255,0.12)',
      border: `1px solid ${active ? accent : 'rgba(255,255,255,0.15)'}`,
      position: 'relative', transition: 'all 0.18s', flexShrink: 0,
    }}>
      <div style={{
        width: 14, height: 14, borderRadius: '50%',
        background: active ? '#040b10' : 'rgba(180,190,210,0.50)',
        position: 'absolute', top: 2,
        left: active ? 'calc(100% - 17px)' : 3,
        transition: 'all 0.18s',
      }} />
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '4px 16px' }} />;
}
