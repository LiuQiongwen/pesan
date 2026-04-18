# React 重渲染诊断 + 修复方案

## Context

星图场景中 hover 节点、切 Pod、弹窗等操作会触发整树 re-render，原因是：
1. **ToolboxContext** 每次 `setPods` 都生成新的 `value` 对象，所有 consumer 全部 re-render
2. **StarMapContents** 持有 ~15 个 useState，任意一个变化都会重绘整个 Layer 0-12 树
3. 几乎 **零 memo** — 全项目仅 AgentPipeline.tsx 用了 `React.memo`
4. **KnowledgeStarMap** 接收的 props 含内联函数 (`() => openPod(...)`)，每次父 render 都创建新引用

## 方案总览（3 个层级）

### A. 轻量诊断工具 — RenderTracer（开发模式 HUD）

在不引入 why-did-you-render 第三方包的情况下，内建一个 `useRenderTracer` hook + `RenderTracerOverlay` 面板：

- hook: 每次 render 记录 `组件名 + props diff + 时间戳` 到共享 ref 环形缓冲区
- overlay: Shift+R 切换，展示最近 50 条 render 记录，按频率/时间排序，高亮异常频率组件
- 零生产成本：`import.meta.env.DEV` 条件编译

### B. Top-5 重渲染热点组件 memo 化

| # | 组件 | 根因 | 修复 |
|---|------|------|------|
| 1 | **FloatingPod** (×5) | 父 `StarMapContents` 任意 state 变化 → 5 个 Pod 全部 re-render | `React.memo` + children 提取为 memoized 变量 |
| 2 | **CommandDock / DesktopCommandDock** | `useToolbox()` 消费整个 context → 任何 pod position/size 变化都触发 | `React.memo` + `useMemo` 选择性消费 |
| 3 | **NodeLightBand** | 接收 `hoveredNode` 对象 → 每次 hover 创建新对象引用 | `React.memo` + 比较 noteId |
| 4 | **InteractionHints** | 4 个 props 每次父 render 都传新值 | `React.memo` |
| 5 | **SettingsCapsule** | `useToolbox()` 全量消费 | `React.memo` |

### C. ToolboxContext 拆分（阻止级联）

当前 `ToolboxContext.Provider value={value}` 每次 `setPods` 都创建新对象 → 所有 `useToolbox()` consumer re-render。

修复：将 `value` 用 `useMemo` 包裹，仅在真正变化的 deps 改变时更新引用。

---

## 新建文件

### 1. `src/hooks/useRenderTracer.ts`
- `useRenderTracer(name: string, props: Record<string, unknown>)` — 在 DEV 模式下追踪每次 render
- 记录到共享环形缓冲区 `renderLog`（全局 ref，不触发 re-render）
- 对比上一次 props，记录哪些 key 发生变化
- 暴露 `getRenderLog()` 供 overlay 读取

### 2. `src/components/starmap/RenderTracerOverlay.tsx`
- Shift+R 切换的右下角浮动面板
- 每 500ms 轮询 `getRenderLog()` 展示最近 50 条
- 每行：`[时间] 组件名 (changedProps: [...])` + 频率色标
- 表头显示总 render 数和 top-3 频率组件

---

## 修改文件

### 3. `src/components/floating/FloatingPod.tsx`
- 在 `DesktopFloatingPod` 外包 `React.memo`
- 对比 `id, title, subtitle, accentColor` 浅比较即可
- 接入 `useRenderTracer` (DEV)

### 4. `src/components/floating/CommandDock.tsx`
- `DesktopCommandDock` 包 `React.memo`
- 提取 `pods` 中仅需要的 open 状态，避免 position/size 变化触发
- 接入 `useRenderTracer` (DEV)

### 5. `src/components/layout/NodeLightBand.tsx`
- 包 `React.memo` + 自定义 areEqual：仅比较 `node?.noteId`, `tagFilter`, `connectMode`
- 接入 `useRenderTracer` (DEV)

### 6. `src/components/starmap/InteractionHints.tsx`
- 包 `React.memo` — props 都是原始类型，浅比较即可
- 接入 `useRenderTracer` (DEV)

### 7. `src/components/floating/SettingsCapsule.tsx`
- 包 `React.memo`
- 接入 `useRenderTracer` (DEV)

### 8. `src/contexts/ToolboxContext.tsx`
- `value` 对象用 `useMemo` 包裹，deps 为 `[pods, lastOpened, topZ, layoutConfig, presets, ...]`
- 这不改变行为，但避免每次 render 都创建新的 value 引用传递给无关组件

### 9. `src/components/layout/StarMapLayout.tsx`
- 在 `StarMapContents` 渲染 `<RenderTracerOverlay />` (仅 DEV 模式)
- memo 化 pod children 变量（CaptureBox / RetrievalBox 等的 props 用 useCallback）

### 10. `src/components/starmap/KnowledgeStarMap.tsx`
- 接入 `useRenderTracer` (DEV)，和 PerfOverlay 互补（GPU vs React）

---

## 验证方式

1. **Shift+R** 打开 RenderTracerOverlay → hover 节点 → 面板中只应看到 `CosmosScene`、`NodeLightBand` render，而非 `FloatingPod`、`CommandDock`
2. 打开/关闭 Pod → 面板中不应出现其他 Pod 的 render 记录
3. **Shift+P** (GPU perf) + **Shift+R** (React perf) 可同时使用
