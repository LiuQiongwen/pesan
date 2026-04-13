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
  ArrowLeft, Edit2, Save, Download, MapPin,
  Lightbulb, Target, Layers, Link, FileText,
  X, CheckCircle2, AlertTriangle, HelpCircle, Sparkles, Globe2
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

// Helper: normalise key_points to always be { title, detail }[]
function normaliseKeyPoints(kp: unknown[]): { title: string; detail: string }[] {
  return kp.map(p => {
    if (typeof p === 'string') return { title: p, detail: '' };
    const obj = p as Record<string, string>;
    return { title: obj.title || '', detail: obj.detail || '' };
  });
}

// Helper: normalise main_viewpoints
function normaliseViewpoints(vp: unknown[]): { claim: string; support: string }[] {
  return vp.map(v => {
    if (typeof v === 'string') return { claim: v, support: '' };
    const obj = v as Record<string, string>;
    return { claim: obj.claim || (v as string), support: obj.support || '' };
  });
}

// Helper: normalise critical_analysis
function normaliseCritical(ca: unknown): { strengths: string[]; limitations: string[]; key_questions: string[] } {
  if (!ca) return { strengths: [], limitations: [], key_questions: [] };
  if (typeof ca === 'string') return { strengths: [ca], limitations: [], key_questions: [] };
  const obj = ca as Record<string, unknown>;
  return {
    strengths: Array.isArray(obj.strengths) ? obj.strengths as string[] : [],
    limitations: Array.isArray(obj.limitations) ? obj.limitations as string[] : [],
    key_questions: Array.isArray(obj.key_questions) ? obj.key_questions as string[] : [],
  };
}

// Helper: normalise innovative_insights
function normaliseInsights(ins: unknown[]): { insight: string; value: string }[] {
  return ins.map(i => {
    if (typeof i === 'string') return { insight: i, value: '' };
    const obj = i as Record<string, string>;
    return { insight: obj.insight || (i as string), value: obj.value || '' };
  });
}

// Helper: normalise knowledge_connections
function normaliseConnections(kc: unknown[]): { domain: string; connection: string }[] {
  return kc.map(c => {
    if (typeof c === 'string') return { domain: c, connection: '' };
    const obj = c as Record<string, string>;
    return { domain: obj.domain || (c as string), connection: obj.connection || '' };
  });
}

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
  const keyPoints = normaliseKeyPoints(note.key_points || []);
  const viewpoints = normaliseViewpoints(ac.main_viewpoints || []);
  const critical = normaliseCritical(ac.critical_analysis);
  const insights = normaliseInsights(ac.innovative_insights || []);
  const connections = normaliseConnections(ac.knowledge_connections || []);

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
            <Badge variant="outline" className="text-xs text-muted-foreground">已编辑</Badge>
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
              <Button variant="outline" size="sm" onClick={() => navigate(`/mindmap/${id}`)}>
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
                  <DropdownMenuItem onClick={() => note && exportMarkdown(note)}>
                    <FileText className="w-4 h-4 mr-2" /> Markdown (.md)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => id && exportPDF(id)}>
                    <FileText className="w-4 h-4 mr-2" /> PDF 文档
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => note && exportWord(note)}>
                    <FileText className="w-4 h-4 mr-2" /> Word 文档 (.docx)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-8 py-3 border-b border-border bg-background">
        {tabs.map(({ id: tabId, label, icon: Icon }) => (
          <button
            key={tabId}
            onClick={() => setActiveTab(tabId)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150',
              activeTab === tabId
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto" id={`note-content-${id}`}>
        <div className="max-w-3xl mx-auto px-8 py-8 w-full">

          {/* Meta */}
          <div className="flex items-center gap-3 mb-8 text-xs text-muted-foreground">
            <span>{format(new Date(note.created_at), 'yyyy年M月d日 HH:mm', { locale: zhCN })}</span>
            {note.tags?.length > 0 && (
              <>
                <span>·</span>
                <div className="flex gap-1 flex-wrap">
                  {note.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                      #{tag}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── SUMMARY TAB ───────────────────────────── */}
          {activeTab === 'summary' && (
            <div className="space-y-8 animate-fade-up">

              {/* Summary lead */}
              <div className="border-l-4 border-primary pl-5 py-1">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">核心摘要</p>
                {editing ? (
                  <Textarea
                    value={editSummary}
                    onChange={e => setEditSummary(e.target.value)}
                    className="min-h-24 resize-none text-base leading-relaxed"
                    placeholder="摘要内容..."
                  />
                ) : (
                  <p className="text-foreground text-[1.05rem] leading-[1.85] font-normal">
                    {note.summary || '暂无摘要'}
                  </p>
                )}
              </div>

              {/* Key points */}
              {keyPoints.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Layers className="w-4 h-4" /> 关键要点
                  </h3>
                  <div className="space-y-3">
                    {keyPoints.map((point, i) => (
                      <div
                        key={i}
                        className="flex gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/25 hover:shadow-sm transition-all duration-200"
                      >
                        <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground text-sm leading-snug">
                            {point.title}
                          </p>
                          {point.detail && (
                            <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
                              {point.detail}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ANALYSIS TAB ──────────────────────────── */}
          {activeTab === 'analysis' && (
            <div className="space-y-8 animate-fade-up">

              {/* Main viewpoints */}
              {viewpoints.length > 0 && (
                <AnalysisSection icon={Target} title="主要观点" accent="blue">
                  <div className="space-y-4">
                    {viewpoints.map((vp, i) => (
                      <div key={i} className="group">
                        <p className="font-semibold text-foreground text-sm leading-snug">{vp.claim}</p>
                        {vp.support && (
                          <p className="text-muted-foreground text-sm mt-1 leading-relaxed pl-0">{vp.support}</p>
                        )}
                        {i < viewpoints.length - 1 && <div className="mt-4 border-b border-border" />}
                      </div>
                    ))}
                  </div>
                </AnalysisSection>
              )}

              {/* Critical analysis — three-panel */}
              {(critical.strengths.length > 0 || critical.limitations.length > 0 || critical.key_questions.length > 0) && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4" /> 批判性分析
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    {critical.strengths.length > 0 && (
                      <CriticalPanel
                        icon={CheckCircle2}
                        label="亮点"
                        items={critical.strengths}
                        color="green"
                      />
                    )}
                    {critical.limitations.length > 0 && (
                      <CriticalPanel
                        icon={AlertTriangle}
                        label="局限"
                        items={critical.limitations}
                        color="amber"
                      />
                    )}
                    {critical.key_questions.length > 0 && (
                      <CriticalPanel
                        icon={HelpCircle}
                        label="延伸问题"
                        items={critical.key_questions}
                        color="blue"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Innovative insights */}
              {insights.length > 0 && (
                <AnalysisSection icon={Sparkles} title="创新洞见" accent="purple">
                  <div className="space-y-4">
                    {insights.map((ins, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0 mt-2" />
                        <div>
                          <p className="font-semibold text-foreground text-sm">{ins.insight}</p>
                          {ins.value && (
                            <p className="text-muted-foreground text-sm mt-0.5 leading-relaxed">{ins.value}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </AnalysisSection>
              )}

              {/* Knowledge connections */}
              {connections.length > 0 && (
                <AnalysisSection icon={Globe2} title="知识关联" accent="green">
                  <div className="space-y-3">
                    {connections.map((kc, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-green-500/10 text-green-700 dark:text-green-400 text-xs font-semibold flex-shrink-0 mt-0.5 border border-green-500/20">
                          {kc.domain}
                        </span>
                        {kc.connection && (
                          <p className="text-muted-foreground text-sm leading-relaxed">{kc.connection}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </AnalysisSection>
              )}
            </div>
          )}

          {/* ── REPORT TAB ────────────────────────────── */}
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
                <article className="prose-ping">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {note.content_markdown || '*暂无完整报告内容*'}
                  </ReactMarkdown>
                </article>
              )}
            </div>
          )}

          {/* ── MINDMAP TAB ───────────────────────────── */}
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
    </div>
  );
}

/* ────────────── Sub-components ────────────── */

function AnalysisSection({
  icon: Icon, title, accent, children
}: {
  icon: typeof FileText;
  title: string;
  accent: 'blue' | 'purple' | 'green' | 'amber';
  children: React.ReactNode;
}) {
  const accentClasses: Record<string, string> = {
    blue: 'text-blue-500',
    purple: 'text-purple-500',
    green: 'text-green-500',
    amber: 'text-amber-500',
  };
  return (
    <div className="p-5 rounded-xl bg-card border border-border">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
        <Icon className={cn('w-4 h-4', accentClasses[accent])} />
        {title}
      </h3>
      {children}
    </div>
  );
}

function CriticalPanel({
  icon: Icon, label, items, color
}: {
  icon: typeof FileText;
  label: string;
  items: string[];
  color: 'green' | 'amber' | 'blue';
}) {
  const styles: Record<string, { bg: string; text: string; border: string; iconCls: string }> = {
    green: { bg: 'bg-green-500/5', text: 'text-green-700 dark:text-green-400', border: 'border-green-500/20', iconCls: 'text-green-500' },
    amber: { bg: 'bg-amber-500/5', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-500/20', iconCls: 'text-amber-500' },
    blue: { bg: 'bg-blue-500/5', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-500/20', iconCls: 'text-blue-500' },
  };
  const s = styles[color];
  return (
    <div className={cn('rounded-xl p-4 border', s.bg, s.border)}>
      <p className={cn('text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5', s.text)}>
        <Icon className={cn('w-3.5 h-3.5', s.iconCls)} />
        {label}
      </p>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-foreground leading-relaxed">
            <span className={cn('flex-shrink-0 mt-1.5 w-1 h-1 rounded-full', color === 'green' ? 'bg-green-500' : color === 'amber' ? 'bg-amber-500' : 'bg-blue-500')} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
