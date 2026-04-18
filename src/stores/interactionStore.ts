/**
 * interactionStore — high-frequency interaction FSM + hover state.
 * Subscribers use selectors for fine-grained subscriptions.
 */
import { create } from 'zustand';
import type { HoveredNodeInfo } from '@/components/starmap/KnowledgeStarMap';

interface InteractionState {
  hoveredNode: HoveredNodeInfo | null;
  mode: 'browse' | 'connect';
  connectFromId: string | null;
  selectedNodeId: string | null;
  openNodes: Set<string>;
  mobileCardNoteId: string | null;
  ctxMenu: { noteId: string; x: number; y: number } | null;
  galaxyCtx: { tag: string; x: number; y: number } | null;
  anchorNoteId: string | null;
  workbenchSelectedIds: string[];
  workbenchActive: boolean;
  nodeWindowOpen: boolean;
  tagFilter: string | null;
  connectModeInfo: { mode: 'browse' | 'connect'; fromTitle?: string };

  // Perf diagnostics
  perfEnabled: boolean;
  bloomEnabled: boolean;
  starFieldEnabled: boolean;
  edgesEnabled: boolean;
  labelsEnabled: boolean;
  raycastThrottle: number;

  // Actions
  setHoveredNode: (node: HoveredNodeInfo | null) => void;
  setMode: (mode: 'browse' | 'connect') => void;
  setConnectFromId: (id: string | null) => void;
  setSelectedNodeId: (id: string | null) => void;
  toggleNode: (id: string, isPhone: boolean) => void;
  closeAllNodes: () => void;
  setMobileCardNoteId: (id: string | null) => void;
  setCtxMenu: (menu: { noteId: string; x: number; y: number } | null) => void;
  setGalaxyCtx: (ctx: { tag: string; x: number; y: number } | null) => void;
  setAnchorNoteId: (id: string | null) => void;
  toggleWorkbenchSelect: (noteId: string) => void;
  activateWorkbench: () => void;
  clearWorkbench: () => void;
  removeFromWorkbench: (noteId: string) => void;
  setNodeWindowOpen: (open: boolean) => void;
  setTagFilter: (tag: string | null) => void;
  setConnectModeInfo: (info: { mode: 'browse' | 'connect'; fromTitle?: string }) => void;
  resetConnectMode: () => void;
  escapeAll: () => void;

  // Perf actions
  setPerfEnabled: (v: boolean) => void;
  togglePerfEnabled: () => void;
  setBloomEnabled: (v: boolean) => void;
  toggleBloomEnabled: () => void;
  setStarFieldEnabled: (v: boolean) => void;
  toggleStarFieldEnabled: () => void;
  setEdgesEnabled: (v: boolean) => void;
  toggleEdgesEnabled: () => void;
  setLabelsEnabled: (v: boolean) => void;
  toggleLabelsEnabled: () => void;
  setRaycastThrottle: (v: number) => void;
  cycleRaycastThrottle: () => void;
}

export const useInteractionStore = create<InteractionState>((set) => ({
  hoveredNode: null,
  mode: 'browse',
  connectFromId: null,
  selectedNodeId: null,
  openNodes: new Set(),
  mobileCardNoteId: null,
  ctxMenu: null,
  galaxyCtx: null,
  anchorNoteId: null,
  workbenchSelectedIds: [],
  workbenchActive: false,
  nodeWindowOpen: false,
  tagFilter: null,
  connectModeInfo: { mode: 'browse' },

  perfEnabled: false,
  bloomEnabled: true,
  starFieldEnabled: true,
  edgesEnabled: true,
  labelsEnabled: true,
  raycastThrottle: 3,

  setHoveredNode: (hoveredNode) => set({ hoveredNode }),
  setMode: (mode) => set({ mode }),
  setConnectFromId: (connectFromId) => set({ connectFromId }),
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
  toggleNode: (id, isPhone) => set((s) => {
    if (isPhone) {
      return { mobileCardNoteId: s.mobileCardNoteId === id ? null : id };
    }
    const next = new Set(s.openNodes);
    if (next.has(id)) {
      next.delete(id);
    } else {
      if (next.size >= 3) {
        const oldest = Array.from(next)[0];
        next.delete(oldest);
      }
      next.add(id);
    }
    return { openNodes: next };
  }),
  closeAllNodes: () => set({ openNodes: new Set() }),
  setMobileCardNoteId: (mobileCardNoteId) => set({ mobileCardNoteId }),
  setCtxMenu: (ctxMenu) => set({ ctxMenu }),
  setGalaxyCtx: (galaxyCtx) => set({ galaxyCtx }),
  setAnchorNoteId: (anchorNoteId) => set({ anchorNoteId }),
  toggleWorkbenchSelect: (noteId) => set((s) => {
    const ids = s.workbenchSelectedIds;
    if (ids.includes(noteId)) return { workbenchSelectedIds: ids.filter(id => id !== noteId) };
    if (ids.length >= 5) return s;
    return { workbenchSelectedIds: [...ids, noteId] };
  }),
  activateWorkbench: () => set({ workbenchActive: true }),
  clearWorkbench: () => set({ workbenchActive: false, workbenchSelectedIds: [] }),
  removeFromWorkbench: (noteId) => set((s) => {
    const next = s.workbenchSelectedIds.filter(id => id !== noteId);
    return { workbenchSelectedIds: next, workbenchActive: next.length > 0 ? s.workbenchActive : false };
  }),
  setNodeWindowOpen: (nodeWindowOpen) => set({ nodeWindowOpen }),
  setTagFilter: (tagFilter) => set({ tagFilter }),
  setConnectModeInfo: (connectModeInfo) => set({ connectModeInfo }),
  resetConnectMode: () => set({ mode: 'browse', connectFromId: null, selectedNodeId: null }),
  escapeAll: () => set({
    openNodes: new Set(),
    workbenchActive: false,
    workbenchSelectedIds: [],
    mode: 'browse',
    connectFromId: null,
    selectedNodeId: null,
    ctxMenu: null,
    galaxyCtx: null,
  }),

  setPerfEnabled: (perfEnabled) => set({ perfEnabled }),
  togglePerfEnabled: () => set((s) => ({ perfEnabled: !s.perfEnabled })),
  setBloomEnabled: (bloomEnabled) => set({ bloomEnabled }),
  toggleBloomEnabled: () => set((s) => ({ bloomEnabled: !s.bloomEnabled })),
  setStarFieldEnabled: (starFieldEnabled) => set({ starFieldEnabled }),
  toggleStarFieldEnabled: () => set((s) => ({ starFieldEnabled: !s.starFieldEnabled })),
  setEdgesEnabled: (edgesEnabled) => set({ edgesEnabled }),
  toggleEdgesEnabled: () => set((s) => ({ edgesEnabled: !s.edgesEnabled })),
  setLabelsEnabled: (labelsEnabled) => set({ labelsEnabled }),
  toggleLabelsEnabled: () => set((s) => ({ labelsEnabled: !s.labelsEnabled })),
  setRaycastThrottle: (raycastThrottle) => set({ raycastThrottle }),
  cycleRaycastThrottle: () => set((s) => ({ raycastThrottle: s.raycastThrottle === 3 ? 6 : s.raycastThrottle === 6 ? 999 : 3 })),
}));
