# Plan: Homepage First-Action — Glowing Entrance Node + Camera Fly-In + Drag Feedback + Quick Capture

## Context
Users land on the app's 3D star map and have no obvious first action. The goal is to make the first 3 seconds self-explanatory:
1. **Glowing entrance node** — draws the eye and demands to be clicked
2. **Camera fly-in** — clicking any node animates the camera toward it (immersive, satisfying)
3. **Drag feedback** — dragging the canvas visibly stirs the nodes (physics feel)
4. **Quick capture bar** — type a sentence → new node appears in the star map (zero-friction input)

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/starmap/CosmosScene.tsx` | Add entrance orb, fly-in, drag feedback, new props |
| `src/components/starmap/KnowledgeStarMap.tsx` | Compute `entranceNoteId`, pass new props |
| `src/components/layout/StarMapLayout.tsx` | Wire `onEmptyStateClick` → open Capture Pod; add QuickCaptureBar |
| `src/components/starmap/QuickCaptureBar.tsx` | **NEW** floating text-to-node input |

---

## 1. Empty-State Entrance Orb (CosmosScene — empty state section)

**Replace the 6 ghost spheres + edges with:**

```
entranceOrbRef = new THREE.Mesh(
  SphereGeometry(1.8, 24, 24),
  MeshStandardMaterial({ emissive: '#00ff66', emissiveIntensity: 2.0 })
)
// position: (0, 0, 0)
// 3 concentric RingGeometry(r, r+0.2, 64) at radii 3, 5, 7 — animated outward pulse in useFrame
// Html below: "CLICK TO START  点击开始第一条知识"  (MONO, 10px, cursor:pointer)
```

**Interaction:** The empty-state orb mesh is stored in a separate `emptyCTAMeshRef`. In `onUp`, if the click hits `emptyCTAMeshRef.current` → call `onEmptyStateClick?.()` (opens Capture Pod).

**Animation in useFrame (empty state rings):**
```
rings[i].material.opacity = 0.4 * (1 - sin(t * 0.8 + i * π/3) * 0.5)
rings[i].scale.setScalar(1 + sin(t * 0.6 + i * π/3) * 0.15)
```

---

## 2. Entrance Note (non-empty state) — Most Recent Note Gets Special Treatment

**Props added to CosmosScene + ImperativeCore:**
```ts
entranceNoteId?: string   // most recently created note ID
```

**In ImperativeCore scene build:** After building all note meshes, if `entranceNoteId` is present and has a mesh:
- Scale it up by 1.6x at build time (or animate in useFrame)
- Add 2 concentric animated rings around it (RingGeometry) stored in `entranceRingsRef`
- Add Html label via a separate mechanism: a small tag `→ 最近活跃` in the hover label

**In useFrame (entrance note):**
```
entranceRings[0].material.opacity = 0.3 + sin(t * 1.2) * 0.2
entranceRings[1].material.opacity = 0.15 + sin(t * 0.8 + π) * 0.15
entranceRings[0].rotation.z += 0.005
entranceRings[1].rotation.z -= 0.003
```

**In KnowledgeStarMap:**
```ts
const entranceNoteId = useMemo(() => {
  if (!notes.length) return undefined;
  return [...notes].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0].id;
}, [notes]);
```

---

## 3. Camera Fly-In (ImperativeCore — click handler + useFrame)

**New ref in ImperativeCore:**
```ts
const flyTargetRef = useRef<THREE.Vector3 | null>(null);
```

**In `onUp` click handler** (after hitting a node):
```ts
const worldPos = noteMeshes.current.get(id)?.position.clone();
if (worldPos) flyTargetRef.current = worldPos;
```

**In `useFrame`** (after recenter handling):
```ts
if (flyTargetRef.current) {
  // Target: 20 units away from node, along current camera direction
  const dir = camera.position.clone().sub(flyTargetRef.current).normalize().multiplyScalar(20);
  const targetPos = flyTargetRef.current.clone().add(dir);
  camera.position.lerp(targetPos, 0.055);
  controls.target.lerp(flyTargetRef.current, 0.055);
  controls.update();
  if (camera.position.distanceTo(targetPos) < 1.5) flyTargetRef.current = null;
}
```

The fly-in takes ~1.5s and co-occurs with NodeWindow opening — feels like diving into the knowledge node.

---

## 4. Drag Feedback (ImperativeCore — useFrame animation)

**New ref:**
```ts
const isDraggingRef = useRef(false);
```

**In `onDown`:** `isDraggingRef.current = true`
**In `onUp`:** `isDraggingRef.current = false`

**In useFrame note animation** (change amplitude multiplier):
```ts
const dragBoost = isDraggingRef.current ? 3.2 : 1.0;  // 3x amplitude during drag
mesh.position.set(
  np.pos[0] + sin(t * 0.3 + phase) * 0.18 * dragBoost,
  np.pos[1] + cos(t * 0.25 + phase * 0.8) * 0.22 * dragBoost,
  np.pos[2] + sin(t * 0.2 + phase * 1.3) * 0.15 * dragBoost,
);
// Also boost emissive intensity slightly for nodes near cursor during drag
```

Nodes "stir" visibly when the user rotates the scene — satisfying physical feedback with zero extra complexity.

---

## 5. NEW: QuickCaptureBar (`src/components/starmap/QuickCaptureBar.tsx`)

**Design:** Fixed, always-visible floating input above CommandDock, similar to a command palette strip.

```
position: fixed
bottom: ~130px (above the dock)
left: 50%
width: 440px
height: 44px
background: rgba(3,5,12,0.90) + backdrop-blur
border: 1px solid rgba(0,255,102,0.18)
glow on focus: box-shadow 0 0 20px rgba(0,255,102,0.20)
```

**Interaction:**
- Placeholder: `输入一条知识，按 Enter 落入星图…`
- Keyboard shortcut: pressing `/` or `Q` when not typing → focus the input
- On Enter with content:
  1. `supabase.from('notes').insert({ user_id, node_type: 'capture', title: input.trim(), summary: null, tags: [], ... })`
  2. `onFlashNote(newNote.id)` → star map flashes the new node
  3. Clear input + brief success glow animation
- Left: small `+` icon button (same action as Enter)  
- Right: `⌘K` badge hint

**Integration in StarMapLayout:**
```tsx
<QuickCaptureBar userId={user.id} onFlashNote={flashNote} />
```
Placed between Layer 5 (NodeLightBand) and Layer 6 (CommandDock).

---

## Hover Label Enhancement (Light Interaction)

In `CosmosScene` (hover label section), upgrade from current tiny single-line label to:
```
┌─ CAPTURE ──────────────────────┐
│ Note Title (max 32 chars…)     │
│ #tag1  #tag2  · 3天前          │
│ ▶ 点击展开                     │
└────────────────────────────────┘
```
- Width: 220px fixed
- Type badge: colored micro-badge (already exists in NodeWindow)
- Title: 12px Inter semibold (was 9px MONO)
- Tags: up to 3 tags, 8px
- Time: `formatDistanceToNow` (already used in NodeWindow)
- "▶ 点击展开" hint in 8px at bottom

The `note` object in hover already has `title`, `tags`, `summary` and `created_at`.

---

## Verification Steps

1. **Empty state**: Open app with no notes → single glowing green orb at center, rings pulse → click → Capture Pod opens
2. **Non-empty entrance**: After adding notes, most recent note has rotating rings and brighter glow
3. **Fly-in**: Click any node → camera smoothly moves to ~20 units from node while NodeWindow opens
4. **Drag feedback**: Hold mousedown + drag → nodes visibly stir (3x amplitude)
5. **Quick capture**: Type `/` or `Q` → input focuses → type text + Enter → new node appears with flash animation in star map
6. **Hover label**: Hover any node → enhanced label with type badge, title (12px), tags, time, click hint
