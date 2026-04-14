# Personal Cloud RAG — Implementation Plan

## Context
Implementing the RAG (Retrieval-Augmented Generation) layer as the central nervous system of Pesan.
Every existing feature (Memory Wake, Distiller, Perspective Switch, etc.) benefits from a shared
retrieval engine that operates over the user's private knowledge corpus.

## Technical Approach: FTS + Claude Reranking (no external embeddings API needed)
- PostgreSQL full-text search (`tsvector`) handles initial candidate retrieval (top-20)
- Claude acts as a semantic reranker: selects best 5 from candidates + writes cited answer
- Reliable, fast, zero external embedding API dependency
- Fully upgradeable to pgvector later

## What Gets Built

### 1. DB Migration
Two new tables:

**`knowledge_chunks`** — chunked, indexed content from all notes
```sql
id UUID PK, user_id UUID FK, project_id TEXT DEFAULT 'default',
note_id UUID FK→notes, chunk_index INT,
content TEXT, source_title TEXT, source_type TEXT,
search_vector TSVECTOR (generated from content),
metadata JSONB, created_at TIMESTAMPTZ
```
- RLS: user_id = auth.uid()
- GIN index on search_vector
- B-tree index on (user_id, note_id)

**`rag_conversations`** — persisted RAG Q&A with citations
```sql
id UUID PK, user_id UUID FK, project_id TEXT DEFAULT 'default',
query TEXT, answer TEXT, citations JSONB DEFAULT '[]', created_at TIMESTAMPTZ
```
- RLS: user_id = auth.uid()
- citations format: [{id, chunk_id, note_id, note_title, excerpt, score}]

### 2. Edge Function: `chunk-and-index`
**Input:** `{ note_id, user_id, content, title, source_type }`
**Logic:**
- Delete existing chunks for this note_id (idempotent re-index)
- Split content into ~400-char chunks at sentence boundaries (". " / "。" / "\n\n")
- 50-char overlap between adjacent chunks for context continuity
- Insert all chunks into `knowledge_chunks` via supabase-js in edge function
- No AI call needed — pure text processing
**Output:** `{ success: true, chunks_created: N }`

### 3. Edge Function: `rag-search`
**Input:** `{ query, user_id, project_id?, top_k? }`
**Logic:**
1. FTS query: `SELECT ... WHERE search_vector @@ plainto_tsquery('simple', $query) AND user_id=$uid ORDER BY ts_rank DESC LIMIT 20`
2. Also fetch 5 most recent chunks as fallback if FTS returns < 5 results
3. Pass top-20 candidates to Claude with the user query
4. Claude selects best 3-5, writes a grounded answer with inline `[1]` `[2]` citation markers
5. Return answer + citations array + save to `rag_conversations`
**max_tokens:** 800 (kept small to avoid buffer overflow)

### 4. Hook: `useRAG.ts`
```ts
interface RagResult {
  answer: string;
  citations: Citation[];
  conversation_id: string;
}
interface Citation {
  id: number;
  chunk_id: string;
  note_id: string;
  note_title: string;
  excerpt: string;
}
useRAG() → { search(query): Promise<RagResult>, history: RagConversation[], loading, error }
```
- Calls `rag-search` edge function
- Loads history from `rag_conversations` table

### 5. Page: `src/pages/RAGSearch.tsx`
Route: `/search`
Layout: Dark, full-height, matches existing product aesthetic (same #040508 bg, neon green accent)

**UI sections:**
- Header: "KNOWLEDGE SEARCH" title + subtitle
- Search bar: large input, `Cmd+K` shortcut hint, search button
- Loading: "Searching your knowledge corpus…" with animated dots
- Answer panel: rendered markdown answer with `[1]` citation superscripts as styled chips
- Citations panel: horizontal scroll of citation cards (note title + excerpt + "Open Note" link)
- History: recent queries listed below (last 5 conversations)
- Empty state: shows re-index button if `knowledge_chunks` count = 0

**Citation card design:**
```
┌──────────────────────────────────────┐
│ [1] Note Title                 ↗     │
│ "Relevant excerpt from the chunk…"   │
│ tag1  tag2                           │
└──────────────────────────────────────┘
```

### 6. Integration: Analyze.tsx
After `saveNote()` succeeds, call `chunk-and-index` edge function with:
- `note_id`, `user_id`
- `content` = concatenated summary + analysis_markdown + content_markdown (first 3000 chars)
- `title`, `source_type`
Fire-and-forget (non-blocking, don't await in main flow)

### 7. Router + Sidebar + Translations
**router.tsx:** Add `{ path: 'search', element: <RAGSearch /> }` under AppLayout children
**Sidebar.tsx:** Add `{ to: '/search', icon: Search, label: t('sidebar.search') }` as second item after Overview
**i18n/index.ts:** Add ~15 translation keys under `rag.*` namespace

## Files to Create
- `supabase/migrations/migration_rag_YYYYMMDD` (new migration)
- `supabase/functions/chunk-and-index/index.ts` (new edge function)
- `supabase/functions/rag-search/index.ts` (new edge function)
- `src/hooks/useRAG.ts` (new hook)
- `src/pages/RAGSearch.tsx` (new page)

## Files to Modify
- `src/router.tsx` — add /search route
- `src/components/layout/Sidebar.tsx` — add Search nav item
- `src/i18n/index.ts` — add rag.* translation keys
- `src/pages/Analyze.tsx` — fire chunk-and-index after note saved

## Verification
1. Analyze a URL/text → note saved → `knowledge_chunks` rows appear in DB
2. Go to /search → type a query → answer appears with citation cards
3. Click citation "Open Note" → navigates to correct note
4. History shows past queries
5. Re-index button appears when no chunks exist, populates DB when clicked
