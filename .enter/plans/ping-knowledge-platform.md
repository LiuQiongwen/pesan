# Plan: Node-Level Interaction Design

## Context
The star map currently has functional but too-small interactions: hover shows a 9px-font label, NodeWindow is 285px with 8-9px text, and there's no first-action onboarding path for new users. This plan redesigns node interactions across two layers (hover/click) plus adds a homepage "entrance" flow and a quick text-to-node capture bar.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/starmap/NodeWindow.tsx` | Full desktop redesign: larger size, readable fonts, organized action area |
| `src/components/starmap/CosmosScene.tsx` | Hover label upgrade, camera fly-in, entrance node glow, empty state CTA |
| `src/components/starmap/KnowledgeStarMap.tsx` | Pass entranceNodeId, integrate QuickCaptureBar |
| `src/components/starmap/QuickCaptureBar.tsx` | **NEW** — floating text-to-node input bar |

---

## 1. NodeWindow — Desktop Redesign

**Two size modes** toggled by a button in the title bar:
- **Light** (default when first opened): `440px` wide, body `maxHeight: 280px` — for quick inspection
- **Expanded**: `620px` wide, body `maxHeight: 520px` — for editing, lineage, deep work

**Typography upgrade:**
- Title: **16px** Inter Bold (was 11px)  
- Body summary text: **13px** / line-height 1.75 (was 11px)
- Action button labels: **12px** (was 8-9px)
- Tag badges: **10px** (was 8px)
- Time/metadata: **10px** (was 8px)

**Header redesign:**
- 48px tall header with 44px icon container
- Node type badge prominently on its own row (larger, 9px → 12px font)
- Size-toggle + close buttons in top-right (28×28 → 32×32 targets)

**Action area (bottom panel, always visible):**
Organized into two rows:

*Row 1 — Primary actions (always shown):*
- `编辑` (Edit) — opens inline editing
- `查看详情` (View Detail) — navigates to note page
- `检索相关` (Search Related) — hints user to Retrieval Pod

*Row 2 — Agent actions (collapsed by default, one click to reveal):*
- `提炼洞见` (Distill Insight) → creates insight node
- `转成行动` (To Action) → creates action node  
- `提问题` (Ask Question) → creates question node
- `标记唤醒` (Mark for Wake) → memory queue
- `连接节点` (Connect) — shows connection hint

Each action button: **48px tall**, icon 16px + label 12px, gap 8px between elements.

---

## 2. CosmosScene — Hover Label Upgrade

Current: 9px title in a tiny box.

**New hover tooltip** (shown when hovering, disappears when window opens):
```
┌─────────────────────────────────────────┐
│ [INSIGHT]  2 hours ago                  │
│ Title of the knowledge node here        │
│ #tag1  #tag2  #tag3                     │
│ ▶ Click to open · Drag to explore       │
└─────────────────────────────────────────┘
```
- Width: 260px
- Title: 14px Inter SemiBold
- Type badge: 11px Mono colored
- Tags: 10px Mono
- Bottom hint: 10px Mono, dimmed
- Entrance animation: 80ms scale+fade in

**Camera Fly-In when clicking a node:**
- Add `flyTargetRef: React.MutableRefObject<{pos: THREE.Vector3, done: boolean} | null>` to `ImperativeCore`
- When `onNodeToggle` is called for a node that's being opened (not closed), set `flyTargetRef.current` to `{ pos: nodePos - 15 units toward camera, done: false }`
- In `useFrame`, if `flyTargetRef.current && !flyTargetRef.current.done`, lerp `camera.position` toward target (factor 0.07), lerp `controls.target` toward node's world pos. Mark done when `distanceTo < 1.0`.
- Expose `onNodeOpen?: (pos: THREE.Vector3) => void` callback from `CosmosSceneProps` to trigger this from parent
- Actually simpler: pass a `flyToNodeRef: MutableRefObject<string | null>` — set it to a note ID from outside, clear after fly

**Entrance node glow:**
- Compute `entranceNoteId` in KnowledgeStarMap as: most recently created note (sorted by `created_at` desc, first item)  
- Pass it into `CosmosScene` as `entranceNoteId?: string`
- In `ImperativeCore`, track `entranceNoteId`. In `useFrame` animation loop, for the entrance node: add a persistent outer ring halo (separate `THREE.RingGeometry` rendered at 2× scale, slowly pulsing opacity 0.15–0.55, 1.5s period)
- The entrance node gets `scale = 1.3 + 0.15*pulse` baseline (even when not hovered)

**Empty state CTA:**
- Replace the 6-ghost-sphere grid with a single large glowing orb:
  - `SphereGeometry(1.2, 24, 24)` at `[0,0,0]`
  - `MeshBasicMaterial({ color: #00ff66, transparent: true, opacity: 0.3 })`
  - Outer ring: `RingGeometry(2.0, 2.2, 32)` pulsing opacity 0.1–0.4
- Replace `EmptyHint` text with: "点击发光节点，开始你的第一个知识片段 · Enter to quick-capture"

---

## 3. QuickCaptureBar — NEW Component

**Location:** `src/components/starmap/QuickCaptureBar.tsx`

**Appearance:** Floating pill input, centered horizontally, sits above the CommandDock (bottom: 110px from viewport bottom). Always visible.

```
┌──────────────────────────────────────────────────────────┐
│  [+]  输入一个想法，按 Enter 直接落入星图 …              [⌘] │
└──────────────────────────────────────────────────────────┘
```
- Width: `min(640px, 90vw)`
- Height: `52px`
- Background: `rgba(3,5,13,0.90)` + `blur(24px)`
- Border: `1px solid rgba(0,255,102,0.20)`
- On focus: border brightens to `rgba(0,255,102,0.50)`, subtle outer glow
- Icon: green `Plus` (16px) on left
- Placeholder: `输入一个想法，按 Enter 直接落入星图…`
- Right side: `⌘K` shortcut hint in mono 10px
- Keyboard shortcut: `Cmd+K` / `Ctrl+K` globally focuses this input

**On Enter:**
1. Calls `supabase.from('notes').insert({...})` with `node_type: 'capture'`, `title: inputText`, user_id from props
2. On success: clears input, calls `onFlashNote(newId)` to flash the new node in the 3D scene
3. Shows sonner toast: "已投入星图 ✦"

**Props:** `userId: string | undefined`, `onFlashNote: (id: string) => void`

**Integration in KnowledgeStarMap:**
- Render `<QuickCaptureBar>` as a fixed overlay above the canvas
- Pass `userId` and `onFlashNote={onFlashNote}`

---

## 4. KnowledgeStarMap — Integration

- Compute `entranceNoteId = notes.sort by created_at desc [0]?.id`
- Pass `entranceNoteId` to `CosmosScene`
- Render `<QuickCaptureBar userId={userId} onFlashNote={onFlashNote} />` as absolute overlay
- Add `userId` to `KnowledgeStarMapProps` (already exists)

---

## Visual Hierarchy Summary

| Element | Before | After |
|---------|--------|-------|
| Hover label title | 9px | 14px |
| Hover label type | n/a | 11px colored badge |
| Hover label hint | n/a | "Click to open" 10px |
| NodeWindow title | 11px | 16px |
| NodeWindow body | 11px | 13px |
| NodeWindow actions | 8-9px | 12px 48px-tall buttons |
| NodeWindow width | 285px | 440px (light) / 620px (expanded) |
| Empty state | 6 ghost spheres | 1 pulsing green orb + CTA text |
| Entrance node | same as all nodes | 1.3× scale + outer pulse ring |
| Quick capture | n/a | 52px floating input above dock |

---

## Verification

1. Open homepage with no notes → see single green pulsing orb, QuickCaptureBar at bottom
2. Type in QuickCaptureBar + Enter → node flashes in star map, toast shown
3. Hover over any node → see rich 260px tooltip with type/title/tags/hint
4. Click node → camera smoothly flies toward it + NodeWindow opens at 440px
5. Toggle expand button in NodeWindow → smoothly animates to 620px
6. All action buttons are 48px tall and clearly readable at 12px
7. NodeWindow entrance node has stronger persistent glow vs other nodes
