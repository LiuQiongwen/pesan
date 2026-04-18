/**
 * ToolboxContext — backward-compatible shim wrapping usePanelStore (Zustand).
 * Consumers can still call useToolbox() — internally it reads from the store.
 * New code should import usePanelStore directly for selector-level subscriptions.
 */
import { createContext, useContext, useRef, useEffect } from 'react';
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
  const store = usePanelStore();
  const reportedSizesRef = useRef<Partial<Record<PodId, { w: number; h: number }>>>({});

  const reportSize = (id: PodId, w: number, h: number) => {
    reportedSizesRef.current[id] = { w, h };
  };

  // Apply global font scale CSS var on mount and change
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--global-font-scale', String(store.layoutConfig.globalFontScale)
    );
  }, [store.layoutConfig.globalFontScale]);

  const value: ToolboxContextValue = {
    pods: store.pods,
    primaryPod: store.lastOpened,
    secondaryPod: null,
    topZ: store.topZ,
    reportedSizesRef,
    layoutConfig: store.layoutConfig,
    presets: store.presets,

    openPod: store.openPod,
    closePod: store.closePod,
    togglePod: store.togglePod,
    minimizePod: store.minimizePod,
    bringToFront: store.bringToFront,
    setPos: store.setPos,
    setSize: store.setSize,
    setPinned: store.setPinned,
    setFontScale: store.setFontScale,
    setSizeMode: store.setSizeMode,
    reportSize,
    podViewMode: store.podViewMode,

    setLocked: store.setLocked,
    setGridSize: store.setGridSize,
    setSnapToEdge: store.setSnapToEdge,
    setGlobalFontScale: store.setGlobalFontScale,

    savePreset: store.savePreset,
    loadPreset: store.loadPreset,
    deletePreset: store.deletePreset,
    resetToDefault: store.resetToDefault,

    // Legacy aliases
    toolboxes: store.pods,
    openToolbox: store.openPod,
    closeToolbox: store.closePod,
    toggleToolbox: store.togglePod,
    minimizeToolbox: store.minimizePod,
  };

  return <ToolboxContext.Provider value={value}>{children}</ToolboxContext.Provider>;
}

export function useToolbox() {
  const ctx = useContext(ToolboxContext);
  if (!ctx) throw new Error('useToolbox must be inside ToolboxProvider');
  return ctx;
}

export type ToolboxId = PodId;
