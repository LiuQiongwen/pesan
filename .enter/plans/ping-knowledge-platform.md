# Galaxy UI Style System — 星系视觉风格系统

## Context

当前星系在 CosmosScene 中的渲染：
- **Halo**: `SphereGeometry(cluster.radius)` + `MeshBasicMaterial(color, opacity: 0.022, BackSide)`
- **Ring**: `RingGeometry(radius*0.85, radius)` + `MeshBasicMaterial(color, opacity: 0.055, DoubleSide)`
- **颜色**: 来自 `PALETTE` 数组(8色)，按 tag 排序索引取色
- **LOD**: 距离 >70 开始淡出 halo/ring，>130 完全透明
- **布局**: Fibonacci sphere 分布，CLUSTER_RADIUS=32，spread = `4 + sqrt(n) * 2.5`

**问题**：所有星系长一样（球+环），缺乏个性；星系多了视觉堆叠；远景单调。

---

## 1. 整体视觉策略

**母体原则**：所有星系共享同一材质语言 + 发光系统，通过 **形态变体** 和 **色调偏移** 区分个性。

| 统一元素（不可变） | 变化元素（可变） |
|---|---|
| 背景色 `#01040d` | 星系形态 (4种变体) |
| 发光材质系统 (emissive + Bloom) | 主色相 (来自 PALETTE，扩展到12色) |
| 标签字体 (IBM Plex Mono) | 粒子密度 & 运动模式 |
| LOD 距离阈值 | 边缘处理 (清晰/弥散/环带) |
| 星点节点形状 (按 node_type) | 内部结构 (紧凑/松散/链式) |
| 关系航路线条样式 | Halo 形状 |

---

## 2. 星系风格分类 — 4 种变体

### A. 团簇型 (Cluster)
**视觉**: 紧密球形星云，中心密亮、边缘弥散
**适用**: 节点数 ≤ 15，常规知识分类（如"读书笔记"、"日常记录"）
**Three.js 实现**:
- Halo: `SphereGeometry` (保持当前) + **内层粒子云** (PointsMaterial, 50–80颗微粒)
- 中心光核: 小 `SphereGeometry(0.8)` + `emissiveIntensity: 2.0` + `opacity: 0.15`
- Ring: 移除（用粒子云替代边界感）

### B. 环带型 (Ring Band)
**视觉**: 围绕中心的环带结构，像土星环
**适用**: 有序知识（如"课程系列"、"项目文档"）
**Three.js 实现**:
- 双层 `RingGeometry` (内环 `radius*0.6→0.75`, 外环 `radius*0.85→1.0`)
- 环带上分布微粒 (沿环分布的 Points)
- 环面缓慢旋转 (`rotation.z += 0.001 * dt`)
- Halo: 扁椭球 (`scaleY: 0.4`)

### C. 链式型 (Chain)
**视觉**: 节点沿曲线/路径排列，像一条发光的知识链
**适用**: 线性/时间序列知识（如"学习路径"、"周报系列"）
**Three.js 实现**:
- 节点沿 CatmullRom 曲线分布（替代球状随机分布）
- 沿曲线的发光 tube: `TubeGeometry(curve, 64, 0.08)` + `emissive, opacity: 0.12`
- 无 halo sphere，用 tube 定义边界
- 起止点有较亮的端点标记

### D. 云雾型 (Nebula)
**视觉**: 大面积低密度的弥散云雾，像星际尘云
**适用**: 节点数 ≥ 25 的大型知识域，或 __untagged__ 无标签区
**Three.js 实现**:
- 多层叠加的 `PlaneGeometry` + `ShaderMaterial` (基于噪声的透明度图)
- 或简化方案: 3-4 层 `SphereGeometry` (不同半径 + 低 opacity 0.008-0.015)
- 微粒密度最高 (100-150 颗)，但每颗更暗 (opacity 0.3-0.5)
- 缓慢旋转 + 呼吸缩放

---

## 3. 功能来源 → 风格映射

| 星系来源 | 推荐变体 | 理由 |
|---|---|---|
| 手动创建标签 (< 15节点) | Cluster 团簇 | 最常见、最紧凑 |
| 手动创建标签 (15-25节点) | Ring Band 环带 | 结构感，避免堆叠 |
| 手动创建标签 (> 25节点) | Nebula 云雾 | 大量节点需要空间 |
| Obsidian 导入的文件夹 | Ring Band 环带 | 有序性 |
| Wiki 编译产物 | Chain 链式 | 知识结构化 |
| __untagged__ 无标签 | Nebula 云雾 | 散落感 |
| OCR 候选簇 | Cluster 团簇 (偏暗) | 待处理状态 |

**自动分配逻辑**:
```typescript
function getGalaxyVariant(cluster: ClusterInfo): GalaxyVariant {
  if (cluster.tag === '__untagged__') return 'nebula';
  if (cluster.noteIds.length > 25) return 'nebula';
  if (cluster.noteIds.length > 15) return 'ring';
  // Check if wiki/obsidian sourced
  const hasWiki = cluster.noteIds.some(id => ...wiki check);
  if (hasWiki) return 'chain';
  return 'cluster';
}
```

---

## 4. Design Tokens 设计

### 4.1 CSS Variables (index.css)
```css
:root {
  /* Galaxy base */
  --galaxy-halo-opacity: 0.022;
  --galaxy-ring-opacity: 0.055;
  --galaxy-core-opacity: 0.15;
  --galaxy-particle-opacity: 0.45;
  --galaxy-particle-size: 0.12;

  /* Galaxy LOD thresholds */
  --galaxy-lod-near: 70;    /* full detail */
  --galaxy-lod-mid: 130;    /* fade halos */
  --galaxy-lod-far: 200;    /* labels only */

  /* Galaxy animation */
  --galaxy-breathe-speed: 0.3;   /* Hz */
  --galaxy-rotate-speed: 0.001;  /* rad/frame */
  --galaxy-particle-drift: 0.005;
}
```

### 4.2 TypeScript Galaxy Theme Config
```typescript
// src/components/starmap/galaxy-theme.ts
export type GalaxyVariant = 'cluster' | 'ring' | 'chain' | 'nebula';

export interface GalaxyTheme {
  variant: GalaxyVariant;
  haloShape: 'sphere' | 'ellipsoid' | 'tube' | 'multi-layer';
  haloOpacity: number;
  hasRing: boolean;
  ringCount: number;
  ringRotateSpeed: number;
  particleCount: number;
  particleSize: number;
  particleDrift: number;
  hasCoreGlow: boolean;
  coreGlowIntensity: number;
  breatheAmplitude: number;  // 0-1 scale pulsing
  nodeDistribution: 'spherical' | 'ring' | 'curve' | 'scattered';
}

export const GALAXY_THEMES: Record<GalaxyVariant, GalaxyTheme> = {
  cluster: {
    variant: 'cluster',
    haloShape: 'sphere',
    haloOpacity: 0.025,
    hasRing: false,
    ringCount: 0,
    ringRotateSpeed: 0,
    particleCount: 60,
    particleSize: 0.10,
    particleDrift: 0.003,
    hasCoreGlow: true,
    coreGlowIntensity: 1.8,
    breatheAmplitude: 0.08,
    nodeDistribution: 'spherical',
  },
  ring: {
    variant: 'ring',
    haloShape: 'ellipsoid',
    haloOpacity: 0.018,
    hasRing: true,
    ringCount: 2,
    ringRotateSpeed: 0.0008,
    particleCount: 40,
    particleSize: 0.08,
    particleDrift: 0.002,
    hasCoreGlow: true,
    coreGlowIntensity: 1.2,
    breatheAmplitude: 0.05,
    nodeDistribution: 'ring',
  },
  chain: {
    variant: 'chain',
    haloShape: 'tube',
    haloOpacity: 0.012,
    hasRing: false,
    ringCount: 0,
    ringRotateSpeed: 0,
    particleCount: 30,
    particleSize: 0.06,
    particleDrift: 0.001,
    hasCoreGlow: false,
    coreGlowIntensity: 0,
    breatheAmplitude: 0.03,
    nodeDistribution: 'curve',
  },
  nebula: {
    variant: 'nebula',
    haloShape: 'multi-layer',
    haloOpacity: 0.012,
    hasRing: false,
    ringCount: 0,
    ringRotateSpeed: 0,
    particleCount: 120,
    particleSize: 0.14,
    particleDrift: 0.006,
    hasCoreGlow: false,
    coreGlowIntensity: 0,
    breatheAmplitude: 0.12,
    nodeDistribution: 'scattered',
  },
};
```

### 4.3 扩展调色板 (12色)
```typescript
// cosmos-layout.ts
export const PALETTE = [
  '#00ff66', // neon green
  '#66f0ff', // cyan
  '#b496ff', // purple
  '#ffa040', // amber
  '#ff4466', // rose
  '#40ccff', // sky
  '#ff80ab', // pink
  '#7fff7f', // lime
  '#ff6b6b', // coral (new)
  '#ffd93d', // gold (new)
  '#6bcb77', // sage (new)
  '#4d96ff', // ocean (new)
];
```

---

## 5. 远 / 中 / 近景统一规则

| 距离 | LOD Level | 显示内容 | 优化策略 |
|---|---|---|---|
| **近景** < 70 | LOD 0 | 节点形状 + 发光 + 标签 + halo + ring + 粒子 + 核心光点 | 完整渲染 |
| **中景** 70-130 | LOD 1 | 节点缩小为光点 + halo 淡出 + 粒子减半 + 标签→tag名 | 粒子数减半，关闭节点 geometry |
| **远景** > 130 | LOD 2 | 仅 halo 微光 + tag 标签(如果距离 < 200) | 关闭粒子，节点渲染为 Points |

**关键**: 远景 = 干净的深空 + 稀疏的星系微光，不做任何花哨效果。

---

## 6. MVP 优先实施顺序 (6步)

### Step 1: galaxy-theme.ts 配置文件
- 创建 `src/components/starmap/galaxy-theme.ts`
- 定义 `GalaxyVariant`, `GalaxyTheme`, `GALAXY_THEMES`
- 定义 `getGalaxyVariant(cluster)` 自动分配函数
- 扩展 `PALETTE` 到 12 色

### Step 2: 团簇型核心光点 + 粒子云
- 在 CosmosScene `useEffect` 的 galaxy cluster 构建部分
- 为每个 cluster 添加中心光核 mesh (`SphereGeometry(0.8)`)
- 添加粒子云 (`Points` + `PointsMaterial`)
- 保留现有 halo 和 ring，但根据 variant 调整 opacity

### Step 3: 呼吸动画 + 微粒漂移
- 在 `useFrame` 中：
  - 核心光点 `emissiveIntensity` 呼吸脉动 (`sin(t * breatheSpeed) * amplitude`)
  - 粒子位置微漂移 (`position += drift * sin(t + phase)`)
  - 环带旋转 (`ring.rotation.z += rotateSpeed`)

### Step 4: 环带型星系变体
- 当 variant = 'ring': 生成双层 RingGeometry + 扁椭球 halo
- 环面粒子分布

### Step 5: LOD 粒子降级
- 中景: 粒子 opacity 减半, 远景: 隐藏粒子
- 确保性能（大量星系时 GPU 不过载）

### Step 6: index.css galaxy tokens
- 添加 galaxy CSS variables
- 确保后续可通过 theme 修改星系外观

---

## Files to Create / Modify

| File | Action |
|---|---|
| `src/components/starmap/galaxy-theme.ts` | **CREATE** — variant configs, auto-assign fn |
| `src/components/starmap/cosmos-layout.ts` | **MODIFY** — expand PALETTE, add variant to ClusterInfo |
| `src/components/starmap/CosmosScene.tsx` | **MODIFY** — galaxy construction + useFrame animation |
| `src/index.css` | **MODIFY** — add galaxy CSS tokens |

## Verification

- 打开星图，星系应显示不同的视觉层次
- 少量节点 (< 15) 的标签 → 团簇型，有中心光核和粒子
- 大量节点 (> 25) 的标签 → 云雾型，多层弥散
- 远景：干净深空，仅见星系微光
- 近景：丰富细节，粒子 + 呼吸动画
- 无明显性能下降 (FPS 保持 > 30)
