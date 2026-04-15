# 局部临时工作台 (Local Workbench) — Design & Implementation Plan

## Context
用户需要一个"临时思考桌面"机制：从星图中提取 2-5 个节点，在宇宙空间中悬浮出一个可操作的工作区，进行比较、整理和 AI 加工。要求保持漂浮感，不做成传统白板或 Kanban，不新增路由或后台面板。

---

## Design Answers

### 1. 工作台如何创建
- **Shift + 点击** 节点 → 节点被选中（星图中发出持续选中光晕）
- 选中 2-5 个节点后，**底部浮现召唤栏**（WorkbenchSummonBar）显示："已选 N 个节点 · [召唤工作台] [取消选择]"
- 点击"召唤工作台"→ `WorkbenchPanel` 以缩放动画从屏幕中心浮现
- 也可单独从一个节点 Shift+点击后再 Shift+点击更多节点，逐步组装

### 2. 视觉设计
- **外观**：极深暗玻璃面板 `rgba(3,7,22,0.94)` + `backdrop-filter: blur(40px)`
- **边框**：1px 霓虹渐变 rim，颜色从所含节点的星系色插值混合
- **形态**：圆角矩形，默认位置屏幕中右侧，可拖拽，不遮挡 CommandDock
- **入场**：`scale(0.85)→1 + opacity 0→1`，200ms cubic-bezier
- **与星图连接感**：`highlightedNoteIds = workbenchNoteIds` → 被选节点持续发出青色选中光晕；鼠标悬停工作台卡片 → `onFlashNote(id)` 让对应星节点脉冲闪光

### 3. 工作台内布局
```
┌─────────────────────────────────────────────┐
│ ◈ 临时工作台 · 3 nodes        [—] [×]       │ ← 拖拽区
├──────────────────────────────────────────────┤
│ [Card A]     [Card B]     [Card C]          │ ← 节点卡片横排
│  ↕ 类型标·标题·摘要·标签                         │
│  [检索] [洞见] [行动]                           │
├──────────────────────────────────────────────┤
│ [⊕ 融合成新节点]                              │ ← 组合操作区
└──────────────────────────────────────────────┘
```
- 节点卡片**可横向拖拽排序**（mousedown on drag handle）
- 每张卡有 X 按钮（从工作台移除，不删除节点）
- 卡片内 [检索][洞见][行动] 按钮 → 调用 `onDropToPod(noteId, podId)` → 走现有 relay 系统打开对应功能舱

### 4. 节点操作

| 操作 | 实现方式 |
|------|----------|
| 移除 | 卡片 X → `onRemoveNote(id)` → 从 workbenchNoteIds 中删除 |
| 重排 | 卡片内 drag handle → mousedown 拖拽横排位置 |
| 融合 | "融合成新节点" → `supabase.from('notes').insert(merged)` |
| 收起 | [—] 按钮 → `minimized=true` → panel 收缩为标题栏 |
| 关闭 | [×] 按钮 → 清空 workbenchNoteIds，隐藏 panel |

**融合逻辑**：
- title = "工作台合并 · [date]"
- content_markdown = 各节点 `## [title]\n[summary]\n[key_points]` 拼接
- tags = 所有节点 tags 并集去重

### 5. 与主星图联系
- 选中的节点通过 `highlightedNoteIds` 维持**持续的青色光晕**（已有 highlight 系统）
- hover 工作台卡片 → `onFlashNote(id)` → 对应星节点做 1.2s 脉冲闪光（已有 flash 系统）
- 工作台打开时，星图仍然完全可交互（pan、zoom、点击其他节点）
- 工作台关闭/清空时，高亮自动消除

### 6. 轻量存在
- 纯 React state，位于 `KnowledgeStarMap.tsx`（或 StarMapLayout）
- 不需要后台 endpoint，不新增 DB 表（仅"融合"功能需要一次 notes insert）
- 不新增路由
- Escape 键 → 清空选择并关闭工作台

---

## Files to Create / Modify

### NEW `src/components/starmap/WorkbenchSummonBar.tsx`
- Props: `selectedCount: number`, `onSummon(): void`, `onClear(): void`
- Fixed position at bottom center, above CommandDock (`bottom: clamp(110px, 12vh, 150px)`)
- Appears when `selectedCount >= 2`, hides when 0
- Animation: slide up from dock

### NEW `src/components/starmap/WorkbenchPanel.tsx`
```typescript
interface WorkbenchPanelProps {
  notes:          CosmosNote[];
  onRemoveNote:   (id: string) => void;
  onClose:        () => void;
  onFlashNote:    (id: string) => void;
  onDropToPod:    (noteId: string, podId: string) => void;
  onCombine:      (noteIds: string[]) => Promise<void>;
  userId?:        string;
}
```
- Draggable header (mousedown → move tracking)
- Default position: `{ x: window.innerWidth * 0.55, y: window.innerHeight * 0.2 }`
- Node cards in horizontal flex layout, each card draggable to reorder
- Minimize / close controls
- Combination button at bottom

### MODIFY `src/components/starmap/CosmosScene.tsx`
- Add `onNodeWorkbenchSelect?: (noteId: string) => void` to `CosmosSceneProps` and `CoreProps`
- Add `shiftKeyRef = useRef(false)` inside event handler scope
- In `onDown`: `shiftKeyRef.current = e.shiftKey`
- In `onUp` normal-click path: if `shiftKeyRef.current` → fire `onNodeWorkbenchSelectRef.current?.(id)` instead of `onToggleRef.current(id)`
- Skip hold-timer when `e.shiftKey` (Shift+click should not start drag-to-connect)

### MODIFY `src/components/starmap/KnowledgeStarMap.tsx`
- Add `workbenchSelectedIds: string[]` state (ordered array for reorder support)
- Add `workbenchActive: boolean` state
- Handler `handleWorkbenchSelect(id)`: toggle in/out of selection (max 5)
- Handler `handleWorkbenchSummon()`: set `workbenchActive = true`
- Handler `handleWorkbenchClose()`: clear selection + deactivate
- Handler `handleWorkbenchRemove(id)`: remove from ordered list
- Handler `handleWorkbenchCombine(ids)`: insert merged note via supabase
- `highlightedNoteIds` = `workbenchSelectedIds` when workbench active/pending
- Render `<WorkbenchSummonBar>` when `!workbenchActive && workbenchSelectedIds.length >= 2`
- Render `<WorkbenchPanel>` when `workbenchActive`

---

## Key Reused Mechanisms
- `highlightedNoteIds` → star node glow (already in CosmosScene)
- `onFlashNote` → pulse a node (already in CosmosScene)
- `onDropToPod` → existing relay chain through StarMapLayout → sendRelay → pod opens
- `supabase.from('notes').insert` → same pattern as GalaxyJoinOverlay's update
- `onNodeWorkbenchSelect` follows same stale-closure ref pattern as `onNodeConnect` etc.

---

## Verification
1. Shift+click 2 nodes → bottom bar appears with count
2. Click "召唤工作台" → panel floats in with animation; clicked nodes glow cyan
3. Hover card → corresponding star flashes
4. Click [检索] on card → RetrievalBox opens with that note's title pre-filled
5. Drag card left/right → cards reorder
6. Click [融合成新节点] → new note appears in star map
7. Click [—] → panel collapses to title bar
8. Press Escape → selection cleared, panel dismissed
9. Star map remains interactive while workbench is open
