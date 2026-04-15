# Fix: 建立连接失败 — relationship_type CHECK constraint mismatch

## Context
Every drag-to-connect operation fails with a DB error because `thought_relationships.relationship_type`
has a CHECK constraint allowing only the OLD set of types:
  `['supports', 'contradicts', 'depends_on', 'evolves_from', 'applies_to', 'unanswered_by']`

But the frontend (`connect-types.ts`) inserts the NEW types:
  `['semantic', 'insight_of', 'drives_action', 'answers']`

The table is currently empty (0 rows), so a safe migration replaces the constraint.

## Fix (single migration)

**File**: `supabase migration` (new)

```sql
-- Drop the old CHECK constraint
ALTER TABLE public.thought_relationships
  DROP CONSTRAINT thought_relationships_relationship_type_check;

-- Add updated CHECK constraint matching frontend connect-types.ts
ALTER TABLE public.thought_relationships
  ADD CONSTRAINT thought_relationships_relationship_type_check
  CHECK (relationship_type IN (
    'semantic', 'insight_of', 'drives_action', 'answers',
    -- keep legacy values for forward compatibility
    'supports', 'contradicts', 'depends_on', 'evolves_from', 'applies_to', 'unanswered_by'
  ));
```

No frontend changes needed — `connect-types.ts` is already correct.

## Verification
1. Run migration → constraint updated
2. Hold a node, drag to another, release → ConnectConfirmOverlay appears
3. Select any relation type and confirm → toast shows "连接已建立" (green)
4. Query `SELECT * FROM thought_relationships` → row inserted with correct type
