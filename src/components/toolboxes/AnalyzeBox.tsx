import { useState, useRef } from 'react';
import { Globe, Type, FileIcon, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAnalysis } from '@/hooks/useNotes';
import { useT } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SourceType } from '@/types';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";
const GREEN = '#00ff66';

const TABS: { type: SourceType; label: string }[] = [
  { type: 'url',  label: 'URL' },
  { type: 'text', label: 'TEXT' },
  { type: 'file', label: 'FILE' },
];

interface Props {
  onFlashNote?: (noteId: string) => void;
}

export default function AnalyzeBox({ onFlashNote }: Props) {
  const { user } = useAuth();
  const { createAnalysis, updateAnalysisStatus, saveNote } = useAnalysis(user?.id);
  const t = useT();

  const [activeTab, setActiveTab] = useState<SourceType>('url');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('');
  const [done, setDone] = useState(false);
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName]   = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setFileContent(text.slice(0, 8000));
  };

  const handleSubmit = async () => {
    if (!user?.id || loading) return;
    const inputContent = activeTab === 'file' ? fileContent : content;
    if (!inputContent.trim()) { toast.error(t('analyze.error.empty')); return; }

    setLoading(true);
    setDone(false);
    setStep(t('analyze.step.0') || '分析中…');

    try {
      const analysis = await createAnalysis(
        activeTab,
        activeTab !== 'url' ? inputContent : '',
        activeTab === 'url' ? content : undefined
      );
      if (!analysis) throw new Error('Failed to create analysis');

      const steps = ['扫描内容', '提取结构', '分析语义', '生成洞见', '完成'];
      let si = 0;
      const stepInterval = setInterval(() => {
        if (si < steps.length - 1) { si++; setStep(steps[si]); }
        else clearInterval(stepInterval);
      }, 2200);

      const body: Record<string, string> = { source_type: activeTab };
      if (activeTab === 'url') body.url = content;
      else if (activeTab === 'file') body.text = fileContent;
      else body.text = content;

      const { data: fnData, error: fnError } = await supabase.functions.invoke('analyze-content', { body });
      clearInterval(stepInterval);

      if (fnError || !fnData?.success) throw new Error(fnError?.message || fnData?.error || 'Analysis failed');

      const analysisData = fnData.data;
      const note = await saveNote(analysis.id, {
        title: analysisData.title,
        summary: analysisData.summary,
        key_points: [],
        analysis_content: {},
        tags: analysisData.tags || [],
        mindmap_data: analysisData.mindmap_data || {},
        content_markdown: analysisData.report_markdown || analysisData.content_markdown || '',
        summary_markdown: analysisData.summary_markdown || '',
        analysis_markdown: analysisData.analysis_markdown || '',
        mindmap_markdown: analysisData.mindmap_markdown || '',
      });

      await updateAnalysisStatus(analysis.id, 'done');

      // Chunk & index for RAG
      if (note?.id && user?.id) {
        const ragContent = [analysisData.summary||'', analysisData.summary_markdown||'', analysisData.analysis_markdown||''].join('\n\n').slice(0,4000);
        supabase.functions.invoke('chunk-and-index', { body: { note_id: note.id, user_id: user.id, content: ragContent, title: analysisData.title||'', source_type: activeTab } }).catch(()=>{});
        onFlashNote?.(note.id);
      }

      setDone(true);
      setContent('');
      setFileContent('');
      setFileName('');
      setStep('');
      toast.success(analysisData.title ? `"${analysisData.title}" 已加入星图` : t('analyze.success'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
      await updateAnalysisStatus('', 'error').catch(()=>{});
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4 }}>
        {TABS.map(tab => (
          <button
            key={tab.type}
            onClick={() => setActiveTab(tab.type)}
            style={{
              fontFamily: MONO,
              fontSize: 9,
              letterSpacing: '0.07em',
              padding: '4px 10px',
              borderRadius: 5,
              border: activeTab === tab.type ? '1px solid rgba(0,255,102,0.40)' : '1px solid rgba(255,255,255,0.08)',
              background: activeTab === tab.type ? 'rgba(0,255,102,0.10)' : 'transparent',
              color: activeTab === tab.type ? GREEN : 'rgba(140,148,165,0.70)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Input */}
      {activeTab === 'url' && (
        <input
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="https://..."
          disabled={loading}
          style={inputStyle}
        />
      )}
      {activeTab === 'text' && (
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={t('analyze.placeholder.text') || '粘贴文本内容…'}
          disabled={loading}
          rows={4}
          style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }}
        />
      )}
      {activeTab === 'file' && (
        <div>
          <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf" onChange={handleFile} style={{ display:'none' }} />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              ...inputStyle,
              cursor: 'pointer',
              color: fileName ? 'rgba(200,210,230,0.85)' : 'rgba(80,90,110,0.60)',
              textAlign: 'left',
            }}
          >
            {fileName || (t('analyze.placeholder.file') || '选择文件…')}
          </button>
        </div>
      )}

      {/* Status */}
      {loading && (
        <div style={{ display:'flex', alignItems:'center', gap:7, fontFamily:MONO, fontSize:10, color:'rgba(0,255,102,0.70)', letterSpacing:'0.05em' }}>
          <Loader2 size={11} style={{ animation:'spin 1s linear infinite' }} />
          {step}
        </div>
      )}
      {done && (
        <div style={{ display:'flex', alignItems:'center', gap:6, fontFamily:MONO, fontSize:10, color:'rgba(0,255,102,0.80)', letterSpacing:'0.05em' }}>
          <CheckCircle2 size={11} />
          节点已加入星图
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading || (!content.trim() && !fileContent.trim())}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em',
          color: loading ? 'rgba(0,255,102,0.40)' : '#040508',
          background: loading ? 'rgba(0,255,102,0.08)' : GREEN,
          border: 'none', borderRadius: 6,
          padding: '9px 0',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s',
          opacity: (!content.trim() && !fileContent.trim() && !loading) ? 0.4 : 1,
        }}
      >
        {loading ? <Loader2 size={12} style={{ animation:'spin 1s linear infinite' }} /> : <ArrowRight size={12} />}
        {loading ? '分析中…' : t('analyze.submit') || '开始分析'}
      </button>

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 6,
  fontFamily: "'Inter',system-ui,sans-serif",
  fontSize: 12,
  color: 'rgba(200,210,230,0.85)',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};
