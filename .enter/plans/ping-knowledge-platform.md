# "创建新宇宙" — 多知识宇宙功能设计与实现计划

## Context

当前产品中所有用户数据（notes, edges, chunks, wiki, positions 等）都属于一个隐式的 "default" 宇宙。`knowledge_chunks` 和 `rag_conversations` 表已有 `project_id` 列（默认 `'default'`），但 `notes`、`thought_edges`、`node_positions`、`galaxy_positions` 等核心表尚未支持多宇宙隔离。

本计划将"宇宙"(Universe) 作为顶层项目空间概念引入，让用户可以创建多个独立的知识世界。

---

## 1. 功能定位

- **宇宙 = 独立知识世界**：每个宇宙有自己的节点、连接、星系布局、RAG 索引、Wiki
- **不是文件夹/标签**：宇宙之间完全隔离，不共享节点
- **视觉隐喻**：每个宇宙是一个独立的星空场景，切换宇宙 = 跃迁到另一个知识维度

---

## 2. 数据结构

### 2.1 新表: `universes`

```sql
CREATE TABLE universes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,                    -- 宇宙名称
  description text,                             -- 可选描述
  color_seed  text DEFAULT 'blue',              -- 主题色种子 (用于星图背景微调)
  icon        text DEFAULT 'sparkles',          -- lucide icon name
  is_default  boolean NOT NULL DEFAULT false,   -- 标记默认宇宙
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
ALTER TABLE universes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own universes" ON universes FOR ALL USING (auth.uid() = user_id);
```

### 2.2 核心表添加 `universe_id`

以下表需添加 `universe_id uuid REFERENCES universes(id)` 列，默认值指向用户的 default 宇宙：

| 表名 | 当前状态 | 改动 |
|------|---------|------|
| `notes` | 无 project_id | 添加 `universe_id` |
| `thought_edges` | 无 | 添加 `universe_id` |
| `knowledge_chunks` | 有 `project_id='default'` | 添加 `universe_id`，逐步替代 project_id |
| `rag_conversations` | 有 `project_id='default'` | 添加 `universe_id` |
| `wiki_pages` | 无 | 添加 `universe_id` |
| `node_positions` | 无 | 添加 `universe_id` |
| `galaxy_positions` | 无 | 添加 `universe_id` |
| `distillations` | 无 | 添加 `universe_id` |
| `actions` | 无 | 添加 `universe_id` |

**迁移策略**：
1. 为每个现有用户创建一个 `is_default=true` 的宇宙记录
2. 用 `UPDATE ... SET universe_id = (SELECT id FROM universes WHERE user_id = notes.user_id AND is_default = true)` 回填所有现有数据
3. 添加 `NOT NULL` 约束 + 索引

### 2.3 套餐限制表（利用现有 `subscriptions` + `admin_settings`）

在 `admin_settings` 中配置每个套餐的宇宙上限：

| plan | max_universes |
|------|--------------|
| free | 1 |
| pro | 5 |
| team | 20 |

前端在创建时检查当前宇宙数量是否达到上限，达到则引导升级。

---

## 3. 创建流程设计

### 3.1 入口
- **左上角 HUD 区域**：当前宇宙名称旁显示切换 / 创建入口（小星星图标）
- 点击后展开 **宇宙选择器面板**（非弹窗，类似悬浮面板，保持宇宙感）

### 3.2 创建步骤（单页，不做向导）
1. **宇宙名称**（必填，如"AI 研究"、"读书笔记"）
2. **描述**（选填，一句话简介）
3. **主题色**（从 6 个预设色种子中选一个，影响星图背景微调）
4. **图标**（从 8 个 lucide 图标中选一个）
5. 点击"创建宇宙" → 带跃迁动画切换过去

### 3.3 MVP 不做的：
- 模板宇宙
- 从资料批量生成宇宙
- 宇宙间节点迁移
- 3D 自定义编辑

---

## 4. 宇宙切换交互

### 4.1 切换器位置
- 左上角 HUD 中用户名下方，显示当前宇宙名称 + 图标
- 点击展开宇宙列表面板（绝对定位浮层，半透明深色背景）

### 4.2 切换动画
- 点击目标宇宙 → 当前星图淡出（opacity 0 + scale 0.95，300ms）
- 切换 `activeUniverseId` → 新宇宙的数据加载
- 新星图淡入（opacity 1 + scale 1，400ms）

### 4.3 面板内容
- 宇宙列表：图标 + 名称 + 节点数 + 最后更新时间
- 底部："+ 创建新宇宙" 按钮
- 当前宇宙高亮标记

---

## 5. 关键文件修改清单

### 5.1 数据库迁移
- 新文件：`supabase/migrations/migration_<timestamp>` — 创建 `universes` 表 + 为核心表添加 `universe_id` + 回填数据

### 5.2 新建文件

| 文件 | 用途 |
|------|------|
| `src/hooks/useUniverses.ts` | CRUD 宇宙、切换当前宇宙、获取列表 |
| `src/contexts/UniverseContext.tsx` | 全局 `activeUniverseId` 状态 + Provider |
| `src/components/universe/UniverseSwitcher.tsx` | 宇宙选择器面板（列表 + 创建入口） |
| `src/components/universe/CreateUniversePanel.tsx` | 创建新宇宙表单面板 |

### 5.3 修改文件

| 文件 | 改动 |
|------|------|
| `src/hooks/useNotes.ts` | 查询加 `.eq('universe_id', activeUniverseId)` 过滤 |
| `src/hooks/useRAG.ts` | `project_id` 改为传入 `universe_id` |
| `src/components/layout/StarMapLayout.tsx` | 包裹 UniverseProvider，HUD 区域渲染 UniverseSwitcher |
| `src/components/starmap/KnowledgeStarMap.tsx` | 接收 `universeId`，position/galaxy 查询加 universe 过滤 |
| `src/App.tsx` | 包裹 UniverseProvider（最外层） |
| `supabase/functions/chunk-and-index/index.ts` | 接受 `universe_id` 参数写入 |
| `supabase/functions/rag-search/index.ts` | 按 `universe_id` 过滤搜索 |
| `supabase/functions/wiki-compile/index.ts` | 按 `universe_id` 过滤编译 |

---

## 6. MVP 实施顺序

### Phase 1: 数据基础
1. 创建 `universes` 表
2. 为核心表添加 `universe_id` 列（nullable 先）
3. 迁移脚本：为现有用户创建默认宇宙 + 回填所有数据
4. 设置 `NOT NULL` + 索引

### Phase 2: Context + Hook
5. `UniverseContext` — 全局 activeUniverseId
6. `useUniverses` — 获取列表 / 创建 / 切换

### Phase 3: 查询隔离
7. `useNotes` 加 `universe_id` 过滤
8. `KnowledgeStarMap` 中 position 查询加 universe 过滤
9. Edge functions 传入 universe_id

### Phase 4: UI
10. `UniverseSwitcher` — 左上角宇宙选择器
11. `CreateUniversePanel` — 创建面板
12. 切换动画

### Phase 5: 套餐限制
13. 创建时检查宇宙数量 vs 套餐上限
14. 达到上限时显示升级提示

---

## 7. 验证方案

1. 新用户注册 → 自动拥有 1 个默认宇宙
2. 老用户登录 → 所有现有数据归属默认宇宙，体验无变化
3. 创建新宇宙 → 进入空白星图，节点数 = 0
4. 在新宇宙中创建节点 → 不影响默认宇宙的节点
5. 切换回默认宇宙 → 所有原有数据完好
6. RAG 搜索 → 只检索当前宇宙的 chunks
7. Free 用户创建第 2 个宇宙 → 显示升级提示
