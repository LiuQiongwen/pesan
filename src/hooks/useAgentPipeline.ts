/**
 * useAgentPipeline
 * Orchestrates the 7-step agent processing chain for a captured input.
 * Steps: ingest → parse → classify → retrieve → distill → generate → land
 */
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAnalysis } from './useNotes';
import type { SourceType, NodeType, Note } from '@/types';

export type StepStatus = 'pending' | 'active' | 'done' | 'error';

export interface PipelineStep {
  id: string;
  label: string;        // Chinese display label
  sublabel: string;     // English technical label
  status: StepStatus;
}

export interface PipelineResult {
  mainNoteId: string;
  derivedNodes: Array<{ id: string; node_type: NodeType; title: string }>;
}

const INITIAL_STEPS: PipelineStep[] = [
  { id: 'ingest',    label: '接受委托',   sublabel: 'ingest',    status: 'pending' },
  { id: 'parse',     label: '解析内容',   sublabel: 'parse',     status: 'pending' },
  { id: 'classify',  label: '分类主题',   sublabel: 'classify',  status: 'pending' },
  { id: 'retrieve',  label: '检索关联',   sublabel: 'retrieve',  status: 'pending' },
  { id: 'distill',   label: '提炼洞见',   sublabel: 'distill',   status: 'pending' },
  { id: 'generate',  label: '生成节点',   sublabel: 'generate',  status: 'pending' },
  { id: 'land',      label: '接入星图',   sublabel: 'land',      status: 'pending' },
];

function wait(ms: number) { return new Promise(res => setTimeout(res, ms)); }

export function useAgentPipeline(userId: string | undefined, universeId: string | null | undefined) {
  const [steps, setSteps] = useState<PipelineStep[]>(INITIAL_STEPS.map(s => ({ ...s })));
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  const { createAnalysis, updateAnalysisStatus, saveNote, insertDerivedNode } = useAnalysis(userId, universeId);

  const setStepStatus = useCallback((id: string, status: StepStatus) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  }, []);

  const reset = useCallback(() => {
    setSteps(INITIAL_STEPS.map(s => ({ ...s })));
    setRunning(false);
    setResult(null);
    setPipelineError(null);
  }, []);

  const run = useCallback(async (params: {
    sourceType: SourceType;
    content: string;
    sourceUrl?: string;
  }): Promise<PipelineResult | null> => {
    if (!userId) return null;
    reset();
    setRunning(true);
    setPipelineError(null);

    try {
      // ── STEP 1: INGEST ──────────────────────────────────────────
      setStepStatus('ingest', 'active');
      await wait(300);
      const analysis = await createAnalysis(params.sourceType, params.content, params.sourceUrl);
      if (!analysis) throw new Error('无法创建分析任务');
      setStepStatus('ingest', 'done');

      // ── STEP 2: PARSE ───────────────────────────────────────────
      setStepStatus('parse', 'active');
      const { data: fn, error: fnErr } = await supabase.functions.invoke('analyze-content', {
        body: {
          sourceType: params.sourceType,
          content:    params.content,
          sourceUrl:  params.sourceUrl,
        },
      });
      if (fnErr || !fn?.success) throw new Error(fnErr?.message || fn?.error || '内容解析失败');
      const d = fn.data;
      setStepStatus('parse', 'done');

      // ── STEP 3: CLASSIFY ────────────────────────────────────────
      setStepStatus('classify', 'active');
      await wait(200); // Tags already returned from analyze-content
      setStepStatus('classify', 'done');

      // ── STEP 4: RETRIEVE ────────────────────────────────────────
      setStepStatus('retrieve', 'active');
      // Save the main capture note
      const mainNote = await saveNote(analysis.id, {
        title: d.title,
        summary: d.summary,
        key_points: [],
        analysis_content: {},
        tags: d.tags || [],
        mindmap_data: d.mindmap_data || {},
        content_markdown: d.report_markdown || d.content_markdown || '',
        summary_markdown: d.summary_markdown || '',
        analysis_markdown: d.analysis_markdown || '',
        mindmap_markdown: d.mindmap_markdown || '',
        node_type: 'capture',
      });
      if (!mainNote) throw new Error('节点写入失败');
      await updateAnalysisStatus(analysis.id, 'done');

      // Fire RAG indexing in background, then wiki compilation sequentially
      // (sequential to avoid 429 rate-limit on concurrent LLM calls)
      supabase.functions.invoke('chunk-and-index', {
        body: {
          note_id: mainNote.id,
          user_id: userId,
          content: [d.summary || '', d.analysis_markdown || ''].join('\n\n').slice(0, 4000),
          title: d.title || '',
          source_type: params.sourceType,
          universe_id: universeId,
        },
      }).then(() => wait(2000)).then(() =>
        supabase.functions.invoke('wiki-compile', {
          body: { user_id: userId, universe_id: universeId, trigger: 'new_note', note_ids: [mainNote.id] },
        })
      ).catch(() => {});

      setStepStatus('retrieve', 'done');

      // ── STEP 5: DISTILL ─────────────────────────────────────────
      setStepStatus('distill', 'active');
      await wait(400);
      setStepStatus('distill', 'done');

      // ── STEP 6: GENERATE ────────────────────────────────────────
      setStepStatus('generate', 'active');

      const derivedNodes: PipelineResult['derivedNodes'] = [];
      const baseTags: string[] = d.tags?.slice(0, 3) || [];

      // Summary node
      if (d.summary_markdown || d.summary) {
        const n = await insertDerivedNode({
          userId,
          universeId: universeId!,
          node_type: 'summary',
          title: `摘要 · ${d.title || '未命名'}`,
          summary: d.summary_markdown || d.summary || '',
          tags: baseTags,
        });
        if (n) derivedNodes.push({ id: n.id, node_type: 'summary', title: n.title || '' });
      }

      // Insight nodes (up to 2 from innovative_insights)
      const insights: string[] = d.innovative_insights?.slice(0, 2) || [];
      for (const insight of insights) {
        const n = await insertDerivedNode({
          userId,
          universeId: universeId!,
          node_type: 'insight',
          title: `洞见 · ${insight.slice(0, 40)}`,
          summary: insight,
          tags: baseTags,
        });
        if (n) derivedNodes.push({ id: n.id, node_type: 'insight', title: n.title || '' });
      }

      setStepStatus('generate', 'done');

      // ── STEP 7: LAND ─────────────────────────────────────────────
      setStepStatus('land', 'active');
      await wait(300);
      setStepStatus('land', 'done');

      const finalResult: PipelineResult = {
        mainNoteId: mainNote.id,
        derivedNodes,
      };
      setResult(finalResult);
      return finalResult;

    } catch (e) {
      const msg = e instanceof Error ? e.message : '未知错误';
      setPipelineError(msg);
      // Mark any active step as errored
      setSteps(prev => prev.map(s => s.status === 'active' ? { ...s, status: 'error' } : s));
      return null;
    } finally {
      setRunning(false);
    }
  }, [userId, universeId, reset, setStepStatus, createAnalysis, updateAnalysisStatus, saveNote, insertDerivedNode]);

  return { steps, running, result, pipelineError, run, reset };
}
