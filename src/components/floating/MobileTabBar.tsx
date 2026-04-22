import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  { id: 'capture',   icon: Inbox,     label: '\u6355\u83B7', accent: '#00ff66' },
  { id: 'retrieval', icon: Telescope, label: '\u68C0\u7D22', accent: '#66f0ff' },
  { id: 'insight',   icon: Sparkles,  label: '\u6D1E\u5BDF', accent: '#b496ff' },
  { id: 'memory',    icon: Library,   label: '\u8BB0\u5FC6', accent: '#ffa040' },
  { id: 'action',    icon: Rocket,    label: '\u884C\u52A8', accent: '#ff4466' },
];

function hexA(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function MobileTabBar() {
  const { pods, togglePod } = useToolbox();
  const [expanded, setExpanded] = useState(false);
  const autoCollapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Hide entirely when any pod sheet is open
  const anyPodOpen = Object.values(pods).some(p => p?.open);

  // Auto-collapse after opening a pod
  const handlePodTap = useCallback((id: PodId) => {
    togglePod(id);
    setExpanded(false);
  }, [togglePod]);

  // Auto-collapse after 4s idle
  useEffect(() => {
    if (expanded) {
      autoCollapseTimer.current = setTimeout(() => setExpanded(false), 4000);
      return () => { if (autoCollapseTimer.current) clearTimeout(autoCollapseTimer.current); };
    }
  }, [expanded]);

  // Tap outside to collapse
  useEffect(() => {
    if (!expanded) return;
    const onTouch = (e: TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    // Use setTimeout to avoid the same tap that opened it
    const t = setTimeout(() => document.addEventListener('touchstart', onTouch, { passive: true }), 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener('touchstart', onTouch);
    };
  }, [expanded]);

  // Collapse when pod opens
  useEffect(() => {
    if (anyPodOpen) setExpanded(false);
  }, [anyPodOpen]);

  if (anyPodOpen) return null;

  // ── Collapsed capsule ─────────────────────────────────────────────────
  if (!expanded) {
    return (
      <div
        onClick={() => setExpanded(true)}
        style={{
          position: 'fixed',
          bottom: `calc(env(safe-area-inset-bottom, 0px) + 12px)`,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          width: 120,
          height: 40,
          borderRadius: 50,
          background: 'rgba(3,5,12,0.95)',
          backdropFilter: 'blur(40px) saturate(2)',
          WebkitBackdropFilter: 'blur(40px) saturate(2)',
          border: '1px solid rgba(0,255,102,0.18)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.70), 0 0 12px rgba(0,255,102,0.08)',
          cursor: 'pointer',
          animation: 'island-collapse var(--dur-standard) var(--spring)',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {/* Pulsing dot */}
        <div style={{
          width: 6, height: 6, borderRadius: 3,
          background: '#00ff66',
          boxShadow: '0 0 8px rgba(0,255,102,0.60)',
          animation: 'island-dot-pulse 2.4s ease-in-out infinite',
        }} />
        <span style={{
          fontFamily: MONO,
          fontSize: 11,
          letterSpacing: '0.08em',
          color: 'rgba(200,215,240,0.70)',
          fontWeight: 500,
        }}>
          PESTA
        </span>
      </div>
    );
  }

  // ── Expanded bar ──────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      style={{
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
        animation: 'island-expand var(--dur-standard) var(--spring)',
        transformOrigin: 'bottom center',
      }}
    >
      {TABS.map((tab, idx) => {
        const isOpen = pods[tab.id]?.open;
        const acc = (a: number) => hexA(tab.accent, a);

        return (
          <React.Fragment key={tab.id}>
            <button
              onClick={() => handlePodTap(tab.id)}
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
                transition: 'background var(--dur-snap) var(--spring-snap)',
                opacity: 0,
                animation: `island-icon-in var(--dur-snap) var(--spring-snap) ${idx * 30}ms both`,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <tab.icon
                size={20}
                color={isOpen ? tab.accent : 'rgba(100,115,145,0.55)'}
                style={{
                  transition: 'color var(--dur-snap) var(--spring-snap)',
                  filter: isOpen ? `drop-shadow(0 0 6px ${acc(0.60)})` : 'none',
                }}
              />
              <span style={{
                fontFamily: MONO,
                fontSize: 10,
                letterSpacing: '0.04em',
                color: isOpen ? acc(0.90) : 'rgba(80,95,120,0.55)',
                transition: 'color var(--dur-snap) var(--spring-snap)',
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
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-ocr-camera'));
                  setExpanded(false);
                }}
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
                  opacity: 0,
                  animation: `island-icon-in var(--dur-snap) var(--spring-snap) ${2.5 * 30}ms both`,
                  transition: 'transform var(--dur-snap) var(--spring-snap)',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <ScanLine size={22} color="#040508" strokeWidth={2.5} />
              </button>
            )}
          </React.Fragment>
        );
      })}

      <style>{`
        @keyframes island-expand {
          from {
            opacity: 0;
            clip-path: inset(80% 30% 0% 30% round 50px);
          }
          to {
            opacity: 1;
            clip-path: inset(0% 0% 0% 0% round 0px);
          }
        }
        @keyframes island-collapse {
          from {
            opacity: 0;
            transform: translateX(-50%) scaleX(0.6) scaleY(0.7);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) scaleX(1) scaleY(1);
          }
        }
        @keyframes island-icon-in {
          from { opacity: 0; transform: translateY(8px) scale(0.85); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes island-dot-pulse {
          0%, 100% { opacity: 0.6; box-shadow: 0 0 4px rgba(0,255,102,0.30); }
          50%      { opacity: 1;   box-shadow: 0 0 10px rgba(0,255,102,0.70); }
        }
      `}</style>
    </div>
  );
}
