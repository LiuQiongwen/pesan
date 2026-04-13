import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import { Button } from '@/components/ui/button';
import { Brain, BookOpen, FileText, Plus, Globe, Image, Video, Type, FileIcon, Tag } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { SourceType } from '@/types';
import KnowledgeConstellation from '@/components/dashboard/KnowledgeConstellation';

const sourceIcons: Record<SourceType, typeof Globe> = {
  url: Globe, text: Type, file: FileIcon, image: Image, video: Video,
};
const sourceLabels: Record<SourceType, string> = {
  url: '网站', text: '文字', file: '文件', image: '图片', video: '视频',
};

export default function Dashboard() {
  const { user } = useAuth();
  const { notes, loading } = useNotes(user?.id);
  const navigate = useNavigate();

  const username = user?.email?.split('@')[0] || '用户';

  const thisWeek = notes.filter(n => {
    const d = new Date(n.created_at);
    return Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
  }).length;

  // All unique tags across notes
  const allTags = Array.from(new Set(notes.flatMap(n => n.tags || []))).slice(0, 8);

  // Most connected notes (by shared tags)
  const recentNotes = notes.slice(0, 4);

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="max-w-5xl mx-auto w-full px-6 py-6 space-y-6">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between animate-fade-up">
          <div>
            <h1 className="text-xl font-bold text-foreground">
              你好，{username}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {format(new Date(), 'yyyy年M月d日 EEEE', { locale: zhCN })}
            </p>
          </div>
          <Button
            className="bg-gradient-primary hover:opacity-90 transition-opacity"
            onClick={() => navigate('/analyze')}
          >
            <Plus className="w-4 h-4 mr-1.5" />新建分析
          </Button>
        </div>

        {/* ── Stats row ───────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 animate-fade-up" style={{ animationDelay: '0.05s' }}>
          {[
            { label: '知识笔记', value: notes.length, icon: FileText, color: 'text-primary' },
            { label: '本周新增', value: thisWeek, icon: Brain, color: 'text-violet-400' },
            { label: '标签数量', value: allTags.length, icon: BookOpen, color: 'text-emerald-400' },
          ].map((s, i) => (
            <div key={i} className="p-4 rounded-xl bg-card border border-border shadow-card flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground tabular-nums">{loading ? '—' : s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Knowledge Constellation ─────────────────────────────── */}
        <div className="animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">知识星图</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                按标签关联自动连线 · 悬停预览 · 点击查看分析
              </p>
            </div>
            {notes.length > 0 && (
              <button
                onClick={() => navigate('/library')}
                className="text-xs text-primary hover:underline"
              >
                知识库 →
              </button>
            )}
          </div>
          <KnowledgeConstellation notes={notes} loading={loading} />
        </div>

        {/* ── Tag cloud ───────────────────────────────────────────── */}
        {allTags.length > 0 && (
          <div className="animate-fade-up" style={{ animationDelay: '0.15s' }}>
            <div className="flex items-center gap-2 mb-2.5">
              <Tag className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">热门标签</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => navigate('/library')}
                  className="px-3 py-1 bg-primary/8 hover:bg-primary/15 text-primary text-xs rounded-full border border-primary/15 transition-colors"
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Quick input types ───────────────────────────────────── */}
        <div className="animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2.5">快速输入</p>
          <div className="grid grid-cols-5 gap-2">
            {Object.entries(sourceLabels).map(([type, label]) => {
              const Icon = sourceIcons[type as SourceType];
              return (
                <button
                  key={type}
                  onClick={() => navigate(`/analyze?type=${type}`)}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-border bg-card hover:bg-primary/5 hover:border-primary/30 transition-all duration-150 group"
                >
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Recent analyses ─────────────────────────────────────── */}
        {recentNotes.length > 0 && (
          <div className="animate-fade-up" style={{ animationDelay: '0.25s' }}>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2.5">最近分析</p>
            <div className="space-y-2">
              {recentNotes.map((note, i) => (
                <button
                  key={note.id}
                  onClick={() => navigate(`/note/${note.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted/30 hover:border-primary/20 transition-all text-left group"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: `hsl(${(i * 47 + 220) % 360}, 70%, 60%)` }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {note.title || '未命名笔记'}
                    </p>
                    {note.summary && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{note.summary}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(note.tags || []).slice(0, 2).map(tag => (
                      <span key={tag} className="hidden sm:inline-block px-2 py-0.5 bg-primary/8 text-primary text-xs rounded-full">
                        #{tag}
                      </span>
                    ))}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(note.created_at), { locale: zhCN, addSuffix: true })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
