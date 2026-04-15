/** Shared relationship-type definitions for drag-to-connect feature */

export const RELATION_TYPES = [
  { id: 'semantic',      label: '语义关联', desc: 'Semantic',  color: '#00ff66' },
  { id: 'insight_of',   label: '洞见提炼', desc: 'Insight',   color: '#cc88ff' },
  { id: 'drives_action', label: '行动依据', desc: 'Action',   color: '#ffaa44' },
  { id: 'answers',       label: '回答关系', desc: 'Answers',  color: '#66c2ff' },
] as const;

export type RelationType = typeof RELATION_TYPES[number]['id'];
