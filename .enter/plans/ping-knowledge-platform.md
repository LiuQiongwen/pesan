# Guide Center 重构

## Context
当前 GuideCenterModal 只有 4 张静态卡片。用户需要完整的使用攻略页，涵盖快速开始、核心交互、进阶效率、设置操作四大分类，与 `useHintState` 联动显示每项完成状态。

## 方案：重写 GuideCenterModal.tsx（单文件）

### 文件：`src/components/tour/GuideCenterModal.tsx`

**信息架构（4 sections × N items）：**

| Section | Items | hint key (if any) |
|---|---|---|
| 快速开始 | 移动知识宇宙 (`first_move_universe`) · 生成第一颗星 (`first_create_star`) · 打开节点 (`first_click_node`) | 3 keys |
| 核心交互 | 拖拽到 Pod (`drag_to_pod`) · 建立连接 (`action_feedback`) · 使用工作台 (`workbench_empty`) · 私人云 RAG (`retrieval_scope`) · 来源回溯 (`trace_source`) | 5 keys |
| 进阶效率 | 快捷键 · 多节点整理 · 导出与回流 · Obsidian 导入 | 0 keys (纯攻略文字) |
| 设置操作 | 重新开启提示 (enableAll) · 重置所有 (resetAll+restart) · 关闭所有 (disableAll) | 操作按钮 |

**每条 item 结构：**
- icon + title + 一行描述
- 若有 hint key → 右侧显示 completed/pending 小圆标
- 进阶效率无 key，不显示状态

**Header：**
- 保留 progress bar (`completedCount/totalCount`)
- 保留"重新体验新手导览"按钮

**底部设置操作区：**
- 保留现有三个按钮（resetAll / enableAll / disableAll toggle）

### 其他文件：无需修改
- `useHintState` 已有所有 8 个 key + `completedCount/totalCount`
- `SettingsCapsule` 已有 Guide Center 入口

## 验证
- 打开 Settings → 使用攻略 → 看到 4 分类，每项有 icon/desc
- 快速开始和核心交互各项右侧显示绿色 ✓ 或灰色 ○
- 点击"重置所有交互提示"后所有状态归零
