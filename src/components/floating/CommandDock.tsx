/**
 * CommandDock — Workflow Pipeline Guide
 * Shows the 5-step agent pipeline as a horizontal flow.
 * Active step glows, completed steps show a check, recommended-next pulses.
 */
import { Feather, Radar, FlaskConical, Layers, Zap, ChevronRight, Check } from 'lucide-react';
import { useToolbox, type PodId } from '@/contexts/ToolboxContext';
import { useAgentWorkflow } from '@/contexts/AgentWorkflowContext';
import { type LucideIcon } from 'lucide-react';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";

interface PipelineStep {
  id: PodId;
  icon: LucideIcon;
  label: string;
  sublabel: string;
  accent: string;
  nextHint?: string; // shown when this step is active
}

const STEPS: PipelineStep[] = [
  { id: 'capture',   icon: Feather,      label: 'Capture',   sublabel: '捕获',  accent: '#00ff66', nextHint: '→ 检索' },
  { id: 'retrieval', icon: Radar,        label: 'Retrieval', sublabel: '检索',  accent: '#66f0ff', nextHint: '→ 洞察' },
  { id: 'insight',   icon: FlaskConical, label: 'Insight',   sublabel: '洞察',  accent: '#b496ff', nextHint: '→ 记忆' },
  { id: 'memory',    icon: Layers,       label: 'Memory',    sublabel: '记忆',  accent: '#ffa040', nextHint: '→ 行动' },
  { id: 'action',    icon: Zap,          label: 'Action',    sublabel: '执行',  accent: '#ff4466' },
];

function hexRgb(hex: string) {
  return { r: parseInt(hex.slice(1,3),16), g: parseInt(hex.slice(3,5),16), b: parseInt(hex.slice(5,7),16) };
}

export function CommandDock() {
  const { pods, togglePod } = useToolbox();
  const { activeStep, completedSteps }  = useAgentWorkflow();

  // Determine the "recommended next" step
  const lastCompleted = completedSteps[completedSteps.length - 1];
  const lastCompletedIdx = lastCompleted ? STEPS.findIndex(s => s.id === lastCompleted) : -1;
  const recommendedNext = lastCompletedIdx >= 0 && lastCompletedIdx < STEPS.length - 1
    ? STEPS[lastCompletedIdx + 1].id
    : (activeStep ? STEPS[STEPS.findIndex(s => s.id === activeStep) + 1]?.id : null);

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
        gap: 0,
        background: 'rgba(4,6,14,0.94)',
        backdropFilter: 'blur(28px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 18,
        padding: '6px 14px',
        boxShadow: '0 4px 40px rgba(0,0,0,0.80), 0 0 0 1px rgba(255,255,255,0.04)',
      }}
    >
      {STEPS.map((step, i) => {
        const { r, g, b } = hexRgb(step.accent);
        const isOpen      = pods[step.id]?.open;
        const isActive    = activeStep === step.id;
        const isDone      = completedSteps.includes(step.id);
        const isRecommend = recommendedNext === step.id && !isOpen;

        return (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {/* Pipeline connector */}
            {i > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', margin: '0 4px',
              }}>
                <ChevronRight
                  size={10}
                  color={isDone || isActive ? `rgba(${r},${g},${b},0.55)` : 'rgba(50,60,80,0.45)'}
                />
              </div>
            )}

            {/* Step button */}
            <button
              onClick={() => togglePod(step.id)}
              title={step.label}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                width: 56,
                height: 50,
                borderRadius: 12,
                border: isOpen
                  ? `1px solid rgba(${r},${g},${b},0.55)`
                  : isActive
                    ? `1px solid rgba(${r},${g},${b},0.35)`
                    : isRecommend
                      ? `1px solid rgba(${r},${g},${b},0.22)`
                      : '1px solid transparent',
                background: isOpen
                  ? `rgba(${r},${g},${b},0.14)`
                  : isActive
                    ? `rgba(${r},${g},${b},0.08)`
                    : isRecommend
                      ? `rgba(${r},${g},${b},0.05)`
                      : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.18s',
                boxShadow: isOpen
                  ? `0 0 16px rgba(${r},${g},${b},0.25), inset 0 0 0 1px rgba(${r},${g},${b},0.08)`
                  : isActive
                    ? `0 0 10px rgba(${r},${g},${b},0.15)`
                    : 'none',
                animation: isRecommend ? 'dock-pulse 2.2s ease-in-out infinite' : 'none',
              }}
              onMouseEnter={e => {
                if (!isOpen) {
                  (e.currentTarget as HTMLButtonElement).style.background = `rgba(${r},${g},${b},0.09)`;
                  (e.currentTarget as HTMLButtonElement).style.border = `1px solid rgba(${r},${g},${b},0.30)`;
                }
              }}
              onMouseLeave={e => {
                if (!isOpen) {
                  (e.currentTarget as HTMLButtonElement).style.background = isActive
                    ? `rgba(${r},${g},${b},0.08)` : 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.border = isOpen
                    ? `1px solid rgba(${r},${g},${b},0.22)` : '1px solid transparent';
                }
              }}
            >
              {/* Step icon */}
              <step.icon
                size={14}
                color={isOpen || isActive || isDone ? step.accent : 'rgba(90,100,125,0.55)'}
                style={{ transition: 'color 0.16s' }}
              />

              {/* Label */}
              <span style={{
                fontFamily: MONO,
                fontSize: 7,
                letterSpacing: '0.05em',
                color: isOpen || isActive || isDone ? step.accent : 'rgba(70,82,108,0.55)',
                transition: 'color 0.16s',
                textTransform: 'uppercase' as const,
                lineHeight: 1,
              }}>
                {step.sublabel}
              </span>

              {/* Done checkmark */}
              {isDone && !isActive && (
                <div style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 10, height: 10, borderRadius: '50%',
                  background: `rgba(${r},${g},${b},0.20)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Check size={6} color={step.accent} />
                </div>
              )}

              {/* Active pulse ring */}
              {isActive && (
                <div style={{
                  position: 'absolute', inset: -2,
                  borderRadius: 14,
                  border: `1px solid rgba(${r},${g},${b},0.50)`,
                  animation: 'dock-ring 1.2s ease-out infinite',
                  pointerEvents: 'none',
                }} />
              )}

              {/* Recommended next badge */}
              {isRecommend && (
                <div style={{
                  position: 'absolute', top: -7,
                  fontFamily: MONO, fontSize: 6.5, letterSpacing: '0.04em',
                  color: `rgba(${r},${g},${b},0.80)`,
                  background: `rgba(${r},${g},${b},0.12)`,
                  border: `1px solid rgba(${r},${g},${b},0.22)`,
                  borderRadius: 4, padding: '1px 4px',
                  whiteSpace: 'nowrap' as const,
                }}>
                  推荐
                </div>
              )}

              {/* Active indicator dot */}
              {isOpen && !isActive && (
                <div style={{
                  position: 'absolute', bottom: 3,
                  width: 3, height: 3, borderRadius: '50%',
                  background: step.accent,
                  boxShadow: `0 0 4px ${step.accent}`,
                }} />
              )}
            </button>
          </div>
        );
      })}

      {/* Divider + wordmark */}
      <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.06)', margin: '0 10px' }} />
      <div style={{
        fontFamily: MONO, fontSize: 9, fontWeight: 700,
        color: 'rgba(50,60,80,0.50)',
        letterSpacing: '0.05em',
        userSelect: 'none' as const,
      }}>
        平
      </div>

      <style>{`
        @keyframes dock-pulse {
          0%,100% { box-shadow: none; }
          50% { box-shadow: 0 0 10px rgba(255,255,255,0.06); }
        }
        @keyframes dock-ring {
          0%   { opacity: 0.8; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.35); }
        }
      `}</style>
    </div>
  );
}
