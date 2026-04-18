# Mobile Interaction Refactor — MVP Plan

## Context
Mobile users face: (1) NodeWindow via drei `Html` with `distanceFactor:18` renders tiny/unusable on phone,
(2) no light-preview card on tap — jumps straight to complex NodeWindow,
(3) mobile already has good action sheet (NodeContextMenu) and bottom sheet (MobileBottomSheet),
(4) Connection mode only works with Shift+click (desktop).

**Strategy**: Keep existing good mobile code, fix the 3 biggest pain points.

---

## Change 1: Mobile Node Tap → Full-Screen Light Card (not drei Html)

**File**: `src/components/starmap/CosmosScene.tsx` (outer component, ~line 1695)

- On phone: **skip** rendering `NodeWindow` via drei `Html`
- Instead dispatch a `CustomEvent('mobile-node-open', { detail: noteId })` when `onNodeToggle` is called

**File**: `src/components/starmap/KnowledgeStarMap.tsx`

- Listen for `mobile-node-open` event
- Pass the noteId to a new `MobileNodeCard` component rendered as a portal

**New file**: `src/components/starmap/MobileNodeCard.tsx`

- Fixed-position card covering bottom 60% of screen (not drei-based)
- Shows: title, node_type badge, summary, tags, created_at
- **Action buttons row**: 打开笔记, 发送到舱, 建立连接, 删除
- "发送到舱" opens the existing NodeContextMenu action sheet with pod list
- Swipe-down or X to dismiss
- `pointerEvents: 'all'` — fully interactive
- Uses same styling tokens as NodeContextMenu mobile sheet

## Change 2: Skip drei NodeWindow on Phone

**File**: `src/components/starmap/CosmosScene.tsx` (outer component ~line 1695)

- Wrap the `openNodes.map(...)` NodeWindow block in `!isPhone &&`
- On phone, single tap dispatches `mobile-node-open` instead of toggling openNodes

**File**: `src/components/starmap/CosmosScene.tsx` (ImperativeCore, onUp handler ~line 970)

- On phone, instead of `onNodeToggleRef.current(id)`, dispatch `mobile-node-open` event

## Change 3: Mobile Node Card "Send to Pod" Integration

**File**: `src/components/starmap/MobileNodeCard.tsx`

- "发送到功能舱" button dispatches `cosmos-context-menu` event reusing existing NodeContextMenu action sheet
- OR directly calls `onSendToPod(noteId, podId)` via a small inline pod picker (5 colored buttons)
- **Recommendation**: Inline pod picker (5 small colored buttons in a row) — simpler, faster

## Change 4: Mobile Connection Mode Polish

Already works: NodeContextMenu has `onConnect` → enters connect mode → tap second node completes.

**File**: `src/components/starmap/MobileNodeCard.tsx`
- Add "建立连接" button that calls `onConnect(noteId)` and closes the card

**File**: `src/components/starmap/InteractionHints.tsx` (already done)
- Already shows "轻点 选择第二颗星完成连接" in connect mode on mobile

## Change 5: MobileBottomSheet touch-to-dismiss

**File**: `src/components/floating/MobileBottomSheet.tsx`

- Add touch drag handler: swipe down > 80px → close
- Track `translateY` state during touch, apply as transform
- On touch end: if translateY > 80 → close, else spring back to 0

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/starmap/MobileNodeCard.tsx` | **NEW** — mobile light card |
| `src/components/starmap/CosmosScene.tsx` | Skip drei NodeWindow on phone; dispatch mobile-node-open on tap |
| `src/components/starmap/KnowledgeStarMap.tsx` | Listen mobile-node-open, render MobileNodeCard |
| `src/components/floating/MobileBottomSheet.tsx` | Add swipe-down-to-dismiss |

## Verification

1. On phone viewport: tap node → MobileNodeCard slides up from bottom
2. Card shows title, summary, tags, action buttons
3. "发送到舱" shows inline pod picker, tapping a pod sends and closes
4. "建立连接" enters connect mode, tap second node completes
5. Swipe down on card or X button → dismisses
6. Pod bottom sheets can be swiped down to close
7. Desktop behavior unchanged — still uses drei Html NodeWindow
