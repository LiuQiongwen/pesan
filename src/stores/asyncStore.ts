/**
 * asyncStore — pending operations, status enums, workflow relay.
 * All transient — never persisted.
 */
import { create } from 'zustand';
import type { PodId } from './panelStore';

export interface PendingConnection {
  sourceId: string;
  targetId: string;
  suggestedType: string;
}

export interface PendingGalaxy {
  noteId: string;
  targetTag: string | null;
}

export interface WorkflowRelay {
  content: string;
  sourcePod: PodId;
  targetPod: PodId;
  timestamp: number;
}

interface AsyncState {
  pendingConn: PendingConnection | null;
  connectStatus: 'idle' | 'saving' | 'saved' | 'error';
  pendingGalaxy: PendingGalaxy | null;
  galaxyStatus: 'idle' | 'saved' | 'error';
  pendingDeleteId: string | null;
  undoInfo: { noteId: string; title: string } | null;
  pendingGalaxyDelete: { tag: string; mode: 'dissolve' | 'delete_all' } | null;
  galaxyUndoInfo: { tag: string; noteIds: string[]; oldTags: Record<string, string[]> } | null;

  // Agent workflow relay
  relay: WorkflowRelay | null;
  activeStep: PodId | null;
  completedSteps: PodId[];

  // Actions
  setPendingConn: (conn: PendingConnection | null) => void;
  setConnectStatus: (status: 'idle' | 'saving' | 'saved' | 'error') => void;
  setPendingGalaxy: (galaxy: PendingGalaxy | null) => void;
  setGalaxyStatus: (status: 'idle' | 'saved' | 'error') => void;
  setPendingDeleteId: (id: string | null) => void;
  setUndoInfo: (info: { noteId: string; title: string } | null) => void;
  setPendingGalaxyDelete: (info: { tag: string; mode: 'dissolve' | 'delete_all' } | null) => void;
  setGalaxyUndoInfo: (info: { tag: string; noteIds: string[]; oldTags: Record<string, string[]> } | null) => void;

  // Relay actions
  sendRelay: (content: string, from: PodId, to: PodId) => void;
  consumeRelay: (podId: PodId) => string | null;
  setActiveStep: (step: PodId | null) => void;
  markStepComplete: (step: PodId) => void;
  clearWorkflow: () => void;
}

export const useAsyncStore = create<AsyncState>((set, get) => ({
  pendingConn: null,
  connectStatus: 'idle',
  pendingGalaxy: null,
  galaxyStatus: 'idle',
  pendingDeleteId: null,
  undoInfo: null,
  pendingGalaxyDelete: null,
  galaxyUndoInfo: null,
  relay: null,
  activeStep: null,
  completedSteps: [],

  setPendingConn: (pendingConn) => set({ pendingConn }),
  setConnectStatus: (connectStatus) => set({ connectStatus }),
  setPendingGalaxy: (pendingGalaxy) => set({ pendingGalaxy }),
  setGalaxyStatus: (galaxyStatus) => set({ galaxyStatus }),
  setPendingDeleteId: (pendingDeleteId) => set({ pendingDeleteId }),
  setUndoInfo: (undoInfo) => set({ undoInfo }),
  setPendingGalaxyDelete: (pendingGalaxyDelete) => set({ pendingGalaxyDelete }),
  setGalaxyUndoInfo: (galaxyUndoInfo) => set({ galaxyUndoInfo }),

  sendRelay: (content, from, to) => set({
    relay: { content, sourcePod: from, targetPod: to, timestamp: Date.now() },
    activeStep: to,
  }),
  consumeRelay: (podId) => {
    const { relay } = get();
    if (relay?.targetPod === podId) {
      const c = relay.content;
      set({ relay: null });
      return c;
    }
    return null;
  },
  setActiveStep: (activeStep) => set({ activeStep }),
  markStepComplete: (step) => set((s) => ({
    completedSteps: s.completedSteps.includes(step) ? s.completedSteps : [...s.completedSteps, step],
  })),
  clearWorkflow: () => set({ activeStep: null, relay: null, completedSteps: [] }),
}));
