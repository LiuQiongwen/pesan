/**
 * AgentPipeline — visual processing chain display
 * Shows the 7-step agent pipeline during capture processing.
 * Designed to fit inside the 280–360px CaptureBox pod.
 */
import { memo } from 'react';
import { CheckCircle, Circle, XCircle } from 'lucide-react';
import type { PipelineStep, PipelineResult } from '@/hooks/useAgentPipeline';
import type { NodeType } from '@/types';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";
const G     = '#00ff66';

// Node type config for result display
const NODE_TYPE_CONFIG: Record<NodeType, { label: string; color: string; symbol: string }> = {
  capture:  { label: 'Capture',  color: '#00ff66', symbol: '●' },
  summary:  { label: 'Summary',  color: '#66f0ff', symbol: '◆' },
  insight:  { label: 'Insight',  color: '#b496ff', symbol: '✦' },
  action:   { label: 'Action',   color: '#ff4466', symbol: '▲' },
  question: { label: 'Question', color: '#ffa040', symbol: '?' },
  relation: { label: 'Relation', color: '#c0c8d8', symbol: '↔' },
};

interface AgentPipelineProps {
  steps: PipelineStep[];
  result: PipelineResult | null;
  error: string | null;
}

function StepIcon({ status }: { status: PipelineStep['status'] }) {
  if (status === 'done')   return <CheckCircle size={11} color={G} />;
  if (status === 'error')  return <XCircle size={11} color="#ff4466" />;
  if (status === 'active') return (
    <div style={{
      width: 11, height: 11, borderRadius: '50%',
      border: `1.5px solid ${G}`,
      borderTopColor: 'transparent',
      animation: 'pipeline-spin 0.8s linear infinite',
      flexShrink: 0,
    }} />
  );
  return <Circle size={11} color="rgba(60,72,95,0.40)" />;
}

export const AgentPipeline = memo(function AgentPipeline({ steps, result, error }: AgentPipelineProps) {
  const allDone = result !== null;
  const totalNodes = allDone ? 1 + result.derivedNodes.length : 0;

  return (
    <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 10, paddingBottom: 8,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: allDone ? G : error ? '#ff4466' : G,
          boxShadow: `0 0 6px ${allDone ? G : error ? '#ff4466' : G}`,
          animation: !allDone && !error ? 'pipeline-pulse 1.4s ease-in-out infinite' : 'none',
        }} />
        <span style={{
          fontFamily: MONO, fontSize: 9, letterSpacing: '0.10em',
          color: allDone ? `${G}cc` : error ? '#ff4466cc' : `${G}99`,
          textTransform: 'uppercase',
        }}>
          {allDone ? `Agent Complete · ${totalNodes} nodes` : error ? 'Agent Error' : 'Agent Processing…'}
        </span>
      </div>

      {/* Step list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {steps.map((step) => (
          <div
            key={step.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 0',
              opacity: step.status === 'pending' ? 0.35 : 1,
              transition: 'opacity 0.3s',
            }}
          >
            <StepIcon status={step.status} />
            <span style={{
              fontFamily: MONO, fontSize: 10,
              color: step.status === 'active'  ? 'rgba(210,222,240,0.95)'
                   : step.status === 'done'    ? `${G}cc`
                   : step.status === 'error'   ? '#ff4466cc'
                   : 'rgba(80,95,120,0.55)',
              flex: 1, letterSpacing: '0.02em',
            }}>
              {step.label}
            </span>
            <span style={{
              fontFamily: MONO, fontSize: 8,
              color: 'rgba(40,52,72,0.60)',
              letterSpacing: '0.06em',
            }}>
              {step.sublabel}
            </span>
          </div>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div style={{
          marginTop: 8, padding: '6px 9px',
          background: 'rgba(255,68,102,0.08)',
          border: '1px solid rgba(255,68,102,0.18)',
          borderRadius: 6,
          fontFamily: INTER, fontSize: 10,
          color: '#ff4466cc',
        }}>
          {error}
        </div>
      )}

      {/* Result: generated nodes */}
      {allDone && result && (
        <div style={{
          marginTop: 10, paddingTop: 8,
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(60,72,95,0.55)', letterSpacing: '0.08em', marginBottom: 2 }}>
            GENERATED NODES
          </div>

          {/* Main capture node */}
          <ResultNode type="capture" label="原始捕捉" />

          {/* Derived nodes */}
          {result.derivedNodes.map(n => (
            <ResultNode key={n.id} type={n.node_type} label={n.title} />
          ))}
        </div>
      )}

      <style>{`
        @keyframes pipeline-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes pipeline-pulse {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 1; }
        }
      `}</style>
    </div>
  );
});

function ResultNode({ type, label }: { type: NodeType; label: string }) {
  const cfg = NODE_TYPE_CONFIG[type];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      padding: '4px 8px',
      background: `${cfg.color}0d`,
      border: `1px solid ${cfg.color}22`,
      borderRadius: 5,
    }}>
      <span style={{ fontFamily: MONO, fontSize: 10, color: cfg.color }}>{cfg.symbol}</span>
      <span style={{ fontFamily: MONO, fontSize: 9, color: `${cfg.color}cc`, letterSpacing: '0.04em' }}>
        {cfg.label}
      </span>
      <span style={{
        fontFamily: MONO, fontSize: 8, color: 'rgba(140,155,180,0.55)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
      }}>
        {label}
      </span>
    </div>
  );
}
