import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Search, Plus, MoreVertical, Trash2, Edit, MapPin, Brain, Globe, Type, FileIcon, Image, Video } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Note, SourceType } from '@/types';
import { cn } from '@/lib/utils';

const sourceIcons: Record<SourceType, typeof Globe> = {
  url: Globe, text: Type, file: FileIcon, image: Image, video: Video,
};

const filterOptions: { label: string; value: string }[] = [
  { label: '全部', value: 'all' },
  { label: '网站', value: 'url' },
  { label: '文字', value: 'text' },
  { label: '文件', value: 'file' },
  { label: '图片', value: 'image' },
  { label: '视频', value: 'video' },
];

export default function Library() {
  const { user } = useAuth();
  const { notes, loading, deleteNote } = useNotes(user?.id);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = notes.filter(n => {
    const matchSearch = !search ||
      n.title?.toLowerCase().includes(search.toLowerCase()) ||
      n.summary?.toLowerCase().includes(search.toLowerCase()) ||
      n.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()));
    return matchSearch;
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await deleteNote(deleteId);
    if (error) { toast.error('删除失败'); }
    else { toast.success('笔记已删除'); }
    setDeleteId(null);
  };

  return (
    <div className="flex flex-col h-full overflow-auto p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold text-foreground">知识库</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            共 {notes.length} 篇笔记
          </p>
        </div>
        <Button
          className="bg-gradient-primary hover:opacity-90 transition-opacity"
          onClick={() => navigate('/analyze')}
        >
          <Plus className="w-4 h-4 mr-2" /> 新建分析
        </Button>
      </div>

      {/* Search & filter */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索笔记标题、摘要、标签..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {filterOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150',
                filter === opt.value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-44 rounded-xl animate-shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-20 text-center">
          <Brain className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <p className="text-foreground font-medium">
            {search ? '没有找到匹配的笔记' : '知识库还是空的'}
          </p>
          <p className="text-muted-foreground text-sm mt-1">
            {search ? '换个关键词试试' : '开始你的第一次分析吧'}
          </p>
          {!search && (
            <Button
              className="mt-4 bg-gradient-primary hover:opacity-90 transition-opacity"
              onClick={() => navigate('/analyze')}
            >
              <Plus className="w-4 h-4 mr-2" /> 新建分析
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((note, i) => (
            <NoteCard
              key={note.id}
              note={note}
              index={i}
              onView={() => navigate(`/note/${note.id}`)}
              onEdit={() => navigate(`/note/${note.id}?edit=true`)}
              onMindMap={() => navigate(`/mindmap/${note.id}`)}
              onDelete={() => setDeleteId(note.id)}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              删除后无法恢复，该笔记的所有内容将被永久删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NoteCard({
  note, index, onView, onEdit, onMindMap, onDelete
}: {
  note: Note;
  index: number;
  onView: () => void;
  onEdit: () => void;
  onMindMap: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="group relative p-5 rounded-xl border border-border bg-card shadow-card hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
      style={{ animation: `fade-up 0.4s ease-out ${index * 0.04}s forwards`, opacity: 0 }}
      onClick={onView}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Type className="w-4 h-4 text-primary" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(note.created_at), { locale: zhCN, addSuffix: true })}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
              <button className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all">
                <MoreVertical className="w-4 h-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={e => { e.stopPropagation(); onEdit(); }}>
                <Edit className="w-4 h-4 mr-2" /> 编辑
              </DropdownMenuItem>
              <DropdownMenuItem onClick={e => { e.stopPropagation(); onMindMap(); }}>
                <MapPin className="w-4 h-4 mr-2" /> 思维导图
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={e => { e.stopPropagation(); onDelete(); }}
                className="text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" /> 删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <h3 className="font-semibold text-foreground text-sm mb-2 line-clamp-1">
        {note.title || '未命名笔记'}
      </h3>
      <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2 mb-3">
        {note.summary || '暂无摘要'}
      </p>

      {note.tags?.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {note.tags.slice(0, 3).map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
              #{tag}
            </span>
          ))}
          {note.tags.length > 3 && (
            <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full">
              +{note.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
