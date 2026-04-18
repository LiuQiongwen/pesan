# Retrieval Scope + Trace Source Hints

## Context
User wants two interaction hints inside RetrievalBox that convey the "private cloud RAG" value through experience, not text. Both hint keys (`retrieval_scope`, `trace_source`) already exist in `useHintState` with `shouldShowHint` context gating returning `true`.

## File: `src/components/pods/RetrievalBox.tsx`

### Change 1 — retrieval_scope hint (above search bar, inside empty state)
- Import `useHintState` + `Crosshair` icon
- Call `hints.shouldShowHint('retrieval_scope')` + `hints.markCompleted`
- In the **empty hint** section (line 382-393), when `shouldShowHint('retrieval_scope')` is true, replace the generic text with a styled "scope awareness" hint:
  - Icon: Crosshair
  - Main: "先选知识范围，再提问"
  - Sub: "这次回答只会基于你选中的知识范围"
  - Style: subtle cyan-tinted bar, `pointerEvents: 'none'`
- **Completion**: Call `hints.markCompleted('retrieval_scope')` inside `handleSearch` after a successful search returns results

### Change 2 — trace_source hint (on first citation appearance)
- Call `hints.shouldShowHint('trace_source')`
- When citations first render AND hint is active, show a one-line hint above the source cards:
  - Icon: Star
  - Main: "点击引用，飞回来源节点"
  - Sub: "每个答案都可以回到你的原始资料"
- **Completion**: In `handleFlyTo`, call `hints.markCompleted('trace_source')`

### Change 3 — trace_source completion in StarMapLayout
- In the existing `onTraceSource` handler (line 125-128), add `hints.markCompleted('trace_source')` so it's also completed from the layout side

## Verification
1. New user opens Retrieval pod → sees scope hint in empty state
2. Performs first search → scope hint disappears permanently
3. Results with citations appear → sees trace hint above source cards
4. Clicks any "定位" button → trace hint disappears, star is highlighted
5. Neither hint reappears on refresh
