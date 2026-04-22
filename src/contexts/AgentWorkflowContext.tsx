/**
 * AgentWorkflowContext — backward-compatible shim wrapping useAsyncStore (Zustand).
 * New code should import useAsyncStore directly.
 */
import { createContext, useContext, useCallback, useMemo, type ReactNode } from 'react';
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
  // Subscribe to individual state slices to avoid infinite re-render loop
  const activeStep = useAsyncStore(s => s.activeStep);
  const relay = useAsyncStore(s => s.relay);
  const completedSteps = useAsyncStore(s => s.completedSteps);

  // Actions are stable references — grab from getState once
  const storeActions = useMemo(() => ({
    setActiveStep: useAsyncStore.getState().setActiveStep,
    consumeRelay: useAsyncStore.getState().consumeRelay,
    markStepComplete: useAsyncStore.getState().markStepComplete,
    clearWorkflow: useAsyncStore.getState().clearWorkflow,
    _sendRelay: useAsyncStore.getState().sendRelay,
  }), []);

  const sendRelay = useCallback((content: string, from: PodId, to: PodId) => {
    storeActions._sendRelay(content, from, to);
    onOpenPod(to);
  }, [onOpenPod, storeActions]);

  const value = useMemo<AgentWorkflowState>(() => ({
    activeStep,
    relay,
    completedSteps,
    setActiveStep: storeActions.setActiveStep,
    sendRelay,
    consumeRelay: storeActions.consumeRelay,
    markStepComplete: storeActions.markStepComplete,
    clearWorkflow: storeActions.clearWorkflow,
  }), [activeStep, relay, completedSteps, storeActions, sendRelay]);

  return (
    <AgentWorkflowContext.Provider value={value}>
      {children}
    </AgentWorkflowContext.Provider>
  );
}

export function useAgentWorkflow() {
  const ctx = useContext(AgentWorkflowContext);
  if (!ctx) throw new Error('useAgentWorkflow must be inside AgentWorkflowProvider');
  return ctx;
}
