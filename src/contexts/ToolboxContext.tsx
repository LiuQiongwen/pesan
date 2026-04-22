/**
 * ToolboxContext — backward-compatible shim wrapping usePanelStore (Zustand).
 * Consumers can still call useToolbox() — internally it reads from the store.
 * New code should import usePanelStore directly for selector-level subscriptions.
 */
import { createContext, useContext, useRef, useEffect, useMemo } from 'react';
import { usePanelStore, type PodId, type PodState, type PodViewMode, type LayoutConfig, type LayoutPreset } from '@/stores/panelStore';

export type { PodId, PodState, PodViewMode, LayoutConfig, LayoutPreset };

type PodMap = Record<PodId, PodState>;

interface ToolboxContextValue {
  pods:         PodMap;
  primaryPod:   PodId | null;
  secondaryPod: PodId | null;
  topZ:         number;
  reportedSizesRef: React.MutableRefObject<Partial<Record<PodId, { w: number; h: number }>>>;
  layoutConfig: LayoutConfig;
  presets:      Record<string, LayoutPreset>;

  openPod:      (id: PodId) => void;
  closePod:     (id: PodId) => void;
  togglePod:    (id: PodId) => void;
  minimizePod:  (id: PodId) => void;
  bringToFront: (id: PodId) => void;
  setPos:       (id: PodId, pos: { x: number; y: number }) => void;
  setSize:      (id: PodId, size: { w: number | null; h: number | null }) => void;
  setPinned:    (id: PodId, pinned: boolean) => void;
  setFontScale: (id: PodId, scale: number) => void;
  setSizeMode:  (id: PodId, mode: 'compact' | 'expanded') => void;
  reportSize:   (id: PodId, w: number, h: number) => void;
  podViewMode:  (id: PodId) => PodViewMode;

  setLocked:          (v: boolean) => void;
  setGridSize:        (v: 0 | 8 | 16 | 24) => void;
  setSnapToEdge:      (v: boolean) => void;
  setGlobalFontScale: (v: number) => void;

  savePreset:    (name: string) => void;
  loadPreset:    (name: string) => void;
  deletePreset:  (name: string) => void;
  resetToDefault:() => void;

  // Legacy aliases
  toolboxes:       PodMap;
  openToolbox:     (id: PodId) => void;
  closeToolbox:    (id: PodId) => void;
  toggleToolbox:   (id: PodId) => void;
  minimizeToolbox: (id: PodId) => void;
}

const ToolboxContext = createContext<ToolboxContextValue | null>(null);

export function ToolboxProvider({ children }: { children: React.ReactNode }) {
  // Subscribe to state slices individually to avoid infinite re-render loops
  const pods = usePanelStore(s => s.pods);
  const lastOpened = usePanelStore(s => s.lastOpened);
  const topZ = usePanelStore(s => s.topZ);
  const layoutConfig = usePanelStore(s => s.layoutConfig);
  const presets = usePanelStore(s => s.presets);

  // Actions are stable references from Zustand — grab once
  const actions = useMemo(() => ({
    openPod:          usePanelStore.getState().openPod,
    closePod:         usePanelStore.getState().closePod,
    togglePod:        usePanelStore.getState().togglePod,
    minimizePod:      usePanelStore.getState().minimizePod,
    bringToFront:     usePanelStore.getState().bringToFront,
    setPos:           usePanelStore.getState().setPos,
    setSize:          usePanelStore.getState().setSize,
    setPinned:        usePanelStore.getState().setPinned,
    setFontScale:     usePanelStore.getState().setFontScale,
    setSizeMode:      usePanelStore.getState().setSizeMode,
    podViewMode:      usePanelStore.getState().podViewMode,
    setLocked:        usePanelStore.getState().setLocked,
    setGridSize:      usePanelStore.getState().setGridSize,
    setSnapToEdge:    usePanelStore.getState().setSnapToEdge,
    setGlobalFontScale: usePanelStore.getState().setGlobalFontScale,
    savePreset:       usePanelStore.getState().savePreset,
    loadPreset:       usePanelStore.getState().loadPreset,
    deletePreset:     usePanelStore.getState().deletePreset,
    resetToDefault:   usePanelStore.getState().resetToDefault,
  }), []);

  const reportedSizesRef = useRef<Partial<Record<PodId, { w: number; h: number }>>>({});

  const reportSize = useMemo(() => (id: PodId, w: number, h: number) => {
    reportedSizesRef.current[id] = { w, h };
  }, []);

  // Apply global font scale CSS var on change
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--global-font-scale', String(layoutConfig.globalFontScale)
    );
  }, [layoutConfig.globalFontScale]);

  const value: ToolboxContextValue = useMemo(() => ({
    pods,
    primaryPod: lastOpened,
    secondaryPod: null,
    topZ,
    reportedSizesRef,
    layoutConfig,
    presets,

    ...actions,
    reportSize,

    // Legacy aliases
    toolboxes: pods,
    openToolbox: actions.openPod,
    closeToolbox: actions.closePod,
    toggleToolbox: actions.togglePod,
    minimizeToolbox: actions.minimizePod,
  }), [pods, lastOpened, topZ, layoutConfig, presets, actions, reportSize]);

  return <ToolboxContext.Provider value={value}>{children}</ToolboxContext.Provider>;
}

export function useToolbox() {
  const ctx = useContext(ToolboxContext);
  if (!ctx) throw new Error('useToolbox must be inside ToolboxProvider');
  return ctx;
}

export type ToolboxId = PodId;
