import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import { useT, useLanguage } from '@/contexts/LanguageContext';
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
import { zhCN, enUS } from 'date-fns/locale';
import { Note, SourceType } from '@/types';
import { cn } from '@/lib/utils';

const sourceIcons: Record<SourceType, typeof Globe> = {
  url: Globe, text: Type, file: FileIcon, image: Image, video: Video,
};

export default function Library() {
  const { user } = useAuth();
  const { notes, loading, deleteNote } = useNotes(user?.id);
  const navigate = useNavigate();
  const t = useT();
  const { lang } = useLanguage();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filterOptions = [
    { label: t('library.filter.all'),   value: 'all' },
    { label: t('library.filter.url'),   value: 'url' },
    { label: t('library.filter.text'),  value: 'text' },
    { label: t('library.filter.file'),  value: 'file' },
    { label: t('library.filter.image'), value: 'image' },
    { label: t('library.filter.video'), value: 'video' },
  ];

  const filtered = notes.filter(n => {
    const matchFilter = filter === 'all' || n.source_type === filter;
    const matchSearch = !search ||
      n.title?.toLowerCase().includes(search.toLowerCase()) ||
      n.summary?.toLowerCase().includes(search.toLowerCase()) ||
      n.tags?.some(tag => tag.toLowerCase().includes(search.toLowerCase()));
    return matchFilter && matchSearch;
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await deleteNote(deleteId);
    if (error) { toast.error(t('library.deleteError')); }
    else { toast.success(t('library.deleteSuccess')); }
    setDeleteId(null);
  };

  return (
    <div className="flex flex-col h-full overflow-auto p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('library.title')}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {lang === 'zh' ? `共 ${notes.length} 篇笔记` : `${notes.length} notes`}
          </p>
        </div>
        <Button
          className="bg-gradient-primary hover:opacity-90 transition-opacity"
          onClick={() => navigate('/analyze')}
        >
          <Plus className="w-4 h-4 mr-2" /> {t('library.new')}
        </Button>
      </div>

      {/* Search & filter */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('library.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 p-1 bg-muted rounded-lg flex-wrap">
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
            {search
              ? (lang === 'zh' ? '没有找到匹配的笔记' : 'No matching notes found')
              : t('library.empty')}
          </p>
          <p className="text-muted-foreground text-sm mt-1">
            {search
              ? (lang === 'zh' ? '换个关键词试试' : 'Try a different keyword')
              : t('library.empty.sub')}
          </p>
          {!search && (
            <Button
              className="mt-4 bg-gradient-primary hover:opacity-90 transition-opacity"
              onClick={() => navigate('/analyze')}
            >
              <Plus className="w-4 h-4 mr-2" /> {t('library.new')}
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
              lang={lang}
              t={t}
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
            <AlertDialogTitle>{t('library.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('library.delete.desc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('library.delete.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('library.delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NoteCard({
  note, index, lang, t, onView, onEdit, onMindMap, onDelete
}: {
  note: Note;
  index: number;
  lang: string;
  t: (k: string) => string;
  onView: () => void;
  onEdit: () => void;
  onMindMap: () => void;
  onDelete: () => void;
}) {
  const dateLocale = lang === 'zh' ? zhCN : enUS;
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
            {formatDistanceToNow(new Date(note.created_at), { locale: dateLocale, addSuffix: true })}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
              <button className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all">
                <MoreVertical className="w-4 h-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={e => { e.stopPropagation(); onEdit(); }}>
                <Edit className="w-4 h-4 mr-2" /> {t('common.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={e => { e.stopPropagation(); onMindMap(); }}>
                <MapPin className="w-4 h-4 mr-2" /> {t('note.tab.mindmap')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={e => { e.stopPropagation(); onDelete(); }}
                className="text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" /> {t('common.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <h3 className="font-semibold text-foreground text-sm mb-2 line-clamp-1">
        {note.title || t('common.untitled')}
      </h3>
      <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2 mb-3">
        {note.summary || (lang === 'zh' ? '暂无摘要' : 'No summary')}
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
