# Camera Navigation System Overhaul

## Context

The 3D knowledge star map currently uses raw `camera.position.lerp()` with hardcoded alpha values (0.055 / 0.065) inside `useFrame` for camera transitions. This produces:

1. **Non-uniform timing** — the lerp alpha is frame-rate dependent, making fly-in faster on 120fps screens and slower on 30fps
2. **Abrupt or sluggish transitions** — fly-to-node uses 0.055, recenter uses 0.065, but neither has easing curves, so the motion lacks "cinematic" feel
3. **No distance-aware duration** — flying to a nearby node takes the same proportional time as flying across the entire universe
4. **Flash note has no camera movement** — `flashNoteId` only triggers a visual pulse, the camera doesn't move to the flashed node
5. **No galaxy-level fly** — clicking a galaxy tag doesn't zoom to its center
6. **OrbitControls damping fights with manual tweens** — `controls.update()` is called inside the tween, causing micro-jitter

## Approach: `useCosmosCam` Hook

Create a single hook that wraps all camera navigation into a **priority-queue animation system** with `smoothDamp` (critically damped spring, like camera-controls and Unity's `SmoothDamp`). The hook runs inside `useFrame` and owns all camera position/target changes.

---

## File Plan

### 1. NEW: `src/hooks/useCosmosCam.ts`

The core camera controller hook.

**Animation Model — SmoothDamp (critically damped spring)**
```
velocity += (target - current - velocity * 2 * smoothTime) / (smoothTime * smoothTime) * dt
current += velocity * dt
```
- Produces a natural deceleration curve (fast start, gentle stop)
- Frame-rate independent (uses `delta` from useFrame)
- `smoothTime` = time to reach ~63% of target (like camera-controls)

**Camera Action Catalog:**

| Action | Target Distance | smoothTime | Zoom Level | Trigger |
|--------|----------------|------------|------------|---------|
| `focusNode(noteId)` | 20 units from node | 0.45s | Close | Node click, flash, anchor scan |
| `focusGalaxy(tag)` | 1.6 * cluster.radius | 0.55s | Mid | Tag click, galaxy context |
| `recenter()` | INIT_CAM_POS (0,0,90) | 0.50s | Full | Space bar, double-click empty, G key |
| `peek(pos, distance?)` | custom | 0.35s | custom | Retrieval source trace, external |

**State machine:**
```
idle -> animating -> settling -> idle
```
- `animating`: smoothDamp is running, OrbitControls disabled
- `settling`: within 0.5 units of target, re-enable OrbitControls with damping
- `idle`: user has full orbit/pan/zoom control

**API (returned from hook):**
```ts
interface CosmosCamAPI {
  focusNode:   (noteId: string) => void;
  focusGalaxy: (tag: string) => void;
  recenter:    () => void;
  peek:        (target: Vector3, distance?: number) => void;
  isAnimating: boolean;   // read inside useFrame for orbit lock
}
```

**Implementation details:**
- Uses `useThree()` to get camera + controls
- Reads `sceneStore.getState().layout` to look up node/galaxy positions
- Runs in `useFrame` with priority `-1` (before ImperativeCore) to update camera before scene renders
- SmoothDamp for both `camera.position` and `controls.target` simultaneously
- Auto-disables OrbitControls during animation (sets `controls.enabled = false`)
- Re-enables with a 100ms settling window after reaching target

### 2. MODIFY: `src/components/starmap/CosmosScene.tsx`

**Remove from ImperativeCore's `useFrame`:**
- Lines 1156-1172: fly-in tween (`flyTargetRef`) + recenter tween (`recenterActiveRef`)
- Lines 1120-1125: Manual OrbitControls enable/disable (moved to useCosmosCam)

**Remove from ImperativeCore:**
- `flyTargetRef` ref and all its usage
- The fly logic in click handler (line 989: `if (worldPos) flyTargetRef.current = worldPos.clone()`)

**Replace with:**
- Accept `camApi: CosmosCamAPI` prop
- On node click: call `camApi.focusNode(id)` instead of setting flyTargetRef
- On empty-state click: call `camApi.recenter()` (already centered at origin)
- OrbitControls disable: check `camApi.isAnimating` in useFrame

**Keep in ImperativeCore's `useFrame`:**
- All node animation, edge opacity, LOD, hover raycasting (unchanged)
- Auto-rotate management (unchanged)
- `recenterActiveRef` still used for Space/G key — but now triggers `camApi.recenter()`

**OrbitControls config change:**
```ts
// Before:
enableDamping: true, dampingFactor: 0.08,
zoomSpeed: 0.7, panSpeed: 0.6,

// After:
enableDamping: true, dampingFactor: 0.12,    // Slightly more responsive
zoomSpeed: 0.8, panSpeed: 0.7,               // Slightly faster user input
```

### 3. MODIFY: `src/components/starmap/KnowledgeStarMap.tsx`

- Remove `recenterActiveRef` pattern (Space/G/double-click) — replace with `camApi.recenter()`
- Pass `camApi` down to `CosmosScene` as prop
- `flashNoteId` change: when flashNoteId is set, also call `camApi.focusNode(flashNoteId)` so the camera flies to the flashed node
- Export `camApi` ref so StarMapLayout can call `camApi.focusGalaxy(tag)` from tag filter

### 4. MODIFY: `src/components/layout/StarMapLayout.tsx`

- `flashNote` callback: already sets flashNoteId; camera follow is now automatic
- Tag click handler: call `camApi.focusGalaxy(tag)` so clicking a tag in NodeLightBand zooms to that galaxy
- G key shortcut: call `camApi.recenter()` instead of incrementing recenterTrigger

### 5. MODIFY: `src/stores/interactionStore.ts`

- No structural changes needed. The `escapeAll()` action can optionally trigger recenter by dispatching a custom event that KnowledgeStarMap listens to.

---

## Animation Timing Rules

| Category | smoothTime | Use Case |
|----------|-----------|----------|
| **Snap** | 0.30s | Recenter from close distance (<30 units away) |
| **Standard** | 0.45s | Node focus, flash-to-node |
| **Cruise** | 0.55s | Galaxy focus, cross-universe travel |
| **Gentle** | 0.35s | Peek (retrieval trace, external navigation) |

Distance-aware adjustment: if the travel distance > 80 units, multiply smoothTime by `1 + (distance - 80) / 200` (capped at 1.5x) so long jumps don't feel rushed.

---

## Integration with Existing Features

| Feature | Current Behavior | New Behavior |
|---------|-----------------|-------------|
| Node click | lerp(0.055) fly-in, no easing | `focusNode()` smooth spring to 20u from node |
| Flash note (F key, capture) | Visual pulse only | Visual pulse + `focusNode()` camera fly |
| Space / G / double-click | lerp(0.065) recenter | `recenter()` smooth spring to INIT_CAM_POS |
| Tag filter click | Highlights nodes, no camera | Highlights nodes + `focusGalaxy(tag)` zoom |
| QR/NFC anchor scan | Opens note page (no star map) | Future: could `focusNode()` if on star map |
| Retrieval source trace | No camera action | `peek()` at source node position |

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/hooks/useCosmosCam.ts` | **CREATE** — smoothDamp camera controller |
| `src/components/starmap/CosmosScene.tsx` | **MODIFY** — remove lerp tweens, accept camApi, delegate camera control |
| `src/components/starmap/KnowledgeStarMap.tsx` | **MODIFY** — mount useCosmosCam, wire up focusNode/recenter/flashNote |
| `src/components/layout/StarMapLayout.tsx` | **MODIFY** — wire focusGalaxy for tag clicks, simplify recenter |

---

## Verification

1. **Node click**: Click a node → camera smoothly flies to 20 units away, decelerating naturally
2. **Recenter**: Press Space or G → camera returns to overview position with spring motion
3. **Flash note**: Press F on hovered node → pulse animation + camera flies to node
4. **Tag filter**: Click a tag in NodeLightBand → highlighted nodes + camera zooms to galaxy center
5. **Frame-rate independence**: Test at 30fps and 60fps — transition duration should feel identical
6. **No jitter**: Camera should not fight with OrbitControls during or after animation
7. **Drag-to-connect still works**: OrbitControls disabled during drag should still function
8. **Perf overlay**: Shift+P should still show correct FPS during camera transitions
