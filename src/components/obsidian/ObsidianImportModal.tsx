/**
 * Obsidian Import Modal — supports both first-time import and incremental re-sync
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Upload, FileArchive, CheckCircle2, AlertCircle, Loader2, Link2, Tag, FolderOpen, FileText, RefreshCw } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/hooks/useAuth';
import { useObsidianImport } from '@/hooks/useObsidianImport';
import JSZip from 'jszip';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";
const ACCENT = '#a855f7';

interface PreviewStats {
  fileCount: number;
  folderCount: number;
  linkCount: number;
  tagCount: number;
  totalSize: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImportDone?: () => void;
}

type Step = 'select' | 'preview' | 'importing' | 'done' | 'error';

export function ObsidianImportModal({ open, onClose, onImportDone }: Props) {
  const { user } = useAuth();
  const importer = useObsidianImport(user?.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('select');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewStats | null>(null);
  const [scanning, setScanning] = useState(false);

  // Reset + detect sync mode when modal opens
  useEffect(() => {
    if (open) {
      setStep('select');
      setZipFile(null);
      setPreview(null);
      importer.reset();
      importer.detectSyncMode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const scanZip = useCallback(async (file: File) => {
    setScanning(true);
    try {
      const zip = await JSZip.loadAsync(file);
      const folders = new Set<string>();
      const tags = new Set<string>();
      let linkCount = 0;
      let fileCount = 0;
      let totalBytes = 0;
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
    if (!file) return;
    setZipFile(file);
    scanZip(file);
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
    if (res) {
      setStep('done');
      onImportDone?.();
    } else {
      setStep('error');
    }
  };

  const handleClose = () => {
    if (importer.running) return;
    onClose();
  };

  if (!open) return null;

  const isSyncMode = importer.syncMode;

  const phaseLabel: Record<string, string> = {
    unzip: '解压文件...',
    parse: '解析 Markdown...',
    diff:  '比对变化...',
    delete: '清理已删除笔记...',
    insert: '写入新笔记...',
    update: '更新修改笔记...',
    index:  'RAG 索引...',
    edges:  '建立关系边...',
    done:   '完成',
    error:  '出错',
  };

  const p = importer.progress;
  const pct = p && p.total > 0 ? Math.round((p.current / p.total) * 100) : 0;

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={handleClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(480px, 92vw)', background: 'linear-gradient(170deg, rgba(20,16,32,0.98), rgba(8,6,16,0.98))',
          border: `1px solid ${ACCENT}33`, borderRadius: 16, padding: 'clamp(20px, 3vh, 32px)',
          fontFamily: INTER, color: '#e6eeff', position: 'relative',
          boxShadow: `0 0 60px ${ACCENT}18`,
        }}
      >
        <button
          onClick={handleClose}
          disabled={importer.running}
          style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: '#888fa8', cursor: importer.running ? 'not-allowed' : 'pointer', padding: 4 }}
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `${ACCENT}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isSyncMode ? <RefreshCw size={18} color={ACCENT} /> : <FileArchive size={18} color={ACCENT} />}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {isSyncMode ? 'Re-sync Obsidian Vault' : 'Import Obsidian Vault'}
            </div>
            <div style={{ fontSize: 11, color: '#888fa8', fontFamily: MONO }}>
              {isSyncMode
                ? `${importer.existingCount} existing notes · incremental sync`
                : 'ZIP archive import'}
            </div>
          </div>
        </div>

        {/* Step: Select */}
        {step === 'select' && (
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${ACCENT}44`, borderRadius: 12, padding: '40px 20px',
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
              {scanning ? 'Scanning...' : 'Drop .zip file here or click to select'}
            </div>
            <div style={{ fontSize: 11, color: '#888fa8' }}>
              {isSyncMode
                ? 'Upload updated vault — only changes will be processed'
                : 'In Obsidian: select your vault folder, compress to .zip, and upload'}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".zip"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && preview && (
          <div>
            {isSyncMode && (
              <div style={{
                marginBottom: 14, padding: '8px 12px', borderRadius: 8,
                background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.20)',
                fontSize: 11, color: 'rgba(195,170,255,0.85)', fontFamily: MONO,
              }}>
                <RefreshCw size={11} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                Sync mode: will detect new, changed, deleted, and renamed files
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                { icon: FileText, label: 'Markdown files', value: preview.fileCount },
                { icon: FolderOpen, label: 'Folders', value: preview.folderCount },
                { icon: Link2, label: 'Wikilinks', value: preview.linkCount },
                { icon: Tag, label: 'Tags', value: preview.tagCount },
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
                Back
              </button>
              <button
                onClick={handleStartImport}
                style={{ flex: 2, padding: '10px 0', borderRadius: 8, border: 'none', background: ACCENT, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: INTER }}
              >
                {isSyncMode ? 'Start Sync' : 'Start Import'}
              </button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && p && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              {phaseLabel[p.phase] ?? p.phase}
            </div>
            {p.currentFile && (
              <div style={{ fontSize: 11, color: '#888fa8', fontFamily: MONO, marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.currentFile}
              </div>
            )}
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: ACCENT, borderRadius: 3, transition: 'width 0.3s ease' }} />
            </div>
            <div style={{ fontSize: 11, color: '#888fa8', fontFamily: MONO, textAlign: 'right' }}>
              {p.current} / {p.total}
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && importer.result && (
          <div style={{ textAlign: 'center' }}>
            <CheckCircle2 size={40} color="#00ff66" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
              {importer.result.isSyncMode ? 'Sync Complete' : 'Import Complete'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
              {[
                { label: 'New',      value: importer.result.imported, color: '#00ff66' },
                { label: 'Updated',  value: importer.result.updated,  color: '#66f0ff' },
                { label: 'Unchanged',value: importer.result.skipped,  color: '#888fa8' },
                { label: 'Deleted',  value: importer.result.deleted,  color: '#ff4466' },
                { label: 'Renamed',  value: importer.result.renamed,  color: '#ffa040' },
                { label: 'Edges',    value: importer.result.edgesCreated, color: ACCENT },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: MONO, color }}>{value}</div>
                  <div style={{ fontSize: 10, color: '#888fa8' }}>{label}</div>
                </div>
              ))}
            </div>
            <button
              onClick={handleClose}
              style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: 'none', background: ACCENT, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: INTER }}
            >
              View in Star Map
            </button>
          </div>
        )}

        {/* Step: Error */}
        {step === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <AlertCircle size={40} color="#ff4466" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
              {isSyncMode ? 'Sync Failed' : 'Import Failed'}
            </div>
            <div style={{ fontSize: 12, color: '#ff4466', marginBottom: 16, fontFamily: MONO }}>
              {importer.error || 'Unknown error'}
            </div>
            <button
              onClick={() => { setStep('select'); setZipFile(null); setPreview(null); importer.reset(); }}
              style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: '#e6eeff', cursor: 'pointer', fontSize: 13, fontFamily: INTER }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
