# 知识宇宙 · 完整优化方案

## Context
User confirmed all design consultation suggestions. Implement the performance/UX/visual improvements
for the 3D knowledge cosmos. No DB schema changes needed (skip node-type polymorphism, version tree,
bi-directional links — those require migrations). Focus on rendering, interaction, and controls.

---

## Scope — what will change

| File | Changes |
|---|---|
| `cosmos-layout.ts` | Add `fromNoteId`/`toNoteId` to `CosmosEdge` |
| `CosmosScene.tsx` | LOD system, hover-only edges, camera recenter, auto-rotate pause, raycasting throttle, shared materials, halo proximity opacity |
| `KnowledgeStarMap.tsx` | Max-3 windows, Space/Escape keys, double-click recenter, `recenterTrigger` prop, LOD level state, background tweak |
| `StarMapLayout.tsx` | "↺ 中心" recenter button in HUD, `recenterTrigger` state |

---

## 1. `cosmos-layout.ts` — minimal change

Add to `CosmosEdge`:
```ts
fromNoteId: string;
toNoteId: string;
```
Populate in `buildCosmosLayout`: `edges.push({ ..., fromNoteId: ni.id, toNoteId: nj.id })`.

---

## 2. `CosmosScene.tsx` — core changes

### A. Hover-only edges
- Build `edgesByNoteIdRef: Map<string, THREE.Line[]>` and `allEdgeLinesRef: THREE.Line[]` in useEffect
- All edges start at `opacity: 0`
- In `useFrame`: when `hoveredId` changes, set connected edges `opacity → 0.25`, all others `opacity → 0`
- Use a `lastHoveredId` ref to detect change and avoid setting material every frame

### B. LOD system (camera-distance based)
In `useFrame`, compute `dist = camera.position.length()`:

| Distance | Halo opacity | Ring opacity | Edges (non-hover) |
|---|---|---|---|
| < 70 | 0.022 | 0.055 | 0 (hover-only) |
| 70–130 | fade to 0 | fade to 0 | 0 |
| > 130 | 0 | 0 | 0 |

Lerp halo/ring material opacity toward target (factor 0.04 — smooth).
Store `haloMeshesRef: THREE.Mesh[]` and `ringMeshesRef: THREE.Mesh[]` to iterate over.

**Cluster labels LOD** (in React layer):
- Add `CosmosLOD` sub-component inside Canvas that tracks camera distance in `useFrame`
- When `dist` crosses thresholds call `setLodLevel` (only on threshold crossing, not every frame)
- `CosmosScene` props pass `onLodChange(level: 0|1|2)` up, parent stores `lodLevel` state
- Conditionally: `lodLevel === 0` renders cluster labels

### C. Camera recenter tween
Add props `recenterActiveRef: React.MutableRefObject<boolean>` to `ImperativeCore`.
In `useFrame`:
```ts
if (recenterActiveRef.current) {
  camera.position.lerp(INIT_POS, 0.065);
  (controls as any)?.target?.lerp(ZERO3, 0.065);
  (controls as any)?.update?.();
  if (camera.position.distanceTo(INIT_POS) < 0.8) {
    recenterActiveRef.current = false;
  }
}
```
`INIT_POS = new THREE.Vector3(0, 0, 90)`.
Uses `useThree().controls` (available because `makeDefault: true` on OrbitControls).

### D. Auto-rotate pause/resume
In click/hover `useEffect` on `gl.domElement`:
- `mousedown` → `orbitAutoRotateRef.current = false` + clear pending timer
- `mouseup` → start 3s timer → set `orbitAutoRotateRef.current = true`
In `useFrame`: `(controls as any)?.autoRotate = orbitAutoRotateRef.current` (only set when changed).

### E. Raycasting throttle
```ts
const frameCountRef = useRef(0);
useFrame((...) => {
  frameCountRef.current++;
  // ... animation (every frame)
  if (frameCountRef.current % 3 === 0) {
    // raycasting
  }
});
```

### F. Shared materials per cluster color
Instead of creating one `MeshStandardMaterial` per node, build a `Map<string, THREE.MeshStandardMaterial>`
keyed by color. Nodes of the same cluster share a material. Use `emissiveIntensity` per-mesh via
a separate `Float32Array` approach OR keep per-mesh materials but reuse geometry by color. 
**Simpler**: just create one material per unique color (≤8 palette entries), clone only if needed.
Reduces material count from N to ≤8.

### G. Camera damping
`OrbitControls` props: add `enableDamping: true, dampingFactor: 0.08`.

### H. New node flash (white pulse)
Existing `flashNoteId` logic already scales+glows. Enhance: add white flash overlay by setting
`emissive: new THREE.Color('white')` temporarily then fading back to cluster color in useFrame.
Track `flashStartTime` per note in a `flashTimesRef: Map<string, number>`.

---

## 3. `KnowledgeStarMap.tsx` — interaction layer

### Max 3 node windows
```ts
const toggleNode = useCallback((id: string) => {
  setOpenNodes(prev => {
    const next = new Set(prev);
    if (next.has(id)) { next.delete(id); return next; }
    if (next.size >= 3) {
      const oldest = Array.from(next)[0];
      next.delete(oldest);
    }
    next.add(id);
    return next;
  });
}, []);
```

### Keyboard shortcuts
```ts
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); recenterRef.current = true; }
    if (e.code === 'Escape') setOpenNodes(new Set());
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, []);
```

### Double-click recenter
On the wrapper `<div>`: `onDoubleClick={() => { recenterRef.current = true; }}`.

### `recenterTrigger` prop
```ts
interface KnowledgeStarMapProps { ...; recenterTrigger?: number; }
useEffect(() => {
  if (recenterTrigger) recenterRef.current = true;
}, [recenterTrigger]);
```

### LOD level upward callback
Pass `onLodChange?: (level: 0|1|2) => void` prop (optional, used by StarMapLayout for future UI).
Actually, cluster labels live inside Canvas — just conditionally render them inside CosmosScene
based on `lodLevel` state held in `KnowledgeStarMap` (passed down via CosmosScene props).

### Background
Change `#040508` → `#01040d` (slight blue tint, as spec'd).

---

## 4. `StarMapLayout.tsx` — minimal HUD update

Add to existing HUD (`pointerEvents: 'none'` div):
- Make that div's inner area `pointerEvents: 'auto'` for the button area
- Add "↺" button styled with MONO font, accent color, that calls `setRecenterTrigger(t => t+1)`
- Add `[recenterTrigger, setRecenterTrigger] = useState(0)` state
- Pass `recenterTrigger` prop to `<KnowledgeStarMap>`

---

## 5. Visual tweaks
- Bloom: `luminanceThreshold: 0.20, intensity: 0.60` (slightly reduced for realism)
- OrbitControls: `enableDamping: true, dampingFactor: 0.08`
- Star field: `opacity: 0.75` (slightly reduced to not compete with nodes)

---

## Verification
1. Open `/app` → stars and galaxy halos visible
2. Hover a node → connected edges appear (opacity ~0.25), disappear on un-hover
3. Zoom out far → halos fade out, cluster labels disappear
4. Double-click empty space → camera smoothly returns to origin
5. Press Space → same recenter behavior
6. Press Escape → all node windows close
7. Open 3 node windows, click a 4th → oldest closes, 4th opens
8. Stop interacting 3s → auto-rotate resumes
9. Click "↺" button in top-left HUD → camera recenters
10. Build: 0 TS errors, 0 lint errors
