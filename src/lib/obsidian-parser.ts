/**
 * Obsidian Vault Markdown Parser
 *
 * Extracts: frontmatter, tags, wikilinks, title, content, folder path
 */
import { parse as parseYaml } from 'yaml';

export interface ParsedNote {
  path: string;            // 'Projects/AI/thoughts.md'
  fileName: string;        // 'thoughts'
  title: string;           // frontmatter.title || first H1 || fileName
  content: string;         // markdown body (frontmatter stripped)
  tags: string[];          // merged frontmatter.tags + inline #tags + folder tag
  wikilinks: string[];     // ['Note A', 'Note B']
  frontmatter: Record<string, unknown>;
  contentHash: string;
  folderTag: string;       // 'folder:Projects' or ''
}

// ── Lightweight hash (cyrb53) ───────────────────────────────────────────────
function cyrb53(str: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// ── Frontmatter extraction ──────────────────────────────────────────────────
const FM_REGEX = /^---\r?\n([\s\S]*?)\r?\n---/;

function extractFrontmatter(raw: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = raw.match(FM_REGEX);
  if (!match) return { frontmatter: {}, body: raw };
  try {
    const parsed = parseYaml(match[1]);
    const body = raw.slice(match[0].length).trim();
    return {
      frontmatter: (typeof parsed === 'object' && parsed !== null) ? parsed as Record<string, unknown> : {},
      body,
    };
  } catch {
    return { frontmatter: {}, body: raw.slice(match[0].length).trim() };
  }
}

// ── Wikilink extraction ─────────────────────────────────────────────────────
const WIKILINK_REGEX = /\[\[([^\]|#]+?)(?:[|#][^\]]*?)?\]\]/g;

function extractWikilinks(body: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = WIKILINK_REGEX.exec(body)) !== null) {
    const name = m[1].trim();
    const key = name.toLowerCase();
    if (name && !seen.has(key)) {
      seen.add(key);
      links.push(name);
    }
  }
  return links;
}

// ── Inline tag extraction ───────────────────────────────────────────────────
const INLINE_TAG_REGEX = /(?:^|\s)#([a-zA-Z\u4e00-\u9fff][\w\u4e00-\u9fff/-]*)/g;

function extractInlineTags(body: string): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = INLINE_TAG_REGEX.exec(body)) !== null) {
    const tag = m[1].replace(/\//g, '-');
    const key = tag.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      tags.push(tag);
    }
  }
  return tags;
}

// ── Title extraction ────────────────────────────────────────────────────────
const H1_REGEX = /^#\s+(.+)$/m;

function extractTitle(body: string, fm: Record<string, unknown>, fileName: string): string {
  if (typeof fm.title === 'string' && fm.title.trim()) return fm.title.trim();
  const h1 = body.match(H1_REGEX);
  if (h1) return h1[1].trim();
  return fileName;
}

// ── Main parse function ─────────────────────────────────────────────────────
export function parseObsidianNote(path: string, rawContent: string): ParsedNote | null {
  // Skip very short files
  const trimmed = rawContent.trim();
  if (trimmed.length < 10) return null;

  const parts = path.split('/');
  const fileNameWithExt = parts[parts.length - 1];
  const fileName = fileNameWithExt.replace(/\.md$/i, '');

  // Folder tag = top-level directory
  const folderTag = parts.length > 1 ? `folder:${parts[0]}` : '';

  const { frontmatter, body } = extractFrontmatter(trimmed);
  const title = extractTitle(body, frontmatter, fileName);
  const wikilinks = extractWikilinks(body);
  const inlineTags = extractInlineTags(body);

  // Merge tags from frontmatter + inline + folder
  const fmTags: string[] = Array.isArray(frontmatter.tags)
    ? (frontmatter.tags as string[]).map(t => String(t).trim()).filter(Boolean)
    : typeof frontmatter.tags === 'string'
      ? frontmatter.tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];

  const allTags = [...fmTags, ...inlineTags];
  if (folderTag) allTags.push(folderTag);
  const uniqueTags = [...new Set(allTags.map(t => t.toLowerCase()))];

  return {
    path,
    fileName,
    title,
    content: body,
    tags: uniqueTags,
    wikilinks,
    frontmatter,
    contentHash: cyrb53(trimmed),
    folderTag,
  };
}

// ── Batch parse helper ──────────────────────────────────────────────────────
export function parseVaultFiles(files: { path: string; content: string }[]): ParsedNote[] {
  const results: ParsedNote[] = [];
  for (const f of files) {
    const note = parseObsidianNote(f.path, f.content);
    if (note) results.push(note);
  }
  return results;
}
