# Mobile Anchor Creation: Replace Right-Click with Tap-Accessible Entry Points

## Context
On mobile, users cannot right-click to open the NodeContextMenu. The current long-press (500ms) interaction exists in CosmosScene but is not discoverable. The user wants a more natural mobile interaction for creating QR anchors.

## Current State
- **MobileNodeCard** (tap a node): Shows 4 action buttons (打开/发送/连接/删除) — no QR anchor option
- **NodeContextMenu** (long-press 500ms): Has "QR 锚点" option but long-press is not intuitive on mobile
- **CreateAnchorModal**: Already supports bottom-sheet on phone (just implemented)

## Plan

### 1. Add "QR 锚点" button to MobileNodeCard
**File: `src/components/starmap/MobileNodeCard.tsx`**
- Add `onCreateAnchor?: (noteId: string) => void` to Props
- Change grid from `repeat(4, 1fr)` to `repeat(5, 1fr)` to add a 5th button
- Add a QR anchor button (QrCode icon from lucide-react, label "锚点", cyan color `#66f0ff`) between "连接" and "删除"
- On click: call `onCreateAnchor(note.id)` then `onClose()`

### 2. Wire the new prop in KnowledgeStarMap
**File: `src/components/starmap/KnowledgeStarMap.tsx`**
- Pass `onCreateAnchor` to `<MobileNodeCard>`:
  ```tsx
  onCreateAnchor={(id) => { setAnchorNoteId(id); setMobileCardNoteId(null); }}
  ```

## Files to Modify
1. `src/components/starmap/MobileNodeCard.tsx` — add QR anchor button + prop
2. `src/components/starmap/KnowledgeStarMap.tsx` — wire `onCreateAnchor` prop

## Verification
- On mobile: tap a node → MobileNodeCard opens with 5 buttons including "锚点"
- Tap "锚点" → CreateAnchorModal opens as bottom-sheet with the node pre-selected
- Long-press still works as a secondary path via NodeContextMenu
