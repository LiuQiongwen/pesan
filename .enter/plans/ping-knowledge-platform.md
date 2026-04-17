# Semantic Connection Enhancement Plan

## Context
Users connect two nodes in the star map but see only a plain line with no meaning. The connection's **relationship type**, **impact on the system**, and **next steps** are invisible. This plan solves "a connection is just a line" by adding semantic labels, immediate feedback, and downstream utility.

## Current State
- Two DB tables: `thought_relationships` (manual, used by drag-to-connect confirm overlay), `thought_edges` (system/wikilink, used by cosmos-layout for rendering lines).
- `ConnectConfirmOverlay` already lets user choose 4 types (semantic/insight_of/drives_action/answers) with auto-confirm countdown.
- `cosmos-layout.ts` builds edges from **shared tags only** — ignores both DB relationship tables entirely.
- Edge lines are all same style, opacity 0 by default, show at 0.28 on hover.
- No relationship info shown in NodeWindow, Note page, or hover card.
- No per-edge interaction (hover/click on a line does nothing).

## Key Insight: Unify on `thought_edges`
`thought_relationships` and `thought_edges` are redundant. The plan unifies: manual connections now write to `thought_edges` with the expanded edge_type enum. The `thought_relationships` table stays for backward compat but new writes go to `thought_edges`.

---

## Changes (MVP — 5 deliverables)

### 1. DB: Expand `thought_edges.edge_type` + add `description` field

**File:** DB migration

- Add new edge_type values: `'semantic'`, `'insight_of'`, `'drives_action'`, `'answers'` to the CHECK constraint (merge with existing `supports`, `contradicts`, `extends`, `inspires`, `related`, `wikilink`).
- Already has `description` column. No schema change needed there.
- `handleConnectionConfirm` in `KnowledgeStarMap.tsx` switches from `thought_relationships` to `thought_edges` insert.

### 2. `cosmos-layout.ts`: Load real edges from DB

**File:** `src/components/starmap/cosmos-layout.ts`, `src/components/starmap/KnowledgeStarMap.tsx`

- Add `CosmosEdge.edgeType` and `CosmosEdge.description` fields.
- `KnowledgeStarMap` fetches `thought_edges` for the user on mount, passes them into `buildCosmosLayout`.
- `buildCosmosLayout` generates edges from **both** shared-tag links AND DB `thought_edges`, deduplicating.
- Each edge gets a color based on its `edge_type` (using `connect-types.ts` color map + extension for system types).

### 3. `ConnectConfirmOverlay`: Enrich post-confirm feedback

**File:** `src/components/starmap/ConnectConfirmOverlay.tsx`, `src/components/starmap/connect-types.ts`

- Expand `RELATION_TYPES` to 8 types (add `supports`, `contradicts`, `extends`, `inspires`), each with icon, color, zh label, and a one-line `impact` description.
- After auto-confirm, transition to a 2-second **"Connection Impact" card** that shows:
  - Relationship type badge + description
  - "What this means": e.g. "相关笔记将在检索中获得优先级加成"
  - "Next: hover the connection line to see details"
- Add optional `description` text input (inline, optional, placeholder "描述这条关系...").

### 4. Edge hover/click interaction in `CosmosScene`

**File:** `src/components/starmap/CosmosScene.tsx`

- **Visual differentiation**: Different edge_types get different colors and dash patterns (solid for semantic, dashed for wikilink, dotted for question types).
- **Hover detection**: On hover raycast, also test against edge lines. When an edge line is hovered:
  - Brighten the line to full opacity + glow.
  - Show an `Html` tooltip at the midpoint with: type badge, description, source → target titles.
- **Click on edge**: Open a mini-panel at midpoint showing full detail + "Delete connection" + "Change type" actions.
- **Connected node glow**: When hovering an edge, both connected nodes get a subtle pulse highlight.

### 5. NodeWindow: Add "Relationships" section

**File:** `src/components/starmap/NodeWindow.tsx`

- Below the "继续委托 Agent" panel, add a **"关系 RELATIONS"** collapsible section.
- Fetch `thought_edges` where `source_id = noteId OR target_id = noteId`.
- Show each as a mini-row: `[type badge] [other node title] [description snippet]`.
- Click a row → flash + fly to the connected node.
- Shows count badge in the section header: "关系 (3)".

---

## File Change Summary

| File | Change |
|---|---|
| DB migration | Expand `thought_edges.edge_type` CHECK to include `semantic`, `insight_of`, `drives_action`, `answers` |
| `src/components/starmap/connect-types.ts` | Add `supports`, `contradicts`, `extends`, `inspires` + icon + impact descriptions |
| `src/components/starmap/cosmos-layout.ts` | Add `edgeType`/`description` to `CosmosEdge`, accept DB edges as input, merge with tag-edges |
| `src/components/starmap/KnowledgeStarMap.tsx` | Fetch `thought_edges` from DB, pass to layout, change confirm handler to write `thought_edges` |
| `src/components/starmap/ConnectConfirmOverlay.tsx` | Add description input, post-confirm impact card |
| `src/components/starmap/CosmosScene.tsx` | Edge hover detection, midpoint tooltip, type-based visual styles, connected-node glow |
| `src/components/starmap/NodeWindow.tsx` | Add "Relations" section fetching thought_edges |

## Verification
1. Drag-to-connect two nodes → confirm overlay shows type picker + description → saved to `thought_edges` → impact card appears.
2. Hover over an edge line in the star map → midpoint tooltip shows type + description + both node titles.
3. Open a node window → scroll to "Relations" section → see all connected edges with type badges.
4. Different edge types render with distinct colors (semantic=green, insight=purple, action=red, wikilink=gray).
5. Click an edge → mini-panel with "delete" and "change type" actions works.
