/**
 * AgentWorkflowContext — shared relay bus for cross-pod content passing.
 * When one pod finishes processing it can "relay" its output to the next pod,
 * automatically opening that pod and pre-filling it with content.
 */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { PodId } from './ToolboxContext';

export interface WorkflowRelay {
  content: string;
  sourcePod: PodId;
  targetPod: PodId;
  timestamp: number;
}

interface AgentWorkflowState {
  activeStep: PodId | null;
  relay: WorkflowRelay | null;
  completedSteps: PodId[];
  // Actions
  setActiveStep: (step: PodId | null) => void;
  sendRelay: (content: string, from: PodId, to: PodId) => void;
  consumeRelay: (podId: PodId) => string | null; // returns content if this pod is the target
  markStepComplete: (step: PodId) => void;
  clearWorkflow: () => void;
}

const AgentWorkflowContext = createContext<AgentWorkflowState | null>(null);

export function AgentWorkflowProvider({
  children,
  onOpenPod,
}: {
  children: ReactNode;
  onOpenPod: (id: PodId) => void;
}) {
  const [activeStep,     setActiveStepState] = useState<PodId | null>(null);
  const [relay,          setRelay]           = useState<WorkflowRelay | null>(null);
  const [completedSteps, setCompletedSteps]  = useState<PodId[]>([]);

  const setActiveStep = useCallback((step: PodId | null) => {
    setActiveStepState(step);
  }, []);

  const sendRelay = useCallback((content: string, from: PodId, to: PodId) => {
    setRelay({ content, sourcePod: from, targetPod: to, timestamp: Date.now() });
    setActiveStepState(to);
    onOpenPod(to);
  }, [onOpenPod]);

  const consumeRelay = useCallback((podId: PodId): string | null => {
    if (relay?.targetPod === podId) {
      const c = relay.content;
      setRelay(null);
      return c;
    }
    return null;
  }, [relay]);

  const markStepComplete = useCallback((step: PodId) => {
    setCompletedSteps(prev => prev.includes(step) ? prev : [...prev, step]);
  }, []);

  const clearWorkflow = useCallback(() => {
    setActiveStepState(null);
    setRelay(null);
    setCompletedSteps([]);
  }, []);

  return (
    <AgentWorkflowContext.Provider value={{
      activeStep, relay, completedSteps,
      setActiveStep, sendRelay, consumeRelay, markStepComplete, clearWorkflow,
    }}>
      {children}
    </AgentWorkflowContext.Provider>
  );
}

export function useAgentWorkflow() {
  const ctx = useContext(AgentWorkflowContext);
  if (!ctx) throw new Error('useAgentWorkflow must be inside AgentWorkflowProvider');
  return ctx;
}
