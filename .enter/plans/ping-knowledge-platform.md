# Workbench Empty-State Hint

## Context
WorkbenchPanel has two redundant empty states (lines 244-253 and 437-443). Both are plain text with no "knowledge workspace" feel. The user wants a richer, cosmos-flavored empty state with clear CTA text.

## Approach — Single file change in `WorkbenchPanel.tsx`

### 1. Merge two empty blocks into one
- Remove the first empty block (lines 244-253) — it's inside `!minimized` but before the card row conditional
- Enhance the second empty block (lines 437-443, the `orderedNotes.length === 0` fallback) with:
  - A subtle orbit ring icon (`Orbit` from lucide-react) replacing `MousePointerClick`
  - **Primary text**: "拖入 2–5 个节点，开始整理"
  - **Secondary text**: "这里适合比较、合并、提炼，再把结果发布回宇宙"
  - Dashed border zone hinting at drag target
  - `workbench_empty` hint key check — show the hint text only when `shouldShowHint('workbench_empty')`, otherwise show a shorter "从星图拖入节点" fallback
  - Mark `workbench_empty` completed when first node arrives (already handled by the note count change in `useEffect`)

### 2. Mark completion
Add `useHintState` import and call `markCompleted('workbench_empty')` inside the existing `useEffect` that syncs `noteOrder` — when `notes.length > 0` and hint is still active.

### 3. Responsive
- Desktop: centered icon + text column layout (already works with flex column)
- Mobile: same layout, narrower width is fine since it's just text + icon

## Files Modified
- `src/components/starmap/WorkbenchPanel.tsx`

## Verification
1. Open workbench with 0 nodes → see orbit icon + "拖入 2–5 个节点" + secondary text
2. Add a node → empty state disappears, hint marked completed
3. Remove all nodes → empty state returns but with shorter fallback text (hint already completed)
