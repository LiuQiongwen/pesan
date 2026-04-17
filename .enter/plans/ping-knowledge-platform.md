# Obsidian 双向同步 / MCP 扩展路线图

## Context

当前已完成 Obsidian → 系统的单向导入 MVP（zip 上传 → 解析 → 入库 → RAG → 星图）和增量同步（content_hash diff → 新增/修改/删除/重命名）。本文档规划后续双向同步与 MCP 扩展路径，**不纳入当前开发范围**。

---

## 1. 总体目标

建立 Obsidian ↔ 知识宇宙之间**安全、渐进、可控**的双向通道：

- **读取方向**（已完成）：Obsidian .md → notes / chunks / edges / RAG
- **写回方向**（后续）：系统派生内容 → Obsidian 指定文件夹，**只新增不覆盖**
- **MCP 方向**（远期）：Agent 通过受控工具接口，在权限范围内读写 Vault 子集

---

## 2. 哪些内容适合双向同步，哪些不适合

### 适合从 Obsidian → 系统（已实现）

| 内容 | 映射 |
|------|------|
| .md 正文 | notes.content_markdown |
| YAML frontmatter | notes.analysis_content.frontmatter |
| inline tags / frontmatter tags | notes.tags |
| `[[wikilinks]]` | thought_edges (edge_type='wikilink') |
| 文件夹路径 | notes.obsidian_path → 星系分组依据 |
| 文件名 / H1 标题 | notes.title |

### 适合从系统 → Obsidian（Phase 3+）

| 内容 | 写回形式 | 安全等级 |
|------|---------|---------|
| AI 摘要 | `_cosmos/summaries/{title}.md` 新文件 | 低风险 |
| Insight 洞见 | `_cosmos/insights/{title}.md` 新文件 | 低风险 |
| Action 任务清单 | `_cosmos/actions/{date}.md` 新文件 | 低风险 |
| 关系映射报告 | `_cosmos/relations/{title}.md` 新文件 | 低风险 |
| 双向链接建议 | `_cosmos/suggestions.md` 追加式 | 中等风险 |
| Cognitive Mirror 报告 | `_cosmos/mirror/{date}.md` 新文件 | 低风险 |

**核心原则：所有写回只生成新文件到 `_cosmos/` 子目录，绝不修改用户原始笔记。**

### 不适合双向同步

| 内容 | 原因 |
|------|------|
| 覆盖用户原始 .md 文件 | 破坏用户知识主权 |
| 修改用户 frontmatter | 可能破坏 Obsidian 模板/Dataview 查询 |
| 删除用户文件 | 不可逆，绝对禁止 |
| 星图 3D 位置信息 | 纯前端状态，无法用 .md 表达 |
| RAG chunks / embeddings | 系统内部数据结构 |

---

## 3. 写回 Obsidian 的安全策略

### 隔离写入目录

```
Vault/
├── _cosmos/                    ← 系统写回的唯一目标
│   ├── summaries/
│   ├── insights/
│   ├── actions/
│   ├── relations/
│   ├── suggestions.md
│   └── .cosmos-manifest.json   ← 写回记录清单
├── Daily Notes/                ← 用户原始，禁止触碰
├── Projects/                   ← 用户原始，禁止触碰
└── ...
```

### 写回文件格式

```yaml
---
source: cosmos-knowledge-universe
generated_at: 2026-04-17T12:00:00Z
source_notes:
  - "[[原始笔记A]]"
  - "[[原始笔记B]]"
type: insight
---

# 洞见标题

正文内容（Markdown）

---
*此文件由知识宇宙系统自动生成，不建议手动编辑。*
```

### 冲突策略

| 场景 | 处理 |
|------|------|
| 系统生成文件被用户编辑 | 下次写回时跳过该文件（检测 content_hash 变化） |
| 同名文件已存在 | 追加 `-v2` / `-v3` 后缀，不覆盖 |
| 用户删除 `_cosmos/` 目录 | 下次同步时重新生成全部派生内容 |
| 原始笔记被修改 | 增量同步已处理（Phase 2，已实现） |
| 原始笔记被删除 | 增量同步已处理（清理 notes + chunks + edges） |

---

## 4. MCP 接入思路

### 架构

```
┌──────────────────┐      ┌─────────────────────┐     ┌──────────────┐
│  知识宇宙 Web App │ ←──→ │  Edge Function (API) │ ──→ │  MCP Gateway │
│  (前端)           │      │  (Supabase)          │     │  (本地进程)   │
└──────────────────┘      └─────────────────────┘     └──────┬───────┘
                                                             │
                                                     ┌──────▼───────┐
                                                     │ Obsidian Vault│
                                                     │ (本地文件系统) │
                                                     └──────────────┘
```

### MCP 工具定义（受控）

```typescript
// 读取类（低风险）
vault.list_files({ folder?: string })       // 列出 .md 文件路径
vault.read_file({ path: string })           // 读取单个文件
vault.search({ query: string, limit: 10 })  // 全文搜索

// 写入类（中风险，仅限 _cosmos/ 目录）
vault.write_file({ path: string, content: string })  // path 必须以 _cosmos/ 开头
vault.append_file({ path: string, content: string }) // 追加内容

// 禁止类
vault.delete_file  // 不提供
vault.rename_file  // 不提供（Phase 4+ 再考虑）
vault.modify_file  // 不提供（不允许修改已有文件）
```

### 权限控制

| 层级 | 机制 |
|------|------|
| 目录范围 | MCP Gateway 硬编码只允许读全 Vault，写只限 `_cosmos/` |
| 文件类型 | 只处理 `.md` 文件，忽略 `.obsidian/` / `.git/` |
| 速率限制 | 单次 Agent 调用最多读 50 文件、写 20 文件 |
| 审批流 | Phase 3 写回需用户在前端确认；Phase 4 MCP 写入记录到审计日志 |
| 内容校验 | 写入前检查：不包含 JS/HTML 注入、文件大小 < 100KB |

### MCP Gateway 实现选择

| 方案 | 优点 | 缺点 |
|------|------|------|
| **Obsidian 社区插件** | 用户最熟悉，生态内 | 需要开发插件，审核周期长 |
| **本地 MCP Bridge 进程** | 不依赖 Obsidian 运行 | 需要用户安装额外软件 |
| **Obsidian Local REST API 插件** | 已有成熟插件 | 功能受限于该插件 API |

**推荐：Phase 3 先用本地 MCP Bridge CLI（Electron 或 Node.js 小进程），Phase 4 开发 Obsidian 原生插件。**

---

## 5. 分阶段演进路线

### Phase 1 — 单向导入 MVP ✅（已完成）

- zip 上传 → 解析 frontmatter/tags/wikilinks
- 写入 notes / knowledge_chunks / thought_edges
- 接入星图（obsidian 紫色节点）+ RAG（chunk-and-index）
- 导入 Modal 四步流程

### Phase 2 — 增量同步 ✅（已完成）

- content_hash diff 检测变化
- 新增/修改/删除/重命名四种处理
- 阶段时间线 UI + 同步统计
- 上次同步记录

### Phase 3 — 有限写回（导出下载）

**不需要本地进程**，系统生成 zip 供用户手动放入 Vault：

- 系统生成 `_cosmos/` 目录结构的 zip 文件
- 用户下载后手动解压到 Vault 根目录
- 每份写回文件包含 frontmatter 溯源信息
- 前端新增"导出派生内容"按钮

**需要改动的文件：**
- `src/lib/obsidian-exporter.ts` — 新建，生成 zip
- `src/components/obsidian/ObsidianExportModal.tsx` — 新建，导出 UI
- `SettingsCapsule.tsx` — 添加导出入口

**写回内容来源 → 目标映射：**
```
distillations (key_insight)     → _cosmos/insights/{title}.md
distillations (facts/methods)   → _cosmos/summaries/{note_title}.md
actions (content + status)      → _cosmos/actions/{date}.md
cognitive_reports               → _cosmos/mirror/{date}.md
thought_edges (high confidence) → _cosmos/relations/map.md
```

### Phase 4 — MCP 驱动双向工作流

- 开发本地 MCP Bridge CLI（Node.js/Electron）
- Agent 可通过 MCP 读取最新 Vault 文件（替代 zip 上传）
- Agent 可通过 MCP 写入 `_cosmos/` 子目录（替代 zip 下载）
- 前端 Agent 工作流中增加 "Obsidian" 工具节点
- 用户审批界面：Agent 写回请求 → 用户确认/拒绝 → 执行

**架构要点：**
- MCP Bridge 以 WebSocket 连接 Edge Function
- 心跳检测 Bridge 在线状态
- 前端显示 "Vault Connected" 状态指示器
- Agent Pipeline (`useAgentPipeline.ts`) 新增 MCP 工具调用步骤

---

## 6. 当前阶段不要做什么

| 不要做 | 原因 |
|--------|------|
| 修改用户原始 .md 文件 | 破坏用户知识主权，信任成本极高 |
| 实时文件监听 (fswatch) | 复杂度高，需要常驻进程，MVP 阶段无必要 |
| Obsidian 插件开发 | 开发/审核周期长，Phase 3 的 zip 方案更快落地 |
| Agent 无限制读写 Vault | 安全风险过高，必须先建立审批流 |
| 双向冲突合并 | 通过"只新增不覆盖"策略完全回避冲突 |
| 实时推送 Vault 变化到前端 | 需要 WebSocket + 本地进程，Phase 4 再考虑 |

---

## 7. 最推荐的长期架构方向

```
             ┌─────────────────────────────────────────┐
             │         用户的 Obsidian Vault            │
             │  (知识主权: 用户完全控制)                 │
             └───────────┬──────────────┬──────────────┘
                         │ 读取          │ 写入(仅 _cosmos/)
                    ┌────▼────┐    ┌────▼────┐
                    │ ZIP 上传 │    │ ZIP 下载 │  ← Phase 1-3
                    │ MCP Read│    │ MCP Write│  ← Phase 4
                    └────┬────┘    └────┬────┘
                         │              │
             ┌───────────▼──────────────▼──────────────┐
             │           知识宇宙系统                    │
             │                                          │
             │  ┌──────────┐ ┌─────────┐ ┌──────────┐ │
             │  │ Importer │ │ Exporter│ │ Agent MCP│ │
             │  │ (解析层)  │ │ (写回层) │ │ (工具层)  │ │
             │  └────┬─────┘ └────┬────┘ └────┬─────┘ │
             │       │            │            │       │
             │  ┌────▼────────────▼────────────▼────┐  │
             │  │    统一数据层 (notes / chunks /     │  │
             │  │    edges / distillations / actions) │  │
             │  └────────────────┬──────────────────┘  │
             │                   │                      │
             │  ┌────────────────▼──────────────────┐  │
             │  │  星图 / RAG / Insight / Memory      │  │
             │  └───────────────────────────────────┘  │
             └─────────────────────────────────────────┘
```

**核心原则：**
1. **知识主权归用户** — 系统永远不修改用户原始文件
2. **渐进式开放** — 先只读，再受限写，最后 Agent 写
3. **隔离写入** — 所有写回内容只进 `_cosmos/` 目录
4. **可审计** — 每次写回记录 manifest，用户可追溯
5. **可回退** — 删除 `_cosmos/` 即可清除所有系统写回内容

---

## 验证方式

本文档为架构规划，不涉及代码改动。验证标准：
- Phase 3 实施时，检查写回 zip 是否只包含 `_cosmos/` 路径下的文件
- Phase 4 实施时，检查 MCP Gateway 是否硬编码写入路径限制
- 任何阶段都不应出现修改用户原始 .md 文件的代码路径
