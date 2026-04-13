import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import { Note, MindMapNode } from '@/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ZoomIn, ZoomOut, Maximize2, Download } from 'lucide-react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const NODE_COLORS = [
  { bg: 'hsl(221 83% 53%)', text: '#ffffff' },
  { bg: 'hsl(249 82% 62%)', text: '#ffffff' },
  { bg: 'hsl(175 84% 32%)', text: '#ffffff' },
  { bg: 'hsl(38 92% 50%)', text: '#ffffff' },
  { bg: 'hsl(355 70% 54%)', text: '#ffffff' },
];

function buildNodesAndEdges(mindmapData: Note['mindmap_data']) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  if (!mindmapData?.root) return { nodes, edges };

  // Root node
  const rootColor = NODE_COLORS[0];
  nodes.push({
    id: 'root',
    data: { label: mindmapData.root },
    position: { x: 0, y: 0 },
    style: {
      background: rootColor.bg,
      color: rootColor.text,
      border: 'none',
      borderRadius: '12px',
      padding: '12px 20px',
      fontWeight: '600',
      fontSize: '15px',
      minWidth: '120px',
      textAlign: 'center',
      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
    },
  });

  const topLevelNodes = mindmapData.nodes || [];
  const colSpacing = 280;
  const rowSpacing = 120;

  topLevelNodes.forEach((node, i) => {
    const colorIdx = (i % (NODE_COLORS.length - 1)) + 1;
    const color = NODE_COLORS[colorIdx];
    const xPos = (i - (topLevelNodes.length - 1) / 2) * colSpacing;
    const yPos = 120;

    nodes.push({
      id: node.id,
      data: { label: node.label },
      position: { x: xPos, y: yPos },
      style: {
        background: color.bg,
        color: color.text,
        border: 'none',
        borderRadius: '10px',
        padding: '8px 16px',
        fontWeight: '500',
        fontSize: '13px',
        minWidth: '100px',
        textAlign: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      },
    });

    edges.push({
      id: `root-${node.id}`,
      source: 'root',
      target: node.id,
      style: { stroke: color.bg, strokeWidth: 2 },
      type: 'smoothstep',
    });

    // Children
    const children = node.children || [];
    children.forEach((child, j) => {
      const childYPos = yPos + rowSpacing + j * 60;
      const childXOffset = (j - (children.length - 1) / 2) * 180;

      nodes.push({
        id: child.id,
        data: { label: child.label },
        position: { x: xPos + childXOffset, y: childYPos },
        style: {
          background: 'hsl(var(--card))',
          color: 'hsl(var(--foreground))',
          border: `2px solid ${color.bg}`,
          borderRadius: '8px',
          padding: '6px 12px',
          fontSize: '12px',
          minWidth: '80px',
          textAlign: 'center',
        },
      });

      edges.push({
        id: `${node.id}-${child.id}`,
        source: node.id,
        target: child.id,
        style: { stroke: color.bg, strokeWidth: 1.5, strokeDasharray: '4 2' },
        type: 'smoothstep',
      });

      // Grandchildren
      const grandchildren = child.children || [];
      grandchildren.forEach((gc, k) => {
        const gcYPos = childYPos + 60 + k * 50;
        nodes.push({
          id: gc.id,
          data: { label: gc.label },
          position: { x: xPos + childXOffset + (k - (grandchildren.length - 1) / 2) * 140, y: gcYPos },
          style: {
            background: 'hsl(var(--muted))',
            color: 'hsl(var(--foreground))',
            border: `1px solid hsl(var(--border))`,
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '11px',
            minWidth: '70px',
            textAlign: 'center',
          },
        });

        edges.push({
          id: `${child.id}-${gc.id}`,
          source: child.id,
          target: gc.id,
          style: { stroke: 'hsl(var(--border))', strokeWidth: 1 },
          type: 'smoothstep',
        });
      });
    });
  });

  return { nodes, edges };
}

export default function MindMapPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { getNote } = useNotes(user?.id);
  const navigate = useNavigate();

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (!id) return;
    getNote(id).then(n => {
      setNote(n);
      if (n?.mindmap_data) {
        const { nodes: initNodes, edges: initEdges } = buildNodesAndEdges(n.mindmap_data);
        setNodes(initNodes);
        setEdges(initEdges);
      }
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleDownload = useCallback(() => {
    const canvas = document.querySelector('.react-flow') as HTMLElement;
    if (!canvas) return;
    const svgEl = canvas.querySelector('svg');
    if (!svgEl) return;
    // Basic export via serialization
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svgEl);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note?.title || 'mindmap'}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [note]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!note) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">笔记不存在</p>
        <Button onClick={() => navigate('/library')}>返回知识库</Button>
      </div>
    );
  }

  const isEmpty = nodes.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-border bg-background z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/note/${id}`)}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-semibold text-foreground text-sm">{note.title || '未命名笔记'}</h1>
            <p className="text-muted-foreground text-xs">思维导图</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="w-4 h-4 mr-1" /> 导出 SVG
        </Button>
      </div>

      {/* Flow canvas */}
      <div className="flex-1 bg-muted/30">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <p className="font-medium">暂无思维导图数据</p>
            <p className="text-sm">重新分析内容以生成思维导图</p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="hsl(var(--border))"
            />
            <Controls
              className="rounded-lg border border-border shadow-card overflow-hidden"
            />
            <MiniMap
              className="rounded-lg border border-border overflow-hidden"
              nodeColor={n => (n.style?.background as string) || 'hsl(var(--muted))'}
            />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
