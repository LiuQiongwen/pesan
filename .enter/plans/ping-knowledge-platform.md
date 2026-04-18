# Plan: Node Click Hint Bubble

## Context

New users see interactive star nodes but may not realize they're clickable. We need a lightweight, one-time hint bubble ("点开这颗星，进入知识内容") that appears **next to the node in 3D space** when the user first hovers a node — but does NOT block pointer events.

## Approach

Extend the **existing hover label** block (CosmosScene.tsx lines 1573–1616) to show a second-line hint below the node title label. This reuses the existing `Html` from drei and the hover timing logic already in place, adding zero new DOM layers.

### Trigger logic
- **Show when**: `first_click_node` hint is NOT completed/dismissed AND user is hovering a node AND there are nodes on screen
- **Hide when**: user clicks ANY node (which fires `tour-node-opened` → `markCompleted('first_click_node')` in StarMapLayout)
- The hint is part of the already-rendered hover tooltip — same `pointerEvents: 'none'` — so it **never** steals clicks

### Changes (2 files)

#### 1. `src/components/starmap/CosmosScene.tsx`
- Import `useHintState` in the outer `CosmosScene` function component (NOT inside the imperative `ImperativeCore`)
- Call `hints.shouldShowHint('first_click_node', { noteCount: notes.length })` once
- Pass the boolean `showClickHint` down as a prop to the hover-label rendering block (lines 1573–1616)
- Below the existing title `<span>`, conditionally render a second line:
  ```tsx
  {showClickHint && (
    <div style={{
      fontFamily: INTER, fontSize: 9, color: 'rgba(102,240,255,0.65)',
      marginTop: 3, letterSpacing: '0.02em',
    }}>
      点开这颗星，进入知识内容
    </div>
  )}
  ```
- The `pointerEvents: 'none'` on the Html container is already set — no change needed

#### 2. `src/components/layout/StarMapLayout.tsx`
- Already has `hints.markCompleted('first_click_node')` in the `tour-node-opened` event handler — **no changes needed** here

### What stays unchanged
- `useHintState.ts` — `first_click_node` already defined with context rule `(ctx?.noteCount ?? 0) > 0`
- `HintBubble.tsx` / `HintPulse.tsx` — not needed; reusing the existing 3D hover label is cleaner
- No new components, no new files, no new events

## Verification
1. Clear localStorage (`pesta_hints_v2`) to simulate a new user
2. Create at least one note so nodes exist
3. Hover over a node → should see title label WITH "点开这颗星，进入知识内容" below it
4. Click the node → NodeWindow opens → `first_click_node` completes
5. Hover another node → hint line should NOT appear anymore
6. Confirm no pointer events are blocked — clicks pass through the label
