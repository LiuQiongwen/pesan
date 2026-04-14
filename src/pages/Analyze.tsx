import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAnalysis } from '@/hooks/useNotes';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Globe, Type, FileIcon, Image, Video, Upload, Loader2, Sparkles, ArrowRight,
  CheckCircle2, Circle, ScanText, Brain, Scale, Lightbulb, Network, ListTree,
  FileText, FileSearch, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SourceType } from '@/types';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).href;

const tabIcons: Record<SourceType, typeof Globe> = {
  url: Globe, text: Type, file: FileIcon, image: Image, video: Video,
};

const stepIcons = [ScanText, FileSearch, Brain, Scale, Lightbulb, Network, ListTree, FileText];

function formatElapsed(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export default function Analyze() {
  const [searchParams] = useSearchParams();
  const initialType = (searchParams.get('type') as SourceType) || 'url';
  const [activeTab, setActiveTab] = useState<SourceType>(initialType);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [fileParsing, setFileParsing] = useState(false);
  const [imageData, setImageData] = useState<string>('');
  const [imageName, setImageName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const stepIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval>>();

  const { user } = useAuth();
  const { createAnalysis, updateAnalysisStatus, saveNote } = useAnalysis(user?.id);
  const navigate = useNavigate();
  const t = useT();
  const { lang } = useLanguage();

  const tabs = [
    { type: 'url'   as SourceType, icon: tabIcons.url,   label: t('analyze.tab.url'),   placeholder: t('analyze.url.placeholder') },
    { type: 'text'  as SourceType, icon: tabIcons.text,  label: t('analyze.tab.text'),  placeholder: t('analyze.text.placeholder') },
    { type: 'file'  as SourceType, icon: tabIcons.file,  label: t('analyze.tab.file'),  placeholder: '' },
    { type: 'image' as SourceType, icon: tabIcons.image, label: t('analyze.tab.image'), placeholder: '' },
    { type: 'video' as SourceType, icon: tabIcons.video, label: t('analyze.tab.video'), placeholder: lang === 'zh' ? 'https://youtube.com/watch?v=... 输入视频链接' : 'https://youtube.com/watch?v=... Video URL' },
  ];

  const analysisStepLabels: { zh: string; en: string; desc_zh: string; desc_en: string }[] = [
    { zh: '解析输入内容', en: 'Parse Input',       desc_zh: '读取并预处理输入数据', desc_en: 'Read and preprocess input' },
    { zh: '提取关键信息', en: 'Extract Key Info',  desc_zh: '识别核心实体与数据',   desc_en: 'Identify key entities and data' },
    { zh: '深度分析观点', en: 'Deep Analysis',     desc_zh: '理解主要论点与立场',   desc_en: 'Understand main arguments' },
    { zh: '批判性思考',   en: 'Critical Thinking', desc_zh: '评估内容优点与局限',   desc_en: 'Evaluate strengths & limits' },
    { zh: '生成创新洞见', en: 'Generate Insights', desc_zh: '提炼独特视角与延伸',   desc_en: 'Extract unique perspectives' },
    { zh: '构建思维导图', en: 'Build Mind Map',    desc_zh: '建立知识节点与关联',   desc_en: 'Build knowledge nodes' },
    { zh: '整理知识脉络', en: 'Organize Knowledge',desc_zh: '梳理逻辑结构与层次',   desc_en: 'Structure logical hierarchy' },
    { zh: '生成完整报告', en: 'Generate Report',   desc_zh: '输出结构化分析文档',   desc_en: 'Output structured analysis' },
  ];

  const analysisSteps = analysisStepLabels.map((s, i) => ({
    icon: stepIcons[i],
    label: lang === 'zh' ? s.zh : s.en,
    desc:  lang === 'zh' ? s.desc_zh : s.desc_en,
  }));

  useEffect(() => {
    return () => {
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setFileContent('');
    setFileParsing(true);

    const ext = file.name.split('.').pop()?.toLowerCase();

    try {
      if (ext === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items
            .map((item) => ('str' in item ? item.str : ''))
            .join(' ');
          text += pageText + '\n';
        }
        setFileContent(text.trim() || '（PDF 内容为空或无法提取文字）');
      } else if (ext === 'docx' || ext === 'doc') {
        const arrayBuffer = await file.arrayBuffer();
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ arrayBuffer });
        setFileContent(result.value.trim() || '（文档内容为空）');
      } else {
        const reader = new FileReader();
        reader.onload = (ev) => setFileContent(ev.target?.result as string);
        reader.readAsText(file);
      }
    } catch (_err) {
      toast.error('文件解析失败，请检查文件格式');
      setFileName('');
    } finally {
      setFileParsing(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setImageData(result);
    };
    reader.readAsDataURL(file);
  };

  const getSubmitContent = () => {
    if (activeTab === 'file') return fileContent;
    if (activeTab === 'image') return imageData;
    return content;
  };

  const isReady = () => {
    if (activeTab === 'file') return !!fileContent;
    if (activeTab === 'image') return !!imageData;
    return content.trim().length > 0;
  };

  const handleSubmit = async () => {
    if (!isReady() || !user) return;
    setLoading(true);
    setStepIndex(0);
    setElapsed(0);

    // Elapsed timer
    elapsedIntervalRef.current = setInterval(() => {
      setElapsed(s => s + 1);
    }, 1000);

    // Advance through steps but stop before the last one
    stepIntervalRef.current = setInterval(() => {
      setStepIndex(prev => {
        if (prev >= analysisSteps.length - 2) return prev;
        return prev + 1;
      });
    }, 2200);

    try {
      const submitContent = getSubmitContent();
      const sourceUrl = activeTab === 'url' ? content : undefined;

      const analysis = await createAnalysis(activeTab, submitContent, sourceUrl);
      if (!analysis) throw new Error('创建分析记录失败');
      await updateAnalysisStatus(analysis.id, 'analyzing');

      const { data: fnData, error: fnError } = await supabase.functions.invoke('analyze-content', {
        body: { sourceType: activeTab, content: submitContent, sourceUrl },
      });

      if (fnError) throw new Error(fnError.message);
      if (!fnData?.success) throw new Error(fnData?.error || 'AI 分析失败');

      const analysisData = fnData.data;

      // Complete last step
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
      setStepIndex(analysisSteps.length - 1);
      await new Promise(resolve => setTimeout(resolve, 500));

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

      // Fire-and-forget: chunk and index for RAG (non-blocking)
      if (note?.id && user?.id) {
        const ragContent = [
          analysisData.summary || '',
          analysisData.summary_markdown || '',
          analysisData.analysis_markdown || '',
          analysisData.report_markdown || analysisData.content_markdown || '',
        ].join('\n\n').slice(0, 4000);
        supabase.functions.invoke('chunk-and-index', {
          body: {
            note_id: note.id,
            user_id: user.id,
            content: ragContent,
            title: analysisData.title || 'Untitled',
            source_type: activeTab,
          },
        }).catch(() => { /* silent — RAG indexing failure doesn't block UX */ });
      }

      toast.success(t('analyze.done'));
      navigate(`/note/${note?.id}`);
    } catch (error: unknown) {
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
      const message = error instanceof Error ? error.message : '分析失败，请重试';
      toast.error(message);
      setLoading(false);
    }
  };

  const progress = Math.round(((stepIndex + 1) / analysisSteps.length) * 100);

  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-auto">
        <div className="max-w-2xl mx-auto w-full p-8 flex flex-col gap-6 animate-fade-up">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div>
                <h2 className="font-bold text-foreground text-lg">{t('analyze.analyzing.title')}</h2>
                <p className="text-xs text-muted-foreground">{t('analyze.analyzing.sub')}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground text-sm bg-muted px-3 py-1.5 rounded-full">
              <Clock className="w-3.5 h-3.5" />
              <span className="tabular-nums">{formatElapsed(elapsed)}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">
                {stepIndex < analysisSteps.length ? analysisSteps[stepIndex].label : '分析完成'}
              </span>
              <span className="text-sm font-semibold text-primary tabular-nums">{progress}%</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-primary rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 text-right">
              {Math.min(stepIndex + 1, analysisSteps.length)} / {analysisSteps.length}{' '}
              {lang === 'zh' ? '步骤完成' : 'steps done'}
            </p>
          </div>

          {/* Task grid */}
          <div className="grid grid-cols-2 gap-3">
            {analysisSteps.map((step, i) => {
              const Icon = step.icon;
              const isDone = i < stepIndex;
              const isActive = i === stepIndex;
              const isPending = i > stepIndex;
              return (
                <div
                  key={i}
                  className={cn(
                    'p-4 rounded-xl border transition-all duration-500',
                    isDone  && 'border-primary/30 bg-primary/5',
                    isActive && 'border-primary/60 bg-primary/10 shadow-sm shadow-primary/10',
                    isPending && 'border-border bg-card opacity-40'
                  )}
                >
                  <div className="flex items-start justify-between mb-2.5">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                      isDone   && 'bg-primary/15',
                      isActive && 'bg-primary/20',
                      isPending && 'bg-muted'
                    )}>
                      <Icon className={cn(
                        'w-4 h-4',
                        (isDone || isActive) ? 'text-primary' : 'text-muted-foreground'
                      )} />
                    </div>
                    {isDone   && <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />}
                    {isActive && <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />}
                    {isPending && <Circle className="w-4 h-4 text-muted-foreground/30 flex-shrink-0" />}
                  </div>
                  <p className={cn(
                    'text-sm font-medium leading-tight',
                    (isDone || isActive) ? 'text-foreground' : 'text-muted-foreground'
                  )}>{step.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                </div>
              );
            })}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            {t('analyze.hint')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="max-w-3xl mx-auto w-full p-8 flex flex-col flex-1">
        {/* Header */}
        <div className="mb-8 animate-fade-up">
          <h1 className="text-2xl font-bold text-foreground">{t('analyze.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('analyze.subtitle')}</p>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 mb-6 p-1 bg-muted rounded-xl">
          {tabs.map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              onClick={() => !loading && setActiveTab(type)}
              disabled={loading}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex-1 justify-center',
                activeTab === type
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Input area */}
        <div className="flex-1 flex flex-col gap-4">
          {activeTab === 'url' && (
            <div className="relative animate-fade-in">
              <Globe className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={tabs[0].placeholder}
                value={content}
                onChange={e => setContent(e.target.value)}
                disabled={loading}
                className="pl-9 h-11"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>
          )}

          {activeTab === 'text' && (
            <Textarea
              placeholder={tabs[1].placeholder}
              value={content}
              onChange={e => setContent(e.target.value)}
              disabled={loading}
              className="min-h-56 resize-none text-sm leading-relaxed animate-fade-in"
            />
          )}

          {activeTab === 'file' && (
            <div className="animate-fade-in">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.html,.xml"
                className="hidden"
              />
              {fileParsing ? (
                  <div className="w-full h-48 border border-border rounded-xl flex flex-col items-center justify-center gap-3 text-muted-foreground bg-muted/30">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm font-medium">{lang === 'zh' ? '正在解析文件内容...' : 'Parsing file...'}</p>
                </div>
              ) : !fileContent ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="w-full h-48 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all duration-200"
                >
                  <Upload className="w-10 h-10" />
                  <div>
                    <p className="font-medium">点击上传文件</p>
                    <p className="text-sm mt-0.5">支持 PDF、Word (.docx)、TXT、MD、CSV 等格式</p>
                  </div>
                </button>
              ) : (
                <div className="p-5 border border-border rounded-xl bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileIcon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">{fileName}</p>
                        <p className="text-xs text-muted-foreground">已提取 {fileContent.length.toLocaleString()} 个字符</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setFileContent(''); setFileName(''); }}>
                      更换
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'image' && (
            <div className="animate-fade-in">
              <input
                type="file"
                ref={imageInputRef}
                onChange={handleImageChange}
                accept="image/*"
                className="hidden"
              />
              {!imageData ? (
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={loading}
                  className="w-full h-48 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all duration-200"
                >
                  <Image className="w-10 h-10" />
                  <div>
                    <p className="font-medium">点击上传图片</p>
                    <p className="text-sm mt-0.5">支持 JPG, PNG, WebP, GIF 等格式</p>
                  </div>
                </button>
              ) : (
                <div className="p-5 border border-border rounded-xl bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={imageData} alt="preview" className="w-10 h-10 object-cover rounded-lg" />
                      <div>
                        <p className="font-medium text-foreground text-sm">{imageName}</p>
                        <p className="text-xs text-muted-foreground">图片已就绪</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setImageData(''); setImageName(''); }}>
                      更换
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'video' && (
            <div className="animate-fade-in">
              <div className="relative">
                <Video className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={tabs[4].placeholder}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  disabled={loading}
                  className="pl-9 h-11"
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                AI 将基于视频链接和标题进行分析（不支持直接解析视频内容）
              </p>
            </div>
          )}

          {/* Submit button */}
          <Button
            onClick={handleSubmit}
            disabled={!isReady()}
            className="mt-2 h-12 bg-gradient-primary hover:opacity-90 transition-opacity text-base"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            {lang === 'zh' ? '开始 AI 深度分析' : 'Start AI Analysis'}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
