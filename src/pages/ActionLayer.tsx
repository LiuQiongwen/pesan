import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, Plus, Trash2, ArrowUpRight, Circle, Clock, AlertCircle, Check, X, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useActions, Action } from '@/hooks/useActions';
import { useNotes } from '@/hooks/useNotes';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { formatDistanceToNow } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';

const C = { bg:'#0a0b0d', surface:'#0e1012', border:'#1e2226', text:'#dde1e8', textSub:'#7a7f8a', textMute:'#4a4f5a', accent:'#00ff66', amber:'#ffaa44', teal:'#00d4aa', red:'#ff6666' };
const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

const STATUS_CONFIG = {
  pending:     { label:'PENDING',     color:'#7a7f8a', bg:'rgba(122,127,138,0.08)', icon: Circle },
  in_progress: { label:'IN PROGRESS', color:'#ffaa44', bg:'rgba(255,170,68,0.08)',  icon: Clock },
  done:        { label:'DONE',        color:'#00ff66', bg:'rgba(0,255,102,0.08)',   icon: Check },
  dropped:     { label:'DROPPED',     color:'#ff6666', bg:'rgba(255,102,102,0.08)', icon: X },
};
const PRIORITY_COLOR = { high:'#ff6666', normal:'#7a7f8a', low:'#4a4f5a' };
const STATUSES = ['pending','in_progress','done','dropped'] as const;

function ActionCard({ action, notes, onUpdate, onDelete }: { action: Action; notes: {id:string,title:string}[]; onUpdate: (id:string,p:Partial<Action>)=>void; onDelete:(id:string)=>void }) {
  const navigate = useNavigate();
  const t = useT();
  const { lang } = useLanguage();
  const [showOutcome, setShowOutcome] = useState(false);
  const [outcome, setOutcome] = useState(action.outcome_note || '');
  const cfg = STATUS_CONFIG[action.status];
  const StatusIcon = cfg.icon;
  const note = notes.find(n => n.id === action.note_id);

  const cycleStatus = () => {
    const idx = STATUSES.indexOf(action.status);
    const next = STATUSES[(idx + 1) % STATUSES.length];
    onUpdate(action.id, { status: next });
    if (next === 'done') setShowOutcome(true);
  };

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, padding: '12px 14px', display:'flex', flexDirection:'column', gap: 8 }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap: 10 }}>
        <div
          role="button" tabIndex={0} onClick={cycleStatus}
          title="Click to cycle status"
          style={{ width:20, height:20, borderRadius:4, background: cfg.bg, border:`1px solid ${cfg.color}40`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, marginTop:1 }}
        >
          <StatusIcon size={11} color={cfg.color} />
        </div>
        <div style={{ flex:1 }}>
          <p style={{ fontFamily:INTER, fontSize:13, color: action.status==='done'?C.textMute:C.text, lineHeight:1.5, margin:0, textDecoration: action.status==='dropped'?'line-through':'none' }}>
            {action.content}
          </p>
          {action.source_context && (
            <p style={{ fontFamily:MONO, fontSize:10, color:C.textMute, marginTop:4, lineHeight:1.4 }}>
              "{action.source_context.slice(0,80)}…"
            </p>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background: PRIORITY_COLOR[action.priority] }} title={action.priority} />
          <div
            role="button" tabIndex={0} onClick={() => onDelete(action.id)}
            style={{ cursor:'pointer', opacity:0.4 }}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.opacity='1';}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.opacity='0.4';}}
          >
            <Trash2 size={12} color={C.textMute} />
          </div>
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontFamily:MONO, fontSize:9, color:cfg.color, background:cfg.bg, border:`1px solid ${cfg.color}28`, borderRadius:3, padding:'1.5px 6px' }}>{cfg.label}</span>
        <span style={{ fontFamily:MONO, fontSize:9, color:C.textMute }}>
          {formatDistanceToNow(new Date(action.created_at), { locale: lang === 'zh' ? zhCN : enUS, addSuffix:true })}
        </span>
        {note && (
          <button onClick={()=>navigate(`/note/${note.id}`)} style={{ display:'flex', alignItems:'center', gap:3, background:'transparent', border:'none', cursor:'pointer', fontFamily:MONO, fontSize:9, color:'rgba(102,227,255,0.6)', padding:0 }}>
            <ArrowUpRight size={9} /> {note.title?.slice(0,24)}…
          </button>
        )}
        {action.status==='done' && (
          <button onClick={()=>setShowOutcome(v=>!v)} style={{ display:'flex', alignItems:'center', gap:3, background:'transparent', border:'none', cursor:'pointer', fontFamily:MONO, fontSize:9, color:C.textMute, padding:0 }}>
            <ChevronDown size={9} /> outcome
          </button>
        )}
      </div>

      {showOutcome && (
        <div style={{ display:'flex', gap:6 }}>
          <input value={outcome} onChange={e=>setOutcome(e.target.value)}
            placeholder="What happened? What did you learn?"
            style={{ flex:1, background:'transparent', border:`1px solid ${C.border}`, borderRadius:4, padding:'5px 8px', fontFamily:MONO, fontSize:11, color:C.text, outline:'none' }}
            onBlur={()=>onUpdate(action.id, { outcome_note: outcome })} />
        </div>
      )}
    </div>
  );
}

export default function ActionLayer() {
  const { user }    = useAuth();
  const { actions, loading, create, update, remove } = useActions(user?.id);
  const { notes }   = useNotes(user?.id);
  const t = useT();
  const { lang } = useLanguage();
  const [newContent, setNewContent] = useState('');
  const [filter, setFilter]         = useState<Action['status'] | 'all'>('all');
  const [priority, setPriority]     = useState<Action['priority']>('normal');

  const addAction = async () => {
    if (!newContent.trim()) return;
    await create({ content: newContent.trim(), priority, status: 'pending' });
    setNewContent('');
  };

  const filtered = filter === 'all' ? actions : actions.filter(a => a.status === filter);
  const counts = STATUSES.reduce((acc, s) => ({ ...acc, [s]: actions.filter(a => a.status === s).length }), {} as Record<string,number>);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:C.bg, overflow:'hidden', fontFamily:INTER }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 24px', borderBottom:`1px solid ${C.border}`, background:C.surface, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:28, height:28, borderRadius:6, background:'rgba(0,212,170,0.08)', border:'1px solid rgba(0,212,170,0.20)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <CheckSquare size={13} color={C.teal} />
          </div>
          <span style={{ fontFamily:MONO, fontSize:11, fontWeight:700, color:C.text, letterSpacing:'0.12em' }}>ACTION LAYER</span>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {(['all',...STATUSES] as const).map(s => {
            const cfg = s === 'all' ? null : STATUS_CONFIG[s];
            const count = s === 'all' ? actions.length : counts[s] || 0;
            return (
              <button key={s} onClick={()=>setFilter(s)}
                style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.06em', padding:'4px 8px', borderRadius:3, cursor:'pointer', background: filter===s ? (cfg?.bg || 'rgba(221,225,232,0.08)') : 'transparent', border:`1px solid ${filter===s ? (cfg?.color || C.text)+'40' : C.border}`, color: filter===s ? (cfg?.color || C.text) : C.textMute }}>
                {s.toUpperCase().replace('_',' ')} {count}
              </button>
            );
          })}
        </div>
      </div>

      {/* Input */}
      <div style={{ padding:'14px 24px', borderBottom:`1px solid ${C.border}`, background:C.surface, flexShrink:0, display:'flex', gap:8 }}>
        <input value={newContent} onChange={e=>setNewContent(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Enter') addAction(); }}
          placeholder={t('actions.placeholder')}
          style={{ flex:1, background:'rgba(255,255,255,0.03)', border:`1px solid ${C.border}`, borderRadius:5, padding:'8px 12px', fontFamily:MONO, fontSize:12, color:C.text, outline:'none' }} />
        <select value={priority} onChange={e=>setPriority(e.target.value as Action['priority'])}
          style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:5, padding:'0 8px', fontFamily:MONO, fontSize:10, color:C.textSub, cursor:'pointer', outline:'none' }}>
          <option value="high">HIGH</option>
          <option value="normal">NORMAL</option>
          <option value="low">LOW</option>
        </select>
        <button onClick={addAction}
          style={{ width:34, height:34, borderRadius:5, background:newContent.trim()?C.teal:'rgba(0,212,170,0.12)', border:'none', cursor:newContent.trim()?'pointer':'not-allowed', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Plus size={14} color={newContent.trim()?'#040508':C.teal} />
        </button>
      </div>

      {/* List */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 24px', display:'flex', flexDirection:'column', gap:8 }}>
        {loading && <div style={{ fontFamily:MONO, fontSize:11, color:C.textMute, textAlign:'center', paddingTop:40 }}>Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign:'center', paddingTop:60 }}>
            <CheckSquare size={28} color={C.textMute} style={{ margin:'0 auto 12px' }} />
            <div style={{ fontFamily:MONO, fontSize:11, color:C.textMute }}>{t('actions.empty')}</div>
          </div>
        )}
        {filtered.map(a => (
          <ActionCard key={a.id} action={a} notes={notes as {id:string,title:string}[]} onUpdate={update} onDelete={remove} />
        ))}
        {!loading && actions.length > 0 && (
          <div style={{ fontFamily:MONO, fontSize:10, color:C.textMute, textAlign:'center', paddingTop:8, paddingBottom:16 }}>
            {lang === 'zh'
              ? `${counts['done']||0} 已完成 · ${counts['pending']||0} 待处理 · ${counts['in_progress']||0} 进行中`
              : `${counts['done']||0} completed · ${counts['pending']||0} pending · ${counts['in_progress']||0} in progress`}
          </div>
        )}
      </div>
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}`}</style>
    </div>
  );
}
