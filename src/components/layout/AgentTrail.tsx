/**
 * AgentTrail — live visualization of the agent's processing path.
 * Shows a horizontal breadcrumb of active/completed/pending steps.
 * Only visible when there is an active workflow step.
 */
import { Feather, Radar, FlaskConical, Layers, Zap, Check } from 'lucide-react';
import { useAgentWorkflow } from '@/contexts/AgentWorkflowContext';
import type { PodId } from '@/contexts/ToolboxContext';
import type { LucideIcon } from 'lucide-react';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";

interface TrailStep {
  id: PodId;
  label: string;
  icon: LucideIcon;
  accent: string;
}

const TRAIL_STEPS: TrailStep[] = [
  { id: 'capture',   label: '摄入', icon: Feather,      accent: '#00ff66' },
  { id: 'retrieval', label: '检索', icon: Radar,        accent: '#66f0ff' },
  { id: 'insight',   label: '洞察', icon: FlaskConical, accent: '#b496ff' },
  { id: 'memory',    label: '记忆', icon: Layers,       accent: '#ffa040' },
  { id: 'action',    label: '执行', icon: Zap,          accent: '#ff4466' },
];

function hexRgb(hex: string) {
  return { r: parseInt(hex.slice(1,3),16), g: parseInt(hex.slice(3,5),16), b: parseInt(hex.slice(5,7),16) };
}

export function AgentTrail() {
  const { activeStep, completedSteps, relay } = useAgentWorkflow();

  // Only show if a workflow is active
  if (!activeStep && completedSteps.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 8,
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      background: 'rgba(4,6,14,0.82)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 24,
      padding: '5px 14px',
      animation: 'trail-in 0.22s cubic-bezier(0.16,1,0.3,1)',
      pointerEvents: 'none',
    }}>
      {/* Label */}
      <span style={{
        fontFamily: MONO, fontSize: 7, letterSpacing: '0.10em',
        color: 'rgba(60,72,95,0.65)', marginRight: 10, textTransform: 'uppercase',
      }}>
        Agent Trail
      </span>

      {TRAIL_STEPS.map((step, i) => {
        const { r, g, b } = hexRgb(step.accent);
        const isDone   = completedSteps.includes(step.id);
        const isActive = activeStep === step.id;
        const isTarget = relay?.targetPod === step.id;

        return (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {/* Connector */}
            {i > 0 && (
              <div style={{
                width: 18, height: 1, margin: '0 2px',
                background: isDone
                  ? `rgba(${r},${g},${b},0.50)`
                  : 'rgba(40,50,70,0.55)',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* Animated particle on active connector */}
                {isTarget && (
                  <div style={{
                    position: 'absolute', top: -1,
                    width: 6, height: 3,
                    borderRadius: '50%',
                    background: step.accent,
                    boxShadow: `0 0 6px ${step.accent}`,
                    animation: 'trail-particle 0.6s ease-out',
                  }} />
                )}
              </div>
            )}

            {/* Step node */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 7px',
              borderRadius: 10,
              background: isActive
                ? `rgba(${r},${g},${b},0.12)`
                : isDone
                  ? `rgba(${r},${g},${b},0.06)`
                  : 'transparent',
              border: isActive
                ? `1px solid rgba(${r},${g},${b},0.30)`
                : '1px solid transparent',
              transition: 'all 0.20s',
            }}>
              {isDone && !isActive
                ? <Check size={9} color={step.accent} />
                : <step.icon
                    size={9}
                    color={isActive ? step.accent : 'rgba(60,72,95,0.50)'}
                    style={{ animation: isActive ? 'trail-pulse 1s ease-in-out infinite' : 'none' }}
                  />
              }
              <span style={{
                fontFamily: MONO, fontSize: 7.5, letterSpacing: '0.04em',
                color: isActive
                  ? step.accent
                  : isDone
                    ? `rgba(${r},${g},${b},0.60)`
                    : 'rgba(50,62,85,0.50)',
                transition: 'color 0.20s',
              }}>
                {step.label}
              </span>
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes trail-in { from { opacity:0; transform: translateX(-50%) translateY(-6px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }
        @keyframes trail-pulse { 0%,100%{opacity:0.7} 50%{opacity:1} }
        @keyframes trail-particle { from{left:-6px} to{left:22px} }
      `}</style>
    </div>
  );
}
