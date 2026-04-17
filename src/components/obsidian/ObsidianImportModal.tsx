/**
 * Obsidian Import Modal — phase timeline + action cards + last import info
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  X, Upload, FileArchive, CheckCircle2, AlertCircle, Loader2,
  Link2, Tag, FolderOpen, FileText, RefreshCw, Telescope, Search,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/hooks/useAuth';
import { useObsidianImport } from '@/hooks/useObsidianImport';
import { useToolbox } from '@/contexts/ToolboxContext';
import { supabase } from '@/integrations/supabase/client';
import JSZip from 'jszip';
import type { ImportPhase } from '@/lib/obsidian-importer';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";
const ACCENT = '#a855f7';

interface PreviewStats { fileCount: number; folderCount: number; linkCount: number; tagCount: number; totalSize: string }
interface LastImportInfo { date: string; imported: number; updated: number; skipped: number }

interface Props { open: boolean; onClose: () => void; onImportDone?: () => void }

type Step = 'select' | 'preview' | 'importing' | 'done' | 'error';

/* ── Phase timeline config ─────────────────────────────────────────────────── */
const PHASES: { key: ImportPhase; label: string }[] = [
  { key: 'unzip',  label: '解压文件' },
  { key: 'parse',  label: '解析 Markdown' },
  { key: 'diff',   label: '比对变化' },
  { key: 'delete', label: '清理删除' },
  { key: 'insert', label: '写入新笔记' },
  { key: 'update', label: '更新修改' },
  { key: 'index',  label: 'RAG 索引' },
  { key: 'edges',  label: '建立关系' },
];

function phaseIndex(phase: ImportPhase): number {
  const idx = PHASES.findIndex(p => p.key === phase);
  return idx >= 0 ? idx : phase === 'done' ? PHASES.length : -1;
}

/* ── Component ─────────────────────────────────────────────────────────────── */
export function ObsidianImportModal({ open, onClose, onImportDone }: Props) {
  const { user } = useAuth();
  const importer = useObsidianImport(user?.id);
  const { openPod } = useToolbox();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('select');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewStats | null>(null);
  const [scanning, setScanning] = useState(false);
  const [lastImport, setLastImport] = useState<LastImportInfo | null>(null);

  // Reset + detect sync mode + fetch last import
  useEffect(() => {
    if (!open || !user?.id) return;
    setStep('select');
    setZipFile(null);
    setPreview(null);
    importer.reset();
    importer.detectSyncMode();

    // Load last import record
    supabase
      .from('obsidian_imports')
      .select('finished_at, imported, updated, skipped')
      .eq('user_id', user.id)
      .eq('status', 'done')
      .order('finished_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.finished_at) {
          const d = new Date(data.finished_at);
          const diff = Date.now() - d.getTime();
          const days = Math.floor(diff / 86400000);
          const dateStr = days === 0 ? '今天' : days === 1 ? '昨天' : `${days} 天前`;
          setLastImport({
            date: dateStr,
            imported: (data.imported as number) ?? 0,
            updated: (data.updated as number) ?? 0,
            skipped: (data.skipped as number) ?? 0,
          });
        } else {
          setLastImport(null);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id]);

  const scanZip = useCallback(async (file: File) => {
    setScanning(true);
    try {
      const zip = await JSZip.loadAsync(file);
      const folders = new Set<string>();
      const tags = new Set<string>();
      let linkCount = 0, fileCount = 0, totalBytes = 0;
      const SKIP = ['.obsidian', '.trash', '.git', '__macosx'];

      for (const [path, entry] of Object.entries(zip.files)) {
        if (entry.dir || !path.endsWith('.md')) continue;
        if (SKIP.some(d => path.toLowerCase().startsWith(d + '/'))) continue;
        fileCount++;
        const text = await entry.async('string');
        totalBytes += text.length;
        const parts = path.split('/');
        if (parts.length > 2) folders.add(parts[1] || parts[0]);
        else if (parts.length > 1) folders.add(parts[0]);
        const links = text.match(/\[\[([^\]]+?)\]\]/g);
        if (links) linkCount += links.length;
        const inlineTags = text.match(/(?:^|\s)#([a-zA-Z\u4e00-\u9fff][\w\u4e00-\u9fff/-]*)/g);
        if (inlineTags) inlineTags.forEach(t => tags.add(t.trim().slice(1)));
      }

      const sizeStr = totalBytes > 1024 * 1024
        ? `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
        : `${(totalBytes / 1024).toFixed(0)} KB`;

      setPreview({ fileCount, folderCount: folders.size, linkCount, tagCount: tags.size, totalSize: sizeStr });
      setStep('preview');
    } catch {
      setStep('error');
    } finally {
      setScanning(false);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setZipFile(file); scanZip(file); }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.zip') || file.type === 'application/zip')) {
      setZipFile(file);
      scanZip(file);
    }
  };

  const handleStartImport = async () => {
    if (!zipFile) return;
    setStep('importing');
    const res = await importer.run(zipFile);
    setStep(res ? 'done' : 'error');
    if (res) onImportDone?.();
  };

  const handleClose = () => { if (!importer.running) onClose(); };

  /* ── Action: view in star map + highlight obsidian cluster ─────────────── */
  const handleViewStarMap = () => {
    window.dispatchEvent(new CustomEvent('obsidian-import-done', { detail: { filterTag: 'obsidian' } }));
    onClose();
  };

  /* ── Action: open retrieval pod ────────────────────────────────────────── */
  const handleSearchKnowledge = () => {
    openPod('retrieval');
    onClose();
  };

  if (!open) return null;

  const isSyncMode = importer.syncMode;
  const p = importer.progress;
  const activePhaseIdx = p ? phaseIndex(p.phase) : -1;
  const pct = p && p.total > 0 ? Math.round((p.current / p.total) * 100) : 0;

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={handleClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(500px, 92vw)', background: 'linear-gradient(170deg, rgba(20,16,32,0.98), rgba(8,6,16,0.98))',
          border: `1px solid ${ACCENT}33`, borderRadius: 16, padding: 'clamp(20px, 3vh, 32px)',
          fontFamily: INTER, color: '#e6eeff', position: 'relative',
          boxShadow: `0 0 60px ${ACCENT}18`,
        }}
      >
        <button
          onClick={handleClose} disabled={importer.running}
          style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: '#888fa8', cursor: importer.running ? 'not-allowed' : 'pointer', padding: 4 }}
        >
          <X size={18} />
        </button>

        {/* ═══ Header ═══ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `${ACCENT}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isSyncMode ? <RefreshCw size={18} color={ACCENT} /> : <FileArchive size={18} color={ACCENT} />}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {isSyncMode ? '增量同步 Obsidian Vault' : '导入 Obsidian Vault'}
            </div>
            <div style={{ fontSize: 11, color: '#888fa8', fontFamily: MONO }}>
              {isSyncMode ? `${importer.existingCount} 已有节点 · 仅处理变化` : '将你的笔记带入知识宇宙'}
            </div>
          </div>
        </div>

        {/* ═══ Step: Select ═══ */}
        {step === 'select' && (
          <div>
            <div
              onDragOver={e => e.preventDefault()} onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${ACCENT}44`, borderRadius: 12, padding: '36px 20px',
                textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s',
              }}
              onMouseOver={e => (e.currentTarget.style.borderColor = `${ACCENT}88`)}
              onMouseOut={e => (e.currentTarget.style.borderColor = `${ACCENT}44`)}
            >
              {scanning ? (
                <Loader2 size={32} color={ACCENT} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
              ) : (
                <Upload size={32} color={ACCENT} style={{ margin: '0 auto 12px' }} />
              )}
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                {scanning ? '扫描中...' : '拖放 .zip 文件或点击选择'}
              </div>
              <div style={{ fontSize: 11, color: '#888fa8' }}>
                {isSyncMode ? '上传更新后的 Vault，仅同步变化部分' : '在 Obsidian 中选择 Vault 文件夹，压缩为 .zip 后上传'}
              </div>
              <input ref={fileRef} type="file" accept=".zip" style={{ display: 'none' }} onChange={handleFileChange} />
            </div>

            {/* Last import info */}
            {isSyncMode && lastImport && (
              <div style={{
                marginTop: 12, padding: '8px 12px', borderRadius: 8,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontSize: 10, fontFamily: MONO, color: '#888fa8',
              }}>
                <span>上次同步: {lastImport.date}</span>
                <span>
                  {lastImport.imported > 0 && <span style={{ color: '#00ff66' }}>+{lastImport.imported} 新</span>}
                  {lastImport.updated > 0 && <span style={{ marginLeft: 8, color: '#66f0ff' }}>{lastImport.updated} 改</span>}
                  {lastImport.skipped > 0 && <span style={{ marginLeft: 8 }}>{lastImport.skipped} 跳过</span>}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ═══ Step: Preview ═══ */}
        {step === 'preview' && preview && (
          <div>
            {isSyncMode && (
              <div style={{
                marginBottom: 14, padding: '8px 12px', borderRadius: 8,
                background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.20)',
                fontSize: 11, color: 'rgba(195,170,255,0.85)', fontFamily: MONO,
              }}>
                <RefreshCw size={11} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                同步模式：将自动检测新增、修改、删除、重命名
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                { icon: FileText, label: 'Markdown 文件', value: preview.fileCount },
                { icon: FolderOpen, label: '文件夹', value: preview.folderCount },
                { icon: Link2, label: 'Wikilinks', value: preview.linkCount },
                { icon: Tag, label: '标签', value: preview.tagCount },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon size={16} color={ACCENT} />
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: MONO }}>{value}</div>
                    <div style={{ fontSize: 10, color: '#888fa8' }}>{label}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#888fa8', marginBottom: 16, fontFamily: MONO }}>
              {zipFile?.name} / {preview.totalSize}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setStep('select'); setZipFile(null); setPreview(null); }}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: '#888fa8', cursor: 'pointer', fontSize: 13, fontFamily: INTER }}
              >
                返回
              </button>
              <button
                onClick={handleStartImport}
                style={{ flex: 2, padding: '10px 0', borderRadius: 8, border: 'none', background: ACCENT, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: INTER }}
              >
                {isSyncMode ? '开始同步' : '开始导入'}
              </button>
            </div>
          </div>
        )}

        {/* ═══ Step: Importing — Phase Timeline ═══ */}
        {step === 'importing' && p && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {PHASES.map((phase, i) => {
                const isDone = i < activePhaseIdx;
                const isActive = i === activePhaseIdx;
                const isPending = i > activePhaseIdx;
                const dotColor = isDone ? '#00ff66' : isActive ? ACCENT : 'rgba(255,255,255,0.12)';

                return (
                  <div key={phase.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative' }}>
                    {/* Vertical line */}
                    {i < PHASES.length - 1 && (
                      <div style={{
                        position: 'absolute', left: 5, top: 14, width: 1, height: 'calc(100% - 2px)',
                        background: isDone ? 'rgba(0,255,102,0.25)' : 'rgba(255,255,255,0.06)',
                      }} />
                    )}
                    {/* Dot */}
                    <div style={{
                      width: 11, height: 11, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                      background: isDone ? dotColor : 'transparent',
                      border: `2px solid ${dotColor}`,
                      boxShadow: isActive ? `0 0 8px ${ACCENT}88` : 'none',
                      animation: isActive ? 'cosmos-pulse 1.5s ease-in-out infinite' : 'none',
                    }} />
                    {/* Label + sub-progress */}
                    <div style={{ flex: 1, paddingBottom: 10, minHeight: 24 }}>
                      <div style={{
                        fontSize: 12, fontWeight: isActive ? 700 : 500,
                        color: isPending ? 'rgba(255,255,255,0.25)' : isDone ? 'rgba(0,255,102,0.75)' : '#e6eeff',
                      }}>
                        {phase.label}
                        {isDone && <span style={{ marginLeft: 8, fontSize: 10, color: 'rgba(0,255,102,0.45)' }}>Done</span>}
                      </div>
                      {isActive && (
                        <div style={{ marginTop: 6 }}>
                          {p.currentFile && (
                            <div style={{
                              fontSize: 10, color: '#888fa8', fontFamily: MONO, marginBottom: 6,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 340,
                            }}>
                              {p.currentFile}
                            </div>
                          )}
                          <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: ACCENT, borderRadius: 2, transition: 'width 0.3s ease' }} />
                          </div>
                          <div style={{ fontSize: 9, color: '#888fa8', fontFamily: MONO, textAlign: 'right', marginTop: 3 }}>
                            {p.current} / {p.total}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ Step: Done — Stats + Action Cards ═══ */}
        {step === 'done' && importer.result && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <CheckCircle2 size={36} color="#00ff66" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: 15, fontWeight: 700 }}>
                {importer.result.isSyncMode ? '同步完成' : '导入完成'}
              </div>
              <div style={{ fontSize: 11, color: '#888fa8', fontFamily: MONO, marginTop: 4 }}>
                {importer.result.totalFiles} 个文件已处理
              </div>
            </div>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
              {[
                { label: '新增', value: importer.result.imported, color: '#00ff66' },
                { label: '更新', value: importer.result.updated,  color: '#66f0ff' },
                { label: '跳过', value: importer.result.skipped,  color: '#888fa8' },
                { label: '删除', value: importer.result.deleted,  color: '#ff4466' },
                { label: '重命名', value: importer.result.renamed,  color: '#ffa040' },
                { label: '关系边', value: importer.result.edgesCreated, color: ACCENT },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: MONO, color }}>{value}</div>
                  <div style={{ fontSize: 9, color: '#888fa8' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Action cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <ActionCard
                icon={Telescope} color="#a855f7" label="查看导入星系"
                sub="在知识宇宙中高亮 Obsidian 节点"
                onClick={handleViewStarMap}
              />
              <ActionCard
                icon={Search} color="#66f0ff" label="检索导入知识"
                sub="在 Retrieval Pod 中搜索新导入内容"
                onClick={handleSearchKnowledge}
              />
              <button
                onClick={handleClose}
                style={{
                  padding: '8px 0', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
                  background: 'none', color: '#888fa8', cursor: 'pointer', fontSize: 12, fontFamily: INTER,
                }}
              >
                稍后查看
              </button>
            </div>
          </div>
        )}

        {/* ═══ Step: Error ═══ */}
        {step === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <AlertCircle size={40} color="#ff4466" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
              {isSyncMode ? '同步失败' : '导入失败'}
            </div>
            <div style={{ fontSize: 12, color: '#ff4466', marginBottom: 16, fontFamily: MONO }}>
              {importer.error || '未知错误'}
            </div>
            <button
              onClick={() => { setStep('select'); setZipFile(null); setPreview(null); importer.reset(); }}
              style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: '#e6eeff', cursor: 'pointer', fontSize: 13, fontFamily: INTER }}
            >
              重试
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ── Action Card ───────────────────────────────────────────────────────────── */
function ActionCard({ icon: Icon, color, label, sub, onClick }: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string; label: string; sub: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderRadius: 10,
        background: `${color}08`, border: `1px solid ${color}22`,
        cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
        fontFamily: "'Inter',system-ui,sans-serif",
      }}
      onMouseOver={e => { e.currentTarget.style.background = `${color}14`; e.currentTarget.style.borderColor = `${color}44`; }}
      onMouseOut={e => { e.currentTarget.style.background = `${color}08`; e.currentTarget.style.borderColor = `${color}22`; }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8, background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={16} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#e6eeff' }}>{label}</div>
        <div style={{ fontSize: 10, color: '#888fa8', marginTop: 2 }}>{sub}</div>
      </div>
    </button>
  );
}
