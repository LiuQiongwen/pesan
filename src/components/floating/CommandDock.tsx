/**
 * CommandDock — Desktop-scale sci-fi control console
 * Large buttons (80×62px), 22px icons, 13px labels — designed for real desktop use.
 */
import { useState } from 'react';
import { Feather, Radar, FlaskConical, Layers, Zap, Check } from 'lucide-react';
import { useToolbox, type PodId } from '@/contexts/ToolboxContext';
import { useAgentWorkflow } from '@/contexts/AgentWorkflowContext';
import { type LucideIcon } from 'lucide-react';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

interface PipelineStep {
  id:       PodId;
  icon:     LucideIcon;
  label:    string;
  sublabel: string;
  accent:   string;
}

const STEPS: PipelineStep[] = [
  { id: 'capture',   icon: Feather,      label: 'Capture',   sublabel: '捕获知识', accent: '#00ff66' },
  { id: 'retrieval', icon: Radar,        label: 'Retrieval', sublabel: '语义检索', accent: '#66f0ff' },
  { id: 'insight',   icon: FlaskConical, label: 'Insight',   sublabel: '知识精炼', accent: '#b496ff' },
  { id: 'memory',    icon: Layers,       label: 'Memory',    sublabel: '记忆唤醒', accent: '#ffa040' },
  { id: 'action',    icon: Zap,          label: 'Action',    sublabel: '知识执行', accent: '#ff4466' },
];

function hexRgb(hex: string) {
  return { r: parseInt(hex.slice(1,3),16), g: parseInt(hex.slice(3,5),16), b: parseInt(hex.slice(5,7),16) };
}

export function CommandDock() {
  const { pods, togglePod } = useToolbox();
  const { activeStep, completedSteps } = useAgentWorkflow();
  const [hoveredId, setHoveredId] = useState<PodId | null>(null);

  const lastCompleted = completedSteps[completedSteps.length - 1];
  const lastCompletedIdx = lastCompleted ? STEPS.findIndex(s => s.id === lastCompleted) : -1;
  const recommendedNext = lastCompletedIdx >= 0 && lastCompletedIdx < STEPS.length - 1
    ? STEPS[lastCompletedIdx + 1].id
    : (activeStep ? STEPS[STEPS.findIndex(s => s.id === activeStep) + 1]?.id : null);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 28,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 30,
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
        background: 'rgba(3,5,12,0.97)',
        backdropFilter: 'blur(40px) saturate(2)',
        WebkitBackdropFilter: 'blur(40px) saturate(2)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 20,
        padding: '10px 16px',
        boxShadow: `
          0 8px 48px rgba(0,0,0,0.90),
          0 0 0 1px rgba(255,255,255,0.05),
          inset 0 1px 0 rgba(255,255,255,0.06)
        `,
      }}
    >
      {/* Left brand mark */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        paddingRight: 16,
        borderRight: '1px solid rgba(255,255,255,0.07)',
        marginRight: 16,
        gap: 4,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(0,255,102,0.08)',
          border: '1px solid rgba(0,255,102,0.20)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 16px rgba(0,255,102,0.12)',
        }}>
          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 16, color: 'rgba(0,255,102,0.80)' }}>平</span>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(60,75,100,0.60)', letterSpacing: '0.06em' }}>COSMOS</span>
      </div>

      {/* Pipeline steps */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {STEPS.map((step, i) => {
          const { r, g, b } = hexRgb(step.accent);
          const isOpen      = pods[step.id]?.open;
          const isActive    = activeStep === step.id;
          const isDone      = completedSteps.includes(step.id);
          const isRecommend = recommendedNext === step.id && !isOpen;
          const isHovered   = hoveredId === step.id;

          const accentAlpha = (a: number) => `rgba(${r},${g},${b},${a})`;

          return (
            <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Connector line */}
              {i > 0 && (
                <div style={{
                  width: 20, height: 1,
                  background: isDone
                    ? `linear-gradient(90deg, ${accentAlpha(0.40)}, rgba(255,255,255,0.08))`
                    : 'rgba(255,255,255,0.06)',
                  flexShrink: 0,
                }} />
              )}

              {/* Step button */}
              <button
                onClick={() => togglePod(step.id)}
                onMouseEnter={() => setHoveredId(step.id)}
                onMouseLeave={() => setHoveredId(null)}
                title={step.label}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  width: 80,
                  height: 62,
                  borderRadius: 14,
                  border: isOpen
                    ? `1.5px solid ${accentAlpha(0.70)}`
                    : isActive
                      ? `1.5px solid ${accentAlpha(0.45)}`
                      : isRecommend
                        ? `1px solid ${accentAlpha(0.30)}`
                        : isHovered
                          ? `1px solid ${accentAlpha(0.35)}`
                          : '1px solid rgba(255,255,255,0.06)',
                  background: isOpen
                    ? `linear-gradient(160deg, ${accentAlpha(0.18)}, ${accentAlpha(0.08)})`
                    : isActive
                      ? accentAlpha(0.10)
                      : isHovered
                        ? accentAlpha(0.08)
                        : isRecommend
                          ? accentAlpha(0.05)
                          : 'rgba(255,255,255,0.02)',
                  cursor: 'pointer',
                  transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
                  transform: isHovered ? 'translateY(-3px)' : 'translateY(0)',
                  boxShadow: isOpen
                    ? `0 0 24px ${accentAlpha(0.35)}, 0 4px 20px rgba(0,0,0,0.60), inset 0 1px 0 ${accentAlpha(0.20)}`
                    : isActive
                      ? `0 0 16px ${accentAlpha(0.22)}, 0 4px 16px rgba(0,0,0,0.50)`
                      : isHovered
                        ? `0 0 14px ${accentAlpha(0.18)}, 0 6px 20px rgba(0,0,0,0.60)`
                        : '0 2px 8px rgba(0,0,0,0.40)',
                  animation: isRecommend ? 'dock-pulse 2.4s ease-in-out infinite' : 'none',
                  flexShrink: 0,
                }}
              >
                {/* Icon with glow container */}
                <div style={{
                  width: 32, height: 32,
                  borderRadius: 9,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isOpen || isHovered ? accentAlpha(0.15) : 'transparent',
                  transition: 'background 0.16s',
                }}>
                  <step.icon
                    size={22}
                    color={isOpen || isActive || isDone || isHovered ? step.accent : 'rgba(80,95,125,0.55)'}
                    style={{
                      transition: 'color 0.16s',
                      filter: isOpen ? `drop-shadow(0 0 6px ${accentAlpha(0.70)})` : 'none',
                    }}
                  />
                </div>

                {/* Labels */}
                <div style={{ textAlign: 'center', lineHeight: 1 }}>
                  <div style={{
                    fontFamily: INTER,
                    fontSize: 12,
                    fontWeight: 600,
                    color: isOpen || isActive || isDone
                      ? accentAlpha(0.95)
                      : isHovered
                        ? 'rgba(200,215,240,0.85)'
                        : 'rgba(120,140,175,0.65)',
                    transition: 'color 0.16s',
                    letterSpacing: '0.01em',
                    marginBottom: 1,
                  }}>
                    {step.label}
                  </div>
                  <div style={{
                    fontFamily: MONO,
                    fontSize: 9,
                    color: isOpen
                      ? accentAlpha(0.60)
                      : 'rgba(70,85,115,0.55)',
                    transition: 'color 0.16s',
                    letterSpacing: '0.04em',
                  }}>
                    {step.sublabel}
                  </div>
                </div>

                {/* Done checkmark badge */}
                {isDone && !isActive && (
                  <div style={{
                    position: 'absolute', top: 5, right: 5,
                    width: 14, height: 14, borderRadius: '50%',
                    background: accentAlpha(0.25),
                    border: `1px solid ${accentAlpha(0.50)}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 0 6px ${accentAlpha(0.30)}`,
                  }}>
                    <Check size={8} color={step.accent} />
                  </div>
                )}

                {/* Active pulse ring */}
                {isActive && (
                  <div style={{
                    position: 'absolute', inset: -3,
                    borderRadius: 17,
                    border: `1.5px solid ${accentAlpha(0.55)}`,
                    animation: 'dock-ring 1.4s ease-out infinite',
                    pointerEvents: 'none',
                  }} />
                )}

                {/* Recommended badge */}
                {isRecommend && (
                  <div style={{
                    position: 'absolute', top: -9,
                    fontFamily: MONO, fontSize: 8, letterSpacing: '0.04em',
                    color: accentAlpha(0.90),
                    background: accentAlpha(0.14),
                    border: `1px solid ${accentAlpha(0.30)}`,
                    borderRadius: 5, padding: '2px 6px',
                    whiteSpace: 'nowrap' as const,
                    boxShadow: `0 0 8px ${accentAlpha(0.20)}`,
                  }}>
                    推荐
                  </div>
                )}

                {/* Open indicator bar */}
                {isOpen && (
                  <div style={{
                    position: 'absolute', bottom: 0, left: '20%', right: '20%',
                    height: 2, borderRadius: '1px 1px 0 0',
                    background: `linear-gradient(90deg, transparent, ${step.accent}, transparent)`,
                    boxShadow: `0 0 8px ${accentAlpha(0.80)}`,
                  }} />
                )}
              </button>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes dock-pulse {
          0%,100% { box-shadow: 0 2px 8px rgba(0,0,0,0.40); }
          50% { box-shadow: 0 0 20px rgba(180,190,220,0.12), 0 2px 8px rgba(0,0,0,0.40); }
        }
        @keyframes dock-ring {
          0%   { opacity: 0.70; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.50); }
        }
      `}</style>
    </div>
  );
}
