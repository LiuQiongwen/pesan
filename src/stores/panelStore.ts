/**
 * panelStore — Pod window management, layout config, presets, OCR/staging modals.
 * Persisted to localStorage with 800ms debounce for pods/layoutConfig/presets.
 */
import { create } from 'zustand';

// ── Types ─────────────────────────────────────────────────────────────────────
export type PodId = 'capture' | 'retrieval' | 'insight' | 'memory' | 'action' | 'settings';
export type PodViewMode = 'open' | 'closed';

export interface PodState {
  open:      boolean;
  minimized: boolean;
  pos:       { x: number; y: number };
  size:      { w: number | null; h: number | null };
  zIndex:    number;
  pinned:    boolean;
  fontScale: number;
  sizeMode:  'compact' | 'expanded';
}

export interface LayoutConfig {
  locked:          boolean;
  gridSize:        0 | 8 | 16 | 24;
  snapToEdge:      boolean;
  globalFontScale: number;
}

export interface LayoutPreset {
  name: string;
  pods: Record<PodId, Pick<PodState, 'pos' | 'size' | 'sizeMode'>>;
}

type PodMap = Record<PodId, PodState>;

const STORAGE_KEY = 'pesta_wm_v1';
const LAYOUT_KEY  = 'pesta_wm_layout_v1';
const PRESETS_KEY = 'pesta_wm_presets_v1';
const BASE_Z     = 100;

// ── Defaults ──────────────────────────────────────────────────────────────────
function makePod(pos: { x: number; y: number }): PodState {
  return { open: false, minimized: false, pos, size: { w: null, h: null }, zIndex: BASE_Z, pinned: false, fontScale: 1.0, sizeMode: 'expanded' };
}

function defaultPositions(): PodMap {
  const W = typeof window !== 'undefined' ? window.innerWidth  : 1440;
  const H = typeof window !== 'undefined' ? window.innerHeight : 900;
  return {
    capture:   makePod({ x: 24,          y: 80       }),
    retrieval: makePod({ x: W - 524,     y: 80       }),
    insight:   makePod({ x: 24,          y: H - 520  }),
    memory:    makePod({ x: W - 484,     y: H - 500  }),
    action:    makePod({ x: W / 2 - 240, y: H - 480  }),
    settings:  makePod({ x: W - 380,     y: 60       }),
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
      const defs = defaultPositions();
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
    const cosmosRaw = localStorage.getItem('cosmos_wm_v1');
    if (cosmosRaw) {
      const saved = JSON.parse(cosmosRaw) as Partial<PodMap>;
      const defs = defaultPositions();
      const merged: PodMap = { ...defs };
      for (const id of Object.keys(defs) as PodId[]) {
        if (saved[id]) {
          merged[id] = { ...defs[id], pos: saved[id]!.pos ?? defs[id].pos, size: saved[id]!.size ?? defs[id].size, sizeMode: saved[id]!.sizeMode ?? defs[id].sizeMode, fontScale: saved[id]!.fontScale ?? defs[id].fontScale, pinned: saved[id]!.pinned ?? defs[id].pinned, open: false, minimized: false };
        }
      }
      return merged;
    }
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
  } catch { /* */ }
  return defaultPositions();
}

function loadLayoutConfig(): LayoutConfig {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (raw) return { ...defaultLayoutConfig, ...JSON.parse(raw) };
  } catch { /* */ }
  return { ...defaultLayoutConfig };
}

function loadPresets(): Record<string, LayoutPreset> {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* */ }
  return {};
}

// ── Debounced persist helpers ─────────────────────────────────────────────────
let podSaveTimer: ReturnType<typeof setTimeout> | null = null;
function debounceSavePods(pods: PodMap) {
  if (podSaveTimer) clearTimeout(podSaveTimer);
  podSaveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pods)); } catch { /* */ }
  }, 800);
}

function saveLayoutConfig(cfg: LayoutConfig) {
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(cfg)); } catch { /* */ }
}

function savePresets(p: Record<string, LayoutPreset>) {
  try { localStorage.setItem(PRESETS_KEY, JSON.stringify(p)); } catch { /* */ }
}

// ── Store interface ───────────────────────────────────────────────────────────
interface PanelState {
  pods: PodMap;
  layoutConfig: LayoutConfig;
  presets: Record<string, LayoutPreset>;
  topZ: number;
  lastOpened: PodId | null;

  // Modal state
  stagingOpen: boolean;
  ocrOpen: boolean;
  ocrAutoCamera: boolean;
  ocrPasteImage: File | null;

  // Pod actions
  openPod: (id: PodId) => void;
  closePod: (id: PodId) => void;
  togglePod: (id: PodId) => void;
  minimizePod: (id: PodId) => void;
  bringToFront: (id: PodId) => void;
  setPos: (id: PodId, pos: { x: number; y: number }) => void;
  setSize: (id: PodId, size: { w: number | null; h: number | null }) => void;
  setPinned: (id: PodId, pinned: boolean) => void;
  setFontScale: (id: PodId, scale: number) => void;
  setSizeMode: (id: PodId, mode: 'compact' | 'expanded') => void;
  podViewMode: (id: PodId) => PodViewMode;

  // Layout config actions
  setLocked: (v: boolean) => void;
  setGridSize: (v: 0 | 8 | 16 | 24) => void;
  setSnapToEdge: (v: boolean) => void;
  setGlobalFontScale: (v: number) => void;

  // Preset actions
  savePreset: (name: string) => void;
  loadPreset: (name: string) => void;
  deletePreset: (name: string) => void;
  resetToDefault: () => void;

  // Modal actions
  openStaging: () => void;
  closeStaging: () => void;
  openOcr: (opts?: { autoCamera?: boolean; pasteImage?: File | null }) => void;
  closeOcr: () => void;
}

const isPhone = typeof window !== 'undefined' && window.innerWidth < 768;

export const usePanelStore = create<PanelState>((set, get) => ({
  pods: loadPods(),
  layoutConfig: loadLayoutConfig(),
  presets: loadPresets(),
  topZ: BASE_Z,
  lastOpened: null,
  stagingOpen: false,
  ocrOpen: false,
  ocrAutoCamera: false,
  ocrPasteImage: null,

  openPod: (id) => set((s) => {
    const base = isPhone
      ? Object.fromEntries(Object.entries(s.pods).map(([k, v]) => [k, { ...v, open: k === id, minimized: false }])) as PodMap
      : s.pods;
    const nz = s.topZ + 1;
    const pods = { ...base, [id]: { ...base[id], open: true, minimized: false, zIndex: nz } };
    debounceSavePods(pods);
    return { pods, topZ: nz, lastOpened: id };
  }),

  closePod: (id) => set((s) => {
    const pods = { ...s.pods, [id]: { ...s.pods[id], open: false, minimized: false } };
    debounceSavePods(pods);
    return { pods, lastOpened: s.lastOpened === id ? null : s.lastOpened };
  }),

  togglePod: (id) => set((s) => {
    const cur = s.pods[id];
    if (cur.open) {
      const pods = { ...s.pods, [id]: { ...cur, open: false } };
      debounceSavePods(pods);
      return { pods, lastOpened: s.lastOpened === id ? null : s.lastOpened };
    }
    const nz = s.topZ + 1;
    const pods = { ...s.pods, [id]: { ...cur, open: true, minimized: false, zIndex: nz } };
    debounceSavePods(pods);
    return { pods, topZ: nz, lastOpened: id };
  }),

  minimizePod: (id) => set((s) => {
    const pods = { ...s.pods, [id]: { ...s.pods[id], minimized: !s.pods[id].minimized } };
    debounceSavePods(pods);
    return { pods };
  }),

  bringToFront: (id) => set((s) => {
    const nz = s.topZ + 1;
    const pods = { ...s.pods, [id]: { ...s.pods[id], zIndex: nz } };
    return { pods, topZ: nz };
  }),

  setPos: (id, pos) => set((s) => {
    const pods = { ...s.pods, [id]: { ...s.pods[id], pos } };
    debounceSavePods(pods);
    return { pods };
  }),

  setSize: (id, size) => set((s) => {
    const pods = { ...s.pods, [id]: { ...s.pods[id], size } };
    debounceSavePods(pods);
    return { pods };
  }),

  setPinned: (id, pinned) => set((s) => {
    const pods = { ...s.pods, [id]: { ...s.pods[id], pinned } };
    debounceSavePods(pods);
    return { pods };
  }),

  setFontScale: (id, fontScale) => set((s) => {
    const pods = { ...s.pods, [id]: { ...s.pods[id], fontScale } };
    debounceSavePods(pods);
    return { pods };
  }),

  setSizeMode: (id, sizeMode) => set((s) => {
    const pods = { ...s.pods, [id]: { ...s.pods[id], sizeMode } };
    debounceSavePods(pods);
    return { pods };
  }),

  podViewMode: (id) => get().pods[id]?.open ? 'open' : 'closed',

  setLocked: (v) => set((s) => {
    const layoutConfig = { ...s.layoutConfig, locked: v };
    saveLayoutConfig(layoutConfig);
    return { layoutConfig };
  }),

  setGridSize: (v) => set((s) => {
    const layoutConfig = { ...s.layoutConfig, gridSize: v };
    saveLayoutConfig(layoutConfig);
    return { layoutConfig };
  }),

  setSnapToEdge: (v) => set((s) => {
    const layoutConfig = { ...s.layoutConfig, snapToEdge: v };
    saveLayoutConfig(layoutConfig);
    return { layoutConfig };
  }),

  setGlobalFontScale: (v) => set((s) => {
    const layoutConfig = { ...s.layoutConfig, globalFontScale: Math.max(0.6, Math.min(1.8, v)) };
    saveLayoutConfig(layoutConfig);
    document.documentElement.style.setProperty('--global-font-scale', String(layoutConfig.globalFontScale));
    return { layoutConfig };
  }),

  savePreset: (name) => set((s) => {
    const snapshot: LayoutPreset = {
      name,
      pods: Object.fromEntries(
        (Object.keys(s.pods) as PodId[]).map(id => [id, { pos: s.pods[id].pos, size: s.pods[id].size, sizeMode: s.pods[id].sizeMode }])
      ) as Record<PodId, Pick<PodState, 'pos' | 'size' | 'sizeMode'>>,
    };
    const presets = { ...s.presets, [name]: snapshot };
    savePresets(presets);
    return { presets };
  }),

  loadPreset: (name) => set((s) => {
    const preset = s.presets[name];
    if (!preset) return s;
    const pods = { ...s.pods };
    for (const id of Object.keys(preset.pods) as PodId[]) {
      pods[id] = { ...pods[id], pos: preset.pods[id].pos, size: preset.pods[id].size, sizeMode: preset.pods[id].sizeMode };
    }
    debounceSavePods(pods);
    return { pods };
  }),

  deletePreset: (name) => set((s) => {
    const presets = { ...s.presets };
    delete presets[name];
    savePresets(presets);
    return { presets };
  }),

  resetToDefault: () => {
    const pods = defaultPositions();
    debounceSavePods(pods);
    set({ pods });
  },

  openStaging: () => set({ stagingOpen: true }),
  closeStaging: () => set({ stagingOpen: false }),
  openOcr: (opts) => set({
    ocrOpen: true,
    ocrAutoCamera: opts?.autoCamera ?? false,
    ocrPasteImage: opts?.pasteImage ?? null,
  }),
  closeOcr: () => set({ ocrOpen: false, ocrAutoCamera: false, ocrPasteImage: null }),
}));
