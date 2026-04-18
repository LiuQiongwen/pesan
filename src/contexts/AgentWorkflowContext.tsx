/**
 * AgentWorkflowContext — backward-compatible shim wrapping useAsyncStore (Zustand).
 * New code should import useAsyncStore directly.
 */
import { createContext, useContext, useCallback, type ReactNode } from 'react';
import { useAsyncStore, type WorkflowRelay } from '@/stores/asyncStore';
import type { PodId } from '@/stores/panelStore';

export type { WorkflowRelay };

interface AgentWorkflowState {
  activeStep: PodId | null;
  relay: WorkflowRelay | null;
  completedSteps: PodId[];
  setActiveStep: (step: PodId | null) => void;
  sendRelay: (content: string, from: PodId, to: PodId) => void;
  consumeRelay: (podId: PodId) => string | null;
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
  const store = useAsyncStore();

  const sendRelay = useCallback((content: string, from: PodId, to: PodId) => {
    store.sendRelay(content, from, to);
    onOpenPod(to);
  }, [onOpenPod, store]);

  return (
    <AgentWorkflowContext.Provider value={{
      activeStep: store.activeStep,
      relay: store.relay,
      completedSteps: store.completedSteps,
      setActiveStep: store.setActiveStep,
      sendRelay,
      consumeRelay: store.consumeRelay,
      markStepComplete: store.markStepComplete,
      clearWorkflow: store.clearWorkflow,
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
