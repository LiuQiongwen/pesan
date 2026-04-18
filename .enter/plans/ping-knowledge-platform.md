# 3D 星图性能诊断面板

## Context

星图场景（CosmosScene.tsx）包含多个性能敏感子系统：
- **9000 粒子星场** — Points + BufferGeometry
- **N 个节点 mesh** — 每个独立几何体 + 共享材质 clone，每帧 `position.set()` + `scale.setScalar()` + `emissiveIntensity` 更新
- **N 条连线** — Line/LineDashedMaterial，每帧 lerp opacity
- **Galaxy halos/rings** — 每帧 lerp opacity
- **Raycasting** — 每 3 帧对所有 mesh + 所有 edge 线段做 intersect
- **EffectComposer + Bloom** — 后处理 pass (mipmapBlur)
- **Html 组件** — ClusterLabel × K + HoverTooltip + NodeWindow × 3（drei Html → DOM overlay）
- **OrbitControls + Camera tween** — 每帧 lerp

当前无法区分帧率下降来自哪个子系统。需要 **非侵入** 诊断面板。

---

## 方案：自建轻量级 PerfMonitor（不引入 r3f-perf 库）

### 为什么不直接 `npm install r3f-perf`

r3f-perf 库依赖 R3F 的 JSX reconciler 来注册 `<Perf>` 组件。但本项目的 CosmosScene 使用 **全命令式构建**（`createElement` + imperative Three.js），是为了避免 Enter.pro babel 插件注入 `data-source-*` 到 Three 对象上导致崩溃。直接 `<Perf />` 同样会踩到这个问题。

**因此**：借鉴 r3f-perf 的思路，自建一个轻量级 `usePerfMonitor` hook + `PerfOverlay` HUD，直接在 useFrame 中采集指标，零外部依赖。

---

## 监控指标

| 指标 | 采集方式 | 瓶颈信号 |
|------|----------|----------|
| **FPS** | `useFrame` delta 计算，1s 窗口平均 | < 45 fps |
| **Frame time (ms)** | `performance.now()` 帧间隔 | > 22ms |
| **Draw calls** | `gl.info.render.calls` (每帧读) | > 150 |
| **Triangles** | `gl.info.render.triangles` | > 200K |
| **Geometries** | `gl.info.memory.geometries` | 持续增长 = 泄漏 |
| **Textures** | `gl.info.memory.textures` | 同上 |
| **Node count** | `notes.length` | > 200 需要 LOD 策略 |
| **Edge count** | `layout.edges.length` | > 500 需要 frustum cull |
| **Raycast time** | `performance.now()` 包裹 raycast 区域 | > 2ms |
| **Bloom pass** | 有/无对比帧率 | 差值 > 10fps = 瓶颈 |

---

## 需要修改的文件

### 1. `src/hooks/usePerfMonitor.ts` (NEW)

轻量级性能采集 hook，在 R3F Canvas 内部使用：

```
export interface PerfSnapshot {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  raycastMs: number;
  nodeCount: number;
  edgeCount: number;
}
```

- 使用 `useFrame` 每帧采集 `gl.info`
- 每 60 帧计算一次平均值 → 写入 `ref` 供 overlay 读
- 暴露 `raycastStart()` / `raycastEnd()` 方法供 ImperativeCore 打点
- 暴露 `snapshot: PerfSnapshot` 供 overlay 读取
- 暴露 `history: PerfSnapshot[]`（最近 120 条，约 2 秒）用于 sparkline

### 2. `src/components/starmap/PerfOverlay.tsx` (NEW)

HUD 面板，渲染为普通 React DOM（不在 Canvas 内）：

- 固定在右上角，半透明深色背景
- 实时显示：FPS (大字 + 颜色编码)、Frame ms、Draw Calls、Tri count
- Mini sparkline（最近 2s FPS 折线，canvas 2D 绘制）
- 子系统开关面板：
  - **Bloom**: 切换 EffectComposer 启/禁
  - **星场**: 切换星场 Points visible
  - **连线**: 切换 edge lines visible
  - **标签**: 切换 Html labels 渲染
  - **Raycast**: 切换 raycast 频率 (3帧 → 6帧 → off)
- 每个开关切换后观察 FPS 变化 → 直接定位瓶颈

### 3. `src/components/starmap/CosmosScene.tsx` (MODIFY)

- 在 `ImperativeCore` 的 `useFrame` 中：
  - 帧头调用 `perfMonitor.frameStart()`
  - raycast 区块前后调用 `perfMonitor.raycastStart()` / `perfMonitor.raycastEnd()`
  - 帧尾调用 `perfMonitor.frameEnd()`
- 在外层 `CosmosScene` 函数中：
  - 接收 `perfEnabled` prop
  - 条件性调用 `usePerfMonitor()`
  - 通过 ref 暴露 snapshot 给外部
- 将 `EffectComposer + Bloom`、星场 Points name、edge lines 添加 `visible` 控制
  - 通过 `useRef` flag 接收 PerfOverlay 的开关信号

### 4. `src/components/starmap/KnowledgeStarMap.tsx` (MODIFY)

- 添加 `perfEnabled` state（默认 false，仅开发时启用）
- 传递给 CosmosScene
- 条件渲染 `<PerfOverlay />`
- 监听键盘快捷键 `Shift+P` 切换 perf panel

### 5. `src/components/layout/StarMapLayout.tsx` (MODIFY - minor)

- 无直接修改，perf panel 完全封装在 KnowledgeStarMap 内部

---

## 接入层级图

```
StarMapLayout
  └── KnowledgeStarMap
        ├── Canvas
        │     └── CosmosScene
        │           ├── ImperativeCore  ← usePerfMonitor() 在这里采集
        │           ├── ClusterLabel (Html)  ← toggleable
        │           ├── HoverTooltip (Html)  ← toggleable
        │           ├── NodeWindow (Html)
        │           ├── OrbitControls
        │           └── EffectComposer+Bloom  ← toggleable
        │
        └── PerfOverlay (DOM)  ← 浮在 Canvas 上方，读 perf ref
```

---

## 诊断 → 优化映射表

| 诊断结论 | 优化动作 |
|----------|----------|
| Bloom 关闭 FPS 提升 >10 | 降低 Bloom intensity/分辨率，或 LOD>1 时禁用 |
| Draw calls > 200 | InstancedMesh 合并同色节点 |
| Triangles > 300K | 降低 SphereGeometry segments (18→10)，远处用 billboard |
| Raycast > 3ms | 增大 throttle 间隔，BVH 空间索引，frustum pre-filter |
| Edge lines 关闭 FPS 提升 >5 | 远处 edge 全部隐藏，近处分批渲染 |
| Html labels 关闭 FPS 提升 >5 | LOD>0 已隐藏，检查 hover tooltip 开销 |
| Node count > 200 | LOD2 只渲染 billboard sprites，LOD1 低段数几何 |
| Geometries 持续增长 | 检查 dispose 遗漏（layout 变化时） |
| FPS 拖动时 <30 | OrbitControls damping 回调触发过多重渲染 |

---

## MVP 最小接入

**Phase 1（本次实施）**：
1. 创建 `usePerfMonitor.ts` — 纯采集，无副作用
2. 创建 `PerfOverlay.tsx` — 只读 HUD + sparkline + 子系统开关
3. 修改 `CosmosScene.tsx` — 插入采集点 + visible 控制 ref
4. 修改 `KnowledgeStarMap.tsx` — `Shift+P` 开关 + state 传递
5. 开关面板的每次切换自动记录 FPS 差值 → 在面板中显示 "Bloom: -12fps" 格式的影响标注

**Phase 2（后续按需）**：
- 导出 perf 快照为 JSON（一键复制到剪贴板）
- Timeline 录制模式：记录 10s 操作 → 帧级回放
- 自动建议：当某子系统 FPS 影响 > 阈值时，面板自动高亮推荐优化

---

## 验证方式

1. 打开星图页面，按 `Shift+P` → PerfOverlay 出现
2. 确认 FPS / Draw Calls / Triangles 实时更新
3. 逐个关闭子系统开关，观察 FPS 变化
4. 拖动/缩放/聚焦节点时观察帧率曲线
5. 再次 `Shift+P` → 面板隐藏，零性能开销
