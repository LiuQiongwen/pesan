export type SourceType = 'url' | 'text' | 'file' | 'image' | 'video';
export type AnalysisStatus = 'pending' | 'analyzing' | 'done' | 'error';
export type NodeType =
  | 'capture' | 'summary' | 'insight' | 'action' | 'question' | 'relation' | 'obsidian'
  | 'wiki_topic' | 'wiki_entity' | 'wiki_timeline' | 'wiki_summary' | 'wiki_question' | 'wiki_overview';

export type WikiPageType = 'topic' | 'entity' | 'timeline' | 'summary' | 'question' | 'overview';

export interface WikiPage {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  page_type: WikiPageType;
  summary: string | null;
  content_markdown: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  version: number;
  source_note_ids: string[];
  source_chunk_ids: string[];
  compiled_at: string;
  created_at: string;
  updated_at: string;
}

export interface WikiSourceRef {
  id: string;
  wiki_page_id: string;
  note_id: string | null;
  chunk_id: string | null;
  section_anchor: string | null;
  excerpt: string | null;
}

export interface Analysis {
  id: string;
  user_id: string;
  title: string | null;
  source_type: SourceType;
  source_content: string | null;
  source_url: string | null;
  status: AnalysisStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface MindMapNode {
  id: string;
  label: string;
  children?: MindMapNode[];
}

export interface MindMapData {
  root: string;
  nodes: MindMapNode[];
}

export interface AnalysisContent {
  main_viewpoints: string[];
  critical_analysis: string;
  innovative_insights: string[];
  knowledge_connections: string[];
}

export interface Note {
  id: string;
  analysis_id: string | null;
  user_id: string;
  title: string | null;
  summary: string | null;
  key_points: string[];
  analysis_content: AnalysisContent;
  tags: string[];
  mindmap_data: MindMapData;
  content_markdown: string | null;
  summary_markdown: string | null;
  analysis_markdown: string | null;
  mindmap_markdown: string | null;
  is_edited: boolean;
  node_type: NodeType;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  theme: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoteWithAnalysis extends Note {
  analysis?: Analysis;
}
