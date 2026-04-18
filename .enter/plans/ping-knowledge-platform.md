# 交互提示系统增量实现计划

## Context

项目已有完整的 hint 基础设施（`useHintState` / `ContextToast` / `InteractionHints` / `PodWelcomeHint`），覆盖了 8 条提示中的 5 条。本计划补齐剩余 3 条 + 增强 1 条。

## 已实现清单 (无需改动)

| ID | 组件 | 触发方式 |
|---|---|---|
| `first_create_star` | ContextToast | noteCount 0→1+ |
| `first_click_node` | ContextToast | tour-node-opened event |
| `drag_to_pod` | ContextToast | handleNodeDropToPod 回调 |
| `action_feedback` | ContextToast | 各处动作完成时 |
| `connect_mode` | ContextToast | connectMode 切换 |

---

## 需要新增/增强的 3 个提示

### 1. `first_move_universe` — 首次拖拽星图反馈

**触发**: 用户首次拖拽旋转 3D 星图（`tour-camera-moved` event，但仅新用户首次触发）
**反馈**: ContextToast「视角已旋转 — 滚轮缩放，双指平移」
**文件**: `src/components/layout/StarMapLayout.tsx`
**逻辑**: 
- 监听 `tour-camera-moved` CustomEvent
- `hints.shouldShow('first-move')` → show toast → `hints.dismiss('first-move')`

### 2. `retrieval_scope` — RAG 检索范围标注

**位置**: RetrievalBox 搜索框上方
**展示**: `检索范围: {宇宙名} · {N} 篇笔记 · {M} 个知识片段`
**文件**: 
- `supabase/functions/rag-search/index.ts` — 返回 `scope_meta`
- `src/hooks/useRAG.ts` — 传递 scope_meta
- `src/components/pods/RetrievalBox.tsx` — 渲染 scope bar + 无依据增强

**Edge Function 改动**:
```
// 在 rag-search 中新增 scope 查询
const { count: noteCount } = await db.from('notes').select('*', { count: 'exact', head: true }).eq('user_id', user_id).eq('universe_id', uniId);
const { count: chunkCount } = await db.from('knowledge_chunks').select('*', { count: 'exact', head: true }).eq('user_id', user_id).eq('universe_id', uniId);
const { data: uni } = await db.from('universes').select('name').eq('id', uniId).maybeSingle();
// 返回 scope_meta: { note_count, chunk_count, universe_name }
```

**RetrievalBox 改动**:
- 搜索框上方加 ScopeBar 行
- 回答底部加: `仅基于你的 {N} 篇笔记生成`
- 无结果时: `知识库中未找到相关依据 · 导入更多资料后答案会更新`+ 打开 Capture 舱 CTA

### 3. `trace_source` — 引用回溯反馈

**触发**: 点击 RetrievalBox 中引用卡片的"飞到星图"按钮
**反馈**: ContextToast「已在星图中高亮 "{note_title}"」
**文件**: `src/components/pods/RetrievalBox.tsx`
**逻辑**: 点击 Star 按钮后 → dispatch `hint-trace-source` CustomEvent with note_title → StarMapLayout 监听并 show toast

### 4. `workbench_empty` 增强

**位置**: 工作台面板空状态
**文件**: `src/components/starmap/WorkbenchPanel.tsx`
**逻辑**: 当工作台 notes 为空时，显示引导文案: `拖拽星球到此处，或右键节点「加入工作台」`

---

## 修改文件清单

| 文件 | 变更类型 | 改动 |
|---|---|---|
| `supabase/functions/rag-search/index.ts` | 增强 | 返回 scope_meta |
| `src/hooks/useRAG.ts` | 增强 | 传递 scope_meta 到 RAGConversation |
| `src/components/pods/RetrievalBox.tsx` | 增强 | ScopeBar + 无依据增强 + trace_source event |
| `src/components/layout/StarMapLayout.tsx` | 增强 | first_move + trace_source toast 监听 |
| `src/components/starmap/WorkbenchPanel.tsx` | 增强 | 空状态引导文案 |

---

## 实现顺序

1. **rag-search + useRAG** — 返回 scope_meta
2. **RetrievalBox** — ScopeBar + 三层结构增强 + trace event
3. **StarMapLayout** — first_move + trace_source toast
4. **WorkbenchPanel** — 空状态引导

---

## 验证

1. 新用户首次拖拽星图 → 看到「视角已旋转」toast，再次拖拽不显示
2. 打开 Retrieval 舱 → 搜索框上方显示检索范围
3. 提问后 → 回答底部显示「仅基于你的 N 篇笔记生成」
4. 点击引用"飞到星图" → toast「已在星图中高亮 "标题"」
5. 问无依据问题 → 显示「未找到依据」+ CTA
6. 工作台为空 → 显示引导文案
