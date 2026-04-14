import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import { useMemoryWake } from '@/hooks/useMemoryWake';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { Note as NoteType } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { exportMarkdown, exportPDF, exportWord } from '@/lib/export';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import KnowledgeZoom from '@/components/note/KnowledgeZoom';
import PerspectiveSwitch from '@/components/note/PerspectiveSwitch';
import MemoryWakePanel from '@/components/layout/MemoryWakePanel';
import {
  ArrowLeft, Edit2, Save, Download, MapPin,
  FileText, Copy, Check, X, Sparkles,
  AlignLeft, Brain, BarChart3, Network, FlaskConical,
  ZoomIn, Repeat2
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

type TabId = 'summary' | 'analysis' | 'report' | 'mindmap';

// ── Mind map helpers ──────────────────────────────────────────────────────
interface MindNode { id: string; label: string; children?: MindNode[] }
interface MindMapData { root?: string; nodes?: MindNode[] }

const NODE_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

function buildFlow(data: MindMapData) {
  const rfNodes: {
    id: string; data: { label: string };
    position: { x: number; y: number };
    style: React.CSSProperties;
  }[] = [];
  const rfEdges: {
    id: string; source: string; target: string; style: React.CSSProperties;
  }[] = [];

  rfNodes.push({
    id: 'root',
    data: { label: data.root || '主题' },
    position: { x: 0, y: 0 },
    style: {
      background: '#6366f1', color: '#fff', border: 'none',
      borderRadius: 12, fontWeight: 700, fontSize: 14,
      padding: '10px 18px', minWidth: 120, textAlign: 'center' as const,
    },
  });

  (data.nodes || []).forEach((node, i) => {
    const col = NODE_COLORS[(i + 1) % NODE_COLORS.length];
    const x = (i - (data.nodes!.length - 1) / 2) * 240;
    rfNodes.push({
      id: node.id, data: { label: node.label }, position: { x, y: 120 },
      style: {
        background: col, color: '#fff', border: 'none',
        borderRadius: 8, fontSize: 13, padding: '8px 14px',
        minWidth: 100, textAlign: 'center' as const,
      },
    });
    rfEdges.push({ id: `root-${node.id}`, source: 'root', target: node.id, style: { stroke: col, strokeWidth: 2 } });

    (node.children || []).forEach((child, j) => {
      rfNodes.push({
        id: child.id, data: { label: child.label }, position: { x, y: 240 + j * 80 },
        style: {
          background: '#1e293b', color: '#e2e8f0', border: `1px solid ${col}40`,
          borderRadius: 6, fontSize: 12, padding: '6px 12px',
          minWidth: 90, textAlign: 'center' as const,
        },
      });
      rfEdges.push({ id: `${node.id}-${child.id}`, source: node.id, target: child.id, style: { stroke: col, strokeWidth: 1.5 } });
    });
  });
  return { rfNodes, rfEdges };
}

// ── Markdown panel (read + edit toggle) ─────────────────────────────────
function MarkdownPanel({
  fieldKey, content, noteId, onSaved, reportRef, updateNote,
}: {
  fieldKey: keyof NoteType;
  content: string;
  noteId: string;
  onSaved: (key: keyof NoteType, val: string) => void;
  reportRef?: React.RefObject<HTMLDivElement | null>;
  updateNote: (id: string, updates: Partial<NoteType>) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const t = useT();

  // sync when parent content changes
  useEffect(() => { setDraft(content); }, [content]);

  const handleSave = async () => {
    setSaving(true);
    await updateNote(noteId, { [fieldKey]: draft, is_edited: true });
    onSaved(fieldKey, draft);
    setSaving(false);
    setEditing(false);
    toast.success(t('note.saved'));
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editing ? draft : content);
    setCopied(true);
    toast.success(t('common.copied'));
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* toolbar */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-border bg-card/40 flex-shrink-0">
        <div className="flex items-center gap-2">
          {!editing ? (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="gap-1.5 text-xs">
              <Edit2 className="w-3 h-3" />{t('common.edit')}
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => { setDraft(content); setEditing(false); }} className="gap-1.5 text-xs">
                <X className="w-3 h-3" />{t('common.cancel')}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 text-xs bg-gradient-primary hover:opacity-90">
                <Save className="w-3 h-3" />{saving ? t('common.saving') : t('common.save')}
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {editing && <span className="text-xs text-muted-foreground tabular-nums">{draft.length} {t('note.charCount')}</span>}
          <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5 text-xs">
            {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
            {copied ? t('common.copied') : t('common.copy')}
          </Button>
        </div>
      </div>

      {/* content */}
      <div className="flex-1 overflow-auto">
        {editing ? (
          <div className="h-full p-4">
            <Textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="h-full font-mono text-sm resize-none bg-card min-h-[500px]"
            />
          </div>
        ) : (
          <div ref={reportRef} className="max-w-3xl mx-auto px-6 py-8">
            <div className="prose-ping">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content || `*${t('common.noContent')}*`}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function Note() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { getNote, updateNote, notes: allNotes } = useNotes(user?.id);
  const navigate = useNavigate();
  const { items: wakeItems, loading: wakeLoading, checkForNote, dismiss: dismissWake } = useMemoryWake(user?.id);
  const t = useT();
  const { lang } = useLanguage();

  const tabs: { id: TabId; label: string; icon: typeof FileText; desc: string }[] = [
    { id: 'summary',  label: t('note.tab.summary'),  icon: AlignLeft, desc: t('note.tab.summary.desc') },
    { id: 'analysis', label: t('note.tab.analysis'), icon: Brain,     desc: t('note.tab.analysis.desc') },
    { id: 'report',   label: t('note.tab.report'),   icon: BarChart3, desc: t('note.tab.report.desc') },
    { id: 'mindmap',  label: t('note.tab.mindmap'),  icon: Network,   desc: t('note.tab.mindmap.desc') },
  ];

  const [note, setNote]           = useState<NoteType | null>(null);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [mindmapView, setMindmapView] = useState<'visual' | 'text'>('visual');
  const [showZoom, setShowZoom]   = useState(false);
  const [showPersp, setShowPersp] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    getNote(id).then(n => {
      setNote(n);
      if (n?.mindmap_data) {
        const { rfNodes, rfEdges } = buildFlow(n.mindmap_data as MindMapData);
        setNodes(rfNodes);
        setEdges(rfEdges);
      }
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Trigger memory wake when note + allNotes are loaded
  useEffect(() => {
    if (!note || !allNotes?.length) return;
    checkForNote(
      { id: note.id, title: note.title||'', summary: note.summary, tags: note.tags||[] },
      allNotes.map(n => ({ id:n.id, title:n.title||'', summary:n.summary||null, tags:n.tags||[], created_at:n.created_at||'' }))
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id, allNotes?.length]);

  // Related notes for Knowledge Zoom (same tags)
  const relatedNotes = useMemo(() => {
    if (!note || !allNotes?.length) return [];
    const tags = new Set(note.tags || []);
    return allNotes
      .filter(n => n.id !== note.id && (n.tags||[]).some((t: string) => tags.has(t)))
      .slice(0, 5)
      .map(n => ({ id:n.id, title:n.title||'', summary:n.summary||null, content_markdown:n.content_markdown||null, tags:n.tags||[] }));
  }, [note, allNotes]);

  const handleSaved = (key: keyof NoteType, val: string) => {
    setNote(prev => prev ? { ...prev, [key]: val, is_edited: true } : prev);
  };

  const handleExport = (fmt: 'md' | 'pdf' | 'word') => {
    if (!note) return;
    const activeContent =
      activeTab === 'summary'  ? (note.summary_markdown  || '') :
      activeTab === 'analysis' ? (note.analysis_markdown || '') :
      activeTab === 'mindmap'  ? (note.mindmap_markdown  || '') :
      (note.content_markdown || '');

    if (fmt === 'md')   exportMarkdown(activeContent, note.title || '笔记');
    if (fmt === 'pdf')  exportPDF(reportRef.current, note.title || '笔记');
    if (fmt === 'word') exportWord(activeContent, note.title || '笔记');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary mx-auto flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <p className="text-muted-foreground text-sm">{t('note.loading')}</p>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">{t('note.notFound')}</p>
        <Button variant="outline" onClick={() => navigate(-1)}>{t('note.backToLibrary')}</Button>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#040508', overflow: 'hidden' }}>
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/60 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-semibold text-foreground text-base truncate">{note.title || t('common.untitled')}</h1>
            <p className="text-xs text-muted-foreground">
              {note.created_at ? format(new Date(note.created_at), 'PPP', { locale: lang === 'zh' ? zhCN : enUS }) : ''}
              {note.is_edited && <span className="ml-2 text-primary">{t('note.edited')}</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="hidden md:flex items-center gap-1.5">
            {(note.tags || []).slice(0, 3).map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-[rgba(0,255,102,0.25)] text-[#00d070] hover:bg-[rgba(0,255,102,0.08)] hover:border-[rgba(0,255,102,0.45)]"
            onClick={() => navigate(`/distiller?noteId=${note.id}`)}
            title="Distill this note into layered insights"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('note.distill')}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-[rgba(102,227,255,0.20)] text-[#66e3ff] hover:bg-[rgba(102,227,255,0.07)] hover:border-[rgba(102,227,255,0.40)]"
            onClick={() => { setShowZoom(v => !v); setShowPersp(false); }}
            title="Knowledge Zoom"
          >
            <ZoomIn className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('note.zoom')}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-[rgba(180,156,255,0.20)] text-[#b49cff] hover:bg-[rgba(180,156,255,0.07)] hover:border-[rgba(180,156,255,0.40)]"
            onClick={() => { setShowPersp(v => !v); setShowZoom(false); }}
            title="Perspective Switch"
          >
            <Repeat2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('note.lens')}</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('common.export')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('md')}>{t('note.export.md')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>{t('note.export.pdf')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('word')}>{t('note.export.word')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-0.5 px-6 pt-3 pb-0 border-b border-border bg-card/20 flex-shrink-0">
        {tabs.map(({ id: tid, label, icon: Icon }) => (
          <button
            key={tid}
            onClick={() => setActiveTab(tid)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all border-b-2 -mb-px',
              activeTab === tid
                ? 'text-primary border-primary bg-primary/5'
                : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/40'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Content area ── */}
      <div className="flex-1 overflow-hidden">

        {activeTab === 'summary' && (
          <MarkdownPanel
            fieldKey="summary_markdown"
            content={note.summary_markdown || ''}
            noteId={note.id}
            onSaved={handleSaved}
            updateNote={updateNote}
          />
        )}

        {activeTab === 'analysis' && (
          <MarkdownPanel
            fieldKey="analysis_markdown"
            content={note.analysis_markdown || ''}
            noteId={note.id}
            onSaved={handleSaved}
            updateNote={updateNote}
          />
        )}

        {activeTab === 'report' && (
          <MarkdownPanel
            fieldKey="content_markdown"
            content={note.content_markdown || ''}
            noteId={note.id}
            onSaved={handleSaved}
            reportRef={reportRef}
            updateNote={updateNote}
          />
        )}

        {activeTab === 'mindmap' && (
          <div className="flex flex-col h-full">
            {/* mindmap sub-tabs */}
            <div className="flex items-center gap-2 px-6 py-2 border-b border-border bg-card/40 flex-shrink-0">
              <button
                onClick={() => setMindmapView('visual')}
                className={cn(
                  'px-3 py-1 text-xs rounded-full font-medium transition-colors',
                  mindmapView === 'visual' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t('note.mindmap.visual')}
              </button>
              <button
                onClick={() => setMindmapView('text')}
                className={cn(
                  'px-3 py-1 text-xs rounded-full font-medium transition-colors',
                  mindmapView === 'text' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t('note.mindmap.text')}
              </button>
            </div>

            {mindmapView === 'visual' ? (
              <div className="flex-1" style={{ minHeight: 400 }}>
                {nodes.length > 0 ? (
                  <ReactFlow
                    nodes={nodes} edges={edges}
                    onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
                    fitView fitViewOptions={{ padding: 0.3 }}
                  >
                    <Background color="hsl(var(--border))" gap={20} />
                    <Controls />
                    <MiniMap nodeStrokeWidth={3} />
                  </ReactFlow>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                    <MapPin className="w-10 h-10 opacity-30" />
                    <p>{t('note.mindmap.noData')}</p>
                  </div>
                )}
              </div>
            ) : (
              <MarkdownPanel
                fieldKey="mindmap_markdown"
                content={note.mindmap_markdown || ''}
                noteId={note.id}
                onSaved={handleSaved}
                updateNote={updateNote}
              />
            )}
          </div>
        )}

      </div>

      {/* ── Side panels ── */}
      {showZoom && (
        <KnowledgeZoom
          note={{ id: note.id, title: note.title||'', summary: note.summary||null, content_markdown: note.content_markdown||null, tags: note.tags||[] }}
          relatedNotes={relatedNotes}
          onClose={() => setShowZoom(false)}
        />
      )}
      {showPersp && (
        <PerspectiveSwitch
          noteTitle={note.title || ''}
          noteContent={note.content_markdown || note.summary || ''}
          onClose={() => setShowPersp(false)}
        />
      )}
      <MemoryWakePanel items={wakeItems} loading={wakeLoading} onDismiss={dismissWake} />
    </div>
    </div>
  );
}
