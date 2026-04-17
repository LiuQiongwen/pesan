# Diagnostic Report: Button Interaction Failures

## Context
User reports that **multiple buttons in the app don't open their corresponding features when clicked**. This plan covers a full audit of the click -> state -> UI chain.

---

## 1. Root Cause Analysis (Prioritized)

### P0 — CONFIRMED BUGS (will fix)

**Bug A: `NodeContextMenu` imports from non-existent module**
- File: `src/components/starmap/NodeContextMenu.tsx:3`
- `import type { CosmosNote } from '@/types/cosmos'` — module **does not exist**
- `CosmosNote` resolves to `any` silently (because `strict: false` + `noImplicitAny: false`)
- Impact: No runtime crash, but TypeScript loses all type-checking on the `note` prop. If any code accesses `note.xyz`, TypeScript won't catch typos.
- Fix: Change to `from '@/components/starmap/cosmos-layout'`

**Bug B: `NodeLightBand` doesn't accept/use `tagFilter` prop**
- File: `src/components/layout/NodeLightBand.tsx`
- StarMapLayout passes `tagFilter={tagFilter}` at line 263, but the interface only has `{ node, onTagClick }`
- Impact: Tag filter **functionally works** (nodes highlight correctly via `highlightedIds`), but the **active tag is never visually indicated** in the NodeLightBand. Users can't tell which tag is active or how to clear it.
- Fix: Add `tagFilter?: string | null` prop and show active state on matching tag chip.

**Bug C: RLS infinite recursion on `profiles` table**
- Console log (April 16): `infinite recursion detected in policy for relation "profiles"`
- Impact: **Any storage upload** (QR codes, files) or **any query that triggers profiles RLS** will fail silently. This could make the QR upload button in admin settings appear unresponsive.
- Fix: Audit profiles RLS policies. Likely an `UPDATE` policy referencing `profiles` itself (the "admins update all profiles" policy `WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)` queries `profiles` within a `profiles` policy -> recursion). Fix by using a `SECURITY DEFINER` function for the admin check.

### P1 — LIKELY ISSUES (high confidence)

**Bug D: Hover quick-action buttons in CosmosScene may be impossible to click**
- File: `src/components/starmap/CosmosScene.tsx:1145-1168`
- When `showButtons` is true, the `<Html>` overlay sets `pointerEvents: 'auto'`
- R3F tracks `pointer` via `useFrame({ pointer })`. Pointer is updated on canvas `pointermove`.
- **Risk**: When cursor moves from the 3D node mesh to the button overlay (a DOM sibling of the canvas), the canvas may fire `pointerleave`. R3F's internal pointer then stops updating. On the next frame, `raycaster.setFromCamera(pointer, camera)` uses the **stale** pointer position. If the stale position still hits the node mesh, hover persists. If it misses (due to node floating animation), `hoveredId` clears, buttons vanish.
- This creates **intermittent** failures — buttons sometimes clickable, sometimes not.
- Fix: Add a 300ms debounce before clearing `hoveredId` to null (instead of clearing immediately on ray miss). Or use a CSS-only approach where the buttons always show on hover without depending on R3F state.

**Bug E: `togglePod` in `ToolboxContext` uses nested `setTopZ` inside `setPods`**
- File: `src/contexts/ToolboxContext.tsx:247-258`
- `togglePod` calls `setPods(prev => {...})` and inside it, conditionally calls `setTopZ(z => z + 1)` and `setLastOpened(id)`.
- Issue: Calling `setTopZ` inside a `setPods` updater is **calling a state setter inside another state setter's callback**. In React 18 concurrent mode, this is batched, but the `setTopZ` increment may not reflect in the `setPods` update (since `setTopZ` updates `topZ` state separately, but `setPods` doesn't use the new `topZ` value for `zIndex`).
- Looking more carefully: `togglePod` opens a pod but doesn't set the new `zIndex`. The `setTopZ(z => z + 1)` fires, but the pod's zIndex isn't updated to the new value. This means toggling a pod open might put it at the **wrong z-index** — behind other pods.
- Impact: Pod opens but appears BEHIND another pod, making it seem like the button didn't work.
- Fix: Use the same pattern as `openPod`: call `setTopZ` first, then update `setPods` with the new z-index.

### P2 — MINOR / COSMETIC

**Issue F: `HoveredNodeInfo` missing `clusterIdx` and `createdAt`**
- `KnowledgeStarMap` exports `HoveredNodeInfo` with `{ noteId, title, tags, summary }`
- But `NodeLightBand` uses `node?.clusterIdx` and `node?.createdAt` which aren't in the type
- These fields must be set somewhere else (likely in CosmosScene's `onHoverRef.current`)
- Impact: TypeScript doesn't catch if these are missing. If they're not set, colors and dates won't show.

---

## 2. Files to Check First

| Priority | File | What to look for |
|----------|------|------------------|
| P0 | `NodeContextMenu.tsx:3` | Fix import path |
| P0 | `NodeLightBand.tsx` | Add `tagFilter` prop + active state |
| P0 | DB RLS policies on `profiles` | Fix infinite recursion |
| P1 | `CosmosScene.tsx:924-948` | Hover raycasting stability |
| P1 | `ToolboxContext.tsx:247-258` | `togglePod` z-index bug |
| P2 | `KnowledgeStarMap.tsx:15-20` | `HoveredNodeInfo` interface completeness |

---

## 3. Diagnostic Console.log Placements

```typescript
// In CommandDock — confirm click fires
onClick={() => { console.log('[Dock] togglePod:', step.id); togglePod(step.id); }}

// In ToolboxContext.togglePod — confirm state update
const togglePod = useCallback((id) => {
  console.log('[Toolbox] togglePod called:', id, 'current open:', pods[id]?.open);
  // ...existing code...
});

// In FloatingPod — confirm render condition
console.log('[FloatingPod]', id, 'open:', state?.open, 'minimized:', state?.minimized);
if (!state?.open) return null;

// In CosmosScene hover — confirm hoveredId stability
useEffect(() => {
  console.log('[CosmosScene] hoveredId changed:', hoveredId, 'showButtons:', showButtons);
}, [hoveredId, showButtons]);
```

---

## 4. Fix Plan (Minimum-cost)

### Fix A: NodeContextMenu import (1 line)
```diff
- import type { CosmosNote } from '@/types/cosmos';
+ import type { CosmosNote } from '@/components/starmap/cosmos-layout';
```

### Fix B: NodeLightBand tagFilter prop (add active state to tag chips)
- Add `tagFilter?: string | null` to props interface
- Conditionally style the active tag with brighter color/border

### Fix C: Profiles RLS recursion (SQL migration)
```sql
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$ SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = uid), false); $$;

-- Then update the policy to use the function instead of a subquery
DROP POLICY IF EXISTS "admins update all profiles" ON public.profiles;
CREATE POLICY "admins update all profiles" ON public.profiles
  FOR UPDATE USING (public.is_admin(auth.uid()));
```

### Fix D: Hover button stability (debounce hoveredId clear)
In CosmosScene's useFrame hover raycasting (line 939):
```typescript
// Instead of immediately clearing hoveredId:
if (hitId !== hoveredIdRef.current) {
  if (hitId) {
    // New hover — set immediately
    clearTimeout(hoverClearTimer.current);
    hoveredIdRef.current = hitId;
    setHoveredId(hitId);
  } else {
    // Lost hover — debounce 300ms before clearing
    hoverClearTimer.current = setTimeout(() => {
      hoveredIdRef.current = null;
      setHoveredId(null);
      onHoverRef.current?.(null);
    }, 300);
  }
}
```

### Fix E: togglePod z-index (match openPod pattern)
```typescript
const togglePod = useCallback((id: PodId) => {
  setPods(prev => {
    const cur = prev[id];
    if (cur.open) {
      setLastOpened(p => p === id ? null : p);
      return { ...prev, [id]: { ...cur, open: false } };
    }
    // Use setTopZ to get next z, then apply to pod
    const nz = topZ + 1;
    setTopZ(nz);
    setLastOpened(id);
    return { ...prev, [id]: { ...cur, open: true, minimized: false, zIndex: nz } };
  });
}, [topZ]);
```
Note: This has a subtle race condition with `topZ` closure. Better to use `setTopZ` callback pattern like `openPod` does.

---

## 5. Verification

After applying fixes:
1. Click each dock button → pod opens AND is on top (visible)
2. Right-click a 3D node → context menu appears at cursor
3. Hover a node for 200ms → quick buttons appear → click each button → action fires
4. Click a tag in NodeLightBand → tag highlights → click again → clears
5. Admin Settings → upload QR → no infinite recursion error
6. Open multiple pods → each new one appears on top (z-index correct)
