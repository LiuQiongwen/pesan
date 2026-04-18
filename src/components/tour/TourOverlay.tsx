/**
 * TourOverlay — non-blocking bottom HUD task bar.
 * Never covers the star map or blocks interaction.
 * Shows a compact strip with: icon + task text + progress dots + skip.
 */
import { useTour } from './TourProvider';
import { getStepContent } from './TourStepContent';
import { X, Check } from 'lucide-react';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

export function TourOverlay() {
  const { active, step, stepIndex, totalSteps, skip } = useTour();

  if (!active || !step) return null;

  const content = getStepContent(step.id);
  const Icon = content.icon;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 60,
        pointerEvents: 'auto',
        animation: 'tour-hud-in 0.4s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '10px 20px',
          background: 'rgba(6,10,22,0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(102,240,255,0.18)',
          borderRadius: 12,
          boxShadow: '0 0 40px rgba(102,240,255,0.06), 0 12px 40px rgba(0,0,0,0.5)',
        }}
      >
        {/* Step icon */}
        <div style={{
          width: 28, height: 28,
          borderRadius: 7,
          background: 'rgba(102,240,255,0.10)',
          border: '1px solid rgba(102,240,255,0.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={14} color="rgba(102,240,255,0.85)" />
        </div>

        {/* Task text */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{
            fontFamily: INTER,
            fontSize: 13,
            fontWeight: 600,
            color: 'rgba(220,230,255,0.90)',
            letterSpacing: '0.01em',
          }}>
            {content.task}
          </span>
          <span style={{
            fontFamily: MONO,
            fontSize: 9,
            color: 'rgba(102,240,255,0.50)',
            letterSpacing: '0.04em',
          }}>
            {content.hint}
          </span>
        </div>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              style={{
                width: i === stepIndex ? 14 : 5,
                height: 5,
                borderRadius: 3,
                background: i < stepIndex
                  ? 'rgba(0,255,102,0.55)'
                  : i === stepIndex
                  ? 'rgba(102,240,255,0.75)'
                  : 'rgba(255,255,255,0.12)',
                transition: 'all 0.3s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {i < stepIndex && <Check size={4} color="rgba(0,255,102,0.9)" />}
            </div>
          ))}
        </div>

        {/* Skip button */}
        <button
          onClick={skip}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            fontFamily: MONO,
            fontSize: 9,
            letterSpacing: '0.06em',
            color: 'rgba(255,255,255,0.25)',
            padding: '4px 6px',
            borderRadius: 4,
            transition: 'color 0.15s, background 0.15s',
            marginLeft: 2,
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.55)';
            e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.25)';
            e.currentTarget.style.background = 'none';
          }}
        >
          <X size={10} />
          跳过
        </button>
      </div>
    </div>
  );
}
