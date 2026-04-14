import { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type ToolboxId =
  | 'analyze'
  | 'search'
  | 'library'
  | 'distiller'
  | 'mirror'
  | 'anticipation'
  | 'actions'
  | 'settings';

export interface ToolboxState {
  open: boolean;
  minimized: boolean;
  pos: { x: number; y: number };
  zIndex: number;
}

type ToolboxMap = Record<ToolboxId, ToolboxState>;

const STORAGE_KEY = 'cosmos_toolbox_positions';
const BASE_Z = 100;

function defaultPositions(): ToolboxMap {
  const iw = typeof window !== 'undefined' ? window.innerWidth : 1400;
  const rnd = () => Math.floor(Math.random() * 30);
  return {
    analyze:     { open: false, minimized: false, pos: { x: 80  + rnd(), y: 80  + rnd() }, zIndex: BASE_Z },
    search:      { open: false, minimized: false, pos: { x: 100 + rnd(), y: 110 + rnd() }, zIndex: BASE_Z },
    library:     { open: false, minimized: false, pos: { x: 120 + rnd(), y: 90  + rnd() }, zIndex: BASE_Z },
    distiller:   { open: false, minimized: false, pos: { x: 140 + rnd(), y: 100 + rnd() }, zIndex: BASE_Z },
    mirror:      { open: false, minimized: false, pos: { x: 160 + rnd(), y: 85  + rnd() }, zIndex: BASE_Z },
    anticipation:{ open: false, minimized: false, pos: { x: 180 + rnd(), y: 100 + rnd() }, zIndex: BASE_Z },
    actions:     { open: false, minimized: false, pos: { x: 160 + rnd(), y: 120 + rnd() }, zIndex: BASE_Z },
    settings:    { open: false, minimized: false, pos: { x: iw - 380,   y: 80          }, zIndex: BASE_Z },
  };
}

function loadPositions(): ToolboxMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<ToolboxMap>;
      const defaults = defaultPositions();
      const merged: ToolboxMap = { ...defaults };
      for (const id of Object.keys(defaults) as ToolboxId[]) {
        if (saved[id]) {
          merged[id] = {
            ...defaults[id],
            pos: saved[id]!.pos || defaults[id].pos,
            open: false,       // always start closed on reload
            minimized: false,
          };
        }
      }
      return merged;
    }
  } catch (_e) { /* ignore */ }
  return defaultPositions();
}

function savePositions(state: ToolboxMap) {
  try {
    const slim: Partial<ToolboxMap> = {};
    for (const id of Object.keys(state) as ToolboxId[]) {
      slim[id] = { ...state[id] };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
  } catch (_e) { /* ignore */ }
}

interface ToolboxContextValue {
  toolboxes: ToolboxMap;
  openToolbox: (id: ToolboxId) => void;
  closeToolbox: (id: ToolboxId) => void;
  toggleToolbox: (id: ToolboxId) => void;
  minimizeToolbox: (id: ToolboxId) => void;
  bringToFront: (id: ToolboxId) => void;
  setPos: (id: ToolboxId, pos: { x: number; y: number }) => void;
  topZ: number;
}

const ToolboxContext = createContext<ToolboxContextValue | null>(null);

export function ToolboxProvider({ children }: { children: React.ReactNode }) {
  const [toolboxes, setToolboxes] = useState<ToolboxMap>(loadPositions);
  const [topZ, setTopZ] = useState(BASE_Z);

  // Persist positions on change
  useEffect(() => {
    savePositions(toolboxes);
  }, [toolboxes]);

  const openToolbox = useCallback((id: ToolboxId) => {
    setTopZ(z => z + 1);
    setToolboxes(prev => ({
      ...prev,
      [id]: { ...prev[id], open: true, minimized: false, zIndex: topZ + 1 },
    }));
  }, [topZ]);

  const closeToolbox = useCallback((id: ToolboxId) => {
    setToolboxes(prev => ({
      ...prev,
      [id]: { ...prev[id], open: false, minimized: false },
    }));
  }, []);

  const toggleToolbox = useCallback((id: ToolboxId) => {
    setTopZ(z => z + 1);
    setToolboxes(prev => {
      const cur = prev[id];
      if (cur.open && !cur.minimized) {
        return { ...prev, [id]: { ...cur, open: false } };
      }
      return { ...prev, [id]: { ...cur, open: true, minimized: false, zIndex: topZ + 1 } };
    });
  }, [topZ]);

  const minimizeToolbox = useCallback((id: ToolboxId) => {
    setToolboxes(prev => ({
      ...prev,
      [id]: { ...prev[id], minimized: !prev[id].minimized },
    }));
  }, []);

  const bringToFront = useCallback((id: ToolboxId) => {
    setTopZ(z => z + 1);
    setToolboxes(prev => ({
      ...prev,
      [id]: { ...prev[id], zIndex: topZ + 1 },
    }));
  }, [topZ]);

  const setPos = useCallback((id: ToolboxId, pos: { x: number; y: number }) => {
    setToolboxes(prev => ({
      ...prev,
      [id]: { ...prev[id], pos },
    }));
  }, []);

  return (
    <ToolboxContext.Provider value={{ toolboxes, openToolbox, closeToolbox, toggleToolbox, minimizeToolbox, bringToFront, setPos, topZ }}>
      {children}
    </ToolboxContext.Provider>
  );
}

export function useToolbox() {
  const ctx = useContext(ToolboxContext);
  if (!ctx) throw new Error('useToolbox must be inside ToolboxProvider');
  return ctx;
}
