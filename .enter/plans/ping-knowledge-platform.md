# 移动端交互适配方案

## Context

当前知识星图产品完全面向桌面端设计，所有交互依赖 hover / right-click / keyboard / mouse-drag，在触控设备上完全不可用。需要一套分层适配方案，在保持宇宙感和沉浸感的前提下，让手机和平板用户获得原生级触控体验。

**现状关键发现：**
- `useIsMobile()` hook 已存在（768px 断点），但仅用于 shadcn Sidebar，cosmos UI 完全未使用
- FloatingPod 拖拽仅绑定 `mousemove/mouseup`，无 touch 事件
- CosmosScene hover 按钮依赖 `pointermove` raycasting + 200ms 定时器，触控无效
- NodeContextMenu 的子菜单依赖 `onMouseEnter/onMouseLeave`，触控无效
- CommandDock 5 个按钮在手机上过于拥挤（62-88px 宽）
- 所有交互组件零触控适配

---

## Phase 0 — 设备检测基础设施

### 新建 `src/hooks/useDevice.ts`

```typescript
// 三档设备检测：phone / tablet / desktop
// phone:   < 768px  || 触控 + portrait
// tablet:  768–1199px  && 触控
// desktop: >= 1200px || 非触控
export type DeviceClass = 'phone' | 'tablet' | 'desktop';

export function useDevice(): {
  device: DeviceClass;
  isTouch: boolean;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}
```

- 用 `matchMedia` + `('pointer: coarse')` 组合判断
- 响应窗口 resize 和方向变化
- 所有需要分支的组件从此 hook 获取设备状态

### 新增 CSS 变量（`index.css`）

```css
:root {
  --touch-min: 44px;          /* Apple HIG / Material 最小触控区 */
  --dock-bottom:  clamp(16px, 2.0vh, 28px);
  --qbar-bottom:  clamp(100px, 11.5vh, 148px);
}
@media (max-width: 767px) {
  :root {
    --dock-bottom: 12px;
    --qbar-bottom: 76px;
  }
}
@media (min-width: 768px) and (max-width: 1199px) {
  :root {
    --dock-bottom: 14px;
    --qbar-bottom: 88px;
  }
}
```

---

## Phase 1 — 节点交互适配（最高优先级）

### 1.1 触控选中 → 底部操作条（替代 hover 快捷按钮）

**桌面端**：hover 节点 → 200ms 后显示 Html overlay 按钮
**移动端**：tap 节点 → 底部滑出 ActionSheet

**文件：** `src/components/starmap/CosmosScene.tsx`（ImperativeCore）
- `isTouch` 时，将 `click`（非 drag）视为"选中节点"而非"打开节点窗口"
- 选中后 dispatch `cosmos-node-selected` CustomEvent
- 第二次 tap 同一节点 → 打开节点窗口

**新建：** `src/components/starmap/MobileActionSheet.tsx`
```
┌────────────────────────────────────┐  ← 底部滑出，高度 auto
│ 📄 笔记标题                         │
│ ─────────────────────────────────  │
│ [→ 打开]  [◇ 蒸馏]  [▶ 送舱]  [✦ 定位] │  ← 4 个大触控按钮(48px 高)
│ [选择舱:  捕获 | 检索 | 洞察 | 记忆 | 行动]│  ← 送舱展开行
└────────────────────────────────────┘
```
- 半透明玻璃背景，保持宇宙感
- 点击空白区域或向下拖拽关闭
- z-index: 35（在 Dock 之上）

### 1.2 长按菜单（替代右键菜单）

**文件：** `src/components/starmap/CosmosScene.tsx`（ImperativeCore）
- 在 `onDown` 中启动 500ms 定时器
- 如果 500ms 内未移动超过 8px → 触发 `cosmos-context-menu` CustomEvent
- 如果移动了 → 取消（这是拖拽/旋转）

**文件：** `src/components/starmap/NodeContextMenu.tsx`
- `isTouch` 时：改为全宽底部 Sheet 样式（不再跟随坐标定位）
- 子菜单"发送到舱"改为内联展开（不再 hover 出子菜单）
- 触控热区 padding 增加到 12px+

### 1.3 手势旋转 / 缩放

**文件：** `src/components/starmap/CosmosScene.tsx`（现有 OrbitControls）
- R3F 的 OrbitControls 已支持触控旋转和双指缩放
- 需确认 `enablePan` / `enableZoom` / `enableRotate` 在触控时正常
- 添加 `touches` 配置：单指旋转，双指缩放/平移

---

## Phase 2 — 面板系统适配

### 2.1 FloatingPod → BottomSheet（手机）/ HalfScreen（平板）

**文件：** `src/components/floating/FloatingPod.tsx`

**手机端策略：** 不再自由浮动，改为底部抽屉
```
手机端 FloatingPod 行为：
- open → 从底部滑出，高度 70vh，圆角顶部
- 可向下拖拽关闭（手势 dismiss）
- 同时只显示 1 个 pod（新 pod 替换当前 pod）
- 标题栏保留：icon + title + close
- 移除：drag / resize / pin / 字体缩放 / fullscreen
- 保留：minimize（收到底部 tab 指示器）
```

**平板端策略：** 右侧 slide-in panel
```
平板端 FloatingPod 行为：
- open → 从右侧滑入，宽度 420px，高度 100vh
- 可左右拖拽调整宽度
- 同时最多显示 1 个 pod
- 保留所有桌面控件
```

**实现关键：**
```typescript
// FloatingPod 内部
const { isPhone, isTablet } = useDevice();

if (isPhone) return <MobileBottomSheet {...props} />;
if (isTablet) return <TabletSlidePanel {...props} />;
return <DesktopFloatingPod {...props} />;  // 现有逻辑
```

**新建：** `src/components/floating/MobileBottomSheet.tsx`
- 用 `touch-action: none` + `touchmove` 实现拖拽关闭
- 背景遮罩 `rgba(0,0,0,0.4)` 点击关闭
- 内部 scroll 隔离 `overscrollBehavior: 'contain'`
- 入场动画：`translateY(100%) → translateY(0)` 弹性曲线

**新建：** `src/components/floating/TabletSlidePanel.tsx`
- 从右侧滑入
- 左侧保留 3D 星图可见（分屏感）

### 2.2 ToolboxContext 移动端行为

**文件：** `src/contexts/ToolboxContext.tsx`
- `isPhone` 时 `openPod` 自动关闭其他已打开的 pod（互斥）
- `isTablet` 时最多同时 2 个 pod
- 桌面端保持不变

---

## Phase 3 — Dock 适配

### 3.1 手机端 Dock → 底部 TabBar

**文件：** `src/components/floating/CommandDock.tsx`

**手机端替代：** 固定底部 5-tab 导航条
```
┌────────────────────────────────────────────────────┐
│  [捕获]  [检索]  [洞察]  [记忆]  [行动]              │  ← 5 个 48x48 触控区
│   ·       ·       ·       ·       ·                │  ← 活跃指示点
└────────────────────────────────────────────────────┘
```
- 只显示 icon + 中文简称（去掉英文 label）
- 触控热区 48x48px 最小
- 活跃 pod 显示强调色底部线
- 去掉 drag-to-pod 逻辑（移动端不需要）
- 去掉品牌 logo 区（节省空间）
- 去掉 pipeline connector 线

**平板端：** 保持当前 Dock 布局，增大触控区到 72x60px

### 3.2 QuickCaptureBar 适配

**文件：** `src/components/starmap/QuickCaptureBar.tsx`
- 手机端：隐藏键盘快捷键提示（`/` 和 `Q`）
- 手机端：宽度改为 `calc(100vw - 24px)`
- 手机端：位置上移避免被 TabBar 遮挡
- placeholder 改为更短的文案
- 去掉 `useEffect` 中的键盘快捷键监听（isTouch 时跳过）

---

## Phase 4 — 触控热区 & 字体 & 尺寸

### 4.1 全局触控安全

**规则：**
- 所有可点击元素最小 44x44px（Apple HIG）
- 相邻按钮间距至少 8px
- 文字最小 14px（手机正文），12px（辅助文字）

**需调整的组件：**
| 组件 | 当前最小尺寸 | 移动端目标 |
|------|-------------|----------|
| CommandDock 按钮 | 62x50px | 48x48px (phone tab) |
| FloatingPod 标题栏控件 | 24x24px | 隐藏多余，保留关闭 44x44px |
| NodeLightBand 标签 | 无约束 | 32px 高 |
| QuickCaptureBar | 40-54px 高 | 48px 高 |
| NodeContextMenu 菜单项 | 28px 行高 | 48px 行高 |

### 4.2 单手操作区设计

手机端关键操作集中在**底部 60%** 区域（拇指可达区）：
```
┌──────────────────┐
│                  │  ← 上 40%：3D 星图（仅观看/双指操作）
│   3D 星图空间     │
│                  │
├──────────────────┤
│  节点信息条       │  ← NodeLightBand（点击展开）
│  快速捕获栏       │  ← QuickCaptureBar
│  底部 TabBar     │  ← 5 个 pod 入口
└──────────────────┘
```

---

## Phase 5 — 平板 vs 手机分层

| 特性 | 手机 (<768px) | 平板 (768-1199px) | 桌面 (>=1200px) |
|------|--------------|------------------|----------------|
| Pod 展示 | BottomSheet 全宽 | 右侧 SlidePanel | 自由浮动窗口 |
| 同时 Pod | 1 个互斥 | 最多 2 个 | 不限 |
| Dock | 底部 TabBar | 当前 Dock (放大) | 当前 Dock |
| 节点选中 | tap → ActionSheet | tap → ActionSheet | hover → 快捷按钮 |
| 右键菜单 | 长按 → BottomSheet | 长按 → BottomSheet | 右键 → ContextMenu |
| 窗口拖拽 | 无 | 有（简化） | 完整 |
| 快捷键 | 无 | 外接键盘支持 | 完整 |
| 星图操作 | 单指旋转 + 双指缩放 | 同手机 | 鼠标 + 滚轮 |

---

## 实施文件清单

### 新建文件
1. `src/hooks/useDevice.ts` — 设备检测 hook
2. `src/components/floating/MobileBottomSheet.tsx` — 手机端 Pod 容器
3. `src/components/floating/TabletSlidePanel.tsx` — 平板端 Pod 容器
4. `src/components/starmap/MobileActionSheet.tsx` — 节点操作条
5. `src/components/floating/MobileTabBar.tsx` — 手机端底部导航

### 修改文件
1. `src/hooks/use-mobile.tsx` — 扩展为 `useDevice` 或新建独立 hook
2. `src/index.css` — 添加移动端 CSS 变量 + 媒体查询
3. `src/components/floating/FloatingPod.tsx` — 分支到三种容器
4. `src/components/floating/CommandDock.tsx` — isPhone 时渲染 MobileTabBar
5. `src/components/starmap/CosmosScene.tsx` — touch 选中 + 长按逻辑
6. `src/components/starmap/NodeContextMenu.tsx` — 触控友好的底部 Sheet 模式
7. `src/components/starmap/QuickCaptureBar.tsx` — 尺寸/文案/快捷键适配
8. `src/components/layout/NodeLightBand.tsx` — 触控热区增大
9. `src/components/layout/StarMapLayout.tsx` — 布局层级移动端调整
10. `src/contexts/ToolboxContext.tsx` — pod 互斥逻辑

---

## MVP 推荐实施顺序

**Sprint 1（核心可用性）：**
1. `useDevice` hook（所有后续改动的基础）
2. `MobileBottomSheet`（Pod 容器 — 影响最大的单一改动）
3. `FloatingPod` 分支（手机走 BottomSheet，其他不变）
4. `ToolboxContext` pod 互斥（手机一次一个 pod）
5. `CommandDock` → `MobileTabBar`（手机端入口）
6. CSS 变量移动端覆盖

**Sprint 2（交互自然度）：**
7. CosmosScene tap 选中 + `MobileActionSheet`
8. CosmosScene 长按 → context menu
9. `NodeContextMenu` 底部 Sheet 模式
10. `QuickCaptureBar` 移动端适配

**Sprint 3（精打磨）：**
11. `TabletSlidePanel`（平板专属）
12. `NodeLightBand` 触控热区
13. 字体/间距微调
14. 手势 dismiss 动画打磨

---

## 验证方式

1. Chrome DevTools 模拟 iPhone 14 (390x844) / iPad (1024x1366)
2. 核心链路验证：
   - 手机：tap 节点 → 底部 ActionSheet → 点击"打开" → BottomSheet Pod 滑出 → 向下拖拽关闭
   - 手机：长按节点 → 底部菜单 → 发送到舱 → Pod 自动打开
   - 手机：TabBar 切换 Pod → 前一个 Pod 自动关闭
   - 平板：tap 节点 → ActionSheet → SlidePanel 从右滑出
3. 确保桌面端零退化（所有移动端改动都在 `isPhone/isTablet` 守卫内）
