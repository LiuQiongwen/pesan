/**
 * CosmosExportModal — export derived knowledge as _cosmos/ zip
 * for placing into Obsidian Vault.
 */
import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Download, X, FileText, Zap, GitBranch, Brain, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { exportCosmos, ExportProgress, ExportResult } from '@/lib/cosmos-exporter';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";
const ACCENT = '#a855f7';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CosmosExportModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<'idle' | 'exporting' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleExport = useCallback(async () => {
    if (!user) return;
    setPhase('exporting');
    setErrorMsg('');
    try {
      const res = await exportCosmos(supabase, user.id, (p) => {
        setProgress(p);
        if (p.phase === 'error') {
          setErrorMsg(p.detail);
          setPhase('error');
        }
      });
      setResult(res);
      setPhase('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setPhase('error');
    }
  }, [user]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `_cosmos-export-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result]);

  const handleClose = () => {
    setPhase('idle');
    setProgress(null);
    setResult(null);
    setErrorMsg('');
    onClose();
  };

  if (!open) return null;

  const pct = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
    }} onClick={handleClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 420, maxHeight: '80vh', overflow: 'auto',
        background: 'linear-gradient(145deg, rgba(20,14,32,0.97), rgba(12,8,22,0.99))',
        border: `1px solid ${ACCENT}33`,
        borderRadius: 16, padding: 28,
        boxShadow: `0 0 60px ${ACCENT}15`,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Download size={18} color={ACCENT} />
            <span style={{ fontFamily: INTER, fontWeight: 700, fontSize: 16, color: 'rgba(230,238,255,0.92)' }}>
              导出至 Obsidian
            </span>
          </div>
          <button onClick={handleClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
          }}>
            <X size={16} color="rgba(160,170,200,0.6)" />
          </button>
        </div>

        {/* Idle — explanation + start */}
        {phase === 'idle' && (
          <div>
            <p style={{ fontFamily: INTER, fontSize: 13, color: 'rgba(180,190,220,0.8)', lineHeight: 1.6, marginBottom: 16 }}>
              将你的知识宇宙中的洞察、行动、关系和认知报告导出为 Obsidian 兼容的 Markdown 文件。
              所有文件放在 <code style={{ fontFamily: MONO, background: 'rgba(168,85,247,0.15)', padding: '1px 5px', borderRadius: 3, fontSize: 12 }}>_cosmos/</code> 文件夹中，
              不会覆盖你的任何原始笔记。
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                { icon: FileText, label: '洞察笔记', desc: 'insights/', color: '#b496ff' },
                { icon: Zap, label: '行动项', desc: 'actions/', color: '#ff4466' },
                { icon: GitBranch, label: '关系图谱', desc: 'relations.md', color: '#66f0ff' },
                { icon: Brain, label: '认知报告', desc: 'reports/', color: '#00ff66' },
              ].map(item => (
                <div key={item.label} style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10, padding: '12px 14px',
                }}>
                  <item.icon size={14} color={item.color} style={{ marginBottom: 4 }} />
                  <div style={{ fontFamily: INTER, fontSize: 12, fontWeight: 600, color: 'rgba(230,238,255,0.85)' }}>
                    {item.label}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(120,130,160,0.6)', marginTop: 2 }}>
                    _cosmos/{item.desc}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={handleExport} style={{
              width: '100%', padding: '12px 0', borderRadius: 10,
              background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`,
              border: 'none', cursor: 'pointer',
              fontFamily: INTER, fontWeight: 700, fontSize: 14,
              color: '#fff', letterSpacing: '0.03em',
            }}>
              开始导出
            </button>
          </div>
        )}

        {/* Exporting */}
        {phase === 'exporting' && progress && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Loader2 size={28} color={ACCENT} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
            <div style={{ fontFamily: INTER, fontSize: 14, color: 'rgba(230,238,255,0.85)', marginBottom: 8 }}>
              {progress.detail}
            </div>
            <div style={{
              height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)',
              overflow: 'hidden', marginBottom: 6,
            }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT}aa)`,
                borderRadius: 2, transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(120,130,160,0.5)' }}>
              {pct}%
            </div>
          </div>
        )}

        {/* Done */}
        {phase === 'done' && result && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <CheckCircle2 size={32} color="#00ff66" style={{ marginBottom: 8 }} />
              <div style={{ fontFamily: INTER, fontSize: 15, fontWeight: 700, color: 'rgba(230,238,255,0.92)' }}>
                导出完成
              </div>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16,
              background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: 14,
              border: '1px solid rgba(255,255,255,0.05)',
            }}>
              {[
                { label: '洞察', count: result.stats.insights, color: '#b496ff' },
                { label: '行动', count: result.stats.actions, color: '#ff4466' },
                { label: '关系', count: result.stats.relations, color: '#66f0ff' },
                { label: '报告', count: result.stats.reports, color: '#00ff66' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: s.color }}>
                    {s.count}
                  </div>
                  <div style={{ fontFamily: INTER, fontSize: 10, color: 'rgba(160,170,200,0.5)', marginTop: 2 }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontFamily: INTER, fontSize: 11, color: 'rgba(160,170,200,0.6)', marginBottom: 14, textAlign: 'center' }}>
              共 {result.stats.totalFiles} 个文件 ({(result.blob.size / 1024).toFixed(1)} KB)
            </div>

            <button onClick={handleDownload} style={{
              width: '100%', padding: '12px 0', borderRadius: 10,
              background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`,
              border: 'none', cursor: 'pointer', marginBottom: 8,
              fontFamily: INTER, fontWeight: 700, fontSize: 14,
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <Download size={16} /> 下载 _cosmos.zip
            </button>

            <p style={{
              fontFamily: INTER, fontSize: 11, color: 'rgba(120,130,160,0.5)',
              textAlign: 'center', lineHeight: 1.5,
            }}>
              解压后将 <code style={{ fontFamily: MONO, fontSize: 10 }}>_cosmos/</code> 文件夹放入你的 Obsidian Vault 根目录即可
            </p>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <AlertCircle size={28} color="#ff4466" style={{ marginBottom: 8 }} />
            <div style={{ fontFamily: INTER, fontSize: 13, color: 'rgba(255,68,102,0.85)', marginBottom: 12 }}>
              {errorMsg || '导出失败'}
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
