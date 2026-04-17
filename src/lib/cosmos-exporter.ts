/**
 * Cosmos Exporter — generates a `_cosmos/` folder as a zip
 * containing derived knowledge in Obsidian-compatible Markdown.
 *
 * Exported content types:
 *  - Distillations -> _cosmos/insights/{title}.md
 *  - Actions       -> _cosmos/actions/{slug}.md
 *  - Relationships -> _cosmos/relations.md
 *  - Cognitive Reports -> _cosmos/reports/{date}.md
 *
 * All files are NEW — we never modify user originals.
 */
import JSZip from 'jszip';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ExportProgress {
  phase: 'loading' | 'generating' | 'zipping' | 'done' | 'error';
  detail: string;
  current: number;
  total: number;
}

export interface ExportResult {
  blob: Blob;
  stats: {
    insights: number;
    actions: number;
    relations: number;
    reports: number;
    totalFiles: number;
  };
}

type ProgressCb = (p: ExportProgress) => void;

function slug(s: string, maxLen = 60): string {
  return s
    .replace(/[^\w\u4e00-\u9fff\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, maxLen) || 'untitled';
}

function fmBlock(meta: Record<string, unknown>): string {
  const lines = Object.entries(meta)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => {
      if (Array.isArray(v)) return `${k}:\n${v.map(i => `  - ${i}`).join('\n')}`;
      return `${k}: ${String(v)}`;
    });
  return '---\n' + lines.join('\n') + '\n---\n\n';
}

function ds(d?: string | null): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  return new Date(d).toISOString().slice(0, 10);
}

async function noteTitleMap(sb: SupabaseClient, uid: string) {
  const { data } = await sb.from('notes').select('id, title').eq('user_id', uid);
  const m = new Map<string, string>();
  (data ?? []).forEach(n => m.set(n.id, n.title ?? 'Untitled'));
  return m;
}

export async function exportCosmos(
  supabase: SupabaseClient,
  userId: string,
  onProgress?: ProgressCb,
): Promise<ExportResult> {
  const zip = new JSZip();
  const cosmos = zip.folder('_cosmos')!;
  const stats = { insights: 0, actions: 0, relations: 0, reports: 0, totalFiles: 0 };

  const emit = (phase: ExportProgress['phase'], detail: string, current = 0, total = 0) =>
    onProgress?.({ phase, detail, current, total });

  try {
    emit('loading', '加载数据...', 0, 4);

    const [distRes, actRes, edgeRes, cogRes, nMap] = await Promise.all([
      supabase.from('distillations').select('*').eq('user_id', userId),
      supabase.from('actions').select('*').eq('user_id', userId),
      supabase.from('thought_edges').select('*').eq('user_id', userId),
      supabase.from('cognitive_reports').select('*').eq('user_id', userId),
      noteTitleMap(supabase, userId),
    ]);

    const dists = distRes.data ?? [];
    const acts = actRes.data ?? [];
    const edges = edgeRes.data ?? [];
    const reps = cogRes.data ?? [];
    const total = dists.length + acts.length + (edges.length > 0 ? 1 : 0) + reps.length;

    // Insights
    emit('generating', '生成洞察笔记...', 0, total);
    const iFolder = cosmos.folder('insights')!;
    const usedI = new Set<string>();

    for (let i = 0; i < dists.length; i++) {
      const d = dists[i];
      let name = slug(d.title ?? d.key_insight ?? `insight-${i + 1}`);
      if (usedI.has(name)) name = `${name}-${i}`;
      usedI.add(name);

      const src = d.note_id ? (nMap.get(d.note_id) ?? '') : '';
      const fm = fmBlock({
        title: d.title ?? d.key_insight ?? 'Untitled Insight',
        source: src, source_label: d.source_label,
        confidence: d.confidence ? Number(d.confidence) : undefined,
        tags: d.tags, created: ds(d.created_at),
        cosmos_type: 'insight', cosmos_id: d.id,
      });

      const body = [
        d.key_insight ? `## Key Insight\n\n${d.key_insight}\n` : '',
        d.facts_markdown ? `## Facts\n\n${d.facts_markdown}\n` : '',
        d.opinions_markdown ? `## Opinions\n\n${d.opinions_markdown}\n` : '',
        d.methods_markdown ? `## Methods\n\n${d.methods_markdown}\n` : '',
        d.insights_markdown ? `## Insights\n\n${d.insights_markdown}\n` : '',
        d.actions_markdown ? `## Suggested Actions\n\n${d.actions_markdown}\n` : '',
        src ? `\n---\nSource: [[${src}]]\n` : '',
      ].filter(Boolean).join('\n');

      iFolder.file(`${name}.md`, fm + body);
      stats.insights++;
      emit('generating', `洞察 ${i + 1}/${dists.length}`, i + 1, total);
    }

    // Actions
    const aFolder = cosmos.folder('actions')!;
    const usedA = new Set<string>();

    for (let i = 0; i < acts.length; i++) {
      const a = acts[i];
      let name = slug(a.content?.slice(0, 50) || `action-${i + 1}`);
      if (usedA.has(name)) name = `${name}-${i}`;
      usedA.add(name);

      const src = a.note_id ? (nMap.get(a.note_id) ?? '') : '';
      const fm = fmBlock({
        status: a.status, priority: a.priority,
        due_date: a.due_date, source: src,
        created: ds(a.created_at),
        cosmos_type: 'action', cosmos_id: a.id,
      });

      const body = [
        `## ${a.content}\n`,
        a.source_context ? `**Context:** ${a.source_context}\n` : '',
        a.outcome_note ? `### Outcome\n\n${a.outcome_note}\n` : '',
        src ? `\n---\nSource: [[${src}]]\n` : '',
      ].filter(Boolean).join('\n');

      aFolder.file(`${name}.md`, fm + body);
      stats.actions++;
      emit('generating', `行动 ${i + 1}/${acts.length}`, dists.length + i + 1, total);
    }

    // Relations
    if (edges.length > 0) {
      const lines: string[] = [
        fmBlock({ cosmos_type: 'relations', created: ds() }),
        '# Knowledge Relations\n',
        `Total: ${edges.length} connections\n`,
      ];

      const byType = new Map<string, typeof edges>();
      edges.forEach(e => {
        const list = byType.get(e.edge_type) ?? [];
        list.push(e);
        byType.set(e.edge_type, list);
      });

      for (const [type, group] of byType) {
        lines.push(`\n## ${type.charAt(0).toUpperCase() + type.slice(1)} (${group.length})\n`);
        for (const e of group) {
          const s = nMap.get(e.source_id) ?? e.source_id.slice(0, 8);
          const t = nMap.get(e.target_id) ?? e.target_id.slice(0, 8);
          const desc = e.description ? ` - ${e.description}` : '';
          const conf = e.confidence ? ` (${Math.round(Number(e.confidence) * 100)}%)` : '';
          lines.push(`- [[${s}]] -> [[${t}]]${desc}${conf}`);
        }
      }

      cosmos.file('relations.md', lines.join('\n'));
      stats.relations = edges.length;
    }

    // Cognitive Reports
    if (reps.length > 0) {
      const rFolder = cosmos.folder('reports')!;
      for (let i = 0; i < reps.length; i++) {
        const r = reps[i];
        const nm = `report-${ds(r.created_at)}`;
        const fm = fmBlock({
          thinking_style: r.thinking_style,
          notes_analyzed: r.notes_analyzed,
          created: ds(r.created_at),
          cosmos_type: 'cognitive_report', cosmos_id: r.id,
        });
        const body = [
          r.report_markdown || '',
          r.thinking_style ? `\n## Thinking Style\n\n${r.thinking_style}\n` : '',
        ].filter(Boolean).join('\n');
        rFolder.file(`${nm}.md`, fm + body);
        stats.reports++;
      }
    }

    // Index
    const idx = [
      fmBlock({ cosmos_type: 'index', created: ds() }),
      '# Cosmos Export Index\n',
      `Exported from Knowledge Cosmos on ${new Date().toLocaleDateString('zh-CN')}\n`,
      '## Summary\n',
      `- Insights: ${stats.insights}`,
      `- Actions: ${stats.actions}`,
      `- Relations: ${stats.relations}`,
      `- Reports: ${stats.reports}`,
      '',
      '## Folders\n',
      stats.insights > 0 ? '- `_cosmos/insights/` - Distilled insights' : '',
      stats.actions > 0 ? '- `_cosmos/actions/` - Action items' : '',
      stats.relations > 0 ? '- `_cosmos/relations.md` - Knowledge map' : '',
      stats.reports > 0 ? '- `_cosmos/reports/` - Cognitive reports' : '',
    ].filter(Boolean).join('\n');

    cosmos.file('_index.md', idx);
    stats.totalFiles = stats.insights + stats.actions + (stats.relations > 0 ? 1 : 0) + stats.reports + 1;

    emit('zipping', '打包 zip...', total, total);
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

    emit('done', '导出完成', total, total);
    return { blob, stats };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit('error', msg);
    throw err;
  }
}
