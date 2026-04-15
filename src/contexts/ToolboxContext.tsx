import { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type PodId = 'capture' | 'retrieval' | 'insight' | 'memory' | 'action' | 'settings';
export type PodViewMode = 'open' | 'closed';

export interface PodState {
  open: boolean;
  minimized: boolean;
  pos: { x: number; y: number };
  zIndex: number;
}

type PodMap = Record<PodId, PodState>;

const STORAGE_KEY = 'cosmos_pods_v4';
const BASE_Z = 100;

function defaultPositions(): PodMap {
  const W = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const H = typeof window !== 'undefined' ? window.innerHeight : 900;
  return {
    capture:   { open: false, minimized: false, pos: { x: 24,        y: 80        }, zIndex: BASE_Z },
    retrieval: { open: false, minimized: false, pos: { x: W - 524,   y: 80        }, zIndex: BASE_Z },
    insight:   { open: false, minimized: false, pos: { x: 24,        y: H - 520   }, zIndex: BASE_Z },
    memory:    { open: false, minimized: false, pos: { x: W - 484,   y: H - 500   }, zIndex: BASE_Z },
    action:    { open: false, minimized: false, pos: { x: W / 2 - 240, y: H - 480 }, zIndex: BASE_Z },
    settings:  { open: false, minimized: false, pos: { x: W - 380,   y: 60        }, zIndex: BASE_Z },
  };
}

function loadPositions(): PodMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<PodMap>;
      const defaults = defaultPositions();
      const merged: PodMap = { ...defaults };
      for (const id of Object.keys(defaults) as PodId[]) {
        if (saved[id]) merged[id] = { ...defaults[id], pos: saved[id]!.pos || defaults[id].pos, open: false, minimized: false };
      }
      return merged;
    }
  } catch (_e) { /**/ }
  return defaultPositions();
}

function savePositions(state: PodMap) {
  try {
    const slim: Partial<PodMap> = {};
    for (const id of Object.keys(state) as PodId[]) slim[id] = { ...state[id] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
  } catch (_e) { /**/ }
}

interface ToolboxContextValue {
  pods:         PodMap;
  primaryPod:   PodId | null;   // kept for backward compat (last opened)
  secondaryPod: PodId | null;   // kept for backward compat (always null now)
  openPod:      (id: PodId) => void;
  closePod:     (id: PodId) => void;
  togglePod:    (id: PodId) => void;
  minimizePod:  (id: PodId) => void;
  bringToFront: (id: PodId) => void;
  setPos:       (id: PodId, pos: { x: number; y: number }) => void;
  podViewMode:  (id: PodId) => PodViewMode;
  topZ: number;
  // Legacy aliases
  toolboxes:       PodMap;
  openToolbox:     (id: PodId) => void;
  closeToolbox:    (id: PodId) => void;
  toggleToolbox:   (id: PodId) => void;
  minimizeToolbox: (id: PodId) => void;
}

const ToolboxContext = createContext<ToolboxContextValue | null>(null);

export function ToolboxProvider({ children }: { children: React.ReactNode }) {
  const [pods, setPods] = useState<PodMap>(loadPositions);
  const [topZ, setTopZ] = useState(BASE_Z);
  const [lastOpened, setLastOpened] = useState<PodId | null>(null);

  useEffect(() => { savePositions(pods); }, [pods]);

  const openPod = useCallback((id: PodId) => {
    setTopZ(z => {
      setPods(prev => ({ ...prev, [id]: { ...prev[id], open: true, minimized: false, zIndex: z + 1 } }));
      return z + 1;
    });
    setLastOpened(id);
  }, []);

  const closePod = useCallback((id: PodId) => {
    setPods(prev => ({ ...prev, [id]: { ...prev[id], open: false, minimized: false } }));
    setLastOpened(prev => prev === id ? null : prev);
  }, []);

  const togglePod = useCallback((id: PodId) => {
    setPods(prev => {
      const cur = prev[id];
      if (cur.open) {
        setLastOpened(p => p === id ? null : p);
        return { ...prev, [id]: { ...cur, open: false } };
      }
      setTopZ(z => z + 1);
      setLastOpened(id);
      return { ...prev, [id]: { ...cur, open: true, minimized: false } };
    });
  }, []);

  const minimizePod = useCallback((id: PodId) => {
    setPods(prev => ({ ...prev, [id]: { ...prev[id], minimized: !prev[id].minimized } }));
  }, []);

  const bringToFront = useCallback((id: PodId) => {
    setTopZ(z => {
      setPods(prev => ({ ...prev, [id]: { ...prev[id], zIndex: z + 1 } }));
      return z + 1;
    });
  }, []);

  const setPos = useCallback((id: PodId, pos: { x: number; y: number }) => {
    setPods(prev => ({ ...prev, [id]: { ...prev[id], pos } }));
  }, []);

  // All open pods are just 'open' — no primary/secondary/capsule distinction
  const podViewMode = useCallback((id: PodId): PodViewMode => {
    return pods[id]?.open ? 'open' : 'closed';
  }, [pods]);

  const value: ToolboxContextValue = {
    pods,
    primaryPod: lastOpened,
    secondaryPod: null,
    openPod, closePod, togglePod, minimizePod, bringToFront, setPos, podViewMode, topZ,
    toolboxes: pods,
    openToolbox:     openPod,
    closeToolbox:    closePod,
    toggleToolbox:   togglePod,
    minimizeToolbox: minimizePod,
  };

  return <ToolboxContext.Provider value={value}>{children}</ToolboxContext.Provider>;
}

export function useToolbox() {
  const ctx = useContext(ToolboxContext);
  if (!ctx) throw new Error('useToolbox must be inside ToolboxProvider');
  return ctx;
}

export type ToolboxId = PodId;
