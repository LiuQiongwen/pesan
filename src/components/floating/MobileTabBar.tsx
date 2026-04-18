import React from 'react';
import { useToolbox, type PodId } from '@/contexts/ToolboxContext';
import { Inbox, Telescope, Sparkles, Library, Rocket, ScanLine } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";

interface Tab {
  id: PodId;
  icon: LucideIcon;
  label: string;
  accent: string;
}

const TABS: Tab[] = [
  { id: 'capture',   icon: Inbox,     label: '捕获', accent: '#00ff66' },
  { id: 'retrieval', icon: Telescope, label: '检索', accent: '#66f0ff' },
  { id: 'insight',   icon: Sparkles,  label: '洞察', accent: '#b496ff' },
  { id: 'memory',    icon: Library,   label: '记忆', accent: '#ffa040' },
  { id: 'action',    icon: Rocket,    label: '行动', accent: '#ff4466' },
];

function hexA(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function MobileTabBar() {
  const { pods, togglePod } = useToolbox();

  // Hide tab bar when any pod sheet is open
  const anyPodOpen = Object.values(pods).some(p => p?.open);
  if (anyPodOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      zIndex: 40,
      display: 'flex',
      alignItems: 'stretch',
      background: 'rgba(3,5,12,0.97)',
      backdropFilter: 'blur(40px) saturate(2)',
      WebkitBackdropFilter: 'blur(40px) saturate(2)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      boxShadow: '0 -4px 32px rgba(0,0,0,0.80)',
    }}>
      {TABS.map((tab, idx) => {
        const isOpen = pods[tab.id]?.open;
        const acc = (a: number) => hexA(tab.accent, a);

        return (
          <React.Fragment key={tab.id}>
            <button
              onClick={() => togglePod(tab.id)}
              style={{
                flex: 1,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 3,
                padding: '10px 0 8px',
                minHeight: 56,
                background: isOpen ? acc(0.08) : 'transparent',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background 0.15s',
              }}
            >
              <tab.icon
                size={20}
                color={isOpen ? tab.accent : 'rgba(100,115,145,0.55)'}
                style={{
                  transition: 'color 0.15s',
                  filter: isOpen ? `drop-shadow(0 0 6px ${acc(0.60)})` : 'none',
                }}
              />
              <span style={{
                fontFamily: MONO,
                fontSize: 10,
                letterSpacing: '0.04em',
                color: isOpen ? acc(0.90) : 'rgba(80,95,120,0.55)',
                transition: 'color 0.15s',
                lineHeight: 1,
              }}>
                {tab.label}
              </span>

              {/* Active indicator */}
              {isOpen && (
                <div style={{
                  position: 'absolute', top: 0,
                  left: '25%', right: '25%',
                  height: 2, borderRadius: '0 0 1px 1px',
                  background: `linear-gradient(90deg, transparent, ${tab.accent}, transparent)`,
                  boxShadow: `0 0 8px ${acc(0.70)}`,
                }} />
              )}
            </button>

            {/* Center OCR FAB — after 3rd tab (insight) */}
            {idx === 2 && (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-ocr-camera'))}
                style={{
                  width: 52, minWidth: 52, height: 52,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #66f0ff, #40d0ff)',
                  border: '2px solid rgba(3,5,12,0.95)',
                  boxShadow: '0 0 16px rgba(102,240,255,0.35), 0 4px 12px rgba(0,0,0,0.60)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  marginTop: -16,
                  position: 'relative',
                  zIndex: 2,
                  flexShrink: 0,
                  transition: 'transform 0.15s',
                }}
              >
                <ScanLine size={22} color="#040508" strokeWidth={2.5} />
              </button>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
