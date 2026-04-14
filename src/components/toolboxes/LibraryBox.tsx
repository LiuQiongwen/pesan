import { useState } from 'react';
import { Search, Globe, Type, FileIcon, Image, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { formatDistanceToNow } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import { toast } from 'sonner';
import { SourceType } from '@/types';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";
const PALETTE = ['#00ff66','#66e3ff','#b496ff','#ffa040','#ff64b4','#64a0ff'];

const srcColors: Record<SourceType, string> = { url:'#64a0ff', text:'#00ff66', file:'#ffa040', image:'#b496ff', video:'#ff64b4' };
const srcIcons: Record<SourceType, typeof Globe> = { url:Globe, text:Type, file:FileIcon, image:Image, video:FileIcon };

interface Props { onHighlight?: (noteId: string) => void }

export default function LibraryBox({ onHighlight }: Props) {
  const { user } = useAuth();
  const { notes, loading, deleteNote } = useNotes(user?.id);
  const { lang } = useLanguage();
  const t = useT();
  const [q, setQ] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = notes.filter(n =>
    !q || n.title?.toLowerCase().includes(q.toLowerCase()) ||
    (n.tags || []).some(tag => tag.toLowerCase().includes(q.toLowerCase()))
  );

  const handleDelete = async (id: string) => {
    await deleteNote(id);
    toast.success(t('library.deleted') || '已删除');
    setDeleteId(null);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column' }}>
      {/* Search */}
      <div style={{ padding:'10px 12px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ position:'relative' }}>
          <Search size={11} style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', color:'rgba(100,110,130,0.6)', pointerEvents:'none' }} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={t('library.search') || '搜索笔记…'}
            style={{
              width:'100%', padding:'6px 8px 6px 26px',
              background:'rgba(255,255,255,0.04)',
              border:'1px solid rgba(255,255,255,0.08)',
              borderRadius:5,
              fontFamily:INTER, fontSize:11,
              color:'rgba(200,210,230,0.80)',
              outline:'none', boxSizing:'border-box',
            }}
          />
        </div>
      </div>

      {/* Count */}
      <div style={{ padding:'6px 12px', fontFamily:MONO, fontSize:9, color:'rgba(80,90,110,0.55)', letterSpacing:'0.05em' }}>
        {filtered.length} / {notes.length} notes
      </div>

      {/* Note list */}
      <div style={{ maxHeight:320, overflowY:'auto' }}>
        {loading ? (
          <div style={{ padding:'20px', textAlign:'center', fontFamily:MONO, fontSize:10, color:'rgba(80,90,110,0.50)' }}>…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:'20px', textAlign:'center', fontFamily:MONO, fontSize:10, color:'rgba(80,90,110,0.50)' }}>
            {q ? t('library.noResults') || 'no results' : t('library.empty') || 'no notes yet'}
          </div>
        ) : (
          filtered.map((note, i) => {
            const SrcIcon = srcIcons[note.source_type as SourceType] || FileIcon;
            const srcColor = srcColors[note.source_type as SourceType] || '#888';
            const clusterColor = note.tags?.length ? PALETTE[i % PALETTE.length] : '#666e80';
            const date = formatDistanceToNow(new Date(note.created_at), {
              locale: lang === 'zh' ? zhCN : enUS, addSuffix: true,
            });

            return (
              <div
                key={note.id}
                onMouseEnter={() => onHighlight?.(note.id)}
                onMouseLeave={() => onHighlight?.('')}
                style={{
                  display:'flex', alignItems:'center', gap:8,
                  padding:'8px 12px',
                  borderBottom:'1px solid rgba(255,255,255,0.04)',
                  cursor:'default',
                  transition:'background 0.12s',
                }}
                onMouseOver={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'; }}
                onMouseOut={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                {/* Color dot */}
                <div style={{ width:5, height:5, borderRadius:'50%', background:clusterColor, flexShrink:0, boxShadow:`0 0 6px ${clusterColor}80` }} />

                {/* Src icon */}
                <SrcIcon size={10} color={srcColor} style={{ flexShrink:0 }} />

                {/* Title */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:INTER, fontSize:11, color:'rgba(200,210,230,0.85)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {note.title || t('library.untitled')}
                  </div>
                  <div style={{ fontFamily:MONO, fontSize:9, color:'rgba(80,90,110,0.55)', marginTop:1 }}>{date}</div>
                </div>

                {/* Delete */}
                {deleteId === note.id ? (
                  <div style={{ display:'flex', gap:4 }}>
                    <button onClick={() => handleDelete(note.id)} style={{ fontFamily:MONO, fontSize:9, color:'#ff5050', background:'rgba(255,80,80,0.10)', border:'1px solid rgba(255,80,80,0.25)', borderRadius:3, padding:'2px 7px', cursor:'pointer' }}>
                      {lang==='zh'?'确认':'Yes'}
                    </button>
                    <button onClick={() => setDeleteId(null)} style={{ fontFamily:MONO, fontSize:9, color:'rgba(140,148,165,0.70)', background:'transparent', border:'1px solid rgba(255,255,255,0.08)', borderRadius:3, padding:'2px 7px', cursor:'pointer' }}>
                      {lang==='zh'?'取消':'No'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteId(note.id); }}
                    style={{ background:'transparent', border:'none', cursor:'pointer', color:'rgba(100,110,130,0.4)', padding:3, borderRadius:3, transition:'color 0.12s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,80,80,0.70)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(100,110,130,0.4)'; }}
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
