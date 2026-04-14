# Plan: 3D Knowledge Cosmos — Infinite Star Map

## Context
The current KnowledgeStarMap is a 2D Canvas animation. The user wants a true 3D immersive
knowledge universe: infinite space, real 3D navigation (orbit/zoom/pan), clickable knowledge
nodes that expand into floating edit windows, and tag-based galaxy clusters. This requires
replacing Canvas 2D with Three.js WebGL.

---

## Technology

**New packages to install:**
- `three` — WebGL 3D engine
- `@react-three/fiber` — React renderer for Three.js
- `@react-three/drei` — Three.js helpers (Stars, OrbitControls, Html)
- `@react-three/postprocessing` — Bloom glow effect

---

## Architecture

### Layer model (z-index unchanged)
```
KnowledgeStarMap  →  <Canvas> WebGL scene  (z-index: 0)
FloatingPods      →  HTML overlays           (z-index: 20)
CommandDock       →  HTML overlay            (z-index: 30)
SettingsCapsule   →  HTML overlay            (z-index: 40)
```

### Files to CREATE
1. `src/components/starmap/CosmosScene.tsx` — Inner Three.js scene (all 3D objects)
2. `src/components/starmap/NodeWindow.tsx`  — Floating edit window via `<Html>` from drei
3. `src/components/starmap/cosmos-layout.ts` — Deterministic 3D position algorithm

### Files to REWRITE
4. `src/components/starmap/KnowledgeStarMap.tsx` — becomes `<Canvas>` wrapper + state manager

### Files to UPDATE
5. `src/components/layout/StarMapLayout.tsx` — remove navigate-on-click; nodes now open inline windows

---

## 3D Layout Algorithm (`cosmos-layout.ts`)

```typescript
// Input: notes with tags, created_at, id
// Output: { positions: Map<noteId, [x,y,z]>, clusters: ClusterInfo[] }

// 1. Group notes by primary tag
// 2. Place each tag cluster center using Fibonacci sphere distribution
//    (deterministic, evenly spread around a sphere of radius 25-40)
// 3. Place each note within its cluster:
//    - seeded random offset (± 5 units) around cluster center
//    - Recent notes float slightly closer to origin (lower Z offset)
// 4. Build connection list: notes sharing ≥1 tag are connected
// 5. Build cluster metadata: center, color (from PALETTE), noteIds, tag name
```

Deterministic hash: `hash01(noteId, salt)` → same positions every load.

---

## `CosmosScene.tsx` — Three.js Components

```
<CosmosScene>
 ├── ambientLight intensity=0.03
 ├── <Stars radius=400 depth=120 count=10000 factor=5 saturation=0.4 />
 ├── {clusters.map(c => <GalaxyHalo center radius color opacity=0.04 />)}
 ├── {edges.map(e => <ConnectionLine from to color alpha />)}
 ├── {notes.map(n => <NoteNode ... />)}
 ├── <OrbitControls enablePan enableZoom autoRotate autoRotateSpeed=0.08 />
 └── <EffectComposer>
      └── <Bloom luminanceThreshold=0.15 intensity=0.6 mipmapBlur />
```

**`<NoteNode>`**: 
- `<mesh>` with `<sphereGeometry args={[0.7, 16, 16]}>`
- `<meshStandardMaterial emissive={color} emissiveIntensity={glow} color="black">`
- `onPointerOver/Out` → trigger onNodeHover callback
- `onClick` → toggle NodeWindow open
- When hovered: `<Html center><NodeLabel /></Html>` (title chip, no transform)
- When open: `<Html center distanceFactor={18}><NodeWindow /></Html>`

**`<GalaxyHalo>`**:
- `<mesh>` position={clusterCenter}
- `<sphereGeometry args={[radius, 12, 12]}>`
- `<meshBasicMaterial color wireframe={false} transparent opacity=0.025 />`
- Subtle glow ring around cluster

**`<ConnectionLine>`**:
- `<Line>` from drei between two 3D points
- Width 0.3, color = cluster palette, opacity 0.12 (0.6 when hover-active)

---

## `NodeWindow.tsx` — Knowledge Card (inside Html)

```
┌─────────────────────────────────┐
│ ▸ NOTE TITLE              [×][⊔]│ ← monospace header, accent color
├─────────────────────────────────┤
│ Summary text (2-3 lines)        │ ← read mode
│                                 │
│ [tag1] [tag2]   2025-01-15      │ ← metadata row
├─────────────────────────────────┤
│ [Edit] [Connect] [Full Note →]  │ ← action row
└─────────────────────────────────┘
```

**Edit mode**: summary becomes `<textarea>`, title becomes `<input>`, Save/Cancel buttons appear
**State**: title, summary, tags read from note prop; on save → `supabase.from('notes').update()`
**Multiple windows**: each node manages its own open state; parent tracks Set<openNodeId>
**Style**: `width: 280px`, glass morphism (`rgba(5,7,12,0.92)` + blur + accent border)

---

## `KnowledgeStarMap.tsx` (rewrite)

```typescript
// Props interface UNCHANGED (backward compat):
// notes, loading, onNodeHover, onNodeClick, highlightedNoteIds, flashNoteId

export default function KnowledgeStarMap(props) {
  const layout = useMemo(() => buildCosmosLayout(props.notes), [props.notes]);
  const [openNodes, setOpenNodes] = useState<Set<string>>(new Set());
  
  const toggleNode = (id: string) => setOpenNodes(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div style={{ position:'fixed', inset:0, zIndex:0 }}>
      <Canvas camera={{ position:[0,0,90], fov:55 }} gl={{ antialias:true }}>
        <CosmosScene
          {...layout}
          notes={props.notes}
          highlightedNoteIds={props.highlightedNoteIds}
          flashNoteId={props.flashNoteId}
          openNodes={openNodes}
          onNodeToggle={toggleNode}
          onNodeHover={props.onNodeHover}
        />
      </Canvas>
    </div>
  );
}
```

---

## `StarMapLayout.tsx` changes

- Remove `navigate('/app/note/:id')` as the click handler
- The `onNodeClick` prop now does nothing (clicking a node opens NodeWindow inline)
- The `onNodeHover` still feeds `NodeLightBand`
- Add "Open Full Note" button inside NodeWindow that calls `navigate`

---

## Visual Design

| Element | Color | Detail |
|---------|-------|--------|
| Node (untagged) | `rgba(100,110,130,0.8)` | dim grey |
| Node (cluster 0) | `#00ff66` neon green | emissive glow |
| Node (cluster 1) | `#66f0ff` cyan | emissive glow |
| Node (cluster 2) | `#b496ff` purple | emissive glow |
| Node (cluster 3) | `#ffa040` amber | emissive glow |
| Node (cluster 4) | `#ff4466` red-pink | emissive glow |
| Highlighted node | `#66f0ff` + 2x scale | search result |
| Flash node | white burst → color | new note created |
| Galaxy halo | cluster color, 2-4% opacity | sphere cloud |
| Connections | cluster color, 12% opacity | thin lines |
| Background stars | white + blue tint | 10k particles |
| Bloom | luminance 0.15, intensity 0.6 | glow effect |

---

## Implementation Order

1. Install 4 packages
2. Write `cosmos-layout.ts` (pure TS, no React)
3. Write `NodeWindow.tsx` (pure HTML component)
4. Write `CosmosScene.tsx` (Three.js scene)
5. Rewrite `KnowledgeStarMap.tsx` (Canvas wrapper)
6. Update `StarMapLayout.tsx` (remove nav-on-click)
7. TypeScript check + lint + build

---

## Verification

- `npx tsc --noEmit` → 0 errors
- `npm run build` → successful
- App loads at `/app` showing 3D canvas
- Notes visible as glowing spheres
- Click node → NodeWindow opens inline
- Edit + save → Supabase update
- OrbitControls: mouse drag rotates, scroll zooms, right-click pans
- Bloom effect visible on nodes
- CommandDock and pods render above canvas (not inside Canvas)
