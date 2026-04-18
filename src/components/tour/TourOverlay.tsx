/**
 * TourOverlay — renders spotlight mask + tooltip bubble.
 * All styles inline to match the sci-fi aesthetic.
 * pointerEvents: 'none' on mask, 'auto' on tooltip only.
 */
import { useTour } from './TourProvider';
import { getStepContent } from './TourStepContent';
import { Sparkles, ArrowRight, X } from 'lucide-react';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

export function TourOverlay() {
  const { active, step, stepIndex, totalSteps, advance, skip } = useTour();

  if (!active || !step) return null;

  const content = getStepContent(step.id);
  const isCenter = step.placement === 'center';

  // Position the tooltip
  const tooltipPosition: React.CSSProperties = isCenter
    ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
    : step.placement === 'bottom-center'
    ? { bottom: 120, left: '50%', transform: 'translateX(-50%)' }
    : { top: 80, left: 24 };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        pointerEvents: 'none',
      }}
    >
      {/* Dark overlay — transparent center for star map visibility */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: isCenter
            ? 'radial-gradient(ellipse at center, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.82) 100%)'
            : 'rgba(0,0,0,0.55)',
          pointerEvents: 'none',
          transition: 'background 0.5s ease',
        }}
      />

      {/* Tooltip card */}
      <div
        style={{
          position: 'absolute',
          ...tooltipPosition,
          pointerEvents: 'auto',
          maxWidth: 420,
          width: 'calc(100vw - 48px)',
          animation: 'tour-fade-in 0.4s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <div
          style={{
            background: 'rgba(6,10,22,0.94)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(102,240,255,0.18)',
            borderRadius: 14,
            padding: 'clamp(20px, 3vw, 28px)',
            boxShadow: '0 0 60px rgba(102,240,255,0.06), 0 20px 60px rgba(0,0,0,0.6)',
          }}
        >
          {/* Step indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 16,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em',
              color: 'rgba(102,240,255,0.50)',
            }}>
              <Sparkles size={11} style={{ opacity: 0.6 }} />
              STEP {stepIndex + 1} / {totalSteps}
            </div>
            <button
              onClick={skip}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em',
                color: 'rgba(255,255,255,0.25)',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
            >
              <X size={10} />
              跳过导览
            </button>
          </div>

          {/* Title */}
          <h3 style={{
            fontFamily: INTER, fontWeight: 700,
            fontSize: 'clamp(17px, 2vw, 21px)',
            color: 'rgba(230,238,255,0.95)',
            margin: '0 0 10px',
            lineHeight: 1.3,
          }}>
            {content.title}
          </h3>

          {/* Body */}
          <p style={{
            fontFamily: INTER, fontSize: 'clamp(13px, 1.3vw, 14.5px)',
            color: 'rgba(200,210,230,0.82)',
            margin: '0 0 8px',
            lineHeight: 1.6,
          }}>
            {content.body}
          </p>

          {/* Sub — value statement */}
          <p style={{
            fontFamily: INTER, fontSize: 'clamp(11px, 1.1vw, 12.5px)',
            color: 'rgba(102,240,255,0.55)',
            margin: '0 0 4px',
            lineHeight: 1.5,
            fontStyle: 'italic',
          }}>
            {content.sub}
          </p>

          {/* Hint */}
          {content.hint && (
            <p style={{
              fontFamily: MONO, fontSize: 10,
              color: 'rgba(0,255,102,0.45)',
              margin: '8px 0 0',
              letterSpacing: '0.04em',
            }}>
              {content.hint}
            </p>
          )}

          {/* CTA button */}
          {content.cta && (
            <button
              onClick={advance}
              style={{
                marginTop: 18,
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: INTER, fontWeight: 600,
                fontSize: 'clamp(13px, 1.3vw, 14.5px)',
                color: '#040508',
                background: 'linear-gradient(135deg, #66f0ff 0%, #00ff66 100%)',
                border: 'none',
                borderRadius: 8,
                padding: '10px 22px',
                cursor: 'pointer',
                transition: 'transform 0.15s, box-shadow 0.15s',
                boxShadow: '0 0 20px rgba(102,240,255,0.2)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 0 30px rgba(102,240,255,0.35)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 0 20px rgba(102,240,255,0.2)';
              }}
            >
              {content.cta}
              <ArrowRight size={15} />
            </button>
          )}

          {/* Progress dots */}
          <div style={{
            display: 'flex', gap: 5, justifyContent: 'center',
            marginTop: content.cta ? 16 : 20,
          }}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === stepIndex ? 18 : 5,
                  height: 5,
                  borderRadius: 3,
                  background: i === stepIndex
                    ? 'rgba(102,240,255,0.80)'
                    : i < stepIndex
                    ? 'rgba(0,255,102,0.40)'
                    : 'rgba(255,255,255,0.12)',
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
