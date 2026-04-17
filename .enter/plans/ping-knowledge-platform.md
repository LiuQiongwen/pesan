# Obsidian 增量同步 — 实施方案

## Context

现有 `obsidian-importer.ts` 已具备基础增量能力：  
- `content_hash` (cyrb53) 存于 `notes.content_hash`  
- `obsidian_path` 存于 `notes.obsidian_path`（唯一索引 `idx_notes_obsidian_path`）  
- Dedup 阶段按 path 查旧记录、按 hash 判断是否跳过或更新  

**缺失能力**：  
1. **删除检测**：zip 中不存在但 DB 仍存在的旧笔记未处理  
2. **旧 chunks 清理**：更新笔记时旧 `knowledge_chunks` 未删  
3. **旧 edges 清理**：更新笔记时旧 `thought_edges` (wikilink) 未删  
4. **重命名处理**：path 变化但 hash 相同的文件被当作 delete+insert  
5. **同步结果统计**：缺少 deleted / renamed 计数  
6. **UI 同步模式**：Modal 无法区分首次导入和重新同步  
7. **RAG re-index 时旧 chunks 残留**：chunk-and-index 不会先删旧数据  

## 实施方案（单一推荐路径）

### Step 1: DB Migration

添加 `obsidian_imports` 新列以支持增量统计：

```sql
ALTER TABLE obsidian_imports
  ADD COLUMN IF NOT EXISTS updated integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deleted integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS renamed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_sync  boolean NOT NULL DEFAULT false;
```

无需新表。现有 `notes.content_hash` + `notes.obsidian_path` 已足够。

### Step 2: 修改 `obsidian-importer.ts` — 增量同步核心

在 Phase 3 (Dedup) 中新增三类检测：

**A. 删除检测**  
```
existingPaths = Set(所有 obsidian_path from existing notes)
parsedPaths   = Set(所有 parsed note paths)
deletedPaths  = existingPaths - parsedPaths
```
对 `deletedPaths` 中的每条：
1. 从 `thought_edges` 删除 source_id 或 target_id = noteId 且 edge_type='wikilink' 的边
2. 从 `knowledge_chunks` 删除 note_id = noteId 的 chunks
3. 将 `notes` 软删除：设置 `node_type = 'obsidian_deleted'`，或直接 hard delete（MVP 选 hard delete）

**B. 重命名检测**  
在 delete 候选中，按 hash 反查 insert 候选：
```
for each deleted note (path_old, hash_old):
  find insert candidate where hash === hash_old
  if found:
    → UPDATE notes SET obsidian_path = path_new WHERE id = old_note_id
    → move from toInsert/toDelete to toRename
```
这样 rename 不触发 re-index、不丢 noteId。

**C. 修改笔记清理旧数据**  
在 Phase 4 (Update) 中，每条 toUpdate 的笔记：
1. 先 DELETE FROM knowledge_chunks WHERE note_id = noteId
2. 先 DELETE FROM thought_edges WHERE (source_id = noteId OR target_id = noteId) AND edge_type = 'wikilink'
3. 然后更新 notes 行
4. 在 Phase 5 重新 chunk-and-index
5. 在 Phase 6 重新建 wikilink edges

### Step 3: 更新 ImportResult 和 ImportProgress 类型

```typescript
export interface ImportResult {
  importId: string;
  imported: number;   // new files
  updated: number;    // changed files
  skipped: number;    // unchanged files
  deleted: number;    // removed files
  renamed: number;    // path changed, content same
  edgesCreated: number;
  totalFiles: number; // in zip
}

export type ImportPhase = 'unzip' | 'parse' | 'diff' | 'delete' | 'insert' | 'update' | 'index' | 'edges' | 'done' | 'error';
```

### Step 4: 更新 `ObsidianImportModal.tsx` — 同步模式

**Preview step** 中新增检测逻辑：  
- 如果用户已有 obsidian notes，自动切换为"Re-sync"模式  
- 预览面板显示 diff 统计：`+12 new · ~5 changed · -3 deleted · ↻1 renamed · =80 unchanged`  

**Done step** 中扩展结果展示：  
- 6 格 grid：imported / updated / skipped / deleted / renamed / edges

### Step 5: 更新 `useObsidianImport.ts`

新增 `syncMode: boolean` 属性，由 Modal 在 preview 阶段判断是否已有 obsidian notes。

---

## 文件修改清单

| File | Change |
|------|--------|
| `supabase/migrations/...` | ALTER obsidian_imports 增加 updated/deleted/renamed/is_sync 列 |
| `src/lib/obsidian-importer.ts` | Phase 3 增加 delete/rename 检测；Phase 4 增加旧 chunks/edges 清理；更新类型；更新统计 |
| `src/lib/obsidian-parser.ts` | 无修改 |
| `src/hooks/useObsidianImport.ts` | 返回 syncMode 检测结果 |
| `src/components/obsidian/ObsidianImportModal.tsx` | Preview 显示 diff 统计；Done 显示 6 格结果；header 区分 Import/Re-sync |

## 详细实施 — obsidian-importer.ts 改写

完整 Phase 3 (Diff) 重写：

```typescript
// Phase 3: Diff
onProgress({ phase: 'diff', current: 0, total: parsed.length });

const { data: existing } = await supabase
  .from('notes')
  .select('id, obsidian_path, content_hash')
  .eq('user_id', userId)
  .eq('node_type', 'obsidian');

const existingMap = new Map<string, { id: string; hash: string | null }>();
const hashToExisting = new Map<string, { id: string; path: string }>();
for (const row of existing || []) {
  if (row.obsidian_path) {
    existingMap.set(row.obsidian_path, { id: row.id, hash: row.content_hash });
    if (row.content_hash) {
      hashToExisting.set(row.content_hash, { id: row.id, path: row.obsidian_path });
    }
  }
}

const parsedPathSet = new Set(parsed.map(n => n.path));

const toInsert: ParsedNote[] = [];
const toUpdate: { noteId: string; note: ParsedNote }[] = [];
const toDelete: { noteId: string; path: string }[] = [];
const toRename: { noteId: string; oldPath: string; newPath: string }[] = [];
let skipped = 0;

// Classify parsed notes
for (const note of parsed) {
  const ex = existingMap.get(note.path);
  if (ex) {
    if (ex.hash === note.contentHash) {
      skipped++;
    } else {
      toUpdate.push({ noteId: ex.id, note });
    }
  } else {
    toInsert.push(note);
  }
}

// Detect deletes: in DB but not in zip
for (const [path, ex] of existingMap) {
  if (!parsedPathSet.has(path)) {
    toDelete.push({ noteId: ex.id, path });
  }
}

// Detect renames: delete candidate whose hash matches an insert candidate
const insertByHash = new Map<string, ParsedNote>();
for (const n of toInsert) insertByHash.set(n.contentHash, n);

for (let i = toDelete.length - 1; i >= 0; i--) {
  const del = toDelete[i];
  const oldHash = existingMap.get(del.path)?.hash;
  if (oldHash && insertByHash.has(oldHash)) {
    const newNote = insertByHash.get(oldHash)!;
    toRename.push({ noteId: del.noteId, oldPath: del.path, newPath: newNote.path });
    // Remove from insert and delete lists
    toInsert.splice(toInsert.indexOf(newNote), 1);
    insertByHash.delete(oldHash);
    toDelete.splice(i, 1);
  }
}
```

Phase "delete":
```typescript
// Phase: Delete
onProgress({ phase: 'delete', current: 0, total: toDelete.length });
for (let i = 0; i < toDelete.length; i++) {
  const { noteId } = toDelete[i];
  await supabase.from('thought_edges').delete()
    .or(`source_id.eq.${noteId},target_id.eq.${noteId}`)
    .eq('edge_type', 'wikilink');
  await supabase.from('knowledge_chunks').delete().eq('note_id', noteId);
  await supabase.from('notes').delete().eq('id', noteId);
  onProgress({ phase: 'delete', current: i + 1, total: toDelete.length });
}
```

Phase "rename":
```typescript
for (const { noteId, newPath } of toRename) {
  const newFileName = newPath.split('/').pop()?.replace(/\.md$/i, '') ?? '';
  const parts = newPath.split('/');
  const newFolderTag = parts.length > 1 ? `folder:${parts[0]}` : '';
  await supabase.from('notes').update({
    obsidian_path: newPath,
    title: newFileName, // update title to new file name
  }).eq('id', noteId);
}
```

Phase "update" — clean before write:
```typescript
for (const { noteId, note } of toUpdate) {
  // Clean old chunks and wikilink edges
  await supabase.from('knowledge_chunks').delete().eq('note_id', noteId);
  await supabase.from('thought_edges').delete()
    .or(`source_id.eq.${noteId},target_id.eq.${noteId}`)
    .eq('edge_type', 'wikilink');
  // Update note fields
  await supabase.from('notes').update({ ... }).eq('id', noteId);
}
```

## UI Preview Diff

在 scanZip 完成后、用户点击 Start 前，查询已有 obsidian notes 数量：
```typescript
const { count } = await supabase
  .from('notes')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', userId)
  .eq('node_type', 'obsidian');

const isSyncMode = (count ?? 0) > 0;
```

如果 isSyncMode，Preview 面板：
- Header: "Re-sync Obsidian Vault"
- 显示: "Found {count} existing notes. Will detect changes."
- Button: "Start Sync" instead of "Start Import"

## Done 面板 6 格 Grid

```
+{imported} new | ~{updated} changed | ={skipped} same
-{deleted} removed | ↻{renamed} renamed | ⚡{edges} edges
```

## Verification

1. **首次导入**：上传 zip → 正常导入 → 所有 notes 为 new
2. **无变化 re-sync**：上传相同 zip → 全部 skipped = N, imported/updated/deleted = 0
3. **修改文件**：改一个 .md 的内容 → updated = 1, 旧 chunks 被清理
4. **新增文件**：添加一个 .md → imported = 1
5. **删除文件**：移除一个 .md → deleted = 1, 对应 note + chunks + edges 被清理
6. **重命名**：改文件名不改内容 → renamed = 1, noteId 保留, path 更新
7. **RAG 验证**：修改后的笔记在 Retrieval pod 中能搜索到新内容
