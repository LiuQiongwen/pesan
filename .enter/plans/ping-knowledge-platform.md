# 知识宇宙 — 5 Pod 精简重设计

## Context
将现有 8 工具箱体系收缩为 5 核心功能舱 + 1 设置组件，每个舱有独特的视觉个性和交互特征，
同时保持同一设计语言。Settings 组件作为低干扰的右上角控制胶囊存在。

---

## 核心架构

### Pod IDs & 视觉标识
| Pod | ID | 颜色 | 尺寸 | 个性 |
|-----|-----|------|------|------|
| Capture Pod  | `capture`   | `#00ff66` 霓虹绿 | 360px | 最轻、最敏捷、采集器 |
| Retrieval Pod| `retrieval` | `#66f0ff` 青蓝   | 420px | 最精确、雷达/扫描仪 |
| Insight Pod  | `insight`   | `#b496ff` 薰衣紫 | 400px | 最聪明、精炼器 |
| Memory Pod   | `memory`    | `#ffa040` 琥珀   | 360px | 最安静、回声装置 |
| Action Pod   | `action`    | `#ff4466` 赤红   | 360px | 最有推进感、发射器 |
| Settings     | `settings`  | `#888fa8` 灰     | 320px | 最低调、系统胶囊 |

---

## 文件变更清单

### 1. 修改 `src/contexts/ToolboxContext.tsx`
- ToolboxId 改为: `'capture' | 'retrieval' | 'insight' | 'memory' | 'action' | 'settings'`
- defaultPositions 改为 6 个 pod，清除旧的 8 个条目
- STORAGE_KEY 改为 `'cosmos_pods_v2'` 防止与旧版本冲突

### 2. 升级 `src/components/floating/FloatingToolbox.tsx` → `FloatingPod.tsx`
- 支持 accentColor 为任意 hex 字符串而非固定枚举
- 标题栏左侧加彩色竖线 bar 作为 pod 辨识符
- 控制按钮颜色使用 pod accent color
- 更紧凑：header padding 减小
- 保持: 拖拽、折叠、关闭、Pin 功能不变

### 3. 新建 5 个 Pod 内容组件（`src/components/pods/`）

**CaptureBox.tsx** (`capture` / `#00ff66`)
- 单一大输入框（textarea + 占位符"随手丢进来…"）
- 顶部 3 个轻量 type 按钮: [文字] [链接] [文件]
- 链接: 单行输入，Enter 快速提交
- 文件: 拖拽区域或点击选择
- 提交后显示"已投入星图"动效
- 无多余设置，极简

**RetrievalBox.tsx** (`retrieval` / `#66f0ff`)
- 搜索输入框（放在顶部，醒目）
- 支持问题式输入（问答模式）和关键词（列表模式）
- 结果列表：每项显示来源节点名 + 摘要短句 + 相关度条
- 引用答案块（带 [1][2] 引用标注）
- 高亮对应节点（传 `onHighlight`）

**InsightBox.tsx** (`insight` / `#b496ff`)
- 选择笔记下拉框
- 四层输出结构: [摘要层] [关键点] [洞见] [可执行项]
- 每层可折叠/展开
- 调用现有 `distill-insight` edge function
- 输出高密度，标题 + 内容分层展示

**MemoryBox.tsx** (`memory` / `#ffa040`)
- 被动显示：根据当前悬停的 star map 节点自动召唤相关旧记录
- 可接受 `hoveredNoteId` prop
- 显示"你曾经记录过…"风格的轻提示卡片列表
- 每张卡片: 小标题 + 时间 + 短摘要
- 有一个手动"刷新记忆"按钮
- 安静、柔和，无操作性按钮

**ActionBox.tsx** (`action` / `#ff4466`)
- 输入框: 粘贴一段洞见或想法
- 5 个快速转化按钮（横排图标+标签）:
  - [→ 任务] [→ 提纲] [→ 问题] [→ 素材] [→ 发布]
- 点击按钮后，在下方显示转化结果（简洁、一次性可复制）
- 强调推进感：按钮颜色鲜明，结果区清晰

### 4. 新建 `src/components/floating/SettingsCapsule.tsx`
- **不是** FloatingPod，而是一个独立的右上角系统组件
- 默认状态：一个小圆形/圆角矩形的齿轮按钮（22×22px），紧贴右上角
- 展开状态：向下展开一个 320px 宽的面板（不可拖动，固定右上角）
- 内容：用户头像/邮箱、语言切换、退出登录
- 面板外点击自动关闭

### 5. 重写 `src/components/floating/CommandDock.tsx`
- 只保留 5 个 Pod 图标（无 Settings 图标）
- 每个图标使用各自 Pod 的 accent color
- 激活状态：彩色填充背景 + 底部彩点
- 布局：更紧凑，5 个图标横排
- 标签：仅 hover 时用 tooltip 显示，不常显

### 6. 更新 `src/components/layout/StarMapLayout.tsx`
- 导入 5 个 Pod 组件替换旧的 8 个
- 添加 `SettingsCapsule` 组件
- 传递 `hoveredNode` 给 MemoryBox（Memory Pod 被动联动）
- 传递 `flashNote` 给 CaptureBox（新节点闪光）
- 传递 `onHighlight` 给 RetrievalBox
- 移除对旧 8 个 toolbox 文件的导入

### 7. 添加 i18n 键
在 `src/i18n/index.ts` 中添加 pod 标题和关键文案:
- `pod.capture`, `pod.retrieval`, `pod.insight`, `pod.memory`, `pod.action`

### 8. 清理旧文件
删除 `src/components/toolboxes/` 下所有 8 个旧文件:
- AnalyzeBox, SearchBox, LibraryBox, DistillerBox, MirrorBox, AnticipationBox, ActionsBox, SettingsBox

---

## 各 Pod 功能映射（旧→新）

| 旧组件 | 映射到 | 说明 |
|--------|--------|------|
| AnalyzeBox | CaptureBox | 保留分析逻辑，UI 大幅简化 |
| SearchBox | RetrievalBox | 保留 RAG 搜索逻辑 |
| DistillerBox + MirrorBox | InsightBox | 合并为单一洞察界面 |
| SettingsBox | SettingsCapsule | 非 pod，改为角落胶囊 |
| ActionsBox | ActionBox | 聚焦知识→行动转化 |
| AnticipationBox, LibraryBox | 移除（Library 并入 Memory 被动召回） | 简化 |

---

## 视觉系统统一规则

所有 Pod 共享：
- 背景: `rgba(4,6,10,0.88)` + `backdrop-filter: blur(22px)`
- 边框: 各自 accent 色 @ 25% 透明度
- 外发光: 各自 accent 色 @ 15% 透明度
- 标题栏: 左侧 3px 竖条 (accent color)，上方有 pod 名称
- 控制按钮: 统一 20×20px 圆角矩形
- 字体: IBM Plex Mono (标签/代码) + Inter (内容)
- 圆角: 10px

---

## 验证
- TS 0 errors
- Lint 0 errors  
- Build 成功
- 5 个 Pod 均可在 CommandDock 中开/关
- Settings Capsule 独立在右上角运作
- CaptureBox 分析完成后新节点出现在星图
- RetrievalBox 搜索后对应节点高亮
