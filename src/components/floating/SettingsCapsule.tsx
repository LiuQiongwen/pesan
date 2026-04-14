import { useState, useRef, useEffect } from 'react';
import { Settings, User, Languages, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";
const GREY = '#888fa8';

export function SettingsCapsule() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();
  const { lang, setLang } = useLanguage();
  const navigate = useNavigate();
  const t = useT();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const username = user?.email?.split('@')[0] ?? '—';

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: 18,
        right: 18,
        zIndex: 40,
      }}
    >
      {/* Gear trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Settings"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '6px 10px',
          background: open ? 'rgba(136,143,168,0.14)' : 'rgba(5,7,12,0.72)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: `1px solid ${open ? 'rgba(136,143,168,0.35)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 8,
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          if (!open) {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(136,143,168,0.09)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(136,143,168,0.22)';
          }
        }}
        onMouseLeave={e => {
          if (!open) {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(5,7,12,0.72)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)';
          }
        }}
      >
        <Settings size={12} color={open ? GREY : 'rgba(100,108,130,0.65)'} />
        <span style={{
          fontFamily: MONO, fontSize: 9, letterSpacing: '0.06em',
          color: open ? GREY : 'rgba(90,100,125,0.55)',
        }}>
          {username}
        </span>
        <ChevronDown
          size={9}
          color={open ? GREY : 'rgba(80,90,115,0.45)'}
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          width: 260,
          background: 'rgba(5,7,12,0.94)',
          backdropFilter: 'blur(24px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
          border: '1px solid rgba(136,143,168,0.22)',
          borderRadius: 10,
          boxShadow: '0 0 0 1px rgba(136,143,168,0.08), 0 16px 48px rgba(0,0,0,0.80)',
          animation: 'toolbox-in 0.15s cubic-bezier(0.16,1,0.3,1)',
          overflow: 'hidden',
        }}>
          {/* User block */}
          <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'rgba(136,143,168,0.12)',
                border: '1px solid rgba(136,143,168,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <User size={13} color={GREY} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: INTER, fontSize: 12, fontWeight: 600, color: 'rgba(220,228,245,0.90)' }}>
                  {username}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(80,90,115,0.60)', letterSpacing: '0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.email}
                </div>
              </div>
            </div>
          </div>

          {/* Language */}
          <div style={{ padding: '4px 6px' }}>
            <div style={rowStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Languages size={12} color="rgba(140,150,175,0.55)" />
                <span style={{ fontFamily: INTER, fontSize: 11, color: 'rgba(180,190,215,0.75)' }}>
                  {t('settings.language') || '界面语言'}
                </span>
              </div>
              <button
                onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
                style={{
                  fontFamily: MONO, fontSize: 9, letterSpacing: '0.06em',
                  color: GREY,
                  background: 'rgba(136,143,168,0.10)',
                  border: '1px solid rgba(136,143,168,0.22)',
                  borderRadius: 5, padding: '3px 10px',
                  cursor: 'pointer', transition: 'all 0.12s',
                }}
              >
                {lang === 'zh' ? 'EN' : '中'}
              </button>
            </div>

            <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '3px 0' }} />

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', borderRadius: 6,
                background: 'transparent', border: 'none',
                cursor: 'pointer', transition: 'background 0.12s', textAlign: 'left',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,64,64,0.07)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <LogOut size={12} color="rgba(210,70,70,0.65)" />
              <span style={{ fontFamily: INTER, fontSize: 11, color: 'rgba(195,75,75,0.75)' }}>
                {t('sidebar.signOut') || '退出登录'}
              </span>
            </button>
          </div>

          {/* Footer */}
          <div style={{ padding: '5px 14px 8px', fontFamily: MONO, fontSize: 8, color: 'rgba(55,65,88,0.50)', letterSpacing: '0.05em' }}>
            KNOWLEDGE COSMOS · v2.0
          </div>
        </div>
      )}
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '7px 10px',
};
