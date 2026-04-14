import { useState, useEffect } from 'react';
import { CheckSquare, Square, Plus, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";
const BLUE = '#64c8ff';

interface Action { id: string; title: string; completed: boolean; priority: string; created_at: string }

export default function ActionsBox() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const t = useT();
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      const { data } = await supabase
        .from('actions')
        .select('id,title,completed,priority,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setActions((data || []) as Action[]);
      setLoading(false);
    };
    load();
  }, [user?.id]);

  const addAction = async () => {
    if (!newTitle.trim() || !user?.id || adding) return;
    setAdding(true);
    const { data } = await supabase.from('actions').insert({
      user_id: user.id, title: newTitle.trim(), completed: false, priority: 'medium',
      status: 'pending', source_type: 'manual', created_at: new Date().toISOString(),
    }).select().maybeSingle();
    if (data) setActions(prev => [data as Action, ...prev]);
    setNewTitle('');
    setAdding(false);
  };

  const toggleAction = async (id: string, completed: boolean) => {
    await supabase.from('actions').update({ completed: !completed }).eq('id', id);
    setActions(prev => prev.map(a => a.id === id ? { ...a, completed: !a.completed } : a));
  };

  const deleteAction = async (id: string) => {
    await supabase.from('actions').delete().eq('id', id);
    setActions(prev => prev.filter(a => a.id !== id));
    toast.success(lang === 'zh' ? '已删除' : 'Deleted');
  };

  const done   = actions.filter(a => a.completed).length;
  const total  = actions.length;

  return (
    <div style={{ display:'flex', flexDirection:'column' }}>
      {/* Add input */}
      <div style={{ padding:'10px 12px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display:'flex', gap:6 }}>
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addAction()}
            placeholder={t('actions.addPlaceholder') || '添加行动项…'}
            style={{
              flex:1, padding:'7px 9px',
              background:'rgba(255,255,255,0.04)',
              border:'1px solid rgba(100,200,255,0.15)',
              borderRadius:5,
              fontFamily:INTER, fontSize:11,
              color:'rgba(200,210,230,0.85)',
              outline:'none',
            }}
          />
          <button
            onClick={addAction}
            disabled={!newTitle.trim() || adding}
            style={{
              display:'flex', alignItems:'center', justifyContent:'center',
              width:30, height:30, borderRadius:5,
              background:'rgba(100,200,255,0.14)', border:`1px solid rgba(100,200,255,0.30)`,
              cursor:'pointer', flexShrink:0,
            }}
          >
            {adding ? <Loader2 size={11} color={BLUE} style={{ animation:'spin 1s linear infinite' }} /> : <Plus size={11} color={BLUE} />}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding:'5px 12px', fontFamily:MONO, fontSize:9, color:'rgba(80,90,110,0.55)', letterSpacing:'0.05em' }}>
        {done}/{total} {lang === 'zh' ? '已完成' : 'done'}
      </div>

      {/* Action list */}
      <div style={{ maxHeight:300, overflowY:'auto' }}>
        {loading ? (
          <div style={{ padding:20, textAlign:'center', fontFamily:MONO, fontSize:10, color:'rgba(80,90,110,0.50)' }}>…</div>
        ) : actions.length === 0 ? (
          <div style={{ padding:20, textAlign:'center', fontFamily:MONO, fontSize:10, color:'rgba(80,90,110,0.50)' }}>
            {t('actions.empty') || '暂无行动项'}
          </div>
        ) : (
          actions.map(action => (
            <div
              key={action.id}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}
            >
              <button
                onClick={() => toggleAction(action.id, action.completed)}
                style={{ background:'none', border:'none', cursor:'pointer', padding:0, flexShrink:0, color: action.completed ? BLUE : 'rgba(100,110,135,0.55)', display:'flex' }}
              >
                {action.completed ? <CheckSquare size={14} /> : <Square size={14} />}
              </button>
              <span style={{ fontFamily:INTER, fontSize:11, color: action.completed ? 'rgba(120,130,155,0.55)' : 'rgba(200,210,230,0.85)', flex:1, textDecoration: action.completed ? 'line-through' : 'none', lineHeight:1.5 }}>
                {action.title}
              </span>
              <button
                onClick={() => deleteAction(action.id)}
                style={{ background:'none', border:'none', cursor:'pointer', padding:2, color:'rgba(100,110,130,0.35)', transition:'color 0.12s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,80,80,0.65)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(100,110,130,0.35)'; }}
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))
        )}
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
