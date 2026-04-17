/** Shared relationship-type definitions for node connections */

export const RELATION_TYPES = [
  { id: 'semantic',       label: '语义关联', desc: '两个知识节点在含义上相关',           color: '#00ff66' },
  { id: 'insight_of',     label: '洞见提炼', desc: '从原始笔记中提炼出的深层认知',       color: '#cc88ff' },
  { id: 'drives_action',  label: '行动依据', desc: '这条知识驱动了某个具体行动',         color: '#ffaa44' },
  { id: 'answers',        label: '回答关系', desc: '一个节点回答了另一个节点提出的问题',   color: '#66c2ff' },
  { id: 'supports',       label: '论据支撑', desc: '一个节点为另一个提供佐证',           color: '#44dd88' },
  { id: 'contradicts',    label: '矛盾冲突', desc: '两个节点的观点存在对立',             color: '#ff4466' },
  { id: 'extends',        label: '延伸拓展', desc: '在原有认知上进一步拓展',             color: '#66f0ff' },
  { id: 'inspires',       label: '灵感启发', desc: '一个节点激发了另一个的产生',          color: '#ffa0d0' },
] as const;

/** System/auto edge types (not user-selectable but displayable) */
export const SYSTEM_EDGE_TYPES = [
  { id: 'related',        label: '共享标签',   desc: '通过共同标签自动关联',           color: '#4a5068' },
  { id: 'wikilink',       label: 'Wiki链接',   desc: 'Obsidian [[wikilink]] 导入',    color: '#a855f7' },
  { id: 'compiled_from',  label: '编译来源',   desc: 'Wiki 页由此笔记编译生成',        color: '#10b981' },
  { id: 'wiki_crossref',  label: '知识互引',   desc: 'Wiki 页之间的交叉引用',          color: '#06b6d4' },
] as const;

export type RelationType = typeof RELATION_TYPES[number]['id'];
export type SystemEdgeType = typeof SYSTEM_EDGE_TYPES[number]['id'];
export type AnyEdgeType = RelationType | SystemEdgeType;

/** Lookup any edge type config by id */
export function getEdgeTypeConfig(id: string) {
  return (RELATION_TYPES as readonly { id: string; label: string; desc: string; color: string }[])
    .find(r => r.id === id)
    ?? (SYSTEM_EDGE_TYPES as readonly { id: string; label: string; desc: string; color: string }[])
      .find(r => r.id === id)
    ?? { id, label: id, desc: '', color: '#4a5068' };
}
