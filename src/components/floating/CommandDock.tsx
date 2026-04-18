/**
 * CommandDock — Desktop-scale sci-fi control console
 * Fully responsive: clamp(min, vw/vh, max) on all sizing properties.
 * Supports "drag-to-pod" receiving mode: listens to cosmos:pod-drag CustomEvent
 * dispatched by CosmosScene when a node is being dragged.
 */
import { useState, useEffect, useRef } from 'react';
import { Inbox, Telescope, Sparkles, Library, Rocket, Check, ClipboardList } from 'lucide-react';
import { useToolbox, type PodId } from '@/contexts/ToolboxContext';
import { useAgentWorkflow } from '@/contexts/AgentWorkflowContext';
import { HintPulse } from '@/components/hints/HintPulse';
import { useHintState } from '@/hooks/useHintState';
import { type LucideIcon } from 'lucide-react';
import { PestaLogo } from '@/components/brand/PestaLogo';
import { useDevice } from '@/hooks/useDevice';
import { MobileTabBar } from '@/components/floating/MobileTabBar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useActiveUniverse } from '@/contexts/UniverseContext';

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
  { id: 'capture',   icon: Inbox,      label: 'Capture',   sublabel: '捕获知识', accent: '#00ff66' },
  { id: 'retrieval', icon: Telescope,  label: 'Retrieval', sublabel: '语义检索', accent: '#66f0ff' },
  { id: 'insight',   icon: Sparkles,   label: 'Insight',   sublabel: '知识精炼', accent: '#b496ff' },
  { id: 'memory',    icon: Library,    label: 'Memory',    sublabel: '记忆唤醒', accent: '#ffa040' },
  { id: 'action',    icon: Rocket,     label: 'Action',    sublabel: '知识执行', accent: '#ff4466' },
];

function hexRgb(hex: string) {
  return { r: parseInt(hex.slice(1,3),16), g: parseInt(hex.slice(3,5),16), b: parseInt(hex.slice(5,7),16) };
}

export function CommandDock() {
  const { isPhone } = useDevice();

  // Phone: use bottom tab bar
  if (isPhone) return <MobileTabBar />;

  return <DesktopCommandDock />;
}

function DesktopCommandDock() {
  const { pods, togglePod } = useToolbox();
  const { activeStep, completedSteps } = useAgentWorkflow();
  const { user } = useAuth();
  const { activeUniverseId } = useActiveUniverse();
  const hints = useHintState();
  const showCapturePulse = hints.shouldShowHint('first_create_star');
  const showDragHint = hints.shouldShowHint('drag_to_pod');
  const [nodeWinOpen, setNodeWinOpen] = useState(false);
  const [hoveredId,     setHoveredId]     = useState<PodId | null>(null);
  const [dragActive,    setDragActive]    = useState(false);
  const [dragHoverId,   setDragHoverId]   = useState<PodId | null>(null);
  const [candidateCount, setCandidateCount] = useState(0);
  const buttonRefs = useRef<Map<PodId, HTMLButtonElement>>(new Map());

  // Poll candidate count
  useEffect(() => {
    if (!user?.id || !activeUniverseId) return;
    const fetch = async () => {
      const { count } = await supabase
        .from('candidate_nodes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('universe_id', activeUniverseId);
      setCandidateCount(count ?? 0);
    };
    fetch();
    const channel = supabase
      .channel('candidate-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidate_nodes', filter: `user_id=eq.${user.id}` }, () => { fetch(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, activeUniverseId]);

  // Listen to drag CustomEvents dispatched by CosmosScene
  useEffect(() => {
    const onDrag = (e: Event) => {
      const evt = e as CustomEvent<{ active: boolean; x: number; y: number }>;
      const { active, x, y } = evt.detail;
      setDragActive(active);

      if (!active) {
        setDragHoverId(null);
        return;
      }

      // Determine which button the cursor is closest to / over
      let hovered: PodId | null = null;
      for (const [podId, el] of buttonRefs.current.entries()) {
        const rect = el.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          hovered = podId;
          break;
        }
      }
      // If cursor is in the dock zone but not over a button, find the nearest one by X
      if (!hovered && y > window.innerHeight - 240) {
        let minDist = Infinity;
        for (const [podId, el] of buttonRefs.current.entries()) {
          const rect = el.getBoundingClientRect();
          const centerX = (rect.left + rect.right) / 2;
          const dist = Math.abs(x - centerX);
          if (dist < minDist) { minDist = dist; hovered = podId; }
        }
      }
      setDragHoverId(y > window.innerHeight - 220 ? hovered : null);
    };

    window.addEventListener('cosmos:pod-drag', onDrag);
    return () => window.removeEventListener('cosmos:pod-drag', onDrag);
  }, []);

  // Track node window open state for drag hint glow
  useEffect(() => {
    const onOpen  = () => setNodeWinOpen(true);
    const onClose = () => setNodeWinOpen(false);
    window.addEventListener('tour-node-opened', onOpen);
    window.addEventListener('node-window-closed', onClose);
    return () => {
      window.removeEventListener('tour-node-opened', onOpen);
      window.removeEventListener('node-window-closed', onClose);
    };
  }, []);

  const lastCompleted = completedSteps[completedSteps.length - 1];
  const lastCompletedIdx = lastCompleted ? STEPS.findIndex(s => s.id === lastCompleted) : -1;
  const recommendedNext = lastCompletedIdx >= 0 && lastCompletedIdx < STEPS.length - 1
    ? STEPS[lastCompletedIdx + 1].id
    : (activeStep ? STEPS[STEPS.findIndex(s => s.id === activeStep) + 1]?.id : null);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'var(--dock-bottom)',
        left: '50%',
        transform: dragActive ? 'translateX(-50%) translateY(-8px)' : 'translateX(-50%)',
        zIndex: 30,
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
        background: dragActive
          ? 'rgba(3,8,20,0.99)'
          : 'rgba(3,5,12,0.97)',
        backdropFilter: 'blur(40px) saturate(2)',
        WebkitBackdropFilter: 'blur(40px) saturate(2)',
        border: dragActive
          ? '1px solid rgba(255,255,255,0.20)'
          : '1px solid rgba(255,255,255,0.10)',
        borderRadius: 'clamp(14px, 1.6vw, 22px)',
        padding: 'clamp(8px,0.8vh,12px) clamp(12px,1.1vw,18px)',
        boxShadow: dragActive
          ? `0 8px 60px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.10), inset 0 1px 0 rgba(255,255,255,0.08), 0 -2px 40px rgba(255,255,255,0.04)`
          : `0 8px 48px rgba(0,0,0,0.90), 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.06)`,
        maxWidth: 'calc(100vw - 24px)',
        transition: 'transform 0.28s cubic-bezier(0.22,1,0.36,1), box-shadow 0.22s ease, border-color 0.22s ease, background 0.22s ease',
      }}
    >
      {/* Drag-mode hint bar */}
      {dragActive && (
        <div style={{
          position: 'absolute',
          top: -28,
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: MONO,
          fontSize: 'clamp(7px,0.7vw,9px)',
          letterSpacing: '0.10em',
          color: 'rgba(255,255,255,0.50)',
          background: 'rgba(3,8,20,0.90)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 6,
          padding: '3px 10px',
          whiteSpace: 'nowrap' as const,
          pointerEvents: 'none',
          animation: 'dock-hint-in 0.2s ease-out',
        }}>
          释放以委托给能力舱
        </div>
      )}

      {/* Left brand mark */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        paddingRight: 'clamp(10px, 1.1vw, 18px)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        marginRight: 'clamp(10px, 1.1vw, 18px)',
        gap: 3,
      }}>
        <PestaLogo size={32} iconOnly />
        <span style={{
          fontFamily: MONO,
          fontSize: 'clamp(6.5px, 0.6vw, 8.5px)',
          color: 'rgba(60,75,100,0.60)', letterSpacing: '0.06em',
        }}>PESTA</span>
      </div>

      {/* Pipeline steps */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(5px, 0.6vw, 10px)' }}>
        {STEPS.map((step, i) => {
          const { r, g, b } = hexRgb(step.accent);
          const isOpen       = pods[step.id]?.open;
          const isActive     = activeStep === step.id;
          const isDone       = completedSteps.includes(step.id);
          const isRecommend  = recommendedNext === step.id && !isOpen;
          const isHovered    = hoveredId === step.id;
          const isDragTarget = dragActive && dragHoverId === step.id;

          const accentAlpha = (a: number) => `rgba(${r},${g},${b},${a})`;

          // Label override during drag hover
          const displayLabel = isDragTarget ? '委托' : step.label;

          return (
            <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 'clamp(5px, 0.6vw, 10px)' }}>
              {/* Connector line */}
              {i > 0 && (
                <div style={{
                  width: 'clamp(8px, 1.2vw, 20px)', height: 1,
                  background: isDone
                    ? `linear-gradient(90deg, ${accentAlpha(0.40)}, rgba(255,255,255,0.08))`
                    : dragActive
                      ? 'rgba(255,255,255,0.12)'
                      : 'rgba(255,255,255,0.06)',
                  flexShrink: 0,
                  transition: 'background 0.2s',
                }} />
              )}

              {/* Step button */}
              <button
                data-pod-id={step.id}
                ref={el => { if (el) buttonRefs.current.set(step.id, el); else buttonRefs.current.delete(step.id); }}
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
                  gap: 'clamp(4px, 0.5vh, 7px)',
                  width: isDragTarget
                    ? 'clamp(68px, 6.6vw, 96px)'
                    : dragActive
                      ? 'clamp(64px, 6.2vw, 90px)'
                      : 'clamp(62px, 6.0vw, 88px)',
                  height: isDragTarget
                    ? 'clamp(56px, 5.8vh, 74px)'
                    : dragActive
                      ? 'clamp(52px, 5.4vh, 70px)'
                      : 'clamp(50px, 5.2vh, 68px)',
                  borderRadius: 'clamp(10px, 1.1vw, 15px)',
                  border: isDragTarget
                    ? `2px solid ${accentAlpha(0.90)}`
                    : dragActive
                      ? `1px solid ${accentAlpha(0.35)}`
                      : isOpen
                        ? `1.5px solid ${accentAlpha(0.70)}`
                        : isActive
                          ? `1.5px solid ${accentAlpha(0.45)}`
                          : isRecommend
                            ? `1px solid ${accentAlpha(0.30)}`
                            : isHovered
                              ? `1px solid ${accentAlpha(0.35)}`
                              : '1px solid rgba(255,255,255,0.06)',
                  background: isDragTarget
                    ? `linear-gradient(160deg, ${accentAlpha(0.28)}, ${accentAlpha(0.14)})`
                    : dragActive
                      ? accentAlpha(0.08)
                      : isOpen
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
                  transform: isDragTarget
                    ? 'translateY(-6px) scale(1.05)'
                    : dragActive
                      ? 'translateY(-2px)'
                      : isHovered
                        ? 'translateY(-3px)'
                        : 'translateY(0)',
                  boxShadow: isDragTarget
                    ? `0 0 36px ${accentAlpha(0.60)}, 0 8px 30px rgba(0,0,0,0.70), inset 0 1px 0 ${accentAlpha(0.30)}`
                    : dragActive
                      ? `0 0 16px ${accentAlpha(0.22)}, 0 4px 16px rgba(0,0,0,0.60)`
                      : isOpen
                        ? `0 0 24px ${accentAlpha(0.35)}, 0 4px 20px rgba(0,0,0,0.60), inset 0 1px 0 ${accentAlpha(0.20)}`
                        : isActive
                          ? `0 0 16px ${accentAlpha(0.22)}, 0 4px 16px rgba(0,0,0,0.50)`
                          : isHovered
                            ? `0 0 14px ${accentAlpha(0.18)}, 0 6px 20px rgba(0,0,0,0.60)`
                            : '0 2px 8px rgba(0,0,0,0.40)',
                  animation: isDragTarget
                    ? 'dock-receive 0.8s ease-in-out infinite'
                    : isRecommend
                      ? 'dock-pulse 2.4s ease-in-out infinite'
                      : 'none',
                  flexShrink: 0,
                  overflow: 'hidden',
                }}
              >
                {/* Drag-receiving shimmer overlay */}
                {isDragTarget && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: `linear-gradient(135deg, ${accentAlpha(0.15)} 0%, transparent 50%, ${accentAlpha(0.08)} 100%)`,
                    borderRadius: 'inherit',
                    animation: 'dock-shimmer 1.2s ease-in-out infinite',
                    pointerEvents: 'none',
                  }} />
                )}

                {/* Icon with glow container */}
                <div style={{
                  width: 'clamp(26px, 2.4vw, 34px)',
                  height: 'clamp(26px, 2.4vw, 34px)',
                  borderRadius: 'clamp(7px, 0.7vw, 10px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isDragTarget || isOpen || isHovered ? accentAlpha(0.15) : 'transparent',
                  transition: 'background 0.16s',
                }}>
                  <step.icon
                    size={22}
                    color={isDragTarget || isOpen || isActive || isDone || isHovered || dragActive
                      ? step.accent
                      : 'rgba(80,95,125,0.55)'}
                    style={{
                      transition: 'color 0.16s',
                      filter: isDragTarget
                        ? `drop-shadow(0 0 8px ${accentAlpha(0.90)})`
                        : isOpen
                          ? `drop-shadow(0 0 6px ${accentAlpha(0.70)})`
                          : 'none',
                      width: 'clamp(15px, 1.5vw, 22px)',
                      height: 'clamp(15px, 1.5vw, 22px)',
                    }}
                  />
                </div>

                {/* Labels */}
                <div style={{ textAlign: 'center', lineHeight: 1 }}>
                  <div style={{
                    fontFamily: isDragTarget ? MONO : INTER,
                    fontSize: isDragTarget
                      ? 'clamp(9px, 0.85vw, 12px)'
                      : 'clamp(10px, 0.9vw, 13px)',
                    fontWeight: 600,
                    color: isDragTarget
                      ? accentAlpha(1.0)
                      : isOpen || isActive || isDone
                        ? accentAlpha(0.95)
                        : isHovered || dragActive
                          ? 'rgba(200,215,240,0.85)'
                          : 'rgba(120,140,175,0.65)',
                    transition: 'color 0.16s',
                    letterSpacing: isDragTarget ? '0.06em' : '0.01em',
                    marginBottom: 1,
                  }}>
                    {displayLabel}
                  </div>
                  <div style={{
                    fontFamily: MONO,
                    fontSize: 'clamp(7.5px, 0.7vw, 9.5px)',
                    color: isDragTarget
                      ? accentAlpha(0.70)
                      : isOpen
                        ? accentAlpha(0.60)
                        : 'rgba(70,85,115,0.55)',
                    transition: 'color 0.16s',
                    letterSpacing: '0.04em',
                  }}>
                    {isDragTarget ? '释放委托' : step.sublabel}
                  </div>
                </div>

                {/* Done checkmark badge */}
                {isDone && !isActive && !isDragTarget && (
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
                {isActive && !isDragTarget && (
                  <div style={{
                    position: 'absolute', inset: -3,
                    borderRadius: 17,
                    border: `1.5px solid ${accentAlpha(0.55)}`,
                    animation: 'dock-ring 1.4s ease-out infinite',
                    pointerEvents: 'none',
                  }} />
                )}

                {/* Recommended badge */}
                {isRecommend && !dragActive && (
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

                {/* Hint pulse for new users — Capture pod */}
                {step.id === 'capture' && showCapturePulse && !isDragTarget && !isActive && (
                  <div style={{
                    position: 'absolute', inset: -3,
                    borderRadius: 17,
                    border: `1.5px solid ${accentAlpha(0.45)}`,
                    animation: 'hint-pulse-ring 2.2s ease-out infinite',
                    pointerEvents: 'none',
                  }} />
                )}

                {/* Drag-to-pod hint glow for non-capture pods */}
                {step.id !== 'capture' && showDragHint && nodeWinOpen && !isDragTarget && !isActive && (
                  <div style={{
                    position: 'absolute', inset: -2,
                    borderRadius: 16,
                    border: `1px solid ${accentAlpha(0.30)}`,
                    boxShadow: `0 0 12px ${accentAlpha(0.15)}`,
                    pointerEvents: 'none',
                    transition: 'opacity 0.3s',
                  }} />
                )}

                {/* Open indicator bar */}
                {isOpen && !isDragTarget && (
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

      {/* Staging workbench button */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        paddingLeft: 'clamp(10px, 1.1vw, 18px)',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
        marginLeft: 'clamp(6px, 0.8vw, 12px)',
      }}>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-staging'))}
          title="候选工作台"
          style={{
            position: 'relative',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 'clamp(3px, 0.4vh, 5px)',
            width: 'clamp(48px, 4.8vw, 66px)',
            height: 'clamp(42px, 4.4vh, 58px)',
            borderRadius: 'clamp(8px, 0.9vw, 12px)',
            border: candidateCount > 0 ? '1px solid rgba(255,160,64,0.35)' : '1px solid rgba(255,255,255,0.06)',
            background: candidateCount > 0 ? 'rgba(255,160,64,0.06)' : 'rgba(255,255,255,0.02)',
            cursor: 'pointer',
            transition: 'all 0.16s',
          }}
        >
          <ClipboardList
            size={16}
            color={candidateCount > 0 ? '#ffa040' : 'rgba(80,95,125,0.55)'}
            style={{ width: 'clamp(13px, 1.3vw, 18px)', height: 'clamp(13px, 1.3vw, 18px)' }}
          />
          <span style={{
            fontFamily: MONO,
            fontSize: 'clamp(7px, 0.65vw, 8.5px)',
            color: candidateCount > 0 ? 'rgba(255,160,64,0.80)' : 'rgba(70,85,115,0.55)',
            letterSpacing: '0.04em',
          }}>
            候选
          </span>
          {candidateCount > 0 && (
            <span style={{
              position: 'absolute', top: 2, right: 2,
              minWidth: 14, height: 14, borderRadius: 7,
              background: '#ffa040',
              fontFamily: MONO, fontSize: 8, fontWeight: 700,
              color: '#040508',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 3px',
              boxShadow: '0 0 6px rgba(255,160,64,0.50)',
            }}>
              {candidateCount > 99 ? '99+' : candidateCount}
            </span>
          )}
        </button>
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
        @keyframes dock-receive {
          0%,100% { box-shadow: var(--receive-shadow-min); }
          50%     { box-shadow: var(--receive-shadow-max); }
        }
        @keyframes dock-shimmer {
          0%   { opacity: 0.6; }
          50%  { opacity: 1.0; }
          100% { opacity: 0.6; }
        }
        @keyframes dock-hint-in {
          from { opacity: 0; transform: translateX(-50%) translateY(4px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0);   }
        }
      `}</style>
    </div>
  );
}
