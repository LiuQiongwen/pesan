# Drag-to-Pod Hint

## Context
New users open a node detail (NodeWindow) but don't know they can also **drag** nodes to Pod docks for further processing. We need a one-time, non-blocking hint when a NodeWindow opens for the first time AND `drag_to_pod` hasn't been completed yet.

## Approach — Two-sided hint

### A. NodeWindow side — inline hint banner (NodeWindow.tsx)
- Below the "继续委托 Agent" button section, add a subtle hint banner:
  - Short text: **拖到洞察舱试试**
  - Sub text: **把这颗星送进功能舱，继续检索、提炼或转成行动**
- Gate: `useHintState().shouldShowHint('drag_to_pod')`
- Style: same glassmorphic pattern as CaptureBox hint — `pointerEvents: 'none'`, no z-index issues
- Disappears reactively when `drag_to_pod` is completed

### B. CommandDock side — glow ring on Pod buttons (CommandDock.tsx)
- When `drag_to_pod` hint is active AND a NodeWindow is open, add a subtle border-glow to all pod dock buttons
- Reuse the existing `hint-pulse-ring` CSS class (already in index.css)
- Gate: listen to `cosmos:drag-hint-active` custom event dispatched from StarMapLayout
- Simpler approach: use `useHintState().shouldShowHint('drag_to_pod')` directly + check `nodeWindowOpen` state via a new CustomEvent

### C. Completion — already wired
`StarMapLayout.tsx` line 280 already calls `hints.markCompleted('drag_to_pod')` inside `handleNodeDropToPod`. No changes needed.

## Files to modify

### 1. `src/components/starmap/NodeWindow.tsx`
- Import `useHintState`, `GripVertical` (or `Move`) icon from lucide
- After the agent actions `</div>`, before closing style tag, add hint banner
- Gated by `shouldShowHint('drag_to_pod')`

### 2. `src/components/floating/CommandDock.tsx`
- Already imports `useHintState`
- Add: `const showDragHint = hints.shouldShowHint('drag_to_pod');`
- On each pod step button, add conditional glow class when `showDragHint && nodeWindowOpen`
- `nodeWindowOpen` state: listen to `tour-node-opened` / `node-window-closed` events

## Verification
1. Fresh user (clear localStorage) — open a node → see hint in NodeWindow + dock buttons glow
2. Drag a node to any pod → hint disappears from both NodeWindow and dock
3. Hint never reappears after completion
4. Hint does NOT block any click/drag interactions
