# Obsidian Import — Frontend Experience Enhancement

## Context

The Obsidian import backend + basic modal are already implemented (ObsidianImportModal.tsx with 5-step flow: select → preview → importing → done → error). The entry point is in SettingsCapsule.tsx. The gap is: post-import star map presentation, phase timeline visualization, next-step guidance, and import history.

## Scope — What to Enhance (Not Rebuild)

We keep the existing modal structure and extend it with:

### 1. Phase Timeline (replace plain progress bar in `importing` step)

**File**: `src/components/obsidian/ObsidianImportModal.tsx`

Replace the simple `phaseLabel + progressBar` in the `importing` step with a vertical step indicator showing all phases:

```
  ● Unzip          ✓
  ● Parse           ✓
  ● Diff             ← current (animated ring)
  ○ Delete
  ○ Insert
  ○ Update
  ○ Index
  ○ Edges
```

Each step: small dot (filled=done, ring+pulse=active, hollow=pending), label, and count when done. Current phase shows the sub-progress bar + current file.

Implementation: define `PHASES` array, derive `phaseIndex` from `p.phase`, map to dots/labels.

### 2. Done Step — Next-Step Action Cards (replace single button)

**File**: `src/components/obsidian/ObsidianImportModal.tsx`

After the 6-stat grid, render 3 action cards instead of a single "View in Star Map" button:

| Action | Icon | Label | onClick |
|--------|------|-------|---------|
| View Obsidian nodes | Telescope | 查看导入星系 | Close modal + filter tag `obsidian` in star map (dispatch CustomEvent `obsidian-import-done` with `{ filterTag: 'obsidian' }`) |
| Search imported knowledge | Search | 检索导入知识 | Close modal + open Retrieval pod (`openPod('retrieval')`) |
| Re-sync later | RefreshCw | 稍后同步 | Just close modal |

### 3. Post-Import Star Map Flash

**File**: `src/components/layout/StarMapLayout.tsx` + `src/components/starmap/KnowledgeStarMap.tsx`

When `ObsidianImportModal` closes after `done`:
1. Modal dispatches `window CustomEvent('obsidian-import-done')` 
2. `StarMapLayout` listens, calls `fetchNotes()` to refresh data
3. After notes refresh, set `tagFilter = 'obsidian'` to highlight obsidian cluster
4. Auto-clear the tag filter after 5 seconds

This reuses existing `tagFilter` state + `NodeLightBand` tag filtering without new architecture.

### 4. Import History (lightweight)

**File**: `src/components/obsidian/ObsidianImportModal.tsx`

In the `select` step, if `isSyncMode === true`, show a compact "Last import" line below the drop zone:
- Query `obsidian_imports` table for most recent completed import
- Display: `Last sync: 3 days ago · 42 notes · 12 updated`
- Uses existing `obsidian_imports` table data (no new tables)

### 5. Obsidian Entry Badge in HUD

**File**: `src/components/layout/StarMapLayout.tsx`

In the top-left HUD stats line, if user has obsidian notes, append a small count:
```
42 nodes · 5 clusters · +3 this week · 28 obsidian
```

Uses existing `notes` array — just filter by `node_type === 'obsidian'` and count.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/obsidian/ObsidianImportModal.tsx` | Phase timeline, action cards on done, last import line, dispatch event on close-after-done |
| `src/components/layout/StarMapLayout.tsx` | Listen for `obsidian-import-done` event → refresh + tag filter + obsidian count in HUD |
| `src/hooks/useNotes.ts` | No changes (already has `fetchNotes` exposed) |

## Files NOT Changed
- `obsidian-importer.ts` — backend logic unchanged
- `obsidian-parser.ts` — parsing unchanged
- `CosmosScene.tsx` — rendering unchanged (obsidian nodes already purple)
- `SettingsCapsule.tsx` — entry point unchanged

## Verification
1. Open Settings → Import Obsidian → select zip → see 4-stat preview
2. Click Start Import → see vertical phase timeline with animated dots
3. After done → see 6-stat grid + 3 action cards
4. Click "查看导入星系" → modal closes, star map highlights obsidian tag cluster for 5s
5. Top-left HUD shows `XX obsidian` count
6. Re-open import → see "Last sync: ..." line + sync mode header
