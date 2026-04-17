import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, X, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";
const ACCENT = '#10b981';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function WikiCompileModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<'idle' | 'compiling' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<{ created: number; updated: number; total_pages: number } | null>(null);
  const [wikiCount, setWikiCount] = useState(0);
  const [noteCount, setNoteCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const [wRes, nRes] = await Promise.all([
        supabase.from('wiki_pages').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', user.id).not('node_type', 'like', 'wiki_%'),
      ]);
      setWikiCount(wRes.count ?? 0);
      setNoteCount(nRes.count ?? 0);
    })();
  }, [open, user]);

  const handleCompile = useCallback(async () => {
    if (!user) return;
    setPhase('compiling');
    setErrorMsg('');
    try {
      const { data, error } = await supabase.functions.invoke('wiki-compile', {
        body: { user_id: user.id, trigger: 'manual' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Compilation failed');
      setResult(data);
      setWikiCount(data.total_pages ?? wikiCount);
      setPhase('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setPhase('error');
    }
  }, [user, wikiCount]);

  const handleClose = () => {
    setPhase('idle');
    setResult(null);
    setErrorMsg('');
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
    }} onClick={handleClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 400, maxHeight: '80vh', overflow: 'auto',
        background: 'linear-gradient(145deg, rgba(8,24,18,0.97), rgba(4,12,10,0.99))',
        border: `1px solid ${ACCENT}33`,
        borderRadius: 16, padding: 28,
        boxShadow: `0 0 60px ${ACCENT}15`,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookOpen size={18} color={ACCENT} />
            <span style={{ fontFamily: INTER, fontWeight: 700, fontSize: 16, color: 'rgba(230,238,255,0.92)' }}>
              Knowledge Wiki
            </span>
          </div>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={16} color="rgba(160,170,200,0.6)" />
          </button>
        </div>

        {/* Stats */}
        <div style={{
          display: 'flex', gap: 12, marginBottom: 16,
          padding: 12, borderRadius: 10,
          background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.1)',
        }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: ACCENT }}>{wikiCount}</div>
            <div style={{ fontFamily: INTER, fontSize: 10, color: 'rgba(160,170,200,0.5)' }}>Wiki 页</div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: 'rgba(200,210,230,0.7)' }}>{noteCount}</div>
            <div style={{ fontFamily: INTER, fontSize: 10, color: 'rgba(160,170,200,0.5)' }}>原始笔记</div>
          </div>
        </div>

        {/* Idle */}
        {phase === 'idle' && (
          <div>
            <p style={{ fontFamily: INTER, fontSize: 13, color: 'rgba(180,190,220,0.75)', lineHeight: 1.6, marginBottom: 16 }}>
              AI 将扫描你的笔记，自动生成或更新主题 Wiki 页。
              Wiki 页是从原始资料中编译的结构化知识，不会修改你的任何原始笔记。
            </p>
            <button onClick={handleCompile} style={{
              width: '100%', padding: '12px 0', borderRadius: 10,
              background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`,
              border: 'none', cursor: 'pointer',
              fontFamily: INTER, fontWeight: 700, fontSize: 14,
              color: '#fff', letterSpacing: '0.03em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <RefreshCw size={15} /> 编译知识
            </button>
          </div>
        )}

        {/* Compiling */}
        {phase === 'compiling' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <Loader2 size={28} color={ACCENT} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
            <div style={{ fontFamily: INTER, fontSize: 14, color: 'rgba(230,238,255,0.85)', marginBottom: 4 }}>
              AI 正在编译知识...
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(120,130,160,0.5)' }}>
              分析笔记 / 识别主题 / 生成 Wiki 页
            </div>
          </div>
        )}

        {/* Done */}
        {phase === 'done' && result && (
          <div style={{ textAlign: 'center' }}>
            <CheckCircle2 size={32} color={ACCENT} style={{ marginBottom: 8 }} />
            <div style={{ fontFamily: INTER, fontSize: 15, fontWeight: 700, color: 'rgba(230,238,255,0.92)', marginBottom: 12 }}>
              编译完成
            </div>
            <div style={{
              display: 'flex', gap: 12, marginBottom: 16, justifyContent: 'center',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 700, color: ACCENT }}>{result.created}</div>
                <div style={{ fontFamily: INTER, fontSize: 10, color: 'rgba(160,170,200,0.5)' }}>新建</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 700, color: '#66f0ff' }}>{result.updated}</div>
                <div style={{ fontFamily: INTER, fontSize: 10, color: 'rgba(160,170,200,0.5)' }}>更新</div>
              </div>
            </div>
            <p style={{ fontFamily: INTER, fontSize: 11, color: 'rgba(120,130,160,0.5)', marginBottom: 12 }}>
              Wiki 页已映射为星图节点（钻石形），可在星图中查看
            </p>
            <button onClick={handleClose} style={{
              padding: '8px 24px', borderRadius: 8,
              background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
              cursor: 'pointer', fontFamily: INTER, fontSize: 12, color: ACCENT,
            }}>
              关闭
            </button>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <AlertCircle size={28} color="#ff4466" style={{ marginBottom: 8 }} />
            <div style={{ fontFamily: INTER, fontSize: 13, color: 'rgba(255,68,102,0.85)', marginBottom: 12 }}>
              {errorMsg || '编译失败'}
            </div>
            <button onClick={() => setPhase('idle')} style={{
              padding: '8px 20px', borderRadius: 8,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer', fontFamily: INTER, fontSize: 12, color: 'rgba(200,210,230,0.8)',
            }}>
              重试
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
