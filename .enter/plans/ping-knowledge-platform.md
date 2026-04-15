# Plan: Drag-to-Galaxy Classification Interaction

## Context
The star map currently groups nodes into cluster galaxies automatically based on `notes.tags[0]` (primary tag). Users want to manually drag nodes into galaxies to override this grouping and organize their knowledge space intentionally. The interaction must feel cosmic — not like filing documents.

## Design Decisions

### Data Persistence: Tag-first, No New Table
Manual galaxy assignment = **prepend the galaxy tag to `notes.tags` as the new first element**:
```ts
newTags = [galaxyTag, ...existingTags.filter(t => t !== galaxyTag)]
```
Since `buildCosmosLayout` uses `tags[0]` for cluster assignment, this naturally moves the node into the target galaxy on next notes rerender. No separate table needed. Auto-clustering and manual assignment are the same mechanism — just different intent.

"Create new galaxy" = type any name → it becomes a new cluster tag. Layout auto-creates the cluster.

### Reuse Existing Drag Mechanism
The 350ms long-press drag from drag-to-connect is **extended**:
- **Drop on node** → connect nodes (existing behavior, unchanged)
- **Drop on empty space in a galaxy zone** → join that galaxy (`onNodeDropToGalaxy(noteId, galaxyTag)`)
- **Drop on empty space outside all galaxies** → show overlay to choose/create galaxy (`onNodeDropToGalaxy(noteId, null)`)

Galaxy zone detection: `cursor3D.distanceTo(cluster.center) < cluster.radius * 1.4`

---

## Files to Change

### 1. NEW `src/components/starmap/GalaxyJoinOverlay.tsx`
Two visual modes in one component:

**Mode A — "join-existing"** (dropped inside a galaxy):
- Header: `将「note」加入「galaxy」星系`
- Single large galaxy chip in the target's color
- 3s auto-confirm countdown progress bar (same style as ConnectConfirmOverlay)
- "新建星系" pill (switches to mode B inline)
- "暂不归类" cancel

**Mode B — "choose"** (dropped in empty space):
- Header: `归入哪个星系？`
- All available galaxy tags as colored pills (scrollable if > 8)
- `[+ 新建星系]` expands inline text input — pressing Enter confirms with new tag name
- "暂不归类" to dismiss
- NO auto-confirm countdown (user must actively choose)

Both modes share the same glassmorphism style as `ConnectConfirmOverlay` (backdrop-blur, border with galaxy color, slide-up animation `cco-in`).

```tsx
interface GalaxyJoinOverlayProps {
  noteTitle:          string;
  targetGalaxy:       { tag: string; color: string } | null;  // null = empty space drop
  availableGalaxies:  { tag: string; color: string }[];
  onConfirm:          (galaxyTag: string) => void;
  onCancel:           () => void;
}
```

---

### 2. MODIFY `src/components/starmap/CosmosScene.tsx`

#### A. New refs
```ts
// Map cluster tag → halo mesh (for targeted highlight)
const halosByTagRef = useRef(new Map<string, THREE.Mesh>());
// Map cluster tag → ring mesh
const ringsByTagRef = useRef(new Map<string, THREE.Mesh>());

// Extend ConnectState with galaxy tracking
type ConnectState = {
  // ...existing fields...
  potentialGalaxyTag: string | null;  // NEW
};
```

#### B. Scene build — populate halosByTag / ringsByTag
In the `layout.clusters.forEach` loop (already building halos/rings), additionally:
```ts
halosByTagRef.current.set(cluster.tag, halo);
ringsByTagRef.current.set(cluster.tag, ring);
```
Clear both in cleanup.

#### C. onDown — activate galaxy-drag mode
When connect mode activates (after 350ms hold), immediately signal all galaxy halos to "open" by setting a `galaxyDragActiveRef = true`. In useFrame, this brightens all halos to 0.06 opacity (was 0.022) and rings to 0.12.

#### D. onMove — detect potential galaxy
After existing node hit-test, if no node target, check galaxy zone:
```ts
const cursor3D = getPointer3D(e, cs.sourceMesh.position.z);
let potentialGalaxy: string | null = null;
for (const cluster of layout.clusters) {
  if (cluster.tag === '__untagged__') continue;
  const cx = new THREE.Vector3(...cluster.center);
  if (cursor3D && cursor3D.distanceTo(cx) < cluster.radius * 1.4) {
    potentialGalaxy = cluster.tag;
    break;
  }
}
// Highlight/un-highlight halos
if (potentialGalaxy !== cs.potentialGalaxyTag) {
  // un-highlight old
  if (cs.potentialGalaxyTag) { /* restore halo to normal */ }
  // highlight new: scale 1.15×, opacity ×3
  cs.potentialGalaxyTag = potentialGalaxy;
}
```
Change drag line color to match the target galaxy when inside its zone.

#### E. onUp — dispatch galaxy drop
```ts
if (connectStateRef.current) {
  const { sourceId, potentialTargetId, potentialGalaxyTag } = cs;
  cancelConnect();
  if (potentialTargetId) {
    onNodeConnectRef.current?.(sourceId, potentialTargetId); // existing
  } else {
    onNodeDropToGalaxyRef.current?.(sourceId, potentialGalaxyTag); // NEW
  }
  return;
}
```

#### F. New prop
```ts
interface CosmosSceneProps { onNodeDropToGalaxy?: (noteId: string, galaxyTag: string | null) => void; }
interface CoreProps { onNodeDropToGalaxy?: ...; }
```
Pass through exported `CosmosScene` → `ImperativeCore`.

#### G. useFrame: galaxy-drag visual animation
When `galaxyDragActiveRef.current`:
- All halos: opacity → `clamp(current, 0.04, haloTarget * 3)` (more visible)
- Potential galaxy halo: `scale.setScalar(1.1 + sin(t*4)*0.04)`, opacity 0.08
- Potential galaxy ring: opacity 0.20, scale 1.15

---

### 3. MODIFY `src/components/starmap/KnowledgeStarMap.tsx`

#### Add state
```ts
interface PendingGalaxy {
  noteId:      string;
  targetTag:   string | null;  // null = user must choose
}
const [pendingGalaxy, setPendingGalaxy] = useState<PendingGalaxy | null>(null);
```

#### Add handler
```ts
const handleNodeDropToGalaxy = useCallback((noteId: string, galaxyTag: string | null) => {
  setPendingGalaxy({ noteId, targetTag: galaxyTag });
}, []);

const handleGalaxyJoinConfirm = useCallback(async (galaxyTag: string) => {
  if (!pendingGalaxy) return;
  setPendingGalaxy(null);
  const note = notesMap.get(pendingGalaxy.noteId);
  if (!note) return;
  const newTags = [galaxyTag, ...(note.tags ?? []).filter(t => t !== galaxyTag)];
  await supabase.from('notes').update({ tags: newTags, updated_at: new Date().toISOString() })
    .eq('id', pendingGalaxy.noteId);
  // Notes realtime subscription auto-refreshes the layout
}, [pendingGalaxy, notesMap]);

const handleGalaxyJoinCancel = useCallback(() => setPendingGalaxy(null), []);
```

#### Compute available galaxies for overlay
```ts
const availableGalaxies = useMemo(() =>
  layout.clusters
    .filter(c => c.tag !== '__untagged__' && c.noteIds.length >= 1)
    .map(c => ({ tag: c.tag, color: c.color })),
  [layout]);
```

#### Render overlay
```tsx
{pendingGalaxy && (
  <GalaxyJoinOverlay
    noteTitle={notesMap.get(pendingGalaxy.noteId)?.title ?? ''}
    targetGalaxy={
      pendingGalaxy.targetTag
        ? availableGalaxies.find(g => g.tag === pendingGalaxy.targetTag) ?? null
        : null
    }
    availableGalaxies={availableGalaxies}
    onConfirm={handleGalaxyJoinConfirm}
    onCancel={handleGalaxyJoinCancel}
  />
)}
```

Pass `onNodeDropToGalaxy={handleNodeDropToGalaxy}` to `CosmosScene`.

---

## Answering All 6 Design Questions

| Question | Answer |
|---|---|
| 1. 发现星系可以接收 | On hold (connect mode), ALL galaxy halos expand opacity ×2.5 and rings become visible — signals "space is open to receive." No extra UI needed. |
| 2. 拖入星系时接纳反馈 | Halo scales 1.15×, pulses at 4Hz, drag line color interpolates to galaxy color. Galaxy cluster name label visible at 100% opacity during drag. |
| 3. 归属变化视觉体现 | Node's emissive color transitions to galaxy's color (after notes refetch, `buildCosmosLayout` repositions node into that cluster). Galaxy emits a brief wave pulse (same as empty-state click wave). |
| 4. 三个选项 | Mode A (in-galaxy): auto-confirm 3s | "新建星系" | "暂不归类". Mode B (empty space): all galaxy pills | inline new-galaxy input | "暂不归类". |
| 5. 自动+手动共存 | Manual = tag update. Auto = same tag algorithm. Same mechanism, different intention. No conflict or new table. |
| 6. 避免复杂管理 | Zero new navigation or panels. Full flow: long-press → drag → release = 3 physical gestures. Overlay auto-confirms for targeted drops. |

---

## No DB Migration Needed
Galaxy assignment uses the existing `notes.tags` array. `notes` table already has full RLS + `updateNote` via `useNotes`.

---

## Verification
1. Long-press a node → hold 350ms → all galaxy halos should brighten
2. Drag into a named cluster zone → halo pulses, drag line recolors
3. Release in cluster → GalaxyJoinOverlay shows (Mode A) with auto-confirm
4. Wait 3s → note's `tags[0]` updated in DB → star map regroups
5. Release in empty space → Mode B overlay, choose existing galaxy or type new
6. Type new galaxy name + Enter → note gets new first tag → new cluster appears in star map
7. ESC at any point → cancel, no changes
