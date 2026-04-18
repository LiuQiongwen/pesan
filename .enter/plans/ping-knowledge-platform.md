# Candidate Node Review Workbench (候选节点确认工作台)

## Context

Multiple input sources (OCR, AI Insight distillations, future import) produce candidate nodes that shouldn't enter the main star map directly. We need a **staging workbench** where users can review, edit, delete, merge, change type, and finally publish candidates into the star map + RAG pipeline. The design should feel like a "knowledge workstation", not a CRUD table.

## Architecture Decision

**Client-side staging via `candidate_nodes` DB table + a dedicated `StagingWorkbench` panel.**

- A new DB table `candidate_nodes` stores pre-publish nodes with `source` metadata (ocr, ai, import).
- The StagingWorkbench is a floating panel (consistent with existing WorkbenchPanel pattern) opened from CommandDock.
- OCR flow writes to `candidate_nodes` instead of directly to `notes`.
- Publishing moves selected candidates into `notes` + triggers `chunk-and-index` for RAG.

This avoids polluting the main `notes` table and gives users a clear review gate.

## Files to Modify / Create

### 1. DB Migration — `candidate_nodes` table
New table with columns: `id`, `user_id`, `universe_id`, `source` (ocr/ai/import), `candidate_type` (topic/keypoint/action), `title`, `summary`, `tags`, `raw_text`, `created_at`.

### 2. `src/hooks/useCandidateNodes.ts` (NEW)
- CRUD hook for `candidate_nodes`: fetch, insert batch, update, delete, delete all.
- Realtime subscription for instant updates.
- `publishCandidates(ids[])` — inserts into `notes` via `insertDerivedNode`, calls `chunk-and-index`, then deletes from `candidate_nodes`.
- `mergeCandidates(ids[])` — client-side merge: combines titles/summaries/tags into one new candidate, deletes originals.
- Reuses existing `useAnalysis.insertDerivedNode` for the publish step.

### 3. `src/components/staging/StagingWorkbench.tsx` (NEW)
Floating panel (same positioning pattern as `WorkbenchPanel`). Layout:

```
┌─ Header: "候选工作台 · N 待审" + badge + minimize/close ─────┐
│ Filter tabs: [全部] [OCR] [AI] [导入]  ·  [主题][要点][行动] │
├──────────────────────────────────────────────────────────────┤
│ Candidate cards grid (2-col flex-wrap, scrollable):         │
│  ┌──────────┐ ┌──────────┐                                   │
│  │ ☐ Topic  │ │ ☐ Keyp.  │  Each card:                      │
│  │ Title... │ │ Title... │  - checkbox for batch select      │
│  │ Summary  │ │ Summary  │  - type badge (editable dropdown) │
│  │ #tags    │ │ #tags    │  - inline title/summary edit      │
│  │ source   │ │ source   │  - source label (OCR/AI/Import)   │
│  └──────────┘ └──────────┘  - delete button                  │
├──────────────────────────────────────────────────────────────┤
│ Bottom bar:                                                   │
│  [全选/取消] count selected · [删除选中] [合并选中] [发布入图]│
└──────────────────────────────────────────────────────────────┘
```

Key interactions:
- **Edit**: Inline title/summary editing on each card.
- **Change type**: Click type badge → cycles through topic/keypoint/action.
- **Delete**: Per-card X button or batch delete.
- **Merge**: Select 2+ → "合并" button → creates one new candidate from combined content.
- **Publish**: Select → "发布入图" button → calls `publishCandidates` → nodes appear in star map + RAG.
- When count is 0, show empty state "暂无候选节点".
- Max visible: Show warning badge when > 10 candidates ("建议先审阅再添加更多").

### 4. `src/components/ocr/OcrCaptureModal.tsx` (MODIFY)
Change the "确认入图" flow: Instead of calling `insertDerivedNode` directly → call `useCandidateNodes.insertBatch` to push candidates into staging table. Phase 4 message changes to "已生成 N 个候选节点 → 前往工作台审阅".

### 5. `src/components/floating/CommandDock.tsx` (MODIFY)
Add a "Staging" button with badge count showing unreviewed candidate count. Uses a new `useCandidateCount` mini-hook or inline query.

### 6. `src/components/floating/MobileTabBar.tsx` (MODIFY)
Add staging entry point on mobile with badge.

## Detailed Implementation Steps

### Step 1: DB Migration
```sql
CREATE TABLE candidate_nodes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  universe_id   uuid NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
  source        text NOT NULL CHECK (source IN ('ocr','ai','import')),
  candidate_type text NOT NULL CHECK (candidate_type IN ('topic','keypoint','action')),
  title         text NOT NULL DEFAULT '',
  summary       text NOT NULL DEFAULT '',
  tags          text[] DEFAULT '{}',
  raw_text      text,
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE candidate_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own candidates" ON candidate_nodes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_candidate_nodes_user ON candidate_nodes(user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE "candidate_nodes";
```

### Step 2: `useCandidateNodes.ts` hook
Key functions:
- `candidates: CandidateNode[]` — live state with realtime
- `loading: boolean`
- `insertBatch(items[])` — batch insert into `candidate_nodes`
- `updateCandidate(id, updates)` — update title/summary/type/tags
- `deleteCandidate(id)` / `deleteBatch(ids[])`
- `mergeCandidates(ids[])` — combine into single new candidate, delete originals
- `publishCandidates(ids[])` — for each: `insertDerivedNode` into `notes` + `chunk-and-index` + delete from `candidate_nodes`

### Step 3: `StagingWorkbench.tsx` panel
- Same floating panel pattern as `WorkbenchPanel` (draggable header, glassmorphic).
- Source filter tabs + type filter tabs at top.
- Card grid with checkboxes, inline edit, type cycle, delete.
- Bottom action bar with batch operations.
- Badge warning when > 10 candidates.

### Step 4: Modify `OcrCaptureModal.tsx`
- Replace `insertDerivedNode` calls with `insertBatch` to `candidate_nodes`.
- Add "前往工作台" button in done phase.

### Step 5: Modify `CommandDock.tsx` + `MobileTabBar.tsx`
- Add staging button between existing pod buttons.
- Show unreviewed count badge (query `candidate_nodes` count).

### Step 6: Wire into `StarMapLayout.tsx`
- Import StagingWorkbench.
- Add `stagingOpen` state.
- Listen for `open-staging` CustomEvent to open the panel.
- Render StagingWorkbench when open.

## Critical Files Referenced
- `src/components/starmap/WorkbenchPanel.tsx` — reuse panel pattern (drag, glassmorphic, card layout)
- `src/hooks/useNotes.ts` — reuse `insertDerivedNode` for publish
- `src/components/ocr/OcrCaptureModal.tsx` — modify to write to staging
- `src/components/floating/CommandDock.tsx` — add staging button
- `src/components/layout/StarMapLayout.tsx` — render staging panel
- `src/types/index.ts` — NodeType mapping

## Verification
1. OCR flow: Upload image → OCR → candidates appear in `candidate_nodes` table (not in star map).
2. Open staging workbench → see candidates → edit title/summary → change type → publish.
3. Published nodes appear in star map and RAG search results.
4. Merge 2+ candidates → single combined candidate in staging.
5. Badge count updates in real-time on CommandDock.
6. Delete candidates → removed from staging, never reaches star map.
