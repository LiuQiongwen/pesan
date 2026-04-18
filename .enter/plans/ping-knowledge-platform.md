# 轻量交互提示系统 — 实现计划

## Context

现有代码中已有：
- `InteractionHints.tsx` — 底部左侧快捷键 HUD（5 种状态，自动淡出）
- `TourProvider/TourOverlay` — 2 步新手引导（create → explore）
- `GuideCenterModal` — 设置页使用攻略
- 右键 `NodeContextMenu` / `GalaxyContextMenu`
- 全局快捷键 N/G/F + CosmosScene 内快捷键

**问题**：现有提示太碎片化，没有统一的状态系统、没有操作反馈、缺少拖拽/连接/检索的上下文引导。

---

## 总体策略

采用 **3 层提示架构**（不做阻断式教学）：

| 层级 | 名称 | 位置 | 触发方式 | 持续 |
|---|---|---|---|---|
| L1 | InteractionHints | 左下角 HUD | 自动，按状态切换 | 常驻，idle 8s 淡出 |
| L2 | ContextToast | 底部中央，tour bar 位置 | 动作完成后弹出 | 2-4s 自动消失 |
| L3 | SpotPulse | 目标元素旁 | 首次进入某状态时 | 完成一次后永不再显示 |

核心原则：
- `pointerEvents: none` — 永不遮挡操作
- 一次性提示用 `localStorage` 记录已展示过的 key
- 所有文案 ≤ 12 字，有动作感

---

## MVP — 8 个提示点

### 1. 空状态引导（L1 升级）
- **触发**：`noteCount === 0`
- **提示**：InteractionHints 显示 `N 输入第一条知识` + `点击光圈 开始`
- **已有**，仅微调文案

### 2. 首次创建完成反馈（L2 新增）
- **触发**：`noteCount` 从 0 变为 1+（`useTourTrigger` 已检测）
- **内容**：ContextToast 显示 `"知识星已生成 — 点击星球查看详情"`
- **消失**：3s 后淡出

### 3. 节点悬停提示（L1 升级）
- **触发**：`hoveredNode` 存在
- **提示**：`点击 查看 · 右键 更多 · 拖拽 移动`
- **已有**，增加 `拖至 Dock 委托`

### 4. 首次打开 NodeWindow（L2 新增）
- **触发**：NodeWindow 渲染 + `localStorage` 无 `hint:node-window-seen`
- **内容**：ContextToast 显示 `"可点击「委托」将知识发送到各功能舱"`
- **标记**：显示后写入 `localStorage`

### 5. 连接模式引导（L1 已有 + L2 新增进入反馈）
- **触发**：`connectMode === true`
- **L1**：`点击 选择目标星 · Esc 取消`（已有）
- **L2 新增**：进入连接模式时显示 ContextToast `"连接模式 — 点击另一颗星建立关联"`

### 6. 拖拽到 Pod 反馈（L2 新增）
- **触发**：`handleNodeDropToPod` 执行成功
- **内容**：ContextToast 显示 `"已发送到 {PodName}"`（如 `"已发送到 Insight Pod"`）
- **消失**：2s

### 7. Retrieval 检索结果提示（L2 新增）
- **触发**：RetrievalBox 返回搜索结果后
- **内容**：在 RetrievalBox 内部（不是 ContextToast）显示搜索范围标注，如 `"共检索 42 条知识 · 语义匹配 Top 5"`
- **位置**：搜索结果列表上方的小标签

### 8. 功能舱首次打开引导（L3 SpotPulse）
- **触发**：首次打开任一 Pod（`localStorage` 无 `hint:pod-{id}-seen`）
- **内容**：Pod 标题栏下方显示一行提示文字（各 Pod 不同）：
  - Capture: `"输入文字或 URL，AI 自动提炼生成知识星"`
  - Retrieval: `"输入关键词，语义检索你的全部知识"`
  - Insight: `"选择节点，AI 深度蒸馏提炼洞察"`
  - Memory: `"查看与当前星球关联的记忆上下文"`
  - Action: `"将知识转化为待办、大纲或执行方案"`
- **消失**：关闭 Pod 或 5s 后淡出，写入 `localStorage`

---

## 前端组件与状态设计

### 新增文件

#### `src/hooks/useHintState.ts` — 统一提示状态管理
```
- dismissedHints: Set<string>  (从 localStorage 读取)
- dismiss(key): 写入 Set + localStorage
- shouldShow(key): boolean
- 导出 hook: useHintState()
```

#### `src/components/hints/ContextToast.tsx` — 动作反馈浮层
```
- 固定 bottom-center，z-index 55（在 tour 下方）
- props: message, icon?, duration=3000, visible
- 进入动画 slide-up + fade-in，退出 fade-out
- pointerEvents: none
```

#### `src/components/hints/PodWelcomeHint.tsx` — Pod 首次使用提示
```
- 渲染在 FloatingPod 内部标题栏下方
- props: podId, onDismiss
- 单行文字 + 淡出动画
```

### 修改文件

| 文件 | 改动 |
|---|---|
| `InteractionHints.tsx` | 增加 `nodeWindowOpen` prop，当 NodeWindow 打开时显示 `"拖拽窗口 · 点委托到功能舱"` |
| `StarMapLayout.tsx` | 添加 ContextToast 渲染 + 管理 toast 队列 state；拖拽到 Pod 后触发 toast |
| `FloatingPod.tsx` | 内部添加 PodWelcomeHint（首次打开时） |
| `NodeWindow.tsx` | 首次打开时触发 ContextToast |
| `KnowledgeStarMap.tsx` | 进入连接模式时触发 ContextToast |

### 状态流转
```
InteractionHints 状态（已有 + 扩展）:
  empty    → noteCount === 0
  browse   → noteCount > 0 && !hoveredNode && !connectMode && !nodeWindowOpen
  hover    → hoveredNode
  connect  → connectMode
  detail   → nodeWindowOpen (新增)

ContextToast 队列:
  StarMapLayout 维护 toastQueue: Array<{id, message, icon?, duration}>
  每次只显示一条，FIFO，显示完自动 pop
```

---

## 设置页"使用攻略"承接

修改 `GuideCenterModal.tsx`：
- 添加 "重置所有提示" 按钮（清除 localStorage 中所有 `hint:*` key）
- 现有的 "关闭所有引导提示" 改为写入 `localStorage` `hint:all-disabled`
- `useHintState` 检查此 key，如果为 true 则所有提示静默

---

## 验证方式

1. 新注册用户 → 空状态提示可见 → 创建第一条笔记 → 看到 "知识星已生成" 反馈
2. 点击星球 → 看到 NodeWindow 首次提示 → 关闭后不再显示
3. 首次打开各 Pod → 看到一行引导文字 → 第二次不显示
4. 拖拽节点到 Dock Pod → 看到 "已发送到 X Pod" 反馈
5. 进入连接模式 → 看到连接模式 toast
6. 设置 → 使用攻略 → 点 "重置提示" → 再次看到所有首次提示
7. 点 "关闭引导" → 所有提示不再出现
