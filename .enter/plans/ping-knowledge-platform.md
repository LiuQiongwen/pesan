# Plan: Universal Window Manager + Connect Overlay Bug Fix

---

## Bug Fix — 建立联系窗口被挡住

**Root cause**: `KnowledgeStarMap` root div has `position:fixed, zIndex:0` → creates a CSS stacking context.
`ConnectConfirmOverlay` (z-index 1200) and `GalaxyJoinOverlay` (z-index 1200) are rendered *inside* this
stacking context, so they can never paint above elements in higher stacking contexts such as the
`FloatingPod` wrapper layer at `zIndex:20` in `StarMapLayout`.

**Fix**: Render both overlays via `ReactDOM.createPortal(…, document.body)` in `KnowledgeStarMap.tsx`.
No changes needed to the overlay components themselves.

---

## Redesign: Universal Window Manager

### 1. Interaction Rules

| Action | Behavior |
|--------|----------|
| Drag title bar | Move window (respects lock mode) |
| Drag resize handle | Resize W+H (edit mode only) |
| Click minimize | Collapse to title bar only |
| Click expand | Restore from minimized |
| Click pin | Freeze position (drag disabled) |
| Click × | Close window (remove from view) |
| Shift+drag | Ignore snapping (free placement) |
| Double-click title | Toggle compact ↔ expanded |
| Edit mode toggle | Unlocks resize handles + guides |
| Lock mode | Drag + resize both disabled |
| Escape | Cancel any active drag/resize |

**Snap rules** (only in edit mode):
- Grid snap: nearest multiple of `gridSize` (0 = off, options: 8 / 16 / 24 px)
- Edge snap: within `SNAP_DIST=12px` of another window's edge or screen edge → magnetic lock
- Alignment guides: thin luminous line drawn when edges align
- Anti-overlap: highlight overlap with red rim glow (no hard block)

---

### 2. Component Behavior Design

All 11 window types managed uniformly:

| Window ID | Component | Current Shell |
|-----------|-----------|---------------|
| `capture` | CaptureBox | FloatingPod |
| `retrieval` | RetrievalBox | FloatingPod |
| `insight` | InsightBox | FloatingPod |
| `memory` | MemoryBox | FloatingPod |
| `action` | ActionBox | FloatingPod |
| `settings` | SettingsCapsule | Dropdown → migrate to FloatingWindow |
| `billing` | BillingPanel | Slide panel → migrate to FloatingWindow |
| `workbench` | WorkbenchPanel | Custom → migrate to FloatingWindow |
| `node-detail:${id}` | Node detail | New (future) |
| `lineage:${id}` | Lineage viewer | New (future) |
| `connect-overlay` | ConnectConfirmOverlay | Portal (not a window) |

**Minimized state visual**: window collapses to just the title bar (existing FloatingPod behavior).
In a future iteration, minimized windows can dock as icon-badges at the bottom.

**Resize constraints**:
- Min size: 200 × 140 px
- Max size: `window.innerWidth × 0.95` × `window.innerHeight × 0.90`
- `null` size = auto (CSS clamp / content-driven) — preserved until user resizes

---

### 3. Layout System Design

```
WindowManagerContext state shape:

{
  windows: Record<WindowId, WindowState>
    WindowState {
      open: boolean
      minimized: boolean
      pos: { x, y }
      size: { w: number|null, h: number|null }  // null = auto
      zIndex: number
      pinned: boolean
      fontScale: number  // 1.0 default
      sizeMode: 'compact' | 'expanded'
    }

  layout: {
    locked: boolean        // false = edit mode
    gridSize: 0|8|16|24
    snapToEdge: boolean
    globalFontScale: number  // 0.75–1.5
    activePreset: string|null
  }

  presets: Record<string, LayoutPreset>  // named snapshots
}
```

**Snap implementation** (`useWindowSnap` hook):
```typescript
// Grid snap
snappedX = Math.round(rawX / gridSize) * gridSize

// Edge snap — check all other open windows
for each otherWindow:
  if |rawX - otherWindow.right| < SNAP_DIST → snappedX = otherWindow.right
  if |rawX + w - otherWindow.left| < SNAP_DIST → snappedX = otherWindow.left - w
  // same for Y axis
```

**Alignment guides** (`AlignmentGuides` component):
- Full-screen SVG overlay, `pointerEvents:none`, `zIndex:9998`
- Active only during drag/resize
- Draws luminous lines (color matches dragged window's accent)
- Fades out 300ms after drag ends

---

### 4. Font Customization Design

```
Global scale:  --global-font-scale (0.75 – 1.5, step 0.05)
Per-window:    --win-font-scale (0.75 – 1.5, stored in WindowState.fontScale)
               injected as inline CSS var on each FloatingWindow's root div

Effective font size = base × --global-font-scale × --win-font-scale
```

Three text categories adjustable per window:
- **Title** (`fontScale.title`): window header text
- **Body** (`fontScale.body`): content area text
- **Label** (`fontScale.label`): mono/metadata labels

Exposed via a compact popover triggered by clicking a `Aa` button in each window's title bar
(only shown in edit mode or always — TBD).

Global font scale lives in the LayoutEditBar settings panel.

---

### 5. Persistence Logic

**Storage key**: `cosmos_wm_v1` (new key — avoids conflicts with old `cosmos_pods_v4`)

**What is saved**:
```json
{
  "windows": { ...all WindowStates (pos, size, sizeMode, fontScale, pinned) },
  "layout": { locked, gridSize, snapToEdge, globalFontScale, activePreset },
  "presets": { "default": {...}, "focus": {...}, "custom-1": {...} }
}
```

**Auto-save**: debounced 800ms after any window state change (positions, sizes).

**Preset operations**:
- `savePreset(name)` — snapshot current `windows` positions+sizes into `presets[name]`
- `loadPreset(name)` — restore positions+sizes, keep open/minimized state unchanged
- `resetToDefault()` — clear stored layout, reload `defaultPositions()`
- Built-in presets: `"default"` (auto-generated), `"focus"` (center-only), user-named

---

### 6. Technical Implementation Structure

```
src/
  contexts/
    WindowManagerContext.tsx    ← REPLACE / extend ToolboxContext
                                  Add: size, pinned, fontScale, sizeMode, locked, gridSize, presets

  hooks/
    useWindowSnap.ts            ← NEW: snap math for drag/resize
    useWindowResize.ts          ← NEW: resize tracking (8 handles)
    useLayoutPresets.ts         ← NEW: save/load/reset presets

  components/
    window-manager/
      FloatingWindow.tsx        ← REPLACE FloatingPod — universal shell
                                  Consumes WindowManagerContext
                                  Integrates snap, resize, font scale, edit mode
      ResizeHandles.tsx         ← NEW: 8-handle resize system (edit mode only)
      AlignmentGuides.tsx       ← NEW: SVG guide lines during drag
      LayoutEditBar.tsx         ← NEW: floating edit/lock toggle + preset controls
      MinimizedDock.tsx         ← FUTURE: icon badges for minimized windows

    starmap/
      KnowledgeStarMap.tsx      ← FIX: createPortal for ConnectConfirmOverlay + GalaxyJoinOverlay
```

**Migration path** (backward-compatible):
1. `WindowManagerContext` keeps all `ToolboxContext` exports + aliases → no consumer changes
2. `FloatingWindow` accepts same props as `FloatingPod` → just rename import
3. `FloatingPod` becomes a re-export of `FloatingWindow` for compat

---

## Implementation Phases

### Phase A — Bug Fix (immediate)
- `KnowledgeStarMap.tsx`: `createPortal` for ConnectConfirmOverlay + GalaxyJoinOverlay

### Phase B — Core Window Manager
- Extend `ToolboxContext` → add `size`, `pinned`, `fontScale`, `sizeMode` to state + actions
- `FloatingPod` → `FloatingWindow`: add resize handles (edit mode), consume new state
- `LayoutEditBar`: edit/lock toggle, grid size selector
- Storage key bumped to v5, new shape

### Phase C — Snap & Guides
- `useWindowSnap` hook
- `AlignmentGuides` SVG overlay
- Edge snap detection

### Phase D — Font Customization
- CSS var injection per window
- `Aa` button + popover in title bar (edit mode)
- Global font scale in LayoutEditBar

### Phase E — Layout Presets
- Named preset save/load in LayoutEditBar
- `useLayoutPresets` hook
- Reset to default

---

## Files to Modify

| File | Change |
|------|--------|
| `src/contexts/ToolboxContext.tsx` | Add size, fontScale, pinned, sizeMode, locked, grid to state |
| `src/components/floating/FloatingPod.tsx` | Add resize handles, edit mode, font scale var |
| `src/components/starmap/KnowledgeStarMap.tsx` | createPortal for ConnectConfirmOverlay + GalaxyJoinOverlay |
| `src/components/layout/StarMapLayout.tsx` | Add LayoutEditBar render |

## New Files

| File | Purpose |
|------|---------|
| `src/hooks/useWindowSnap.ts` | Snap math (grid + edge) |
| `src/hooks/useWindowResize.ts` | 8-handle resize tracking |
| `src/components/window-manager/ResizeHandles.tsx` | Resize handle UI |
| `src/components/window-manager/AlignmentGuides.tsx` | SVG guide line overlay |
| `src/components/window-manager/LayoutEditBar.tsx` | Edit/lock toggle bar |
