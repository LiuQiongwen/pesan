# Zustand 状态拆分重构

## Context

KnowledgeStarMap.tsx 单组件持有 **30+ useState**（hover、连接FSM、perf、delete、galaxy、workbench、mobile…），任意 setState 都触发整棵子树重渲染。ToolboxContext 虽已 useMemo，但 pods 对象每次 setPos/setSize 都新建整个 Record，导致所有 Pod 消费者级联刷新。AgentWorkflowContext 的 relay 状态也会波及无关组件。

拆分为 4 个独立 Zustand store，每个 store 的 selector 粒度订阅天然隔离，消除跨域级联。

---

## Store 拆分设计

### Store 1: `useSceneStore` — 3D 场景 + 布局数据
管理星图渲染所需的只读/低频数据，变更只影响 Canvas 内部。

| 字段 | 类型 | 说明 |
|---|---|---|
| notes | CosmosNote[] | 从 useNotes 同步 |
| dbEdges | DbEdge[] | thought_edges |
| manualNodePos | Record<string, [n,n,n]> | 手动位置 |
| manualGalaxyPos | Record<string, [n,n,n]> | 星系位置 |
| layout | CosmosLayout | buildCosmosLayout 缓存 |
| highlightedNoteIds | string[] | 高亮节点 |
| flashNoteId | string \| null | 闪烁节点 |
| **actions** | setNotes, setDbEdges, setManualNodePos, setManualGalaxyPos, highlight, flash, recomputeLayout |

**不持久化**：notes/edges 来自 DB，每次加载刷新。manualPos 已存 DB。

### Store 2: `usePanelStore` — 面板 / Pod 窗口管理
替代 ToolboxContext，管理 6 个 Pod 的开关、位置、大小、z-index。

| 字段 | 类型 | 说明 |
|---|---|---|
| pods | Record<PodId, PodState> | 窗口状态 |
| layoutConfig | LayoutConfig | 网格/锁定/字号 |
| presets | Record<string, LayoutPreset> | 布局预设 |
| topZ | number | z-index 计数器 |
| lastOpened | PodId \| null | 最近打开 |
| stagingOpen | boolean | 候选工作台 |
| ocrOpen / ocrAutoCamera / ocrPasteImage | — | OCR 弹窗 |
| **actions** | openPod, closePod, togglePod, minimizePod, bringToFront, setPos, setSize, setPinned, setFontScale, setSizeMode, savePreset, loadPreset, resetToDefault, openOcr, closeOcr, openStaging, closeStaging |

**持久化**：pods 位置/大小/pinned + layoutConfig + presets → localStorage（800ms debounce）。

### Store 3: `useInteractionStore` — 交互 FSM + hover
高频变更，订阅者只需自己关心的 slice。

| 字段 | 类型 | 说明 |
|---|---|---|
| hoveredNode | HoveredNodeInfo \| null | 当前 hover |
| mode | 'browse' \| 'connect' | 交互模式 |
| connectFromId | string \| null | 连接起点 |
| selectedNodeId | string \| null | 选中节点 |
| openNodes | Set<string> | 展开的 NodeWindow |
| mobileCardNoteId | string \| null | 移动端卡片 |
| ctxMenu | {noteId, x, y} \| null | 右键菜单 |
| galaxyCtx | {tag, x, y} \| null | 星系菜单 |
| anchorNoteId | string \| null | 锚点弹窗 |
| workbenchSelectedIds | string[] | 工作台选中 |
| workbenchActive | boolean | 工作台激活 |
| **actions** | setHoveredNode, setMode, toggleNode, setCtxMenu, setGalaxyCtx, setAnchorNote, toggleWorkbenchSelect, activateWorkbench, clearWorkbench |

**不持久化**：全部瞬态，页面刷新归零。

### Store 4: `useAsyncStore` — 异步操作 + 工作流中继
管理 pending 操作、status 枚举、relay 数据。

| 字段 | 类型 | 说明 |
|---|---|---|
| pendingConn | PendingConnection \| null | 待确认连接 |
| connectStatus | 'idle' \| 'saving' \| 'saved' \| 'error' | 连接状态 |
| pendingGalaxy | PendingGalaxy \| null | 待确认星系 |
| galaxyStatus | 'idle' \| 'saved' \| 'error' | 星系状态 |
| pendingDeleteId | string \| null | 待删除节点 |
| undoInfo | {noteId, title} \| null | 撤销信息 |
| pendingGalaxyDelete | {tag, mode} \| null | 星系删除 |
| galaxyUndoInfo | {tag, noteIds, oldTags} \| null | 星系撤销 |
| relay | WorkflowRelay \| null | Agent 中继 |
| activeStep | PodId \| null | 工作流步骤 |
| completedSteps | PodId[] | 已完成步骤 |
| **actions** | setPendingConn, confirmConnection, cancelConnection, setPendingGalaxy, confirmGalaxy, cancelGalaxy, requestDelete, confirmDelete, cancelDelete, setUndoInfo, sendRelay, consumeRelay, markStepComplete, clearWorkflow |

**不持久化**：异步操作都是瞬态。

---

## 文件清单

### 新建 (4 files)

| 文件 | 说明 |
|---|---|
| `src/stores/sceneStore.ts` | useSceneStore — notes, edges, positions, layout |
| `src/stores/panelStore.ts` | usePanelStore — pods, layoutConfig, presets, ocr, staging |
| `src/stores/interactionStore.ts` | useInteractionStore — hover, mode, menus, workbench |
| `src/stores/asyncStore.ts` | useAsyncStore — pending ops, status, relay |

### 修改 (6 files)

| 文件 | 变更 |
|---|---|
| `src/components/starmap/KnowledgeStarMap.tsx` | 删除 30+ useState，改为 4 个 store selector 订阅 |
| `src/components/layout/StarMapLayout.tsx` | 删除 StarMapContents 内 hover/flash/highlight/ocr/staging useState，改用 store |
| `src/contexts/ToolboxContext.tsx` | 改为薄 shim：内部调用 usePanelStore，保持 useToolbox() API 不变（渐进迁移） |
| `src/contexts/AgentWorkflowContext.tsx` | 改为薄 shim：内部调用 useAsyncStore.relay/workflow 部分 |
| `src/components/layout/NodeLightBand.tsx` | 直接 `useInteractionStore(s => s.hoveredNode)` 替代 props |
| `src/components/floating/CommandDock.tsx` | 直接 `usePanelStore(s => s.pods)` 替代 useToolbox |

### 删除 (0 files)
Context 文件保留为 shim（向后兼容），未来可逐步移除。

---

## 实施顺序

1. **安装 zustand**
2. **创建 4 个 store 文件**（纯数据 + actions，不依赖组件）
3. **改写 ToolboxContext → panelStore shim**（保持 useToolbox API）
4. **改写 AgentWorkflowContext → asyncStore shim**（保持 useAgentWorkflow API）
5. **重构 KnowledgeStarMap.tsx**：删除 useState，用 store selectors
6. **重构 StarMapLayout.tsx**：删除冗余 state，用 store selectors
7. **优化 NodeLightBand / CommandDock** 直接订阅 store

---

## Verification

1. **Shift+R 渲染追踪**：hover 节点时，只有 NodeLightBand 和 CosmosScene 出现在日志，不再有 CommandDock / FloatingPod / SettingsCapsule
2. **Pod 开关**：togglePod 只触发对应 FloatingPod 重渲染，其他 Pod 和星图无变化
3. **连接流程**：setPendingConn → 只触发 ConnectConfirmOverlay，星图不重渲染
4. **OCR 弹窗**：打开/关闭 OCR 不影响星图 FPS
5. **Shift+P 性能面板**：切换前后 FPS 无显著差异（因为 perf state 已隔离到 interactionStore）
