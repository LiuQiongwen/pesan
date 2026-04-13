import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import { Note as NoteType } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { exportMarkdown, exportPDF, exportWord } from '@/lib/export';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft, Edit2, Save, Download, MapPin,
  FileText, Copy, Check, X, Sparkles
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

type TabId = 'read' | 'edit' | 'mindmap';

const tabs: { id: TabId; label: string; icon: typeof FileText }[] = [
  { id: 'read',    label: '报告阅读', icon: FileText },
  { id: 'edit',    label: '编辑',     icon: Edit2    },
  { id: 'mindmap', label: '思维导图', icon: MapPin   },
];

// ── Mind map helpers ───────────────────────────────────────────────────────
interface MindNode { id: string; label: string; children?: MindNode[] }
interface MindMapData { root?: string; nodes?: MindNode[] }

const NODE_COLORS = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444'];

function buildFlow(data: MindMapData) {
  const rfNodes: { id: string; data: { label: string }; position: { x: number; y: number }; style: React.CSSProperties }[] = [];
  const rfEdges: { id: string; source: string; target: string; style: React.CSSProperties }[] = [];

  rfNodes.push({
    id: 'root',
    data: { label: data.root || '主题' },
    position: { x: 0, y: 0 },
    style: { background: '#6366f1', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 14, padding: '10px 18px', minWidth: 120, textAlign: 'center' as const },
  });

  (data.nodes || []).forEach((node, i) => {
    const col = NODE_COLORS[(i + 1) % NODE_COLORS.length];
    const x = (i - (data.nodes!.length - 1) / 2) * 240;
    rfNodes.push({
      id: node.id,
      data: { label: node.label },
      position: { x, y: 120 },
      style: { background: col, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, padding: '8px 14px', minWidth: 100, textAlign: 'center' as const },
    });
    rfEdges.push({ id: `root-${node.id}`, source: 'root', target: node.id, style: { stroke: col, strokeWidth: 2 } });

    (node.children || []).forEach((child, j) => {
      const cy = 240 + j * 80;
      rfNodes.push({
        id: child.id,
        data: { label: child.label },
        position: { x, y: cy },
        style: { background: '#1e293b', color: '#e2e8f0', border: `1px solid ${col}40`, borderRadius: 6, fontSize: 12, padding: '6px 12px', minWidth: 90, textAlign: 'center' as const },
      });
      rfEdges.push({ id: `${node.id}-${child.id}`, source: node.id, target: child.id, style: { stroke: col, strokeWidth: 1.5 } });
    });
  });

  return { rfNodes, rfEdges };
}

// ── Main component ─────────────────────────────────────────────────────────
export default function Note() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { getNote, updateNote } = useNotes(user?.id);
  const navigate = useNavigate();

  const [note, setNote]               = useState<NoteType | null>(null);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState<TabId>('read');
  const [editMarkdown, setEditMarkdown] = useState('');
  const [saving, setSaving]           = useState(false);
  const [copied, setCopied]           = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const reportRef = useRef<HTMLDivElement>(null);

  // Load note
  useEffect(() => {
    if (!id) return;
    getNote(id).then(n => {
      setNote(n);
      if (n?.content_markdown) setEditMarkdown(n.content_markdown);
      if (n?.mindmap_data) {
        const { rfNodes, rfEdges } = buildFlow(n.mindmap_data as MindMapData);
        setNodes(rfNodes);
        setEdges(rfEdges);
      }
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSave = async () => {
    if (!note) return;
    setSaving(true);
    await updateNote(note.id, { content_markdown: editMarkdown, is_edited: true });
    setNote(prev => prev ? { ...prev, content_markdown: editMarkdown } : prev);
    setSaving(false);
    toast.success('已保存');
  };

  const handleCopy = async () => {
    const text = note?.content_markdown || '';
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('已复制到剪贴板');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = (fmt: 'md' | 'pdf' | 'word') => {
    if (!note) return;
    if (fmt === 'md')   exportMarkdown(note.content_markdown || '', note.title || '笔记');
    if (fmt === 'pdf')  exportPDF(reportRef.current, note.title || '笔记');
    if (fmt === 'word') exportWord(note.content_markdown || '', note.title || '笔记');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary mx-auto flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <p className="text-muted-foreground text-sm">加载笔记中…</p>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">笔记不存在</p>
        <Button variant="outline" onClick={() => navigate('/library')}>返回知识库</Button>
      </div>
    );
  }

  const markdown = activeTab === 'edit' ? editMarkdown : (note.content_markdown || '');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/60 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate('/library')} className="flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-semibold text-foreground text-base truncate">{note.title || '未命名笔记'}</h1>
            <p className="text-xs text-muted-foreground">
              {note.created_at ? format(new Date(note.created_at), 'PPP', { locale: zhCN }) : ''}
              {note.is_edited && <span className="ml-2 text-primary">· 已编辑</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Tags */}
          <div className="hidden md:flex items-center gap-1.5">
            {(note.tags || []).slice(0, 3).map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
          </div>

          {/* Copy */}
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
            {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? '已复制' : '复制 MD'}</span>
          </Button>

          {/* Download */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">下载</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('md')}>Markdown (.md)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>PDF 文档</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('word')}>Word (.docx)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 px-6 pt-3 pb-0 border-b border-border flex-shrink-0">
        {tabs.map(({ id: tid, label, icon: Icon }) => (
          <button
            key={tid}
            onClick={() => setActiveTab(tid)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px',
              activeTab === tid
                ? 'text-primary border-primary bg-primary/5'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}

        {/* Save button (only in edit mode) */}
        {activeTab === 'edit' && (
          <div className="ml-auto pb-1 flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setEditMarkdown(note.content_markdown || ''); setActiveTab('read'); }}>
              <X className="w-3.5 h-3.5 mr-1" />取消
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-gradient-primary hover:opacity-90">
              <Save className="w-3.5 h-3.5 mr-1" />
              {saving ? '保存中…' : '保存'}
            </Button>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto">
        {/* Read tab */}
        {activeTab === 'read' && (
          <div ref={reportRef} className="max-w-3xl mx-auto px-6 py-8">
            <div className="prose-ping">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {note.content_markdown || '*暂无内容*'}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Edit tab */}
        {activeTab === 'edit' && (
          <div className="h-full flex flex-col p-6 gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">编辑 Markdown 源码，保存后实时更新报告</p>
              <span className="text-xs text-muted-foreground tabular-nums">{editMarkdown.length} 字符</span>
            </div>
            <Textarea
              value={editMarkdown}
              onChange={e => setEditMarkdown(e.target.value)}
              className="flex-1 font-mono text-sm resize-none bg-card min-h-[400px]"
              placeholder="在此输入 Markdown 内容..."
            />
          </div>
        )}

        {/* Mind map tab */}
        {activeTab === 'mindmap' && (
          <div className="h-full" style={{ minHeight: 500 }}>
            {nodes.length > 0 ? (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
                fitViewOptions={{ padding: 0.3 }}
              >
                <Background color="hsl(var(--border))" gap={20} />
                <Controls />
                <MiniMap nodeStrokeWidth={3} />
              </ReactFlow>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <MapPin className="w-10 h-10 opacity-30" />
                <p>暂无思维导图数据</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
