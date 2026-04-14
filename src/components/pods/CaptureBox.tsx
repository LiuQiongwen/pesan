/**
 * Capture Pod — Agent Intake Terminal
 * Accent: #00ff66 (neon green)
 * Philosophy: Input is a delegation, not a save. The agent takes over.
 */
import { useState, useRef, useCallback } from 'react';
import { Globe, Type, FileIcon, Send, RotateCcw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAgentPipeline } from '@/hooks/useAgentPipeline';
import { AgentPipeline } from './AgentPipeline';
import type { SourceType } from '@/types';

const G     = '#00ff66';
const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

type Mode = 'text' | 'url' | 'file';

interface Props {
  onFlashNote?: (id: string) => void;
  onAgentStart?: () => void;
  onAgentEnd?:   () => void;
}

const MODES: { key: Mode; label: string; icon: typeof Type }[] = [
  { key: 'text', label: 'TEXT', icon: Type   },
  { key: 'url',  label: 'URL',  icon: Globe  },
  { key: 'file', label: 'FILE', icon: FileIcon },
];

export default function CaptureBox({ onFlashNote, onAgentStart, onAgentEnd }: Props) {
  const { user }   = useAuth();
  const pipeline   = useAgentPipeline(user?.id);

  const [mode,     setMode]     = useState<Mode>('text');
  const [text,     setText]     = useState('');
  const [url,      setUrl]      = useState('');
  const [fileName, setFileName] = useState('');
  const [fileText, setFileText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setFileName(f.name);
    setFileText((await f.text()).slice(0, 8000));
  };

  const canSubmit = mode === 'url'  ? url.trim().length > 4
    : mode === 'text' ? text.trim().length > 3
    : fileText.trim().length > 3;

  const submit = useCallback(async () => {
    if (!user?.id || !canSubmit || pipeline.running) return;
    const sourceType: SourceType = mode;
    const content   = mode === 'text' ? text : mode === 'file' ? fileText : '';
    const sourceUrl = mode === 'url' ? url : undefined;

    onAgentStart?.();
    const result = await pipeline.run({ sourceType, content, sourceUrl });
    onAgentEnd?.();
    if (result) {
      // Flash all generated nodes in the star map
      onFlashNote?.(result.mainNoteId);
      result.derivedNodes.forEach(n => {
        setTimeout(() => onFlashNote?.(n.id), 400 + result.derivedNodes.indexOf(n) * 300);
      });
      setText(''); setUrl(''); setFileText(''); setFileName('');
    }
  }, [user, mode, text, url, fileText, canSubmit, pipeline, onFlashNote, onAgentStart, onAgentEnd]);

  // Show pipeline display during / after processing
  const showPipeline = pipeline.running || pipeline.result !== null || pipeline.pipelineError !== null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ── AGENT INTAKE HEADER ── */}
      <div style={{
        padding: '8px 14px 6px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%',
            background: G, boxShadow: `0 0 5px ${G}`,
          }} />
          <span style={{
            fontFamily: MONO, fontSize: 8, letterSpacing: '0.12em',
            color: `${G}80`, textTransform: 'uppercase',
          }}>
            Agent Intake
          </span>
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: 2 }}>
          {MODES.map(({ key, label, icon: MIcon }) => (
            <button
              key={key}
              onClick={() => !pipeline.running && setMode(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 3,
                fontFamily: MONO, fontSize: 8, letterSpacing: '0.07em',
                color: mode === key ? '#040508' : 'rgba(80,95,120,0.55)',
                background: mode === key ? G : 'transparent',
                border: 'none', borderRadius: 4, padding: '3px 6px',
                cursor: pipeline.running ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <MIcon size={8} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── INPUT AREA (hidden during pipeline) ── */}
      {!showPipeline && (
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>

          {mode === 'text' && (
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="委托任何内容——想法、文章片段、问题、笔记…"
              rows={5}
              style={{ ...inputBase, resize: 'none', lineHeight: 1.65,
                borderColor: text.trim() ? 'rgba(0,255,102,0.20)' : 'rgba(255,255,255,0.07)',
              }}
              onKeyDown={e => { if (e.metaKey && e.key === 'Enter') submit(); }}
            />
          )}

          {mode === 'url' && (
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="https://  委托 agent 抓取和理解链接内容"
              style={{ ...inputBase,
                borderColor: url.trim() ? 'rgba(0,255,102,0.20)' : 'rgba(255,255,255,0.07)',
              }}
            />
          )}

          {mode === 'file' && (
            <>
              <input ref={fileRef} type="file" accept=".txt,.md,.pdf" onChange={handleFile} style={{ display: 'none' }} />
              <button
                onClick={() => fileRef.current?.click()}
                style={{ ...inputBase, cursor: 'pointer', textAlign: 'left',
                  color: fileName ? 'rgba(200,212,232,0.85)' : 'rgba(80,95,120,0.55)',
                  borderStyle: 'dashed',
                  borderColor: fileText ? 'rgba(0,255,102,0.20)' : 'rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                }}
              >
                <FileIcon size={13} color={fileText ? G : 'rgba(80,95,120,0.45)'} />
                {fileName || '选择文件，agent 将全程处理'}
              </button>
            </>
          )}

          {/* Intent hint */}
          <div style={{
            fontFamily: MONO, fontSize: 8, color: 'rgba(40,52,72,0.55)',
            letterSpacing: '0.04em', display: 'flex', justifyContent: 'space-between',
          }}>
            <span>agent 将自动分类 · 提炼 · 生成知识节点</span>
            {mode === 'text' && <span>⌘ + Enter</span>}
          </div>

          {/* Submit — agent delegation CTA */}
          <button
            onClick={submit}
            disabled={!canSubmit}
            style={{
              fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em',
              color: canSubmit ? '#020a04' : `${G}30`,
              background: canSubmit
                ? `linear-gradient(135deg, ${G}, #00cc55)`
                : 'rgba(0,255,102,0.06)',
              border: 'none', borderRadius: 7,
              padding: '10px 0', cursor: canSubmit ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: canSubmit ? `0 0 16px ${G}28` : 'none',
            }}
          >
            <Send size={11} />
            委托给 Agent →
          </button>
        </div>
      )}

      {/* ── AGENT PIPELINE DISPLAY ── */}
      {showPipeline && (
        <>
          <AgentPipeline
            steps={pipeline.steps}
            result={pipeline.result}
            error={pipeline.pipelineError}
          />
          {/* Re-delegate button after completion/error */}
          {!pipeline.running && (
            <div style={{ padding: '0 14px 12px' }}>
              <button
                onClick={pipeline.reset}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  fontFamily: MONO, fontSize: 9, letterSpacing: '0.07em',
                  color: 'rgba(80,95,120,0.70)',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 6, padding: '7px 0', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <RotateCcw size={10} />
                新的委托
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const inputBase: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '9px 11px',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 7,
  fontFamily: INTER, fontSize: 12,
  color: 'rgba(210,220,240,0.88)',
  outline: 'none',
  transition: 'border-color 0.15s',
};
