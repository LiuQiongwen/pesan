import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import { Button } from '@/components/ui/button';
import { Brain, BookOpen, FileText, Plus, ArrowRight, Globe, Image, Video, Type, FileIcon } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { SourceType } from '@/types';

const sourceIcons: Record<SourceType, typeof Globe> = {
  url: Globe,
  text: Type,
  file: FileIcon,
  image: Image,
  video: Video,
};

const sourceLabels: Record<SourceType, string> = {
  url: '网站',
  text: '文字',
  file: '文件',
  image: '图片',
  video: '视频',
};

export default function Dashboard() {
  const { user } = useAuth();
  const { notes, loading } = useNotes(user?.id);
  const navigate = useNavigate();

  const username = user?.email?.split('@')[0] || '用户';
  const recentNotes = notes.slice(0, 6);

  const stats = [
    { label: '知识笔记', value: notes.length, icon: FileText, color: 'text-primary' },
    { label: '本周新增', value: notes.filter(n => {
      const d = new Date(n.created_at);
      const now = new Date();
      return now.getTime() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
    }).length, icon: Brain, color: 'text-accent' },
    { label: '已分析', value: notes.length, icon: BookOpen, color: 'text-green-500' },
  ];

  return (
    <div className="flex flex-col h-full overflow-auto p-8 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            你好，{username} 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            {format(new Date(), 'yyyy年M月d日', { locale: zhCN })} · 今天也在积累智识
          </p>
        </div>
        <Button
          className="bg-gradient-primary hover:opacity-90 transition-opacity"
          onClick={() => navigate('/analyze')}
        >
          <Plus className="w-4 h-4 mr-2" />
          新建分析
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {stats.map((s, i) => (
          <div
            key={i}
            className="p-5 rounded-xl bg-card border border-border shadow-card"
            style={{ animation: `fade-up 0.4s ease-out ${i * 0.1}s forwards`, opacity: 0 }}
          >
            <div className="flex items-center gap-3 mb-1">
              <s.icon className={`w-5 h-5 ${s.color}`} />
              <span className="text-muted-foreground text-sm">{s.label}</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{loading ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">快速分析</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(sourceLabels).map(([type, label]) => {
            const Icon = sourceIcons[type as SourceType];
            return (
              <button
                key={type}
                onClick={() => navigate(`/analyze?type=${type}`)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:bg-accent/5 hover:border-primary/30 hover:shadow-glow transition-all duration-200 group"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm text-foreground font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent notes */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">最近笔记</h2>
          <button
            onClick={() => navigate('/library')}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            查看全部 <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-32 rounded-xl animate-shimmer" />
            ))}
          </div>
        ) : recentNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-xl">
            <Brain className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground font-medium">还没有笔记</p>
            <p className="text-muted-foreground text-sm mt-1">开始你的第一次 AI 分析吧</p>
            <Button
              className="mt-4 bg-gradient-primary hover:opacity-90 transition-opacity"
              onClick={() => navigate('/analyze')}
            >
              <Plus className="w-4 h-4 mr-2" /> 新建分析
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentNotes.map((note, i) => {
              const Icon = sourceIcons['text'];
              return (
                <button
                  key={note.id}
                  onClick={() => navigate(`/note/${note.id}`)}
                  className="text-left p-5 rounded-xl border border-border bg-card shadow-card hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
                  style={{ animation: `fade-up 0.4s ease-out ${i * 0.05}s forwards`, opacity: 0 }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(note.created_at), { locale: zhCN, addSuffix: true })}
                    </span>
                  </div>
                  <h3 className="font-medium text-foreground text-sm mb-1 line-clamp-1">
                    {note.title || '未命名笔记'}
                  </h3>
                  <p className="text-muted-foreground text-xs line-clamp-2">
                    {note.summary || '暂无摘要'}
                  </p>
                  {note.tags?.length > 0 && (
                    <div className="flex gap-1 mt-3 flex-wrap">
                      {note.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
