import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAnalysis } from '@/hooks/useNotes';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Globe, Type, FileIcon, Image, Video, Upload, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SourceType } from '@/types';

const tabs: { type: SourceType; icon: typeof Globe; label: string; placeholder: string }[] = [
  { type: 'url', icon: Globe, label: '网站', placeholder: 'https://example.com 输入网址，AI 将抓取并分析网页内容' },
  { type: 'text', icon: Type, label: '文字', placeholder: '将文章、段落、笔记等任意文字内容粘贴至此处...' },
  { type: 'file', icon: FileIcon, label: '文件', placeholder: '' },
  { type: 'image', icon: Image, label: '图片', placeholder: '' },
  { type: 'video', icon: Video, label: '视频', placeholder: 'https://youtube.com/watch?v=... 输入视频链接（YouTube等）' },
];

const analysisSteps = [
  '解析输入内容...',
  '提取关键信息...',
  '深度分析观点...',
  '批判性思考中...',
  '生成创新洞见...',
  '构建思维导图...',
  '整理知识脉络...',
  '生成完整报告...',
];

export default function Analyze() {
  const [searchParams] = useSearchParams();
  const initialType = (searchParams.get('type') as SourceType) || 'url';
  const [activeTab, setActiveTab] = useState<SourceType>(initialType);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [imageData, setImageData] = useState<string>('');
  const [imageName, setImageName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const stepIntervalRef = useRef<ReturnType<typeof setInterval>>();

  const { user } = useAuth();
  const { createAnalysis, updateAnalysisStatus, saveNote } = useAnalysis(user?.id);
  const navigate = useNavigate();

  useEffect(() => {
    return () => { if (stepIntervalRef.current) clearInterval(stepIntervalRef.current); };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFileContent(ev.target?.result as string);
    };
    reader.readAsText(file);
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

    // Cycle through analysis steps
    stepIntervalRef.current = setInterval(() => {
      setStepIndex(prev => (prev + 1) % analysisSteps.length);
    }, 2000);

    try {
      const submitContent = getSubmitContent();
      const sourceUrl = activeTab === 'url' ? content : undefined;

      // Create analysis record
      const analysis = await createAnalysis(activeTab, submitContent, sourceUrl);
      if (!analysis) throw new Error('创建分析记录失败');

      await updateAnalysisStatus(analysis.id, 'analyzing');

      // Call edge function
      const { data: fnData, error: fnError } = await supabase.functions.invoke('analyze-content', {
        body: { sourceType: activeTab, content: submitContent, sourceUrl },
      });

      if (fnError) throw new Error(fnError.message);
      if (!fnData?.success) throw new Error(fnData?.error || 'AI 分析失败');

      const analysisData = fnData.data;

      // Save note
      const note = await saveNote(analysis.id, {
        title: analysisData.title,
        summary: analysisData.summary,
        key_points: analysisData.key_points || [],
        analysis_content: analysisData.analysis_content || {},
        tags: analysisData.tags || [],
        mindmap_data: analysisData.mindmap_data || {},
        content_markdown: analysisData.content_markdown || '',
      });

      await updateAnalysisStatus(analysis.id, 'done');

      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
      toast.success('分析完成！');
      navigate(`/note/${note?.id}`);
    } catch (error: unknown) {
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
      const message = error instanceof Error ? error.message : '分析失败，请重试';
      toast.error(message);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="max-w-3xl mx-auto w-full p-8 flex flex-col flex-1">
        {/* Header */}
        <div className="mb-8 animate-fade-up">
          <h1 className="text-2xl font-bold text-foreground">新建分析</h1>
          <p className="text-muted-foreground mt-1">输入任意内容，AI 将自动提炼洞见并整理知识</p>
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
                accept=".txt,.md,.csv,.pdf,.json,.html,.xml"
                className="hidden"
              />
              {!fileContent ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="w-full h-48 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all duration-200"
                >
                  <Upload className="w-10 h-10" />
                  <div>
                    <p className="font-medium">点击上传文件</p>
                    <p className="text-sm mt-0.5">支持 TXT, MD, CSV, JSON, HTML 等文本格式</p>
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
                        <p className="text-xs text-muted-foreground">{fileContent.length.toLocaleString()} 字符</p>
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

          {/* Analysis progress */}
          {loading && (
            <div className="mt-4 p-6 rounded-xl border border-primary/20 bg-primary/5 animate-fade-in">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center animate-spin" style={{ animationDuration: '3s' }}>
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">AI 深度分析中</p>
                  <p className="text-xs text-muted-foreground">使用 Claude Sonnet 4.5</p>
                </div>
              </div>
              <div className="space-y-2">
                {analysisSteps.map((step, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center gap-2 text-sm transition-all duration-300',
                      i < stepIndex ? 'text-primary' : i === stepIndex ? 'text-foreground' : 'text-muted-foreground/40'
                    )}
                  >
                    <div className={cn(
                      'w-1.5 h-1.5 rounded-full flex-shrink-0',
                      i < stepIndex ? 'bg-primary' : i === stepIndex ? 'bg-foreground animate-pulse' : 'bg-muted'
                    )} />
                    {step}
                    {i === stepIndex && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit button */}
          {!loading && (
            <Button
              onClick={handleSubmit}
              disabled={!isReady()}
              className="mt-2 h-12 bg-gradient-primary hover:opacity-90 transition-opacity text-base"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              开始 AI 深度分析
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
