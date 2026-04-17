/**
 * Obsidian Vault Importer — with incremental sync
 *
 * Flow: unzip → parse → diff (dedup + delete + rename detect) →
 *       delete → rename → insert → update → RAG index → edges → done
 */
import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';
import { parseVaultFiles, type ParsedNote } from './obsidian-parser';

export type ImportPhase =
  | 'unzip' | 'parse' | 'diff' | 'delete' | 'insert' | 'update'
  | 'index' | 'edges' | 'done' | 'error';

export interface ImportProgress {
  phase: ImportPhase;
  current: number;
  total: number;
  currentFile?: string;
}

export interface ImportResult {
  importId: string;
  imported: number;
  updated: number;
  skipped: number;
  deleted: number;
  renamed: number;
  edgesCreated: number;
  totalFiles: number;
  isSyncMode: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const SKIP_DIRS = ['.obsidian', '.trash', '.git', '__MACOSX'];

function shouldSkip(path: string): boolean {
  const lower = path.toLowerCase();
  return SKIP_DIRS.some(d => lower.startsWith(d.toLowerCase() + '/') || lower.startsWith(d.toLowerCase() + '\\'));
}

async function pMap<T, R>(items: T[], fn: (item: T, index: number) => Promise<R>, concurrency: number): Promise<R[]> {
  const results: R[] = [];
  let idx = 0;
  async function next(): Promise<void> {
    const i = idx++;
    if (i >= items.length) return;
    results[i] = await fn(items[i], i);
    await next();
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => next()));
  return results;
}

// ── Main import / sync function ─────────────────────────────────────────────
export async function importObsidianVault(
  zipFile: File,
  userId: string,
  onProgress: (p: ImportProgress) => void,
): Promise<ImportResult> {

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 1: Unzip
  // ═══════════════════════════════════════════════════════════════════════════
  onProgress({ phase: 'unzip', current: 0, total: 1 });
  const zip = await JSZip.loadAsync(zipFile);

  const allPaths: string[] = [];
  zip.forEach((relPath, entry) => {
    if (!entry.dir && relPath.endsWith('.md') && !shouldSkip(relPath)) {
      allPaths.push(relPath);
    }
  });

  // Strip common vault root folder
  let prefix = '';
  if (allPaths.length > 1) {
    const first = allPaths[0];
    const firstSlash = first.indexOf('/');
    if (firstSlash > 0) {
      const candidate = first.slice(0, firstSlash + 1);
      if (allPaths.every(p => p.startsWith(candidate))) prefix = candidate;
    }
  }
  onProgress({ phase: 'unzip', current: 1, total: 1 });

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 2: Parse
  // ═══════════════════════════════════════════════════════════════════════════
  const rawFiles: { path: string; content: string }[] = [];
  for (let i = 0; i < allPaths.length; i++) {
    const p = allPaths[i];
    const stripped = prefix ? p.slice(prefix.length) : p;
    onProgress({ phase: 'parse', current: i, total: allPaths.length, currentFile: stripped });
    const text = await zip.file(p)!.async('string');
    rawFiles.push({ path: stripped, content: text });
  }
  const parsed = parseVaultFiles(rawFiles);
  onProgress({ phase: 'parse', current: allPaths.length, total: allPaths.length });

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 3: Diff — detect new / changed / deleted / renamed
  // ═══════════════════════════════════════════════════════════════════════════
  onProgress({ phase: 'diff', current: 0, total: parsed.length });

  const { data: existing } = await supabase
    .from('notes')
    .select('id, obsidian_path, content_hash')
    .eq('user_id', userId)
    .eq('node_type', 'obsidian');

  const existingMap = new Map<string, { id: string; hash: string | null }>();
  for (const row of existing || []) {
    if (row.obsidian_path) {
      existingMap.set(row.obsidian_path, { id: row.id, hash: row.content_hash });
    }
  }

  const isSyncMode = existingMap.size > 0;
  const parsedPathSet = new Set(parsed.map(n => n.path));

  const toInsert: ParsedNote[] = [];
  const toUpdate: { noteId: string; note: ParsedNote }[] = [];
  const toDelete: { noteId: string; path: string }[] = [];
  const toRename: { noteId: string; oldPath: string; newPath: string }[] = [];
  let skipped = 0;

  // Classify parsed notes against existing DB
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

  // Detect deletes: notes in DB but not in this zip
  for (const [path, ex] of existingMap) {
    if (!parsedPathSet.has(path)) {
      toDelete.push({ noteId: ex.id, path });
    }
  }

  // Detect renames: deleted note whose hash matches an insert candidate
  const insertByHash = new Map<string, ParsedNote>();
  for (const n of toInsert) {
    if (!insertByHash.has(n.contentHash)) insertByHash.set(n.contentHash, n);
  }

  for (let i = toDelete.length - 1; i >= 0; i--) {
    const del = toDelete[i];
    const oldHash = existingMap.get(del.path)?.hash;
    if (oldHash && insertByHash.has(oldHash)) {
      const newNote = insertByHash.get(oldHash)!;
      toRename.push({ noteId: del.noteId, oldPath: del.path, newPath: newNote.path });
      // Remove from both lists
      const insertIdx = toInsert.indexOf(newNote);
      if (insertIdx >= 0) toInsert.splice(insertIdx, 1);
      insertByHash.delete(oldHash);
      toDelete.splice(i, 1);
    }
  }

  onProgress({ phase: 'diff', current: parsed.length, total: parsed.length });

  // ═══════════════════════════════════════════════════════════════════════════
  // Create import record
  // ═══════════════════════════════════════════════════════════════════════════
  const { data: importRow } = await supabase.from('obsidian_imports').insert({
    user_id: userId,
    file_name: zipFile.name,
    total_files: parsed.length,
    imported: 0,
    skipped,
    updated: 0,
    deleted: 0,
    renamed: 0,
    is_sync: isSyncMode,
    status: 'processing',
  }).select('id').single();

  const importId = importRow?.id ?? '';

  // fileName → noteId map for wikilink resolution
  const fileNameToNoteId = new Map<string, string>();

  // Pre-populate with all existing notes (including those not changing)
  for (const [path, ex] of existingMap) {
    const fn = path.split('/').pop()?.replace(/\.md$/i, '').toLowerCase() ?? '';
    if (fn) fileNameToNoteId.set(fn, ex.id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 4: Delete
  // ═══════════════════════════════════════════════════════════════════════════
  if (toDelete.length > 0) {
    for (let i = 0; i < toDelete.length; i++) {
      const { noteId, path } = toDelete[i];
      onProgress({ phase: 'delete', current: i, total: toDelete.length, currentFile: path });

      // Remove wikilink edges
      await supabase.from('thought_edges').delete()
        .or(`source_id.eq.${noteId},target_id.eq.${noteId}`)
        .eq('edge_type', 'wikilink')
        .eq('user_id', userId);

      // Remove RAG chunks
      await supabase.from('knowledge_chunks').delete().eq('note_id', noteId);

      // Remove note
      await supabase.from('notes').delete().eq('id', noteId);

      // Remove from lookup map
      const fn = path.split('/').pop()?.replace(/\.md$/i, '').toLowerCase() ?? '';
      if (fn) fileNameToNoteId.delete(fn);
    }
    onProgress({ phase: 'delete', current: toDelete.length, total: toDelete.length });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 4b: Rename (path only, no re-index needed)
  // ═══════════════════════════════════════════════════════════════════════════
  for (const { noteId, oldPath, newPath } of toRename) {
    const newFileName = newPath.split('/').pop()?.replace(/\.md$/i, '') ?? '';
    const parts = newPath.split('/');
    const newFolderTag = parts.length > 1 ? `folder:${parts[0]}` : '';

    // Get existing tags, replace old folder tag
    const { data: noteData } = await supabase.from('notes').select('tags').eq('id', noteId).maybeSingle();
    const existingTags: string[] = (noteData?.tags as string[]) ?? [];
    const cleanedTags = existingTags.filter(t => !t.startsWith('folder:'));
    if (newFolderTag) cleanedTags.push(newFolderTag);

    await supabase.from('notes').update({
      obsidian_path: newPath,
      title: newFileName,
      tags: cleanedTags,
      updated_at: new Date().toISOString(),
    }).eq('id', noteId);

    // Update lookup map
    const oldFn = oldPath.split('/').pop()?.replace(/\.md$/i, '').toLowerCase() ?? '';
    if (oldFn) fileNameToNoteId.delete(oldFn);
    const newFn = newFileName.toLowerCase();
    if (newFn) fileNameToNoteId.set(newFn, noteId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 5: Insert new notes
  // ═══════════════════════════════════════════════════════════════════════════
  const totalWrite = toInsert.length + toUpdate.length;
  let written = 0;

  const BATCH = 20;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    onProgress({ phase: 'insert', current: written, total: totalWrite, currentFile: batch[0]?.path });

    const rows = batch.map(n => ({
      user_id: userId,
      title: n.title,
      content_markdown: n.content.slice(0, 8000),
      summary: n.content.slice(0, 200),
      tags: n.tags,
      node_type: 'obsidian' as const,
      obsidian_path: n.path,
      obsidian_import_id: importId || null,
      content_hash: n.contentHash,
      analysis_content: n.frontmatter && Object.keys(n.frontmatter).length > 0
        ? { obsidian_frontmatter: n.frontmatter }
        : {},
      key_points: [] as string[],
      mindmap_data: {},
    }));

    const { data: inserted } = await supabase.from('notes').insert(rows).select('id, obsidian_path');
    if (inserted) {
      for (const row of inserted) {
        const fn = (row.obsidian_path as string)?.split('/').pop()?.replace(/\.md$/i, '').toLowerCase() ?? '';
        if (fn) fileNameToNoteId.set(fn, row.id);
      }
    }
    written += batch.length;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 6: Update changed notes (clean old data first)
  // ═══════════════════════════════════════════════════════════════════════════
  for (const { noteId, note } of toUpdate) {
    onProgress({ phase: 'update', current: written - toInsert.length, total: toUpdate.length, currentFile: note.path });

    // Clean old RAG chunks
    await supabase.from('knowledge_chunks').delete().eq('note_id', noteId);

    // Clean old wikilink edges (both directions)
    await supabase.from('thought_edges').delete()
      .or(`source_id.eq.${noteId},target_id.eq.${noteId}`)
      .eq('edge_type', 'wikilink')
      .eq('user_id', userId);

    // Update note
    await supabase.from('notes').update({
      title: note.title,
      content_markdown: note.content.slice(0, 8000),
      summary: note.content.slice(0, 200),
      tags: note.tags,
      content_hash: note.contentHash,
      analysis_content: note.frontmatter && Object.keys(note.frontmatter).length > 0
        ? { obsidian_frontmatter: note.frontmatter }
        : {},
      updated_at: new Date().toISOString(),
    }).eq('id', noteId);

    const fn = note.fileName.toLowerCase();
    if (fn) fileNameToNoteId.set(fn, noteId);
    written++;
  }

  onProgress({ phase: 'update', current: toUpdate.length, total: toUpdate.length });

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 7: RAG index (only new + updated notes)
  // ═══════════════════════════════════════════════════════════════════════════
  const toIndex = [
    ...toInsert.map(n => ({ noteId: fileNameToNoteId.get(n.fileName.toLowerCase()) ?? '', note: n })),
    ...toUpdate.map(u => ({ noteId: u.noteId, note: u.note })),
  ].filter(x => x.noteId);

  let indexed = 0;
  await pMap(toIndex, async ({ noteId, note }, i) => {
    indexed = i + 1;
    onProgress({ phase: 'index', current: indexed, total: toIndex.length, currentFile: note.path });
    try {
      await supabase.functions.invoke('chunk-and-index', {
        body: {
          note_id: noteId,
          user_id: userId,
          content: note.content.slice(0, 6000),
          title: note.title,
          source_type: 'obsidian',
          project_id: 'default',
        },
      });
    } catch {
      // Non-fatal
    }
  }, 3);

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 8: Wikilink edges (rebuild for all parsed notes)
  // ═══════════════════════════════════════════════════════════════════════════
  const edgeRows: { user_id: string; source_id: string; target_id: string; edge_type: string; description: string }[] = [];
  const edgeSeen = new Set<string>();

  for (const note of parsed) {
    const sourceId = fileNameToNoteId.get(note.fileName.toLowerCase());
    if (!sourceId) continue;

    for (const link of note.wikilinks) {
      const segments = link.split('/');
      const linkName = segments[segments.length - 1].toLowerCase();
      const targetId = fileNameToNoteId.get(linkName);
      if (targetId && targetId !== sourceId) {
        const key = `${sourceId}→${targetId}`;
        if (!edgeSeen.has(key)) {
          edgeSeen.add(key);
          edgeRows.push({
            user_id: userId,
            source_id: sourceId,
            target_id: targetId,
            edge_type: 'wikilink',
            description: `[[${link}]]`,
          });
        }
      }
    }
  }

  onProgress({ phase: 'edges', current: 0, total: edgeRows.length });

  // For sync mode, skip edges that already exist (insert with ON CONFLICT isn't available via client,
  // so we check existing edges first)
  let edgesCreated = 0;
  if (edgeRows.length > 0) {
    // Fetch existing wikilink edges to avoid duplicates
    const { data: existingEdges } = await supabase
      .from('thought_edges')
      .select('source_id, target_id')
      .eq('user_id', userId)
      .eq('edge_type', 'wikilink');

    const existingEdgeSet = new Set(
      (existingEdges || []).map(e => `${e.source_id}→${e.target_id}`)
    );

    const newEdges = edgeRows.filter(e => !existingEdgeSet.has(`${e.source_id}→${e.target_id}`));

    for (let i = 0; i < newEdges.length; i += 50) {
      const batch = newEdges.slice(i, i + 50);
      const { error } = await supabase.from('thought_edges').insert(batch);
      if (!error) edgesCreated += batch.length;
      onProgress({ phase: 'edges', current: Math.min(i + 50, newEdges.length), total: newEdges.length });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Finalize
  // ═══════════════════════════════════════════════════════════════════════════
  const importedCount = toInsert.length;
  const updatedCount = toUpdate.length;
  const deletedCount = toDelete.length;
  const renamedCount = toRename.length;

  await supabase.from('obsidian_imports').update({
    status: 'done',
    imported: importedCount,
    updated: updatedCount,
    skipped,
    deleted: deletedCount,
    renamed: renamedCount,
    finished_at: new Date().toISOString(),
  }).eq('id', importId);

  onProgress({ phase: 'done', current: importedCount + updatedCount, total: parsed.length });

  return {
    importId,
    imported: importedCount,
    updated: updatedCount,
    skipped,
    deleted: deletedCount,
    renamed: renamedCount,
    edgesCreated,
    totalFiles: parsed.length,
    isSyncMode,
  };
}
