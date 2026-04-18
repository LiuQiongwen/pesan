/**
 * CreateUniversePanel — inline creation form for a new knowledge universe.
 * Single page: name, description, color seed, icon picker.
 */
import { useState } from 'react';
import { X, Sparkles, Globe, BookOpen, Brain, Rocket, Heart, Lightbulb, Compass, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

const COLOR_OPTIONS: { key: string; label: string; hex: string }[] = [
  { key: 'blue',   label: '星蓝',   hex: '#66b3ff' },
  { key: 'purple', label: '星紫',   hex: '#b496ff' },
  { key: 'cyan',   label: '星青',   hex: '#66f0ff' },
  { key: 'green',  label: '星绿',   hex: '#00ff66' },
  { key: 'amber',  label: '星金',   hex: '#ffa040' },
  { key: 'rose',   label: '星红',   hex: '#ff6688' },
];

const ICON_OPTIONS: { key: string; Icon: LucideIcon }[] = [
  { key: 'sparkles',  Icon: Sparkles },
  { key: 'globe',     Icon: Globe },
  { key: 'book-open', Icon: BookOpen },
  { key: 'brain',     Icon: Brain },
  { key: 'rocket',    Icon: Rocket },
  { key: 'heart',     Icon: Heart },
  { key: 'lightbulb', Icon: Lightbulb },
  { key: 'compass',   Icon: Compass },
];

interface Props {
  onClose: () => void;
  onCreate: (params: { name: string; description?: string; color_seed: string; icon: string }) => Promise<void>;
  atLimit?: boolean;
  planLabel?: string;
}

export function CreateUniversePanel({ onClose, onCreate, atLimit, planLabel }: Props) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [color, setColor] = useState('blue');
  const [icon, setIcon]  = useState('sparkles');
  const [saving, setSaving] = useState(false);

  const accentHex = COLOR_OPTIONS.find(c => c.key === color)?.hex ?? '#66b3ff';

  const handleCreate = async () => {
    if (!name.trim() || atLimit) return;
    setSaving(true);
    await onCreate({ name: name.trim(), description: desc.trim() || undefined, color_seed: color, icon });
    setSaving(false);
  };

  return (
    <div style={{
      padding: '18px 20px',
      fontFamily: INTER,
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{
          fontFamily: MONO, fontSize: 10, letterSpacing: '0.10em',
          color: accentHex, opacity: 0.8,
        }}>
          CREATE UNIVERSE
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'rgba(140,150,170,0.5)',
          cursor: 'pointer', padding: 2,
        }}>
          <X size={14} />
        </button>
      </div>

      {/* Name */}
      <div>
        <label style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em', color: 'rgba(140,150,170,0.6)', marginBottom: 4, display: 'block' }}>
          NAME
        </label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="AI 研究"
          maxLength={40}
          autoFocus
          style={{
            width: '100%', boxSizing: 'border-box',
            fontFamily: INTER, fontSize: 13, color: 'rgba(230,238,255,0.9)',
            background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.08)`,
            borderRadius: 6, padding: '8px 10px',
            outline: 'none',
          }}
          onFocus={e => e.currentTarget.style.borderColor = `${accentHex}40`}
          onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
        />
      </div>

      {/* Description */}
      <div>
        <label style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em', color: 'rgba(140,150,170,0.6)', marginBottom: 4, display: 'block' }}>
          DESCRIPTION (OPTIONAL)
        </label>
        <input
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="一句话简介..."
          maxLength={100}
          style={{
            width: '100%', boxSizing: 'border-box',
            fontFamily: INTER, fontSize: 12, color: 'rgba(230,238,255,0.7)',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 6, padding: '7px 10px',
            outline: 'none',
          }}
        />
      </div>

      {/* Color */}
      <div>
        <label style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em', color: 'rgba(140,150,170,0.6)', marginBottom: 6, display: 'block' }}>
          THEME COLOR
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          {COLOR_OPTIONS.map(c => (
            <button
              key={c.key}
              onClick={() => setColor(c.key)}
              title={c.label}
              style={{
                width: 26, height: 26, borderRadius: '50%',
                background: c.hex,
                border: color === c.key ? '2px solid rgba(255,255,255,0.9)' : '2px solid transparent',
                cursor: 'pointer',
                boxShadow: color === c.key ? `0 0 12px ${c.hex}60` : 'none',
                transition: 'all 0.15s',
              }}
            />
          ))}
        </div>
      </div>

      {/* Icon */}
      <div>
        <label style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em', color: 'rgba(140,150,170,0.6)', marginBottom: 6, display: 'block' }}>
          ICON
        </label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ICON_OPTIONS.map(({ key, Icon }) => (
            <button
              key={key}
              onClick={() => setIcon(key)}
              style={{
                width: 32, height: 32, borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: icon === key ? `${accentHex}18` : 'rgba(255,255,255,0.03)',
                border: icon === key ? `1px solid ${accentHex}40` : '1px solid rgba(255,255,255,0.06)',
                color: icon === key ? accentHex : 'rgba(140,150,170,0.5)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>
      </div>

      {/* Create button */}
      {atLimit ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: MONO, fontSize: 10, color: 'rgba(255,150,80,0.7)',
          padding: '8px 12px',
          background: 'rgba(255,150,80,0.06)', borderRadius: 6,
          border: '1px solid rgba(255,150,80,0.12)',
        }}>
          <Lock size={12} />
          {planLabel ?? 'Free'} 套餐已达上限，请升级以创建更多宇宙
        </div>
      ) : (
        <button
          onClick={handleCreate}
          disabled={!name.trim() || saving}
          style={{
            fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em',
            color: name.trim() ? '#01040d' : 'rgba(140,150,170,0.4)',
            background: name.trim() ? accentHex : 'rgba(255,255,255,0.06)',
            border: 'none', borderRadius: 6, padding: '9px 0',
            cursor: name.trim() ? 'pointer' : 'not-allowed',
            fontWeight: 600,
            transition: 'all 0.15s',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? '创建中...' : '创建宇宙'}
        </button>
      )}
    </div>
  );
}
