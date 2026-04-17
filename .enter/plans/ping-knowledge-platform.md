# Wiki Knowledge Compilation Layer — MVP Implementation Plan

## Context

The system currently has: raw document capture -> chunk-and-index -> FTS-based RAG search -> star map visualization.
Problem: every query goes through raw chunks. There's no "compiled knowledge" layer that accumulates understanding over time.

This plan adds a **wiki compilation layer** between raw sources and the query/agent interface:
`Raw Sources -> [NEW] Wiki Compilation -> RAG + Star Map + Agents`

Wiki pages are AI-maintained, source-referenced, structured knowledge pages that compress and cross-link accumulated knowledge.

---

## 1. Database Schema

### New table: `wiki_pages`

```sql
CREATE TABLE wiki_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  slug text NOT NULL,
  title text NOT NULL,
  page_type text NOT NULL DEFAULT 'topic',
  summary text,
  content_markdown text,
  tags text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  version integer NOT NULL DEFAULT 1,
  source_note_ids text[] DEFAULT '{}',
  source_chunk_ids text[] DEFAULT '{}',
  compiled_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT wiki_pages_type_check CHECK (page_type IN ('topic','entity','timeline','summary','question','overview'))
);

ALTER TABLE wiki_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage wiki" ON wiki_pages FOR ALL USING (auth.uid() = user_id);
CREATE UNIQUE INDEX idx_wiki_pages_slug ON wiki_pages(user_id, slug);
CREATE INDEX idx_wiki_pages_type ON wiki_pages(user_id, page_type);
ALTER PUBLICATION supabase_realtime ADD TABLE wiki_pages;
```

### New table: `wiki_source_refs` (granular source tracking per section)

```sql
CREATE TABLE wiki_source_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wiki_page_id uuid NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
  note_id uuid REFERENCES notes(id) ON DELETE SET NULL,
  chunk_id uuid REFERENCES knowledge_chunks(id) ON DELETE SET NULL,
  section_anchor text,
  excerpt text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wiki_source_refs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage refs" ON wiki_source_refs FOR ALL
  USING (EXISTS (SELECT 1 FROM wiki_pages WHERE id = wiki_page_id AND user_id = auth.uid()));
CREATE INDEX idx_wiki_refs_page ON wiki_source_refs(wiki_page_id);
CREATE INDEX idx_wiki_refs_note ON wiki_source_refs(note_id);
```

### Extend `notes.node_type` for wiki types

```sql
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_node_type_check;
ALTER TABLE notes ADD CONSTRAINT notes_node_type_check CHECK (
  node_type IN ('capture','summary','insight','action','question','relation','obsidian',
                'wiki_topic','wiki_entity','wiki_timeline','wiki_summary','wiki_question','wiki_overview')
);
```

### Extend `thought_edges.edge_type` for wiki relationships

```sql
ALTER TABLE thought_edges DROP CONSTRAINT IF EXISTS thought_edges_edge_type_check;
ALTER TABLE thought_edges ADD CONSTRAINT thought_edges_edge_type_check CHECK (
  edge_type IN ('supports','contradicts','extends','inspires','related','wikilink',
                'semantic','insight_of','drives_action','answers',
                'compiled_from','wiki_crossref')
);
```

---

## 2. TypeScript Type Extensions

### File: `src/types/index.ts`

Add to `NodeType`:
```ts
export type NodeType =
  | 'capture' | 'summary' | 'insight' | 'action' | 'question' | 'relation' | 'obsidian'
  | 'wiki_topic' | 'wiki_entity' | 'wiki_timeline' | 'wiki_summary' | 'wiki_question' | 'wiki_overview';
```

Add new types:
```ts
export type WikiPageType = 'topic' | 'entity' | 'timeline' | 'summary' | 'question' | 'overview';

export interface WikiPage {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  page_type: WikiPageType;
  summary: string | null;
  content_markdown: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  version: number;
  source_note_ids: string[];
  source_chunk_ids: string[];
  compiled_at: string;
  created_at: string;
  updated_at: string;
}

export interface WikiSourceRef {
  id: string;
  wiki_page_id: string;
  note_id: string | null;
  chunk_id: string | null;
  section_anchor: string | null;
  excerpt: string | null;
}
```

---

## 3. Edge Function: `wiki-compile`

New edge function: `supabase/functions/wiki-compile/index.ts`

### Input
```json
{
  "user_id": "uuid",
  "trigger": "new_note" | "manual" | "batch",
  "note_ids": ["uuid"] // optional, for targeted compilation
}
```

### Logic Flow
1. **Gather context**: Fetch all user's `knowledge_chunks` (FTS search by note tags/title), plus existing `wiki_pages`
2. **Classify**: Ask LLM to identify which topics/entities the new material relates to
3. **Match existing pages**: Check if any existing wiki page covers the topic (by slug/tags overlap)
4. **Generate/Update**:
   - If matching wiki page exists: send existing page content + new chunks -> LLM generates updated page
   - If no match: LLM creates new wiki page
5. **Extract source refs**: LLM output includes `[src:chunk_id]` markers -> parsed into `wiki_source_refs`
6. **Write results**: Upsert `wiki_pages`, insert `wiki_source_refs`, create/update mirror `notes` row (for star map)
7. **Create edges**: `compiled_from` edges from wiki note to source notes

### LLM Prompt Strategy
- System prompt instructs LLM to act as a "knowledge compiler"
- Input: topic name + existing page content (if updating) + new source chunks
- Output: structured JSON with `title`, `summary`, `content_markdown`, `tags`, `source_refs[]`
- Content must include inline `[src:N]` markers that map to source chunks
- LLM must NOT hallucinate — only synthesize from provided chunks

### Key Constraints
- Never modifies raw notes or chunks
- Incremental: only processes new/changed notes since last compilation
- Caps at 10 chunks per compilation call to stay within token limits
- Bumps `version` on each update

---

## 4. Edge Function: `rag-search` Enhancement (Wiki-First Query)

### Modified query flow in existing `rag-search/index.ts`:

```
1. Receive query + user_id
2. NEW: FTS search wiki_pages (title, content_markdown) -> top 3 wiki hits
3. Existing: FTS search knowledge_chunks -> top 15 raw chunk hits
4. Build context for LLM:
   a. Wiki context block: "[WIKI] Title: ... \n Content: ..."
   b. Chunk context blocks: "[1] Source: ... \n Content: ..."
5. Updated system prompt: "Use wiki summaries as primary knowledge. Use raw chunks as supporting evidence. Cite both."
6. Return answer + wiki_citations + chunk_citations
```

### New response shape:
```json
{
  "answer": "...",
  "wiki_citations": [{ "wiki_page_id": "...", "title": "...", "excerpt": "..." }],
  "citations": [{ "chunk_id": "...", "note_id": "...", "excerpt": "..." }],
  "conversation_id": "..."
}
```

---

## 5. Star Map Integration

### File: `src/components/starmap/CosmosScene.tsx`

Add to `NODE_TYPE_CFG`:
```ts
wiki_topic:    { label: 'WIKI:TOPIC',    color: '#10b981' },
wiki_entity:   { label: 'WIKI:ENTITY',   color: '#06b6d4' },
wiki_timeline: { label: 'WIKI:TIMELINE', color: '#f59e0b' },
wiki_summary:  { label: 'WIKI:SUMMARY',  color: '#8b5cf6' },
wiki_question: { label: 'WIKI:Q',        color: '#ef4444' },
wiki_overview: { label: 'WIKI:OVERVIEW', color: '#ec4899' },
```

Wiki nodes render with a **diamond/gem geometry** (DodecahedronGeometry) to visually distinguish from raw notes.

### File: `src/components/starmap/connect-types.ts`

Add edge types:
```ts
compiled_from: { icon: '...', label: '编译自', color: '#10b981', impact: '标记来源' },
wiki_crossref: { icon: '...', label: '知识互引', color: '#06b6d4', impact: '交叉引用' },
```

### File: `src/components/starmap/NodeWindow.tsx`

When `node_type` starts with `wiki_`:
- Show "Wiki Page" badge with emerald accent
- Show "Sources" section listing source notes (from `wiki_source_refs`)
- Show "Re-compile" button that triggers `wiki-compile` for this page
- Show wiki content with inline source reference markers

---

## 6. Frontend: Wiki Panel in NodeWindow

When opening a wiki node, the NodeWindow shows:
- Page type badge (topic/entity/timeline/etc.)
- Summary section
- Full compiled content (markdown rendered)
- Source references section (clickable, navigates to source nodes)
- "Re-compile" action button
- Version indicator + last compiled timestamp

---

## 7. Frontend: Manual Compile Trigger

### File: `src/components/floating/SettingsCapsule.tsx`

Add "Compile Knowledge" button in dropdown menu -> opens `WikiCompileModal`.

### New file: `src/components/wiki/WikiCompileModal.tsx`

Simple modal:
1. Shows current wiki page count + last compile time
2. "Compile Now" button -> calls `wiki-compile` edge function with `trigger: 'manual'`
3. Progress indicator (loading state)
4. Done state: shows new/updated page count
5. Option to compile only for specific tags/topics

---

## 8. Source Chain & Traceability

Every wiki page tracks:
- `source_note_ids[]` — which notes contributed (array on wiki_pages)
- `source_chunk_ids[]` — which chunks were used (array on wiki_pages)
- `wiki_source_refs` table — granular per-section references

In the UI, inline `[src:N]` markers in wiki content render as clickable superscripts that:
1. Highlight the source reference
2. Show excerpt from the original chunk
3. Allow navigation to the source note

---

## 9. Auto-trigger Hook

### File: `src/hooks/useAgentPipeline.ts`

After step 4 (retrieve/save note), add background wiki compilation trigger:
```ts
// After chunk-and-index completes, trigger wiki compilation
supabase.functions.invoke('wiki-compile', {
  body: { user_id: userId, trigger: 'new_note', note_ids: [mainNote.id] },
}).catch(() => {}); // fire-and-forget
```

---

## 10. MVP Implementation Order

### Step 1: Database migration
- Create `wiki_pages` + `wiki_source_refs` tables
- Extend `notes.node_type` + `thought_edges.edge_type`

### Step 2: Types
- Update `src/types/index.ts` with wiki types

### Step 3: Edge function `wiki-compile`
- Implement the compilation agent
- Handles both create and incremental update

### Step 4: Enhance `rag-search`
- Add wiki-first search layer
- Return wiki citations alongside chunk citations

### Step 5: Star map integration
- Add wiki node types to `NODE_TYPE_CFG` with distinct geometry
- Add wiki edge types to `connect-types.ts`
- Update `cosmos-layout.ts` to handle wiki nodes

### Step 6: NodeWindow wiki view
- Detect wiki node types -> render wiki-specific content
- Source references section
- Re-compile button

### Step 7: Manual compile trigger
- WikiCompileModal component
- SettingsCapsule entry point

### Step 8: Auto-trigger in pipeline
- Add wiki-compile call to useAgentPipeline after indexing

### Step 9: RAG search UI update
- Show wiki citations in RAGSearch page
- Distinguish wiki sources from chunk sources

---

## Files to Create
- `supabase/functions/wiki-compile/index.ts` — compilation agent edge function
- `src/components/wiki/WikiCompileModal.tsx` — manual compile trigger UI

## Files to Modify
- `supabase/functions/rag-search/index.ts` — add wiki-first search
- `src/types/index.ts` — add wiki types
- `src/components/starmap/CosmosScene.tsx` — add wiki node configs + geometry
- `src/components/starmap/connect-types.ts` — add wiki edge types
- `src/components/starmap/cosmos-layout.ts` — handle wiki node layout
- `src/components/starmap/NodeWindow.tsx` — wiki page view
- `src/components/floating/SettingsCapsule.tsx` — compile trigger button
- `src/hooks/useAgentPipeline.ts` — auto-trigger compilation
- `src/hooks/useRAG.ts` — handle wiki citations
- `src/pages/RAGSearch.tsx` — render wiki citations

## Verification
1. Create a few notes via normal capture flow
2. Trigger manual compilation -> verify wiki pages created in DB
3. Open star map -> verify wiki nodes appear with distinct geometry/color
4. Open wiki node -> verify source chain is visible
5. RAG search -> verify wiki pages are hit first, raw chunks as evidence
6. Add new note -> verify wiki auto-updates in background
