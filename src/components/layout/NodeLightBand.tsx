import { useNavigate } from 'react-router-dom';
import { ArrowRight, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import type { HoveredNodeInfo } from '@/components/starmap/KnowledgeStarMap';
import { useLanguage } from '@/contexts/LanguageContext';

const PALETTE_COLORS = ['#00ff66','#66e3ff','#b496ff','#ffa040','#ff64b4','#64a0ff'];
const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

interface NodeLightBandProps {
  node: HoveredNodeInfo | null;
  onTagClick?: (tag: string) => void;
}

export function NodeLightBand({ node, onTagClick }: NodeLightBandProps) {
  const navigate = useNavigate();
  const { lang } = useLanguage();

  const visible = !!node;
  const color = node?.clusterIdx != null && node.clusterIdx >= 0
    ? PALETTE_COLORS[node.clusterIdx % PALETTE_COLORS.length]
    : '#666e80';

  const dateStr = node?.createdAt
    ? formatDistanceToNow(new Date(node.createdAt), {
        locale: lang === 'zh' ? zhCN : enUS,
        addSuffix: true,
      })
    : '';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 15,
        height: 88,
        background: 'linear-gradient(to top, rgba(4,5,8,0.96) 0%, rgba(4,5,8,0.75) 60%, rgba(4,5,8,0.0) 100%)',
        backdropFilter: visible ? 'blur(14px)' : 'none',
        WebkitBackdropFilter: visible ? 'blur(14px)' : 'none',
        borderTop: visible ? `1px solid ${color}28` : '1px solid transparent',
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1), border-color 0.22s, backdrop-filter 0.22s',
        display: 'flex',
        alignItems: 'center',
        padding: '0 28px',
        gap: 18,
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {/* Color dot */}
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 10px ${color}99`,
        flexShrink: 0,
      }} />

      {/* Title + summary */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: INTER,
          fontSize: 13,
          fontWeight: 600,
          color: '#f0f4ff',
          marginBottom: 3,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {node?.title}
        </div>
        {node?.summary && (
          <div style={{
            fontFamily: INTER,
            fontSize: 11,
            color: 'rgba(160,168,185,0.80)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {node.summary.slice(0, 100)}{node.summary.length > 100 ? '…' : ''}
          </div>
        )}
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', gap: 5, flexShrink: 0, maxWidth: 200, overflow: 'hidden' }}>
        {(node?.tags || []).slice(0, 3).map(tag => (
          <span key={tag}
            onClick={() => onTagClick?.(tag)}
            style={{
              fontFamily: MONO,
              fontSize: 9,
              color: `${color}cc`,
              background: `${color}12`,
              border: `1px solid ${color}28`,
              padding: '2px 7px',
              borderRadius: 3,
              letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
              cursor: onTagClick ? 'pointer' : 'default',
              transition: 'background 0.12s, border-color 0.12s',
            }}
            onMouseEnter={e => { if (onTagClick) { (e.currentTarget as HTMLSpanElement).style.background = `${color}28`; (e.currentTarget as HTMLSpanElement).style.borderColor = `${color}55`; } }}
            onMouseLeave={e => { (e.currentTarget as HTMLSpanElement).style.background = `${color}12`; (e.currentTarget as HTMLSpanElement).style.borderColor = `${color}28`; }}
          >#{tag}</span>
        ))}
      </div>

      {/* Date */}
      <div style={{
        fontFamily: MONO,
        fontSize: 10,
        color: 'rgba(100,108,125,0.65)',
        letterSpacing: '0.04em',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}>
        <Clock size={9} />
        {dateStr}
      </div>

      {/* Open button */}
      {node && (
        <button
          onClick={() => navigate(`/note/${node.noteId}`)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontFamily: MONO,
            fontSize: 10,
            color: color,
            background: `${color}10`,
            border: `1px solid ${color}30`,
            borderRadius: 5,
            padding: '6px 12px',
            cursor: 'pointer',
            letterSpacing: '0.04em',
            transition: 'all 0.15s',
            flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = `${color}20`; e.currentTarget.style.borderColor = `${color}60`; }}
          onMouseLeave={e => { e.currentTarget.style.background = `${color}10`; e.currentTarget.style.borderColor = `${color}30`; }}
        >
          {lang === 'zh' ? '展开' : 'Open'}
          <ArrowRight size={10} />
        </button>
      )}
    </div>
  );
}
