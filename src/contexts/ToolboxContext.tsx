import { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type PodId = 'capture' | 'retrieval' | 'insight' | 'memory' | 'action' | 'settings';

export interface PodState {
  open: boolean;
  minimized: boolean;
  pos: { x: number; y: number };
  zIndex: number;
}

type PodMap = Record<PodId, PodState>;

const STORAGE_KEY = 'cosmos_pods_v2';
const BASE_Z = 100;

function defaultPositions(): PodMap {
  const W = typeof window !== 'undefined' ? window.innerWidth : 1400;
  const H = typeof window !== 'undefined' ? window.innerHeight : 900;
  const cx = W / 2;
  const cy = H / 2;
  return {
    capture:   { open: false, minimized: false, pos: { x: cx - 180, y: cy - 260 }, zIndex: BASE_Z },
    retrieval: { open: false, minimized: false, pos: { x: cx + 40,  y: cy - 240 }, zIndex: BASE_Z },
    insight:   { open: false, minimized: false, pos: { x: cx - 200, y: cy + 20  }, zIndex: BASE_Z },
    memory:    { open: false, minimized: false, pos: { x: cx + 60,  y: cy + 40  }, zIndex: BASE_Z },
    action:    { open: false, minimized: false, pos: { x: cx - 180, y: cy + 200 }, zIndex: BASE_Z },
    settings:  { open: false, minimized: false, pos: { x: W - 340,  y: 60       }, zIndex: BASE_Z },
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
        if (saved[id]) {
          merged[id] = {
            ...defaults[id],
            pos: saved[id]!.pos || defaults[id].pos,
            open: false,
            minimized: false,
          };
        }
      }
      return merged;
    }
  } catch (_e) { /* ignore */ }
  return defaultPositions();
}

function savePositions(state: PodMap) {
  try {
    const slim: Partial<PodMap> = {};
    for (const id of Object.keys(state) as PodId[]) slim[id] = { ...state[id] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
  } catch (_e) { /* ignore */ }
}

interface ToolboxContextValue {
  pods: PodMap;
  openPod:    (id: PodId) => void;
  closePod:   (id: PodId) => void;
  togglePod:  (id: PodId) => void;
  minimizePod:(id: PodId) => void;
  bringToFront:(id: PodId) => void;
  setPos:     (id: PodId, pos: { x: number; y: number }) => void;
  topZ: number;
  // Legacy aliases for backward compat
  toolboxes: PodMap;
  openToolbox: (id: PodId) => void;
  closeToolbox: (id: PodId) => void;
  toggleToolbox: (id: PodId) => void;
  minimizeToolbox: (id: PodId) => void;
}

const ToolboxContext = createContext<ToolboxContextValue | null>(null);

export function ToolboxProvider({ children }: { children: React.ReactNode }) {
  const [pods, setPods] = useState<PodMap>(loadPositions);
  const [topZ, setTopZ] = useState(BASE_Z);

  useEffect(() => { savePositions(pods); }, [pods]);

  const openPod = useCallback((id: PodId) => {
    setTopZ(z => {
      setPods(prev => ({ ...prev, [id]: { ...prev[id], open: true, minimized: false, zIndex: z + 1 } }));
      return z + 1;
    });
  }, []);

  const closePod = useCallback((id: PodId) => {
    setPods(prev => ({ ...prev, [id]: { ...prev[id], open: false, minimized: false } }));
  }, []);

  const togglePod = useCallback((id: PodId) => {
    setTopZ(z => {
      setPods(prev => {
        const cur = prev[id];
        if (cur.open && !cur.minimized) return { ...prev, [id]: { ...cur, open: false } };
        return { ...prev, [id]: { ...cur, open: true, minimized: false, zIndex: z + 1 } };
      });
      return z + 1;
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

  const value: ToolboxContextValue = {
    pods, openPod, closePod, togglePod, minimizePod, bringToFront, setPos, topZ,
    // legacy aliases
    toolboxes: pods,
    openToolbox: openPod,
    closeToolbox: closePod,
    toggleToolbox: togglePod,
    minimizeToolbox: minimizePod,
  };

  return <ToolboxContext.Provider value={value}>{children}</ToolboxContext.Provider>;
}

export function useToolbox() {
  const ctx = useContext(ToolboxContext);
  if (!ctx) throw new Error('useToolbox must be inside ToolboxProvider');
  return ctx;
}

// Also export ToolboxId for backward compat
export type ToolboxId = PodId;
