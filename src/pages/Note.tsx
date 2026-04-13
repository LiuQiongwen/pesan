import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import { Note as NoteType } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { exportMarkdown, exportPDF, exportWord } from '@/lib/export';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft, Edit2, Save, Download, Share2, MapPin,
  Lightbulb, Target, Layers, Link, Tag, FileText,
  ChevronRight, X, MoreHorizontal
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

type TabId = 'summary' | 'analysis' | 'report' | 'mindmap';

const tabs: { id: TabId; label: string; icon: typeof FileText }[] = [
  { id: 'summary', label: '摘要', icon: Target },
  { id: 'analysis', label: '深度分析', icon: Lightbulb },
  { id: 'report', label: '完整报告', icon: FileText },
  { id: 'mindmap', label: '思维导图', icon: MapPin },
];

export default function NotePage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { getNote, updateNote } = useNotes(user?.id);
  const navigate = useNavigate();

  const [note, setNote] = useState<NoteType | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const [editing, setEditing] = useState(searchParams.get('edit') === 'true');
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editMarkdown, setEditMarkdown] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    getNote(id).then(n => {
      setNote(n);
      if (n) {
        setEditTitle(n.title || '');
        setEditSummary(n.summary || '');
        setEditMarkdown(n.content_markdown || '');
      }
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSave = async () => {
    if (!note || !id) return;
    setSaving(true);
    const { error } = await updateNote(id, {
      title: editTitle,
      summary: editSummary,
      content_markdown: editMarkdown,
    });
    if (error) { toast.error('保存失败'); }
    else {
      toast.success('已保存');
      setNote(prev => prev ? { ...prev, title: editTitle, summary: editSummary, content_markdown: editMarkdown } : null);
      setEditing(false);
    }
    setSaving(false);
  };

  const handleExportMarkdown = () => note && exportMarkdown(note);
  const handleExportPDF = () => id && exportPDF(id);
  const handleExportWord = () => note && exportWord(note);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">加载笔记...</p>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">笔记不存在或已被删除</p>
        <Button onClick={() => navigate('/library')}>返回知识库</Button>
      </div>
    );
  }

  const ac = note.analysis_content || {};

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-border sticky top-0 bg-background/90 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={() => navigate('/library')}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          {editing ? (
            <Input
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              className="font-semibold text-lg h-9 border-0 shadow-none p-0 focus-visible:ring-0 bg-transparent"
              placeholder="笔记标题..."
            />
          ) : (
            <h1 className="font-semibold text-foreground text-lg truncate">
              {note.title || '未命名笔记'}
            </h1>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          {note.is_edited && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              已编辑
            </Badge>
          )}
          {editing ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                <X className="w-4 h-4 mr-1" /> 取消
              </Button>
              <Button
                size="sm"
                className="bg-gradient-primary hover:opacity-90 transition-opacity"
                onClick={handleSave}
                disabled={saving}
              >
                <Save className="w-4 h-4 mr-1" />
                {saving ? '保存中...' : '保存'}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/mindmap/${id}`)}
              >
                <MapPin className="w-4 h-4 mr-1" /> 思维导图
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Edit2 className="w-4 h-4 mr-1" /> 编辑
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-1" /> 导出
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportMarkdown}>
                    <FileText className="w-4 h-4 mr-2" /> Markdown (.md)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportPDF}>
                    <FileText className="w-4 h-4 mr-2" /> PDF 文档
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportWord}>
                    <FileText className="w-4 h-4 mr-2" /> Word 文档 (.docx)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-8 py-3 border-b border-border">
        {tabs.map(({ id: tabId, label, icon: Icon }) => (
          <button
            key={tabId}
            onClick={() => setActiveTab(tabId)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150',
              activeTab === tabId
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6 max-w-4xl mx-auto w-full" id={`note-content-${id}`}>
        {/* Meta */}
        <div className="flex items-center gap-3 mb-6 text-xs text-muted-foreground">
          <span>{format(new Date(note.created_at), 'yyyy年M月d日 HH:mm', { locale: zhCN })}</span>
          {note.tags?.length > 0 && (
            <>
              <span>·</span>
              <div className="flex gap-1 flex-wrap">
                {note.tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Summary tab */}
        {activeTab === 'summary' && (
          <div className="space-y-6 animate-fade-up">
            {/* Summary block */}
            <div className="p-5 rounded-xl bg-gradient-card border border-border">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" /> 核心摘要
              </h3>
              {editing ? (
                <Textarea
                  value={editSummary}
                  onChange={e => setEditSummary(e.target.value)}
                  className="min-h-24 resize-none text-sm"
                  placeholder="摘要内容..."
                />
              ) : (
                <p className="text-foreground text-sm leading-relaxed">
                  {note.summary || '暂无摘要'}
                </p>
              )}
            </div>

            {/* Key points */}
            {note.key_points?.length > 0 && (
              <div>
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" /> 关键要点
                </h3>
                <div className="space-y-2">
                  {note.key_points.map((point, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border hover:border-primary/30 transition-colors">
                      <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <p className="text-sm text-foreground">{point}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Analysis tab */}
        {activeTab === 'analysis' && (
          <div className="space-y-6 animate-fade-up">
            {ac.main_viewpoints?.length > 0 && (
              <Section icon={Target} title="主要观点" iconColor="text-blue-500">
                <ul className="space-y-2">
                  {ac.main_viewpoints.map((v, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-foreground">{v}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {ac.critical_analysis && (
              <Section icon={Lightbulb} title="批判性分析" iconColor="text-amber-500">
                <p className="text-sm text-foreground leading-relaxed">{ac.critical_analysis}</p>
              </Section>
            )}

            {ac.innovative_insights?.length > 0 && (
              <Section icon={Lightbulb} title="创新洞见" iconColor="text-purple-500">
                <ul className="space-y-2">
                  {ac.innovative_insights.map((insight, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-purple-500 flex-shrink-0">✦</span>
                      <span className="text-foreground">{insight}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {ac.knowledge_connections?.length > 0 && (
              <Section icon={Link} title="知识关联" iconColor="text-green-500">
                <div className="flex flex-wrap gap-2">
                  {ac.knowledge_connections.map((c, i) => (
                    <span key={i} className="px-3 py-1.5 bg-green-500/10 text-green-600 dark:text-green-400 text-xs rounded-lg border border-green-500/20">
                      {c}
                    </span>
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}

        {/* Full report tab */}
        {activeTab === 'report' && (
          <div className="animate-fade-up">
            {editing ? (
              <Textarea
                value={editMarkdown}
                onChange={e => setEditMarkdown(e.target.value)}
                className="min-h-[600px] font-mono text-sm resize-none"
                placeholder="Markdown 格式内容..."
              />
            ) : (
              <div className="prose-ping">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {note.content_markdown || '*暂无完整报告内容*'}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Mind map redirect */}
        {activeTab === 'mindmap' && (
          <div className="flex flex-col items-center justify-center py-16 animate-fade-up">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <MapPin className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">思维导图</h3>
            <p className="text-muted-foreground text-sm mb-6 text-center max-w-xs">
              在独立页面查看完整的交互式思维导图
            </p>
            <Button
              className="bg-gradient-primary hover:opacity-90 transition-opacity"
              onClick={() => navigate(`/mindmap/${id}`)}
            >
              <MapPin className="w-4 h-4 mr-2" /> 打开思维导图
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  icon: Icon, title, iconColor, children
}: {
  icon: typeof FileText;
  title: string;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-5 rounded-xl bg-card border border-border">
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <Icon className={cn('w-4 h-4', iconColor)} />
        {title}
      </h3>
      {children}
    </div>
  );
}
