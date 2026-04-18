# Fix: NodeWindow Agent Actions + Interaction Hints

## Context
1. **"继续委托" buttons lack real functionality** — "再检索" only shows a toast, "再蒸馏/转行动/提问题" create placeholder derived nodes with static text instead of invoking AI. "标记唤醒" is a fake toast.
2. **No interaction hints** — New users don't know about right-click context menu, keyboard shortcuts (N/G/F), drag-to-connect, drag-to-pod, etc.

## Files to modify

### 1. `src/components/starmap/NodeWindow.tsx` — Wire agent actions to real pods

**Problem**: The 5 agent action buttons do nothing meaningful.

**Fix**: Replace the `createDerived` approach — instead, use `handleNodeDropToPod` pattern (relay content to the correct Pod via `AgentWorkflowContext.sendRelay` then open the pod). This requires:

- Accept `onDropToPod?: (noteId: string, podId: string) => void` prop
- **再检索**: call `onDropToPod(note.id, 'retrieval')` — pre-fills Retrieval Pod with note title and auto-searches
- **再蒸馏**: call `onDropToPod(note.id, 'insight')` — sends to Insight Pod with `__noteId__` prefix for auto-select
- **转行动**: call `onDropToPod(note.id, 'action')` — sends content to Action Pod
- **提问题**: create derived question node (keep `createDerived` for this one, it's legitimate)
- **标记唤醒**: call `onDropToPod(note.id, 'memory')` — pins the note in Memory Pod
- Remove `delegating` state (no longer needed for most actions)
- Add `universe_id` to `createDerived` insert (currently missing, causes FK error)

### 2. `src/components/starmap/CosmosScene.tsx` — Pass `onDropToPod` to NodeWindow

- NodeWindow is rendered at ~line 1695. Add `onDropToPod={onNodeDropToPodRef.current}` prop.

### 3. `src/components/starmap/InteractionHints.tsx` — NEW file

A lightweight bottom-left HUD showing contextual hints based on current state:

- **Empty state (0 nodes)**: "按 N 开始输入知识 · 或点击 < CLICK TO BEGIN >"
- **Browse mode (has nodes)**: "点击 — 打开节点 · 拖拽 — 转动视角 · 右键 — 更多操作 · N — 新笔记 · G — 回到中心"
- **Hovering a node**: "点击打开 · 右键菜单 · 拖拽移动位置 · F — 闪烁定位"
- **Connect mode**: "点击另一颗星建立连接 · Esc — 取消"

Style: fixed bottom-left, `pointerEvents: none`, MONO font, ultra-subtle, fades out after 8s of no interaction, reappears on mouse move.

### 4. `src/components/layout/StarMapLayout.tsx` — Add InteractionHints

- Import and render `<InteractionHints>` with current state props (noteCount, hoveredNode, connectMode).

## Verification
1. Click "再检索" in NodeWindow → Retrieval Pod opens with note title pre-filled
2. Click "再蒸馏" → Insight Pod opens with the note auto-selected
3. Click "转行动" → Action Pod opens with note content
4. Interaction hints appear at bottom-left, change based on context
5. Hints auto-fade after 8s idle, reappear on mouse move
