import { Brain, Search, BookOpen, FlaskConical, Scan, Sparkles, CheckSquare, Settings } from 'lucide-react';
import { useToolbox, type ToolboxId } from '@/contexts/ToolboxContext';
import { useT } from '@/contexts/LanguageContext';
import { type LucideIcon } from 'lucide-react';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";

interface DockItem {
  id: ToolboxId;
  icon: LucideIcon;
  labelKey: string;
  color: string;
}

const DOCK_ITEMS: DockItem[] = [
  { id: 'analyze',      icon: Brain,       labelKey: 'sidebar.analyze',       color: '#00ff66' },
  { id: 'search',       icon: Search,      labelKey: 'sidebar.search',        color: '#66f0ff' },
  { id: 'library',      icon: BookOpen,    labelKey: 'sidebar.library',       color: '#b496ff' },
  { id: 'distiller',    icon: FlaskConical,labelKey: 'sidebar.distiller',     color: '#ffa040' },
  { id: 'mirror',       icon: Scan,        labelKey: 'sidebar.mirror',        color: '#66f0ff' },
  { id: 'anticipation', icon: Sparkles,    labelKey: 'sidebar.anticipation',  color: '#ff64b4' },
  { id: 'actions',      icon: CheckSquare, labelKey: 'sidebar.actions',       color: '#64c8ff' },
  { id: 'settings',     icon: Settings,    labelKey: 'sidebar.settings',      color: '#888fa8' },
];

export function CommandDock() {
  const { toolboxes, toggleToolbox } = useToolbox();
  const t = useT();

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: 'rgba(4,6,10,0.90)',
        backdropFilter: 'blur(24px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        padding: '6px 10px',
        boxShadow: '0 4px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,255,102,0.06)',
      }}
    >
      {DOCK_ITEMS.map(({ id, icon: Icon, labelKey, color }) => {
        const isOpen = toolboxes[id]?.open && !toolboxes[id]?.minimized;
        const label = t(labelKey);
        return (
          <button
            key={id}
            onClick={() => toggleToolbox(id)}
            title={label}
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: 10,
              border: isOpen ? `1px solid ${color}40` : '1px solid transparent',
              background: isOpen ? `${color}10` : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: isOpen ? `0 0 12px ${color}30` : 'none',
            }}
            onMouseEnter={e => {
              if (!isOpen) {
                e.currentTarget.style.background = `${color}08`;
                e.currentTarget.style.borderColor = `${color}25`;
              }
            }}
            onMouseLeave={e => {
              if (!isOpen) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'transparent';
              }
            }}
          >
            <Icon
              size={16}
              color={isOpen ? color : 'rgba(140,150,170,0.65)'}
              style={{ transition: 'color 0.15s' }}
            />
            {/* Active dot */}
            {isOpen && (
              <div style={{
                position: 'absolute',
                bottom: 5,
                width: 3,
                height: 3,
                borderRadius: '50%',
                background: color,
                boxShadow: `0 0 6px ${color}`,
              }} />
            )}
          </button>
        );
      })}

      {/* Separator + hint */}
      <div style={{
        width: 1,
        height: 20,
        background: 'rgba(255,255,255,0.06)',
        margin: '0 6px',
      }} />
      <div style={{
        fontFamily: MONO,
        fontSize: 9,
        color: 'rgba(80,90,110,0.55)',
        letterSpacing: '0.05em',
        paddingRight: 4,
        whiteSpace: 'nowrap',
      }}>
        COSMOS
      </div>
    </div>
  );
}
