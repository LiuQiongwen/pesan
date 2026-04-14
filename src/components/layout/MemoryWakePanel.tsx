import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, ChevronRight, X, ArrowUpRight } from 'lucide-react';
import { MemoryWakeItem } from '@/hooks/useMemoryWake';

const C = { bg:'#0e1012', border:'#1e2226', text:'#dde1e8', textSub:'#7a7f8a', textMute:'#4a4f5a', amber:'#ffaa44' };
const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

const RELEVANCE_COLOR = { high: '#ffaa44', medium: '#7a7f8a', low: '#4a4f5a' };

interface Props {
  items: MemoryWakeItem[];
  loading: boolean;
  onDismiss: () => void;
}

export default function MemoryWakePanel({ items, loading, onDismiss }: Props) {
  const navigate   = useNavigate();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = items.filter(i => !dismissed.has(i.noteId));

  if (loading || items.length === 0) return null;

  const dismiss = (noteId: string) => setDismissed(p => new Set([...p, noteId]));

  if (visible.length === 0) return null;

  return (
    <div style={{ position:'fixed', bottom:20, right:76, zIndex:50, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
      {/* Collapsed pill */}
      {!open && (
        <button onClick={()=>setOpen(true)}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 10px', borderRadius:20, background:'rgba(255,170,68,0.08)', border:'1px solid rgba(255,170,68,0.25)', cursor:'pointer', boxShadow:'0 4px 16px rgba(255,170,68,0.08)' }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:C.amber, animation:'pulse 2s ease-in-out infinite' }} />
          <Brain size={12} color={C.amber} />
          <span style={{ fontFamily:MONO, fontSize:9, color:C.amber, letterSpacing:'0.06em' }}>MEMORY WAKE · {visible.length}</span>
          <ChevronRight size={9} color={C.amber} />
        </button>
      )}

      {/* Expanded panel */}
      {open && (
        <div style={{ width:300, background:C.bg, border:`1px solid rgba(255,170,68,0.20)`, borderRadius:8, overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,0.5)' }}>
          {/* Panel header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', borderBottom:'1px solid rgba(255,170,68,0.15)', background:'rgba(255,170,68,0.04)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <Brain size={11} color={C.amber} />
              <span style={{ fontFamily:MONO, fontSize:9, color:C.amber, letterSpacing:'0.08em' }}>MEMORY WAKE</span>
              <span style={{ fontFamily:MONO, fontSize:8, color:C.textMute }}>{visible.length} resurfaced</span>
            </div>
            <div role="button" onClick={()=>{ setOpen(false); onDismiss(); }} style={{ cursor:'pointer', opacity:0.5 }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.opacity='1';}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.opacity='0.5';}}>
              <X size={11} color={C.textSub} />
            </div>
          </div>

          {/* Items */}
          <div style={{ padding:8, display:'flex', flexDirection:'column', gap:6, maxHeight:280, overflowY:'auto' }}>
            {visible.map(item => (
              <div key={item.noteId} style={{ background:'rgba(255,170,68,0.04)', border:'1px solid rgba(255,170,68,0.10)', borderRadius:5, padding:'8px 10px' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:6 }}>
                  <div style={{ flex:1 }}>
                    <button onClick={()=>navigate(`/note/${item.noteId}`)}
                      style={{ display:'flex', alignItems:'center', gap:4, background:'transparent', border:'none', cursor:'pointer', padding:0, fontFamily:INTER, fontSize:12, color:C.text, textAlign:'left', lineHeight:1.4, marginBottom:3 }}>
                      <ArrowUpRight size={10} color={C.amber} />
                      {item.title.slice(0,40)}
                    </button>
                    <p style={{ fontFamily:MONO, fontSize:9, color:C.textMute, margin:0, lineHeight:1.5 }}>{item.reason}</p>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:RELEVANCE_COLOR[item.relevance] }} />
                    <div role="button" onClick={()=>dismiss(item.noteId)} style={{ cursor:'pointer', opacity:0.4 }}
                      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.opacity='1';}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.opacity='0.4';}}>
                      <X size={9} color={C.textMute} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ padding:'6px 12px', borderTop:`1px solid ${C.border}`, fontFamily:MONO, fontSize:8, color:C.textMute }}>
            These notes are semantically related to what you're reading now.
          </div>
        </div>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}
