import { LogOut, Languages, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";
const GREEN = '#00ff66';

export default function SettingsBox() {
  const { user, signOut } = useAuth();
  const { lang, setLang } = useLanguage();
  const navigate = useNavigate();
  const t = useT();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:2 }}>

      {/* User info */}
      <div style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px', background:'rgba(255,255,255,0.03)', borderRadius:7, marginBottom:6 }}>
        <div style={{
          width:28, height:28, borderRadius:'50%',
          background:'rgba(0,255,102,0.12)',
          border:'1px solid rgba(0,255,102,0.25)',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <User size={12} color={GREEN} />
        </div>
        <div>
          <div style={{ fontFamily:INTER, fontSize:12, fontWeight:600, color:'rgba(220,230,245,0.90)' }}>
            {user?.email?.split('@')[0]}
          </div>
          <div style={{ fontFamily:MONO, fontSize:9, color:'rgba(80,90,110,0.55)', letterSpacing:'0.04em' }}>
            {user?.email}
          </div>
        </div>
      </div>

      {/* Language toggle */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 10px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <Languages size={13} color="rgba(140,150,175,0.60)" />
          <span style={{ fontFamily:INTER, fontSize:12, color:'rgba(180,190,215,0.80)' }}>
            {t('settings.language') || '界面语言'}
          </span>
        </div>
        <button
          onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
          style={{
            fontFamily:MONO, fontSize:10, letterSpacing:'0.06em',
            color: GREEN,
            background:'rgba(0,255,102,0.08)',
            border:'1px solid rgba(0,255,102,0.25)',
            borderRadius:5, padding:'4px 10px',
            cursor:'pointer', transition:'all 0.15s',
          }}
        >
          {lang === 'zh' ? 'EN' : '中'}
        </button>
      </div>

      <div style={{ height:1, background:'rgba(255,255,255,0.05)', margin:'4px 0' }} />

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        style={{
          display:'flex', alignItems:'center', gap:8,
          padding:'9px 10px', borderRadius:6,
          background:'transparent', border:'none',
          cursor:'pointer', transition:'background 0.15s',
          width:'100%', textAlign:'left',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,80,80,0.08)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
      >
        <LogOut size={13} color="rgba(220,80,80,0.65)" />
        <span style={{ fontFamily:INTER, fontSize:12, color:'rgba(200,80,80,0.70)' }}>
          {t('sidebar.signOut') || '退出登录'}
        </span>
      </button>

      {/* Version */}
      <div style={{ padding:'6px 10px 2px', fontFamily:MONO, fontSize:9, color:'rgba(60,70,90,0.45)', letterSpacing:'0.05em' }}>
        KNOWLEDGE COSMOS v2.0
      </div>
    </div>
  );
}
