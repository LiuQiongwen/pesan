# "创建新宇宙" — 多知识宇宙功能实现计划

## Context

当前所有数据隐式属于 "default" 宇宙。`knowledge_chunks` 和 `rag_conversations` 已有 `project_id` 列（默认 `'default'`），但 `notes`、`thought_edges`、`node_positions` 等核心表无多宇宙支持。本计划引入 `universes` 表和 `universe_id` 外键，实现完全隔离的多知识宇宙。

---

## Phase 1: 数据库迁移

**单次迁移脚本**，包含以下操作：

### 1.1 创建 `universes` 表
```sql
CREATE TABLE universes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  color_seed  text DEFAULT 'blue',
  icon        text DEFAULT 'sparkles',
  is_default  boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
ALTER TABLE universes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own universes" ON universes FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_universes_user ON universes(user_id);
```

### 1.2 为每个现有用户创建默认宇宙
```sql
INSERT INTO universes (user_id, name, is_default)
SELECT DISTINCT user_id, '默认宇宙', true FROM notes
ON CONFLICT DO NOTHING;
```

### 1.3 为 9 个核心表添加 `universe_id` 列 + 回填 + 索引

**需要添加 `universe_id` 的表：**
| 表 | 当前有 project_id? |
|---|---|
| `notes` | 否 |
| `thought_edges` | 否 |
| `knowledge_chunks` | 是 (project_id='default') |
| `rag_conversations` | 是 (project_id='default') |
| `wiki_pages` | 否 |
| `wiki_source_refs` | 否（通过 wiki_page_id 间接关联即可，**不加**） |
| `node_positions` | 否 |
| `galaxy_positions` | 否 |
| `distillations` | 否 |
| `actions` | 否 |

每个表执行：
```sql
ALTER TABLE <table> ADD COLUMN universe_id uuid REFERENCES universes(id);
UPDATE <table> SET universe_id = (
  SELECT id FROM universes WHERE user_id = <table>.user_id AND is_default = true
);
ALTER TABLE <table> ALTER COLUMN universe_id SET NOT NULL;
CREATE INDEX idx_<table>_universe ON <table>(universe_id);
```

**注意**：`galaxy_positions` 的 unique 约束需改为 `UNIQUE(user_id, tag, universe_id)`，`node_positions` 的 unique 约束需改为 `UNIQUE(user_id, note_id, universe_id)`。但由于现有约束已在 `(user_id, tag)` / `(user_id, note_id)` 上，且 universe_id 刚加入时所有行指向同一 default 宇宙，回填后不会冲突。后续新建宇宙的数据自然隔离。暂不修改 unique 约束，MVP 够用。

---

## Phase 2: UniverseContext + useUniverses hook

### 2.1 `src/contexts/UniverseContext.tsx` (新建)
- 全局 Provider，存储 `activeUniverseId: string | null`
- 从 localStorage 读取上次使用的宇宙 ID（`cosmos_active_universe`）
- 初始化时查 DB 验证该 ID 仍然存在 → 否则 fallback 到 `is_default=true` 的宇宙
- 暴露 `activeUniverseId`、`setActiveUniverseId`、`activeUniverse` 对象
- `setActiveUniverseId` 同步写 localStorage

### 2.2 `src/hooks/useUniverses.ts` (新建)
- `useUniverses(userId)` → `{ universes, loading, createUniverse, deleteUniverse, updateUniverse }`
- `createUniverse({ name, description?, color_seed?, icon? })` → insert to DB, 检查套餐限制
- Realtime subscription for INSERT/UPDATE/DELETE on `universes` table
- 返回 `universes` 按 `sort_order` 排序

### 2.3 `src/App.tsx` 修改
- 包裹 `<UniverseProvider>` 在 `<ToolboxProvider>` 内层（需要 auth ready）
- 实际上 Provider 在 StarMapLayout 中更合适（因为需要 userId），放在 `StarMapOuter` 中

**决定**：`UniverseProvider` 放在 `StarMapOuter` 内，在 `<AgentWorkflowProvider>` 外层包裹。

---

## Phase 3: 查询隔离 — 所有数据查询加 universe_id 过滤

### 3.1 `src/hooks/useNotes.ts`
- `useNotes(userId, universeId)` — 添加第二个参数
- 所有查询加 `.eq('universe_id', universeId)`
- Realtime filter 加 universe_id
- `saveNote` / `insertDerivedNode` 插入时带 `universe_id`

### 3.2 `src/components/starmap/KnowledgeStarMap.tsx`
- 接收 `universeId` prop
- `thought_edges` 查询加 `.eq('universe_id', universeId)`
- `node_positions` / `galaxy_positions` 查询加 `.eq('universe_id', universeId)`
- 所有 upsert（handleNodeMove, handleGalaxyMove）带 `universe_id`

### 3.3 `src/hooks/useRAG.ts`
- `search()` / `indexNote()` 传 `universe_id` 替代硬编码 `project_id: "default"`
- 从 UniverseContext 获取 activeUniverseId

### 3.4 `src/hooks/useAgentPipeline.ts`
- `run()` 参数增加 `universeId`
- `chunk-and-index` 调用传 `universe_id`
- `wiki-compile` 调用传 `universe_id`

### 3.5 `src/components/layout/StarMapLayout.tsx`
- `StarMapOuter` 包裹 UniverseProvider
- `useNotes(user.id, activeUniverseId)` — 传入当前宇宙 ID
- `KnowledgeStarMap` 接收 `universeId` prop

### 3.6 `src/lib/obsidian-importer.ts`
- line 346 的 `project_id: 'default'` 改为传入 `universe_id`

---

## Phase 4: Edge Functions 适配

### 4.1 `supabase/functions/chunk-and-index/index.ts`
- 接受 `universe_id` 参数（兼容旧的 `project_id`）
- 写入 `knowledge_chunks` 时同时写 `universe_id` 和 `project_id`（向后兼容）

### 4.2 `supabase/functions/rag-search/index.ts`
- 接受 `universe_id` 参数
- `knowledge_chunks` 查询加 `.eq('universe_id', universe_id)` 过滤
- `wiki_pages` 查询加 `.eq('universe_id', universe_id)` 过滤
- `rag_conversations` insert 带 `universe_id`

### 4.3 `supabase/functions/wiki-compile/index.ts`
- 接受 `universe_id` 参数
- `notes` 查询加 `.eq('universe_id', universe_id)`
- `wiki_pages` 查询加 `.eq('universe_id', universe_id)`
- 新建 wiki_page / mirror note 带 `universe_id`
- `chunk-and-index` 调用传 `universe_id`

---

## Phase 5: UI — 宇宙选择器 + 创建面板

### 5.1 `src/components/universe/UniverseSwitcher.tsx` (新建)
- 位置：左上角 HUD 区域，用户名下方
- 显示当前宇宙图标 + 名称（lucide 图标渲染）
- 点击展开浮层面板（绝对定位，半透明深色背景，`pointer-events: auto`）
- 面板内容：
  - 宇宙列表：图标 + 名称 + 节点数统计 + 当前宇宙高亮
  - 底部："+ 创建新宇宙" 按钮
- 切换时调用 `setActiveUniverseId(id)` → 触发所有数据重新加载

### 5.2 `src/components/universe/CreateUniversePanel.tsx` (新建)
- 单页表单，不做多步向导
- 字段：
  - 名称（必填，placeholder: "AI 研究"）
  - 描述（选填）
  - 主题色（6 色 radio：blue/purple/cyan/green/amber/rose）
  - 图标（8 个 lucide 图标选择：Sparkles/Globe/BookOpen/Brain/Rocket/Heart/Lightbulb/Compass）
- 创建后自动切换到新宇宙
- 套餐限制：如果 `universes.length >= maxByPlan`，禁用创建按钮，显示升级提示

### 5.3 `src/components/layout/StarMapLayout.tsx` 修改
- 顶部 HUD 区域插入 `<UniverseSwitcher />`
- 位于用户名和节点统计之间

### 5.4 切换动画
- 切换宇宙时，星图容器 opacity 0 + scale 0.97（300ms）→ 数据切换 → 淡入 opacity 1 + scale 1（400ms）
- 在 `KnowledgeStarMap` 中通过 `universeId` 变化检测触发

---

## Phase 6: 套餐限制

### 6.1 限制规则（硬编码常量，不用 admin_settings）
```ts
const UNIVERSE_LIMITS: Record<string, number> = {
  free: 1,
  pro: 5,
  team: 20,
};
```

### 6.2 创建时检查
- `CreateUniversePanel` 读取 `useBilling(userId).plan` + `useUniverses(userId).universes.length`
- 达到上限 → 按钮 disabled + "升级以创建更多宇宙" 提示
- Free 用户只能看到默认宇宙，切换器仍显示但创建按钮带锁

---

## 关键文件清单

| 操作 | 文件路径 |
|------|---------|
| 新建 | `src/contexts/UniverseContext.tsx` |
| 新建 | `src/hooks/useUniverses.ts` |
| 新建 | `src/components/universe/UniverseSwitcher.tsx` |
| 新建 | `src/components/universe/CreateUniversePanel.tsx` |
| 修改 | `src/hooks/useNotes.ts` — 加 universeId 参数 |
| 修改 | `src/hooks/useRAG.ts` — universe_id 替代 project_id |
| 修改 | `src/hooks/useAgentPipeline.ts` — 传 universe_id |
| 修改 | `src/components/layout/StarMapLayout.tsx` — UniverseProvider + 传 universeId |
| 修改 | `src/components/starmap/KnowledgeStarMap.tsx` — universe_id 过滤 |
| 修改 | `src/lib/obsidian-importer.ts` — universe_id |
| 部署 | `supabase/functions/chunk-and-index/index.ts` |
| 部署 | `supabase/functions/rag-search/index.ts` |
| 部署 | `supabase/functions/wiki-compile/index.ts` |

---

## 验证方案

1. **老用户零影响**：登录 → 自动使用默认宇宙 → 所有数据完好，体验无变化
2. **创建新宇宙**：点击创建 → 输入名称 → 成功后自动跳转 → 空白星图
3. **数据隔离**：新宇宙中创建节点 → 切回默认宇宙 → 新节点不可见
4. **RAG 隔离**：在新宇宙中搜索 → 只返回该宇宙的 chunks
5. **Wiki 隔离**：wiki-compile 只编译当前宇宙的笔记
6. **位置隔离**：各宇宙的手动布局独立保存
7. **套餐限制**：Free 用户创建第 2 个宇宙 → 显示升级提示
8. **持久化**：刷新页面 → localStorage 恢复上次使用的宇宙
