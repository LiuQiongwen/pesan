/**
 * Obsidian Vault Importer
 *
 * Orchestrates: unzip → parse → dedup → insert notes → RAG index → wikilink edges
 */
import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';
import { parseVaultFiles, type ParsedNote } from './obsidian-parser';

export type ImportPhase = 'unzip' | 'parse' | 'dedup' | 'insert' | 'index' | 'edges' | 'done' | 'error';

export interface ImportProgress {
  phase: ImportPhase;
  current: number;
  total: number;
  currentFile?: string;
}

export interface ImportResult {
  importId: string;
  imported: number;
  skipped: number;
  edgesCreated: number;
  totalFiles: number;
}

// Directories to skip inside vault zip
const SKIP_DIRS = ['.obsidian', '.trash', '.git', '__MACOSX'];

function shouldSkip(path: string): boolean {
  const lower = path.toLowerCase();
  return SKIP_DIRS.some(d => lower.startsWith(d.toLowerCase() + '/') || lower.startsWith(d.toLowerCase() + '\\'));
}

// ── Concurrency limiter ─────────────────────────────────────────────────────
async function pMap<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency: number): Promise<R[]> {
  const results: R[] = [];
  let idx = 0;
  async function next(): Promise<void> {
    const i = idx++;
    if (i >= items.length) return;
    results[i] = await fn(items[i]);
    await next();
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => next()));
  return results;
}

// ── Main import function ────────────────────────────────────────────────────
export async function importObsidianVault(
  zipFile: File,
  userId: string,
  onProgress: (p: ImportProgress) => void,
): Promise<ImportResult> {
  // ── Phase 1: Unzip ──────────────────────────────────────────────────────
  onProgress({ phase: 'unzip', current: 0, total: 1 });
  const zip = await JSZip.loadAsync(zipFile);

  // Collect .md file paths (strip top-level vault folder if all files share one)
  const allPaths: string[] = [];
  zip.forEach((relPath, entry) => {
    if (!entry.dir && relPath.endsWith('.md') && !shouldSkip(relPath)) {
      allPaths.push(relPath);
    }
  });

  // Detect and strip common prefix (single vault root folder)
  let prefix = '';
  if (allPaths.length > 1) {
    const first = allPaths[0];
    const firstSlash = first.indexOf('/');
    if (firstSlash > 0) {
      const candidate = first.slice(0, firstSlash + 1);
      if (allPaths.every(p => p.startsWith(candidate))) {
        prefix = candidate;
      }
    }
  }

  onProgress({ phase: 'unzip', current: 1, total: 1 });

  // ── Phase 2: Parse ──────────────────────────────────────────────────────
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

  // ── Phase 3: Dedup ──────────────────────────────────────────────────────
  onProgress({ phase: 'dedup', current: 0, total: parsed.length });

  // Fetch existing obsidian notes for this user
  const { data: existing } = await supabase
    .from('notes')
    .select('id, obsidian_path, content_hash')
    .eq('user_id', userId)
    .not('obsidian_path', 'is', null);

  const existingMap = new Map<string, { id: string; hash: string | null }>();
  for (const row of existing || []) {
    if (row.obsidian_path) {
      existingMap.set(row.obsidian_path, { id: row.id, hash: row.content_hash });
    }
  }

  const toInsert: ParsedNote[] = [];
  const toUpdate: { noteId: string; note: ParsedNote }[] = [];
  let skipped = 0;

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

  onProgress({ phase: 'dedup', current: parsed.length, total: parsed.length });

  // ── Create import record ────────────────────────────────────────────────
  const { data: importRow } = await supabase.from('obsidian_imports').insert({
    user_id: userId,
    file_name: zipFile.name,
    total_files: parsed.length,
    imported: 0,
    skipped,
    status: 'processing',
  }).select('id').single();

  const importId = importRow?.id ?? '';

  // ── Phase 4: Insert notes ───────────────────────────────────────────────
  const totalWrite = toInsert.length + toUpdate.length;
  let written = 0;

  // Map: fileName (lowercase) → noteId for wikilink resolution
  const fileNameToNoteId = new Map<string, string>();

  // Pre-populate with existing notes (they won't be re-inserted)
  for (const [path, ex] of existingMap) {
    const fn = path.split('/').pop()?.replace(/\.md$/i, '').toLowerCase() ?? '';
    if (fn) fileNameToNoteId.set(fn, ex.id);
  }

  // Batch insert new notes (20 at a time)
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

  // Update changed notes
  for (const { noteId, note } of toUpdate) {
    onProgress({ phase: 'insert', current: written, total: totalWrite, currentFile: note.path });
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

  onProgress({ phase: 'insert', current: totalWrite, total: totalWrite });

  // ── Phase 5: RAG index ──────────────────────────────────────────────────
  const toIndex = [
    ...toInsert.map(n => ({ noteId: fileNameToNoteId.get(n.fileName.toLowerCase()) ?? '', note: n })),
    ...toUpdate.map(u => ({ noteId: u.noteId, note: u.note })),
  ].filter(x => x.noteId);

  await pMap(toIndex, async ({ noteId, note }, ) => {
    const idx = toIndex.indexOf({ noteId, note });
    onProgress({ phase: 'index', current: Math.min(idx + 1, toIndex.length), total: toIndex.length, currentFile: note.path });
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
      // Non-fatal: RAG indexing failure shouldn't block import
    }
  }, 3);

  // Track index progress more accurately
  let indexed = 0;
  for (const item of toIndex) {
    indexed++;
    onProgress({ phase: 'index', current: indexed, total: toIndex.length, currentFile: item.note.path });
  }

  // ── Phase 6: Wikilink edges ─────────────────────────────────────────────
  const allNotes = [...toInsert, ...toUpdate.map(u => u.note)];
  const edgeRows: { user_id: string; source_id: string; target_id: string; edge_type: string; description: string }[] = [];

  for (const note of parsed) {
    const sourceId = fileNameToNoteId.get(note.fileName.toLowerCase());
    if (!sourceId) continue;

    for (const link of note.wikilinks) {
      // Try exact match, then last segment of path-style links
      const segments = link.split('/');
      const linkName = segments[segments.length - 1].toLowerCase();
      const targetId = fileNameToNoteId.get(linkName);
      if (targetId && targetId !== sourceId) {
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

  onProgress({ phase: 'edges', current: 0, total: edgeRows.length });

  // Batch insert edges (50 at a time)
  let edgesCreated = 0;
  for (let i = 0; i < edgeRows.length; i += 50) {
    const batch = edgeRows.slice(i, i + 50);
    const { error } = await supabase.from('thought_edges').insert(batch);
    if (!error) edgesCreated += batch.length;
    onProgress({ phase: 'edges', current: Math.min(i + 50, edgeRows.length), total: edgeRows.length });
  }

  // ── Finalize ────────────────────────────────────────────────────────────
  const imported = toInsert.length + toUpdate.length;
  await supabase.from('obsidian_imports').update({
    status: 'done',
    imported,
    skipped,
    finished_at: new Date().toISOString(),
  }).eq('id', importId);

  onProgress({ phase: 'done', current: imported, total: parsed.length });

  return {
    importId,
    imported,
    skipped,
    edgesCreated,
    totalFiles: parsed.length,
  };
}
