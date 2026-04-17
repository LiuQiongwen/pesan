# Node/Galaxy Delete & Move — Implementation Plan

## Context

The knowledge star map currently treats nodes and galaxies (clusters) as read-only, auto-positioned objects. Users cannot delete nodes/galaxies, nor manually reposition them. This plan adds four fundamental CRUD/spatial operations: **node delete**, **galaxy delete/dissolve**, **node drag-move**, and **galaxy drag-move** — turning the star map into a truly user-controlled knowledge space.

---

## 1. Database Migration

### 1a. `node_positions` table — persists manual placements

```sql
CREATE TABLE node_positions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id),
  note_id    uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  x          double precision NOT NULL,
  y          double precision NOT NULL,
  z          double precision NOT NULL,
  is_manual  boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, note_id)
);
ALTER TABLE node_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own positions" ON node_positions FOR ALL USING (auth.uid() = user_id);
```

### 1b. `galaxy_positions` table — persists manual galaxy center overrides

```sql
CREATE TABLE galaxy_positions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id),
  tag        text NOT NULL,
  cx         double precision NOT NULL,
  cy         double precision NOT NULL,
  cz         double precision NOT NULL,
  is_manual  boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tag)
);
ALTER TABLE galaxy_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own galaxy positions" ON galaxy_positions FOR ALL USING (auth.uid() = user_id);
```

### 1c. Add soft-delete column to `notes`

```sql
ALTER TABLE notes ADD COLUMN deleted_at timestamptz DEFAULT NULL;
CREATE INDEX idx_notes_deleted ON notes (user_id) WHERE deleted_at IS NOT NULL;
```

All existing queries in `useNotes.ts` will be updated to filter `deleted_at IS NULL`.

---

## 2. Node Delete

### Entry Points
- **Context menu** (right-click / long-press) → add "🗑 删除节点" item in `NodeContextMenu.tsx`
- **NodeWindow** detail panel → add a small trash button in the header bar

### Interaction Flow
1. User triggers delete → **confirmation overlay** appears (reusable `ConfirmDeleteOverlay` component)
   - Shows node title, tag count, edge count
   - Red "删除" button + "取消" button
   - Keyboard: Enter = confirm, Esc = cancel
2. On confirm:
   - **Soft-delete**: `UPDATE notes SET deleted_at = now() WHERE id = $1`
   - Remove from local `notes` state immediately (optimistic)
   - Related edges auto-handled: `thought_edges` has FK ON DELETE CASCADE on `source_id`/`target_id`... wait, let me verify.

### Edge & Cascade Handling
- `thought_edges.source_id` / `target_id` → FK to `notes(id)` — but notes aren't hard-deleted, they're soft-deleted. So edges remain in DB. We filter them out in the frontend: when building `CosmosLayout`, skip edges referencing deleted notes (which won't be in the notes array anyway since `useNotes` filters `deleted_at IS NULL`).
- `knowledge_chunks.note_id` → FK to notes. Soft-delete keeps chunks intact for potential undo.
- `wiki_source_refs.note_id` → FK SET NULL. Soft-delete doesn't trigger this.

### Galaxy Handling After Node Delete
- If a galaxy's last node is deleted, the galaxy simply disappears from the layout (no nodes → no cluster).
- No special handling needed — `buildCosmosLayout` recomputes.

### Undo Mechanism
- After soft-delete, show a **toast with "撤销" button** at bottom of screen for 8 seconds.
- Undo = `UPDATE notes SET deleted_at = NULL WHERE id = $1`, re-add to local state.
- After 8 seconds, toast disappears. Data remains soft-deleted but recoverable via future "trash" UI.

### Files Modified
- `src/hooks/useNotes.ts` — change `deleteNote` to soft-delete, add `undoDeleteNote`, filter `deleted_at IS NULL` in fetch
- `src/components/starmap/NodeContextMenu.tsx` — add "删除节点" menu item
- `src/components/starmap/NodeWindow.tsx` — add trash button
- **NEW**: `src/components/starmap/ConfirmDeleteOverlay.tsx` — reusable confirmation modal
- **NEW**: `src/components/starmap/UndoToast.tsx` — auto-dismiss toast with undo action
- `src/components/starmap/KnowledgeStarMap.tsx` — wire delete handlers + undo state

---

## 3. Galaxy Delete / Dissolve

### Concept
Galaxies (clusters) are tag-based groupings. "Deleting a galaxy" means removing the tag from all member nodes.

### Two Modes
1. **解散星系 (Dissolve)** — default: Remove the galaxy's primary tag from all member notes. Nodes move to `__untagged__` cluster or their next tag's cluster. Nodes are preserved.
2. **彻底删除 (Delete All)** — soft-delete all member notes in the galaxy. Uses the same node-delete flow for each.

### Entry Point
- **Right-click on galaxy halo/ring area** → context menu with galaxy name, dissolve/delete options
- Detected in `CosmosScene.tsx` `onContextMenu`: if raycaster hits a halo mesh, dispatch `cosmos-galaxy-context-menu` event

### Interaction Flow
1. Right-click galaxy halo → `GalaxyContextMenu` appears with:
   - Galaxy name (tag) + node count
   - "解散星系" (dissolve) — default, safe
   - "删除星系及全部节点" (delete all) — destructive, red
2. On dissolve:
   - For each note in galaxy: remove the galaxy's tag from `tags` array
   - `UPDATE notes SET tags = array_remove(tags, $tag) WHERE user_id = $uid AND $tag = ANY(tags)`
   - Show undo toast for 8 seconds
3. On delete all:
   - Confirmation dialog (extra warning: "将删除 N 个节点")
   - Soft-delete all member notes
   - Show undo toast

### Files Modified
- `src/components/starmap/CosmosScene.tsx` — detect right-click on halo, dispatch galaxy context menu event
- **NEW**: `src/components/starmap/GalaxyContextMenu.tsx` — context menu for galaxy operations
- `src/components/starmap/KnowledgeStarMap.tsx` — wire galaxy delete/dissolve handlers, undo state

---

## 4. Node Drag-Move

### Interaction
- **Hold + drag** is already used for drag-to-connect. We need a different gesture.
- **Approach**: In `browse` mode, Alt+drag (desktop) or two-finger-then-single-drag (mobile) initiates node move. Alternatively, simpler: when a node is **selected** (single-clicked), dragging it moves it.
- **Chosen approach for MVP**: When a node is selected (`selectedNodeId === noteId`), a subsequent mousedown+drag on that same node enters **move mode** instead of connect mode. The 350ms hold timer is skipped for already-selected nodes.

### Visual Feedback During Drag
- Dragged node gets: scale 1.4, emissiveIntensity 3.5, slight blue tint
- A subtle "shadow" ghost remains at original position (low opacity mesh clone)
- Connected edges follow the node (update line endpoints in real-time)
- Cursor: `grabbing`

### Position Persistence
- On drag end:
  - Upsert to `node_positions` table: `(user_id, note_id, x, y, z, is_manual=true)`
  - Update local layout position immediately
- `buildCosmosLayout` checks for manual positions: if `node_positions` entry exists, use that instead of computed Fibonacci position

### Auto-Layout vs Manual
- Nodes with `is_manual = true` in `node_positions` keep their position across layout rebuilds
- If a node's tag changes (moving to different galaxy), and it has a manual position, **keep the manual position** unless user explicitly resets
- Future: "重置位置" button in NodeContextMenu to clear manual position

### Files Modified
- `src/components/starmap/CosmosScene.tsx` — add move-mode drag handling in onDown/onMove/onUp for selected nodes
- `src/components/starmap/cosmos-layout.ts` — accept `manualPositions: Record<string, [number,number,number]>` parameter, apply overrides
- `src/components/starmap/KnowledgeStarMap.tsx` — fetch/save node_positions, pass to layout builder, handle onNodeMove callback
- `src/components/starmap/NodeContextMenu.tsx` — add "重置位置" option (clears manual position)

---

## 5. Galaxy Drag-Move

### Interaction
- **Alt+click+drag on galaxy halo/ring** initiates galaxy move
- All nodes in the galaxy move together, preserving relative offsets from the galaxy center

### Implementation
- In `CosmosScene.tsx`, detect Alt+mousedown on halo mesh → enter galaxy-move mode
- Track `dragDelta = currentCursorPos - galaxyCenter`
- Each frame during drag: move all member node meshes by delta, update halo/ring positions
- On release: compute new center = oldCenter + totalDelta, compute each node's new absolute position = old + totalDelta
  - Upsert `galaxy_positions` for the galaxy center
  - Upsert `node_positions` for each member node (mark is_manual=true)
  
### Visual Feedback During Galaxy Drag
- Galaxy halo: opacity boost to 0.08, subtle pulse
- All member nodes: slight scale boost (1.1x), shared glow color intensifies
- Connected edges between members stay connected; edges to external nodes stretch dynamically
- Galaxy tag label follows the center

### Relative Position Preservation
- On drag start: snapshot each node's offset from galaxy center: `offset_i = nodePos_i - galaxyCenter`
- During drag: `nodePos_i = newGalaxyCenter + offset_i`
- On release: persist all new positions

### Files Modified
- `src/components/starmap/CosmosScene.tsx` — add galaxy-move mode (Alt+drag on halo), real-time mesh repositioning
- `src/components/starmap/cosmos-layout.ts` — accept `galaxyPositionOverrides` parameter
- `src/components/starmap/KnowledgeStarMap.tsx` — fetch/save galaxy_positions, handle onGalaxyMove callback

---

## 6. Data Flow Summary

### State in `KnowledgeStarMap.tsx`
```
nodePositions: Record<string, { x, y, z }>  // fetched from node_positions table
galaxyPositions: Record<string, { cx, cy, cz }>  // fetched from galaxy_positions table
undoStack: Array<{ type: 'delete_node' | 'dissolve_galaxy' | 'delete_galaxy', payload }>
```

### Layout Builder Signature Change
```ts
buildCosmosLayout(
  notes: CosmosNote[],
  dbEdges: DbEdge[],
  manualNodePositions?: Record<string, [number,number,number]>,
  manualGalaxyPositions?: Record<string, [number,number,number]>
): CosmosLayout
```

### New Callbacks on CosmosScene
```ts
onNodeMove?: (noteId: string, pos: [number,number,number]) => void
onGalaxyMove?: (tag: string, center: [number,number,number], memberPositions: Record<string, [number,number,number]>) => void
onGalaxyContextMenu?: (tag: string, x: number, y: number) => void
```

---

## 7. MVP Priority

### Phase A — Ship First (core operations)
1. **Node soft-delete** + undo toast (context menu + NodeWindow button)
2. **Galaxy dissolve** (context menu on halo right-click)
3. **Node drag-move** (selected node + drag) with position persistence
4. **DB migration** for `node_positions`, `galaxy_positions`, `notes.deleted_at`

### Phase B — Ship Second (polish)
5. Galaxy delete-all (soft-delete all members)
6. Galaxy drag-move (Alt+drag on halo)
7. "重置位置" in context menu
8. Ghost shadow during node drag

### Phase C — Future
9. Trash/archive view for soft-deleted notes
10. Batch operations (multi-select → delete/move)

---

## 8. Files Summary

| File | Change |
|------|--------|
| `supabase/migrations/...` | NEW: node_positions, galaxy_positions tables + notes.deleted_at column |
| `src/hooks/useNotes.ts` | Soft-delete, undo, filter deleted_at IS NULL |
| `src/components/starmap/cosmos-layout.ts` | Accept manual position overrides |
| `src/components/starmap/CosmosScene.tsx` | Node move mode, galaxy context menu detection, galaxy move mode |
| `src/components/starmap/KnowledgeStarMap.tsx` | Fetch/persist positions, delete/dissolve handlers, undo state |
| `src/components/starmap/NodeContextMenu.tsx` | Add delete + reset-position items |
| `src/components/starmap/NodeWindow.tsx` | Add delete button |
| `src/components/starmap/ConfirmDeleteOverlay.tsx` | NEW: confirmation modal |
| `src/components/starmap/UndoToast.tsx` | NEW: timed undo toast |
| `src/components/starmap/GalaxyContextMenu.tsx` | NEW: galaxy right-click menu |

---

## 9. Verification

1. **Node delete**: Right-click node → "删除" → confirm → node disappears + undo toast → click undo → node reappears
2. **Galaxy dissolve**: Right-click galaxy halo → "解散星系" → nodes scatter to untagged → undo restores tags
3. **Node move**: Click to select → drag node → release → position persists across page reload
4. **Galaxy move**: Alt+drag halo → all nodes move together → positions persist
5. **Edge handling**: Delete a node → its edges disappear from star map. Move a node → its edges follow.
6. **Keyboard**: Esc cancels any active drag. Delete key as alternative delete trigger for selected node.
