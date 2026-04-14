/**
 * Capture Pod — 捕捉舱
 * Accent: #00ff66 (neon green)
 * Philosophy: Lowest friction. Throw anything in, fast.
 */
import { useState, useRef, useCallback } from 'react';
import { Loader2, Check, Globe, Type, FileIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAnalysis } from '@/hooks/useNotes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { SourceType } from '@/types';

const G = '#00ff66';
const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

type Mode = 'text' | 'url' | 'file';

interface Props { onFlashNote?: (id: string) => void }

const MODES: { key: Mode; label: string; icon: typeof Type }[] = [
  { key: 'text', label: '文字', icon: Type  },
  { key: 'url',  label: '链接', icon: Globe },
  { key: 'file', label: '文件', icon: FileIcon },
];

const STEPS_ZH = ['扫描内容…', '提取结构…', '生成洞见…', '写入星图…'];

export default function CaptureBox({ onFlashNote }: Props) {
  const { user } = useAuth();
  const { createAnalysis, updateAnalysisStatus, saveNote } = useAnalysis(user?.id);
  const [mode, setMode]       = useState<Mode>('text');
  const [text, setText]       = useState('');
  const [url,  setUrl]        = useState('');
  const [fileName, setFileName] = useState('');
  const [fileText, setFileText] = useState('');
  const [loading, setLoading] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [done,  setDone]      = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setFileName(f.name);
    setFileText((await f.text()).slice(0, 8000));
  };

  const canSubmit = mode === 'url'  ? url.trim().length > 4
    : mode === 'text' ? text.trim().length > 3
    : fileText.trim().length > 3;

  const submit = useCallback(async () => {
    if (!user?.id || !canSubmit || loading) return;
    setLoading(true); setDone(false); setStepIdx(0);

    const timer = setInterval(() => setStepIdx(i => Math.min(i + 1, STEPS_ZH.length - 1)), 2500);

    try {
      const sourceType: SourceType = mode;
      const content  = mode === 'text' ? text : mode === 'file' ? fileText : '';
      const sourceUrl = mode === 'url' ? url : undefined;

      const analysis = await createAnalysis(sourceType, content, sourceUrl);
      if (!analysis) throw new Error('创建失败');

      const body: Record<string, string> = { source_type: mode };
      if (mode === 'url')  body.url  = url;
      else                 body.text = content;

      const { data: fn, error: fnErr } = await supabase.functions.invoke('analyze-content', { body });
      if (fnErr || !fn?.success) throw new Error(fnErr?.message || fn?.error || '分析失败');

      const d = fn.data;
      const note = await saveNote(analysis.id, {
        title: d.title, summary: d.summary, key_points: [], analysis_content: {},
        tags: d.tags || [], mindmap_data: d.mindmap_data || {},
        content_markdown: d.report_markdown || d.content_markdown || '',
        summary_markdown: d.summary_markdown || '',
        analysis_markdown: d.analysis_markdown || '',
        mindmap_markdown: d.mindmap_markdown || '',
      });
      await updateAnalysisStatus(analysis.id, 'done');

      if (note?.id) {
        const ragContent = [d.summary||'', d.analysis_markdown||''].join('\n\n').slice(0, 4000);
        supabase.functions.invoke('chunk-and-index', {
          body: { note_id: note.id, user_id: user.id, content: ragContent, title: d.title||'', source_type: mode },
        }).catch(() => {});
        onFlashNote?.(note.id);
      }

      setDone(true);
      setText(''); setUrl(''); setFileText(''); setFileName('');
      toast.success(d.title ? `"${d.title}" 已投入星图` : '已投入星图');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '失败');
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  }, [user, mode, text, url, fileText, canSubmit, loading, createAnalysis, updateAnalysisStatus, saveNote, onFlashNote]);

  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 3, padding: '3px', background: 'rgba(255,255,255,0.03)', borderRadius: 7 }}>
        {MODES.map(({ key, label, icon: MIcon }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              fontFamily: MONO, fontSize: 9, letterSpacing: '0.05em',
              color: mode === key ? '#040508' : 'rgba(120,130,155,0.65)',
              background: mode === key ? G : 'transparent',
              border: 'none', borderRadius: 5, padding: '5px 0',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            <MIcon size={9} />
            {label}
          </button>
        ))}
      </div>

      {/* Input area */}
      {mode === 'text' && (
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="随手丢进来——文章片段、想法、笔记…"
          disabled={loading}
          rows={5}
          style={{
            ...inputBase,
            resize: 'none', lineHeight: 1.65,
            borderColor: text.trim() ? 'rgba(0,255,102,0.22)' : 'rgba(255,255,255,0.07)',
          }}
          onKeyDown={e => { if (e.metaKey && e.key === 'Enter') submit(); }}
        />
      )}
      {mode === 'url' && (
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="https://…"
          disabled={loading}
          style={{
            ...inputBase,
            borderColor: url.trim() ? 'rgba(0,255,102,0.22)' : 'rgba(255,255,255,0.07)',
          }}
        />
      )}
      {mode === 'file' && (
        <>
          <input ref={fileRef} type="file" accept=".txt,.md,.pdf" onChange={handleFile} style={{ display: 'none' }} />
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              ...inputBase, cursor: 'pointer', textAlign: 'left',
              color: fileName ? 'rgba(200,212,232,0.85)' : 'rgba(80,95,120,0.55)',
              borderStyle: 'dashed',
              borderColor: fileText ? 'rgba(0,255,102,0.22)' : 'rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
            }}
          >
            <FileIcon size={13} color={fileText ? G : 'rgba(80,95,120,0.45)'} />
            {fileName || '点击选择文件，或拖拽到此处'}
          </button>
        </>
      )}

      {/* Hint */}
      {mode === 'text' && !loading && (
        <div style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(60,72,95,0.55)', letterSpacing: '0.04em' }}>
          ⌘ + Enter 快速投入
        </div>
      )}

      {/* Progress */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Loader2 size={11} color={G} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontFamily: MONO, fontSize: 9, color: `${G}90`, letterSpacing: '0.05em' }}>
            {STEPS_ZH[stepIdx]}
          </span>
        </div>
      )}
      {done && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Check size={11} color={G} />
          <span style={{ fontFamily: MONO, fontSize: 9, color: `${G}90`, letterSpacing: '0.05em' }}>已投入星图</span>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={submit}
        disabled={loading || !canSubmit}
        style={{
          fontFamily: MONO, fontSize: 10, letterSpacing: '0.07em',
          color: canSubmit && !loading ? '#040508' : `${G}35`,
          background: canSubmit && !loading ? G : 'rgba(0,255,102,0.07)',
          border: 'none', borderRadius: 7,
          padding: '10px 0', cursor: canSubmit && !loading ? 'pointer' : 'not-allowed',
          transition: 'all 0.15s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        {loading
          ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> 分析中…</>
          : '投入星图 →'
        }
      </button>

      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const inputBase: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '9px 11px',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 7,
  fontFamily: INTER, fontSize: 12,
  color: 'rgba(210,220,240,0.88)',
  outline: 'none',
  transition: 'border-color 0.15s',
};
