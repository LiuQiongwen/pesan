/**
 * sceneStore — 3D scene data: notes, edges, positions, layout.
 * Changes here only affect Canvas internals.
 */
import { create } from 'zustand';
import { buildCosmosLayout, type CosmosLayout, type CosmosNote, type DbEdge, type ManualPositions } from '@/components/starmap/cosmos-layout';

interface SceneState {
  notes: CosmosNote[];
  dbEdges: DbEdge[];
  manualNodePos: Record<string, [number, number, number]>;
  manualGalaxyPos: Record<string, [number, number, number]>;
  layout: CosmosLayout;
  highlightedNoteIds: string[];
  flashNoteId: string | null;
  recenterTrigger: number;

  // Actions
  setNotes: (notes: CosmosNote[]) => void;
  setDbEdges: (edges: DbEdge[]) => void;
  setManualNodePos: (pos: Record<string, [number, number, number]>) => void;
  updateManualNodePos: (noteId: string, pos: [number, number, number]) => void;
  removeManualNodePos: (noteId: string) => void;
  setManualGalaxyPos: (pos: Record<string, [number, number, number]>) => void;
  updateManualGalaxyPos: (tag: string, pos: [number, number, number]) => void;
  batchUpdateManualNodePos: (updates: Record<string, [number, number, number]>) => void;
  highlight: (ids: string[]) => void;
  flash: (noteId: string | null) => void;
  triggerRecenter: () => void;
  recomputeLayout: () => void;
}

const EMPTY_LAYOUT: CosmosLayout = { positions: {}, clusters: [], edges: [] };

function computeLayout(s: Pick<SceneState, 'notes' | 'dbEdges' | 'manualNodePos' | 'manualGalaxyPos'>): CosmosLayout {
  const manualPositions: ManualPositions = {
    nodes: Object.keys(s.manualNodePos).length > 0 ? s.manualNodePos : undefined,
    galaxies: Object.keys(s.manualGalaxyPos).length > 0 ? s.manualGalaxyPos : undefined,
  };
  return buildCosmosLayout(s.notes, s.dbEdges, manualPositions);
}

export const useSceneStore = create<SceneState>((set, get) => ({
  notes: [],
  dbEdges: [],
  manualNodePos: {},
  manualGalaxyPos: {},
  layout: EMPTY_LAYOUT,
  highlightedNoteIds: [],
  flashNoteId: null,
  recenterTrigger: 0,

  setNotes: (notes) => {
    set({ notes });
    const s = get();
    set({ layout: computeLayout({ ...s, notes }) });
  },
  setDbEdges: (dbEdges) => {
    set({ dbEdges });
    const s = get();
    set({ layout: computeLayout({ ...s, dbEdges }) });
  },
  setManualNodePos: (manualNodePos) => {
    set({ manualNodePos });
    const s = get();
    set({ layout: computeLayout({ ...s, manualNodePos }) });
  },
  updateManualNodePos: (noteId, pos) => {
    const manualNodePos = { ...get().manualNodePos, [noteId]: pos };
    set({ manualNodePos });
    const s = get();
    set({ layout: computeLayout(s) });
  },
  removeManualNodePos: (noteId) => {
    const manualNodePos = { ...get().manualNodePos };
    delete manualNodePos[noteId];
    set({ manualNodePos });
    const s = get();
    set({ layout: computeLayout(s) });
  },
  setManualGalaxyPos: (manualGalaxyPos) => {
    set({ manualGalaxyPos });
    const s = get();
    set({ layout: computeLayout({ ...s, manualGalaxyPos }) });
  },
  updateManualGalaxyPos: (tag, pos) => {
    const manualGalaxyPos = { ...get().manualGalaxyPos, [tag]: pos };
    set({ manualGalaxyPos });
    const s = get();
    set({ layout: computeLayout(s) });
  },
  batchUpdateManualNodePos: (updates) => {
    const manualNodePos = { ...get().manualNodePos, ...updates };
    set({ manualNodePos });
    const s = get();
    set({ layout: computeLayout(s) });
  },
  highlight: (ids) => set({ highlightedNoteIds: ids }),
  flash: (noteId) => set({ flashNoteId: noteId }),
  triggerRecenter: () => set((s) => ({ recenterTrigger: s.recenterTrigger + 1 })),
  recomputeLayout: () => {
    const s = get();
    set({ layout: computeLayout(s) });
  },
}));
