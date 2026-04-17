# Obsidian Vault 导入 — MVP 实施方案

## Context

用户的"知识宇宙"产品已具备完整的 notes → cosmos-layout → 3D StarMap 渲染管线和 RAG 检索链路。现在需要接入 Obsidian，让用户把已有笔记库批量导入系统，复用现有的 notes 表、knowledge_chunks、thought_edges 和 RAG 搜索。

**核心约束：**
- MVP 只做 Obsidian → 系统的单向导入
- 不做双向写回、不做实时文件系统监听
- 浏览器无法读取本地文件夹 → 使用 **ZIP 压缩包上传** 作为唯一导入方式
- 解析全部在前端完成（JSZip），不消耗 Edge Function 额度
- RAG 索引复用现有 `chunk-and-index` Edge Function

---

## 1. 整体架构

```
用户浏览器                             后端 (Edge Functions)
┌──────────────────────────────┐      ┌──────────────────────────┐
│ ① 选择 .zip 文件             │      │                          │
│ ② JSZip 解压在内存中         │      │                          │
│ ③ 前端 Markdown 解析器       │      │                          │
│    ├─ frontmatter (yaml)     │      │                          │
│    ├─ wikilinks [[…]]        │      │                          │
│    ├─ tags #tag / yaml tags  │      │                          │
│    └─ 正文 markdown          │      │                          │
│ ④ 批量 supabase.insert       │─────▶│  notes / thought_edges   │
│ ⑤ 逐条调 chunk-and-index     │─────▶│  chunk-and-index (复用)  │
│ ⑥ 进度条 + 完成反馈          │      │                          │
└──────────────────────────────┘      └──────────────────────────┘
```

**关键决策：**
- 前端解析，避免大文件上传到 Edge Function 的体积限制 (2MB)
- JSZip 在浏览器内存中解压，逐个读 .md 文件
- 每个 .md → 一条 notes 行 (node_type = 'obsidian')
- wikilinks → thought_edges 行 (edge_type = 'wikilink')
- tags → notes.tags 数组字段
- RAG 索引复用 chunk-and-index，每条 note 触发一次

---

## 2. 数据映射

| Obsidian 概念 | 系统目标 | 字段映射 |
|---|---|---|
| .md 文件 | `notes` 行 | title=文件名/H1, content_markdown=正文, node_type='obsidian' |
| YAML frontmatter tags | `notes.tags` | 合并 frontmatter.tags + inline #tags |
| `[[Note A]]` wikilink | `thought_edges` | source_id=当前note, target_id=目标note, edge_type='wikilink' |
| 文件夹路径 | `notes.tags` | 顶层文件夹名作为额外 tag，如 `folder:Projects` |
| frontmatter | `notes.analysis_content` | 存入 `{ obsidian_frontmatter: {...} }` |
| 附件引用 ![[img.png]] | 暂不处理 | MVP 跳过，仅保留文本引用 |

---

## 3. 数据库变更

### 3.1 notes 表 — 新增 node_type 值

`node_type` 当前 CHECK 约束只有 `capture|summary|insight|action|question|relation`，需新增 `obsidian`：

```sql
-- 扩展 node_type 枚举
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_node_type_check;
ALTER TABLE notes ADD CONSTRAINT notes_node_type_check
  CHECK (node_type IN ('capture','summary','insight','action','question','relation','obsidian'));
```

### 3.2 新增 obsidian_imports 表 — 跟踪导入批次

```sql
CREATE TABLE obsidian_imports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  file_name   text NOT NULL,
  total_files integer NOT NULL DEFAULT 0,
  imported    integer NOT NULL DEFAULT 0,
  skipped     integer NOT NULL DEFAULT 0,
  status      text NOT NULL DEFAULT 'processing'
                CHECK (status IN ('processing','done','error')),
  error_msg   text,
  created_at  timestamptz DEFAULT now(),
  finished_at timestamptz
);
ALTER TABLE obsidian_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own imports" ON obsidian_imports FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### 3.3 notes 表新增可选列 — 追踪 obsidian 来源

```sql
ALTER TABLE notes ADD COLUMN IF NOT EXISTS obsidian_path text;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS obsidian_import_id uuid
  REFERENCES obsidian_imports(id) ON DELETE SET NULL;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS content_hash text;
```

- `obsidian_path`：原始文件路径（如 `Projects/AI/thoughts.md`），用于增量同步去重
- `obsidian_import_id`：归属哪次导入批次
- `content_hash`：MD5/SHA256 摘要，增量导入时跳过未变更文件

### 3.4 thought_edges — 已有 wikilink 支持

现有 `thought_edges.edge_type` CHECK: `supports|contradicts|extends|inspires|related`，需新增 `wikilink`：

```sql
ALTER TABLE thought_edges DROP CONSTRAINT IF EXISTS thought_edges_edge_type_check;
ALTER TABLE thought_edges ADD CONSTRAINT thought_edges_edge_type_check
  CHECK (edge_type IN ('supports','contradicts','extends','inspires','related','wikilink'));
```

---

## 4. 前端解析流程

### 4.1 新增依赖

- `jszip` — 浏览器端解压 ZIP
- `yaml` — 解析 YAML frontmatter（轻量，已被很多 markdown 工具依赖）

### 4.2 解析器模块：`src/lib/obsidian-parser.ts`

```typescript
interface ParsedNote {
  path: string;            // 'Projects/AI/thoughts.md'
  fileName: string;        // 'thoughts'
  title: string;           // frontmatter.title || 第一个 H1 || fileName
  content: string;         // 去除 frontmatter 后的 markdown 正文
  tags: string[];          // 合并 frontmatter.tags + inline #tags + folder tag
  wikilinks: string[];     // ['Note A', 'Note B'] — 原始链接文本
  frontmatter: Record<string, unknown>;
  contentHash: string;     // 用于增量去重
  folderTag: string;       // 'folder:Projects'
}
```

**解析步骤：**
1. 读取文件文本内容
2. 用正则 `^---\n([\s\S]*?)\n---` 提取 frontmatter，用 `yaml.parse()` 解析
3. 正则 `\[\[([^\]]+)\]\]` 提取所有 wikilinks
4. 正则 `(?:^|\s)#([a-zA-Z\u4e00-\u9fff][\w\u4e00-\u9fff/\-]*)` 提取 inline tags
5. 合并 frontmatter.tags + inline tags + folder tag → 去重
6. 标题优先级：frontmatter.title > 第一个 `# ` 行 > 文件名
7. 计算 contentHash = 简易字符串哈希（避免引入 crypto 依赖，用 cyrb53 或类似）
8. 跳过空文件（正文 < 10 字符）

### 4.3 导入器模块：`src/lib/obsidian-importer.ts`

```typescript
interface ImportProgress {
  phase: 'unzip' | 'parse' | 'insert' | 'index' | 'edges' | 'done';
  current: number;
  total: number;
  currentFile?: string;
}

async function importVault(
  zipFile: File,
  userId: string,
  onProgress: (p: ImportProgress) => void,
): Promise<ImportResult>
```

**执行链路：**
1. **解压** — JSZip 读取 zip，过滤出 .md 文件（跳过 .obsidian/ 目录、.trash/）
2. **解析** — 逐个文件调 parseNote()，收集 ParsedNote[]
3. **去重查询** — 查询该用户所有 `obsidian_path IS NOT NULL` 的 notes，按 path+hash 判断是否跳过
4. **批量插入 notes** — 每 20 条一批 supabase.from('notes').insert(batch)
5. **RAG 索引** — 对每条新 note 调 `chunk-and-index`（并行度限制为 3）
6. **建立 wikilink edges** — 解析完成后，用 path→noteId 映射表解析 wikilinks，insert thought_edges
7. **更新 obsidian_imports** — 标记完成

### 4.4 Wikilink 解析策略

- 建立 `fileNameToNoteId: Map<string, string>` 映射（key = 文件名去 .md，小写）
- 对每个 note 的 wikilinks，查找 `fileNameToNoteId.get(link.toLowerCase())`
- 找不到的跳过（目标文件可能未在 vault 中或被过滤）
- 支持 `[[folder/note]]` 格式 → 取最后一段作为文件名匹配

---

## 5. 前端 UI 设计

### 5.1 导入入口

在 SettingsCapsule 下拉菜单中新增 **"导入 Obsidian"** 按钮。点击打开全屏模态框。

**文件：** `src/components/obsidian/ObsidianImportModal.tsx`

### 5.2 导入模态框 — 三步流程

```
┌─────────────────────────────────────┐
│  ◈ 导入 Obsidian Vault              │
│                                     │
│  ┌─── Step 1: 选择文件 ────────┐    │
│  │  [拖拽或点击选择 .zip 文件]  │    │
│  │  支持 .zip 格式              │    │
│  └──────────────────────────────┘    │
│                                     │
│  ┌─── Step 2: 预览 ────────────┐    │
│  │  📄 检测到 47 个 .md 文件    │    │
│  │  📁 来自 5 个文件夹          │    │
│  │  🔗 检测到 123 个 wikilinks  │    │
│  │  🏷 检测到 28 个标签          │    │
│  │                              │    │
│  │  [ 开始导入 ]                │    │
│  └──────────────────────────────┘    │
│                                     │
│  ┌─── Step 3: 进度 ────────────┐    │
│  │  ████████░░░░  23/47         │    │
│  │  正在处理: Projects/AI/xxx   │    │
│  │  阶段: 写入节点 → RAG 索引   │    │
│  └──────────────────────────────┘    │
│                                     │
│  ┌─── 完成 ───────────────────┐     │
│  │  ✓ 导入完成                 │     │
│  │  新增 42 个节点 · 跳过 5 个  │     │
│  │  建立 98 条关系边            │     │
│  │  RAG 索引 42 条              │     │
│  │  [ 在星图中查看 ]            │     │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### 5.3 星图中的 Obsidian 节点

- `node_type = 'obsidian'` 在 CosmosScene 中使用独特图标颜色（如紫色菱形 `#a855f7`）
- NODE_TYPE_CFG 新增 obsidian 条目：`{ label: 'Obsidian', shape: 'diamond', color: '#a855f7', size: 1.0 }`
- 节点 hover 时 NodeLightBand 显示 `来源: Obsidian · folder/path`
- wikilink edges 在宇宙中渲染为浅紫色连线

### 5.4 导入历史

在 SettingsCapsule 中显示最近一次导入的状态（日期 + 节点数）。

---

## 6. 增量同步方案 (MVP-lite)

- 用户再次上传同一 vault 的 zip 时：
  1. 前端解析所有 .md 文件的 path + contentHash
  2. 查询 DB 中 `obsidian_path` 和 `content_hash` 匹配的 notes
  3. **path+hash 相同** → 跳过（未变更）
  4. **path 相同，hash 不同** → update notes 的 content/tags/frontmatter + 重新 chunk-and-index
  5. **path 不存在** → 新增
  6. **DB 中有但 zip 中无** → 不删除（保守策略，避免误删）
- 前端在"预览"步骤显示：`新增 12 · 更新 5 · 未变 30 · 不在本次导入 8`

---

## 7. 文件清单

### 新增文件

| 文件 | 职责 |
|---|---|
| `src/lib/obsidian-parser.ts` | Markdown 解析器（frontmatter/tags/wikilinks/hash） |
| `src/lib/obsidian-importer.ts` | 导入执行器（解压→解析→insert→index→edges） |
| `src/components/obsidian/ObsidianImportModal.tsx` | 导入模态框 UI（选文件→预览→进度→完成） |
| `src/hooks/useObsidianImport.ts` | 导入状态管理 hook |

### 修改文件

| 文件 | 变更内容 |
|---|---|
| `src/types/index.ts` | NodeType 增加 `'obsidian'` |
| `src/components/starmap/cosmos-layout.ts` | NODE_TYPE_CFG 增加 obsidian 条目 |
| `src/components/starmap/CosmosScene.tsx` | obsidian 节点的特殊形状/颜色渲染 |
| `src/components/floating/SettingsCapsule.tsx` | 菜单新增"导入 Obsidian"入口 |
| `src/hooks/useNotes.ts` | normalizeNote 兼容 obsidian node_type |

### 数据库迁移

- 扩展 `notes.node_type` CHECK 约束
- 新建 `obsidian_imports` 表
- notes 新增 `obsidian_path`, `obsidian_import_id`, `content_hash` 列
- 扩展 `thought_edges.edge_type` CHECK 约束

### 新增依赖

- `jszip` — ZIP 解压
- `yaml` — YAML frontmatter 解析

---

## 8. MVP 优先级

### 第一阶段（本次实施）
1. DB 迁移（表结构 + 约束）
2. `obsidian-parser.ts`（纯函数，可单测）
3. `obsidian-importer.ts`（导入链路）
4. `ObsidianImportModal.tsx`（UI 三步流程）
5. SettingsCapsule 入口
6. CosmosScene obsidian 节点样式
7. wikilink → thought_edges 映射

### 延后
- 增量同步的"更新已变更文件"逻辑 → 第二阶段
- 附件/图片导入 → 需 Storage bucket，延后
- 双向写回 → 不做
- Obsidian 插件（API 同步） → 远期
- 导入历史管理 / 批量删除 → 延后

---

## 9. 验证方式

1. 准备一个小型 Obsidian vault（10+ .md 文件，含 frontmatter、wikilinks、tags、文件夹结构）
2. 压缩为 .zip
3. 在 /app 页面 → 设置菜单 → 导入 Obsidian → 选择 zip
4. 验证预览统计正确（文件数、tag 数、link 数）
5. 点击导入 → 进度条正常推进
6. 完成后 → 星图中出现紫色 obsidian 节点
7. wikilink 连线正确渲染
8. RAG 搜索能命中 obsidian 导入的内容
9. 再次导入同一 zip → 全部显示"跳过"
