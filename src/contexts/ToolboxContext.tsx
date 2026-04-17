import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
export type PodId = 'capture' | 'retrieval' | 'insight' | 'memory' | 'action' | 'settings';
export type PodViewMode = 'open' | 'closed';

export interface PodState {
  open:      boolean;
  minimized: boolean;
  pos:       { x: number; y: number };
  size:      { w: number | null; h: number | null }; // null = CSS auto
  zIndex:    number;
  pinned:    boolean;
  fontScale: number;   // 1.0 = default
  sizeMode:  'compact' | 'expanded';
}

export interface LayoutConfig {
  locked:          boolean;        // false = edit mode
  gridSize:        0 | 8 | 16 | 24;
  snapToEdge:      boolean;
  globalFontScale: number;         // 0.75 – 1.5
}

export interface LayoutPreset {
  name: string;
  pods: Record<PodId, Pick<PodState, 'pos' | 'size' | 'sizeMode'>>;
}

type PodMap = Record<PodId, PodState>;

const STORAGE_KEY  = 'pesta_wm_v1';
const LAYOUT_KEY   = 'pesta_wm_layout_v1';
const PRESETS_KEY  = 'pesta_wm_presets_v1';
const BASE_Z       = 100;

// ── Defaults ─────────────────────────────────────────────────────────────────
function makePod(pos: { x: number; y: number }): PodState {
  return {
    open: false, minimized: false, pos,
    size: { w: null, h: null },
    zIndex: BASE_Z, pinned: false, fontScale: 1.0, sizeMode: 'expanded',
  };
}

function defaultPositions(): PodMap {
  const W = typeof window !== 'undefined' ? window.innerWidth  : 1440;
  const H = typeof window !== 'undefined' ? window.innerHeight : 900;
  return {
    capture:   makePod({ x: 24,            y: 80         }),
    retrieval: makePod({ x: W - 524,       y: 80         }),
    insight:   makePod({ x: 24,            y: H - 520    }),
    memory:    makePod({ x: W - 484,       y: H - 500    }),
    action:    makePod({ x: W / 2 - 240,   y: H - 480    }),
    settings:  makePod({ x: W - 380,       y: 60         }),
  };
}

const defaultLayoutConfig: LayoutConfig = {
  locked: false, gridSize: 0, snapToEdge: true, globalFontScale: 1.0,
};

// ── Persistence ───────────────────────────────────────────────────────────────
function loadPods(): PodMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<PodMap>;
      const defs  = defaultPositions();
      const merged: PodMap = { ...defs };
      for (const id of Object.keys(defs) as PodId[]) {
        if (saved[id]) {
          merged[id] = {
            ...defs[id],
            pos:       saved[id]!.pos       ?? defs[id].pos,
            size:      saved[id]!.size      ?? defs[id].size,
            sizeMode:  saved[id]!.sizeMode  ?? defs[id].sizeMode,
            fontScale: saved[id]!.fontScale ?? defs[id].fontScale,
            pinned:    saved[id]!.pinned    ?? defs[id].pinned,
            // Always start closed/unminimized
            open: false, minimized: false,
          };
        }
      }
      return merged;
    }
    // Try migrating from cosmos_wm_v1 (pre-Pesta branding)
    const cosmosRaw = localStorage.getItem('cosmos_wm_v1');
    if (cosmosRaw) {
      const saved = JSON.parse(cosmosRaw) as Partial<PodMap>;
      const defs  = defaultPositions();
      const merged: PodMap = { ...defs };
      for (const id of Object.keys(defs) as PodId[]) {
        if (saved[id]) {
          merged[id] = {
            ...defs[id],
            pos:       saved[id]!.pos       ?? defs[id].pos,
            size:      saved[id]!.size      ?? defs[id].size,
            sizeMode:  saved[id]!.sizeMode  ?? defs[id].sizeMode,
            fontScale: saved[id]!.fontScale ?? defs[id].fontScale,
            pinned:    saved[id]!.pinned    ?? defs[id].pinned,
            open: false, minimized: false,
          };
        }
      }
      return merged;
    }
    // Try migrating from old key
    const oldRaw = localStorage.getItem('cosmos_pods_v4');
    if (oldRaw) {
      const old = JSON.parse(oldRaw) as Partial<PodMap>;
      const defs = defaultPositions();
      const merged: PodMap = { ...defs };
      for (const id of Object.keys(defs) as PodId[]) {
        if (old[id]) merged[id] = { ...defs[id], pos: old[id]!.pos ?? defs[id].pos };
      }
      return merged;
    }
  } catch (_e) { /**/ }
  return defaultPositions();
}

function savePods(state: PodMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_e) { /**/ }
}

function loadLayoutConfig(): LayoutConfig {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (raw) return { ...defaultLayoutConfig, ...JSON.parse(raw) };
  } catch (_e) { /**/ }
  return { ...defaultLayoutConfig };
}

function saveLayoutConfig(cfg: LayoutConfig) {
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(cfg)); } catch (_e) { /**/ }
}

function loadPresets(): Record<string, LayoutPreset> {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_e) { /**/ }
  return {};
}

function savePresets(p: Record<string, LayoutPreset>) {
  try { localStorage.setItem(PRESETS_KEY, JSON.stringify(p)); } catch (_e) { /**/ }
}

// ── Context interface ─────────────────────────────────────────────────────────
interface ToolboxContextValue {
  // Window state
  pods:         PodMap;
  primaryPod:   PodId | null;
  secondaryPod: PodId | null;
  topZ:         number;

  // Reported (actual rendered) sizes — ref, no re-render
  reportedSizesRef: React.MutableRefObject<Partial<Record<PodId, { w: number; h: number }>>>;

  // Layout config
  layoutConfig: LayoutConfig;

  // Presets
  presets: Record<string, LayoutPreset>;

  // Pod actions
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

  // Layout config actions
  setLocked:         (v: boolean) => void;
  setGridSize:       (v: 0 | 8 | 16 | 24) => void;
  setSnapToEdge:     (v: boolean) => void;
  setGlobalFontScale:(v: number) => void;

  // Preset actions
  savePreset:   (name: string) => void;
  loadPreset:   (name: string) => void;
  deletePreset: (name: string) => void;
  resetToDefault: () => void;

  // Legacy aliases
  toolboxes:       PodMap;
  openToolbox:     (id: PodId) => void;
  closeToolbox:    (id: PodId) => void;
  toggleToolbox:   (id: PodId) => void;
  minimizeToolbox: (id: PodId) => void;
}

const ToolboxContext = createContext<ToolboxContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────
export function ToolboxProvider({ children }: { children: React.ReactNode }) {
  const [pods,         setPods]         = useState<PodMap>(loadPods);
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig>(loadLayoutConfig);
  const [presets,      setPresets]      = useState<Record<string, LayoutPreset>>(loadPresets);
  const [topZ,         setTopZ]         = useState(BASE_Z);
  const [lastOpened,   setLastOpened]   = useState<PodId | null>(null);

  // Actual rendered sizes (ref — no re-render overhead)
  const reportedSizesRef = useRef<Partial<Record<PodId, { w: number; h: number }>>>({});

  // Debounced persist
  useEffect(() => {
    const t = setTimeout(() => savePods(pods), 800);
    return () => clearTimeout(t);
  }, [pods]);
  useEffect(() => { saveLayoutConfig(layoutConfig); }, [layoutConfig]);
  useEffect(() => { savePresets(presets); }, [presets]);

  // Apply global font scale CSS var
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--global-font-scale', String(layoutConfig.globalFontScale)
    );
  }, [layoutConfig.globalFontScale]);

  // ── Pod actions ─────────────────────────────────────────────────────────
  const isPhone = typeof window !== 'undefined' && window.innerWidth < 768;

  const openPod = useCallback((id: PodId) => {
    setPods(prev => {
      // On phone: close all other pods first (single-pod mode)
      const base = isPhone
        ? Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, open: k === id ? true : false, minimized: false }])) as typeof prev
        : prev;
      return { ...base, [id]: { ...base[id], open: true, minimized: false } };
    });
    setTopZ(z => {
      const nz = z + 1;
      setPods(prev => ({ ...prev, [id]: { ...prev[id], zIndex: nz } }));
      return nz;
    });
    setLastOpened(id);
  }, [isPhone]);

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
      // Open: bump z-index via setTopZ (same pattern as openPod)
      setTopZ(z => {
        const nz = z + 1;
        setPods(p => ({ ...p, [id]: { ...p[id], zIndex: nz } }));
        return nz;
      });
      setLastOpened(id);
      return { ...prev, [id]: { ...cur, open: true, minimized: false } };
    });
  }, []);

  const minimizePod = useCallback((id: PodId) => {
    setPods(prev => ({ ...prev, [id]: { ...prev[id], minimized: !prev[id].minimized } }));
  }, []);

  const bringToFront = useCallback((id: PodId) => {
    setTopZ(z => {
      const nz = z + 1;
      setPods(prev => ({ ...prev, [id]: { ...prev[id], zIndex: nz } }));
      return nz;
    });
  }, []);

  const setPos = useCallback((id: PodId, pos: { x: number; y: number }) => {
    setPods(prev => ({ ...prev, [id]: { ...prev[id], pos } }));
  }, []);

  const setSize = useCallback((id: PodId, size: { w: number | null; h: number | null }) => {
    setPods(prev => ({ ...prev, [id]: { ...prev[id], size } }));
  }, []);

  const setPinned = useCallback((id: PodId, pinned: boolean) => {
    setPods(prev => ({ ...prev, [id]: { ...prev[id], pinned } }));
  }, []);

  const setFontScale = useCallback((id: PodId, fontScale: number) => {
    setPods(prev => ({ ...prev, [id]: { ...prev[id], fontScale } }));
  }, []);

  const setSizeMode = useCallback((id: PodId, sizeMode: 'compact' | 'expanded') => {
    setPods(prev => ({ ...prev, [id]: { ...prev[id], sizeMode } }));
  }, []);

  const reportSize = useCallback((id: PodId, w: number, h: number) => {
    reportedSizesRef.current[id] = { w, h };
  }, []);

  const podViewMode = useCallback((id: PodId): PodViewMode => {
    return pods[id]?.open ? 'open' : 'closed';
  }, [pods]);

  // ── Layout config actions ────────────────────────────────────────────────
  const setLocked          = useCallback((v: boolean) => setLayoutConfig(c => ({ ...c, locked: v })), []);
  const setGridSize        = useCallback((v: 0 | 8 | 16 | 24) => setLayoutConfig(c => ({ ...c, gridSize: v })), []);
  const setSnapToEdge      = useCallback((v: boolean) => setLayoutConfig(c => ({ ...c, snapToEdge: v })), []);
  const setGlobalFontScale = useCallback((v: number) => setLayoutConfig(c => ({ ...c, globalFontScale: Math.max(0.6, Math.min(1.8, v)) })), []);

  // ── Preset actions ───────────────────────────────────────────────────────
  const savePreset = useCallback((name: string) => {
    const snapshot: LayoutPreset = {
      name,
      pods: Object.fromEntries(
        (Object.keys(pods) as PodId[]).map(id => [id, {
          pos:      pods[id].pos,
          size:     pods[id].size,
          sizeMode: pods[id].sizeMode,
        }])
      ) as Record<PodId, Pick<PodState, 'pos' | 'size' | 'sizeMode'>>,
    };
    setPresets(prev => ({ ...prev, [name]: snapshot }));
  }, [pods]);

  const loadPreset = useCallback((name: string) => {
    const preset = presets[name];
    if (!preset) return;
    setPods(prev => {
      const next = { ...prev };
      for (const id of Object.keys(preset.pods) as PodId[]) {
        next[id] = {
          ...next[id],
          pos:     preset.pods[id].pos,
          size:    preset.pods[id].size,
          sizeMode:preset.pods[id].sizeMode,
        };
      }
      return next;
    });
  }, [presets]);

  const deletePreset = useCallback((name: string) => {
    setPresets(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const resetToDefault = useCallback(() => {
    setPods(defaultPositions());
  }, []);

  const value: ToolboxContextValue = {
    pods, primaryPod: lastOpened, secondaryPod: null, topZ,
    reportedSizesRef,
    layoutConfig, presets,
    openPod, closePod, togglePod, minimizePod, bringToFront,
    setPos, setSize, setPinned, setFontScale, setSizeMode, reportSize, podViewMode,
    setLocked, setGridSize, setSnapToEdge, setGlobalFontScale,
    savePreset, loadPreset, deletePreset, resetToDefault,
    // Legacy aliases
    toolboxes:       pods,
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
