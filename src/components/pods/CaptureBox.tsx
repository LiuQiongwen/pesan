/**
 * Capture Pod — Agent Intake Terminal
 * Accent: #00ff66 (neon green)
 *
 * Features:
 * - 5 intent types: raw | idea | question | analyze | act
 * - Routing preview based on intent
 * - Post-capture relay to Retrieval pod
 * - Agent pipeline visualization
 */
import { useState, useRef, useCallback } from 'react';
import { Globe, Type, FileIcon, Send, RotateCcw, ArrowRight, Sparkles, ScanLine } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAgentPipeline } from '@/hooks/useAgentPipeline';
import { useAgentWorkflow } from '@/contexts/AgentWorkflowContext';
import { useActiveUniverse } from '@/contexts/UniverseContext';
import { useHintState } from '@/hooks/useHintState';
import { AgentPipeline } from './AgentPipeline';
import { OcrCaptureModal } from '@/components/ocr/OcrCaptureModal';
import type { SourceType } from '@/types';

const G     = '#00ff66';
const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

type Mode   = 'text' | 'url' | 'file' | 'ocr';
type Intent = 'raw' | 'idea' | 'question' | 'analyze' | 'act';

const INTENTS: { key: Intent; label: string; hint: string; chain: string }[] = [
  { key: 'raw',      label: '原料',   hint: '原始资料',   chain: '捕获 → 检索 → 洞察' },
  { key: 'idea',     label: '想法',   hint: '发散想法',   chain: '捕获 → 洞察 → 行动' },
  { key: 'question', label: '问题',   hint: '待解答的疑问', chain: '捕获 → 检索 → 记忆' },
  { key: 'analyze',  label: '待分析', hint: '深度分析对象', chain: '捕获 → 洞察 → 行动' },
  { key: 'act',      label: '待执行', hint: '直接转化执行', chain: '捕获 → 行动' },
];

const MODES: { key: Mode; label: string; icon: typeof Type }[] = [
  { key: 'text', label: 'TEXT', icon: Type    },
  { key: 'url',  label: 'URL',  icon: Globe   },
  { key: 'file', label: 'FILE', icon: FileIcon },
  { key: 'ocr',  label: 'OCR',  icon: ScanLine },
];

interface Props {
  onFlashNote?:  (id: string) => void;
  onAgentStart?: () => void;
  onAgentEnd?:   () => void;
}

export default function CaptureBox({ onFlashNote, onAgentStart, onAgentEnd }: Props) {
  const { user }    = useAuth();
  const { activeUniverseId } = useActiveUniverse();
  const pipeline    = useAgentPipeline(user?.id, activeUniverseId);
  const workflow    = useAgentWorkflow();
  const hints       = useHintState();
  const showCaptureHint = hints.shouldShowHint('first_create_star');

  const [mode,     setMode]     = useState<Mode>('text');
  const [intent,   setIntent]   = useState<Intent>('raw');
  const [text,     setText]     = useState('');
  const [url,      setUrl]      = useState('');
  const [fileName, setFileName] = useState('');
  const [fileText, setFileText] = useState('');
  const [ocrOpen,  setOcrOpen]  = useState(false);
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
    workflow.setActiveStep('capture');
    const result = await pipeline.run({ sourceType, content, sourceUrl });
    onAgentEnd?.();
    if (result) {
      workflow.markStepComplete('capture');
      onFlashNote?.(result.mainNoteId);
      result.derivedNodes.forEach(n => {
        setTimeout(() => onFlashNote?.(n.id), 400 + result.derivedNodes.indexOf(n) * 300);
      });
      // Don't clear text yet — user may want to relay
    }
  }, [user, mode, text, url, fileText, canSubmit, pipeline, onFlashNote, onAgentStart, onAgentEnd, workflow]);

  const handleRelay = useCallback(() => {
    const content = mode === 'text' ? text : mode === 'url' ? url : fileText;
    if (!content.trim()) return;
    // Route intent to best next pod
    const nextPod = (intent === 'act') ? 'action'
      : (intent === 'question') ? 'retrieval'
      : 'retrieval';
    workflow.sendRelay(content, 'capture', nextPod);
    setText(''); setUrl(''); setFileText(''); setFileName('');
  }, [intent, mode, text, url, fileText, workflow]);

  const showPipeline   = pipeline.running || pipeline.result !== null || pipeline.pipelineError !== null;
  const captureContent = mode === 'text' ? text : mode === 'url' ? url : fileText;
  const currentIntent  = INTENTS.find(i => i.key === intent)!;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ── HEADER: mode tabs ── */}
      <div style={{
        padding: '8px 14px 6px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: G, boxShadow: `0 0 5px ${G}` }} />
          <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '0.12em', color: `${G}80`, textTransform: 'uppercase' }}>
            Agent 委托
          </span>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          {MODES.map(({ key, label, icon: MIcon }) => (
            <button key={key} onClick={() => {
              if (pipeline.running) return;
              if (key === 'ocr') { setOcrOpen(true); return; }
              setMode(key);
            }} style={{
              display: 'flex', alignItems: 'center', gap: 3,
              fontFamily: MONO, fontSize: 8, letterSpacing: '0.07em',
              color: mode === key ? '#040508' : 'rgba(80,95,120,0.55)',
              background: mode === key ? G : 'transparent',
              border: 'none', borderRadius: 4, padding: '3px 6px',
              cursor: pipeline.running ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
            }}>
              <MIcon size={8} />{label}
            </button>
          ))}
        </div>
      </div>

      {/* ── INTENT CHIPS ── */}
      {!showPipeline && (
        <div style={{
          padding: '7px 14px 0',
          display: 'flex', gap: 4, flexWrap: 'wrap',
        }}>
          {INTENTS.map(({ key, label }) => (
            <button key={key} onClick={() => setIntent(key)} style={{
              fontFamily: MONO, fontSize: 7.5, letterSpacing: '0.05em',
              color: intent === key ? '#040508' : 'rgba(90,105,130,0.65)',
              background: intent === key ? G : 'rgba(255,255,255,0.04)',
              border: intent === key ? 'none' : '1px solid rgba(255,255,255,0.07)',
              borderRadius: 20, padding: '3px 9px',
              cursor: 'pointer', transition: 'all 0.12s',
            }}>{label}</button>
          ))}
        </div>
      )}

      {/* ── ROUTING PREVIEW ── */}
      {!showPipeline && (
        <div style={{
          margin: '6px 14px 0',
          padding: '5px 9px',
          background: 'rgba(0,255,102,0.04)',
          border: '1px solid rgba(0,255,102,0.10)',
          borderRadius: 6,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <ArrowRight size={9} color={`${G}60`} />
          <span style={{ fontFamily: MONO, fontSize: 7.5, color: `${G}70`, letterSpacing: '0.04em' }}>
            {currentIntent.hint} · {currentIntent.chain}
          </span>
        </div>
      )}

      {/* ── INPUT AREA ── */}
      {!showPipeline && (
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* ── FIRST-TIME CAPTURE HINT ── */}
          {showCaptureHint && (
            <div style={{
              padding: '8px 10px',
              background: 'rgba(0,255,102,0.04)',
              border: '1px solid rgba(0,255,102,0.10)',
              borderRadius: 6,
              pointerEvents: 'none',
              display: 'flex', alignItems: 'flex-start', gap: 7,
            }}>
              <Sparkles size={13} color={`${G}70`} style={{ marginTop: 1, flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontFamily: INTER, fontSize: 11.5, fontWeight: 500, color: `${G}cc`, letterSpacing: '0.01em' }}>
                  输入一句想法，生成第一颗知识星
                </span>
                <span style={{ fontFamily: INTER, fontSize: 10, color: 'rgba(0,255,102,0.38)', letterSpacing: '0.01em' }}>
                  你的输入不会只是被保存，而会被编译成知识节点
                </span>
              </div>
            </div>
          )}

          {mode === 'text' && (
            <textarea value={text} onChange={e => setText(e.target.value)}
              placeholder="委托任何内容——想法、文章片段、问题、笔记…"
              rows={4}
              style={{ ...inputBase, resize: 'none', lineHeight: 1.65,
                borderColor: text.trim() ? 'rgba(0,255,102,0.20)' : 'rgba(255,255,255,0.07)' }}
              onKeyDown={e => { if (e.metaKey && e.key === 'Enter') submit(); }}
            />
          )}
          {mode === 'url' && (
            <input value={url} onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="https://  委托 agent 抓取和理解链接内容"
              style={{ ...inputBase, borderColor: url.trim() ? 'rgba(0,255,102,0.20)' : 'rgba(255,255,255,0.07)' }}
            />
          )}
          {mode === 'file' && (
            <>
              <input ref={fileRef} type="file" accept=".txt,.md,.pdf" onChange={handleFile} style={{ display: 'none' }} />
              <button onClick={() => fileRef.current?.click()} style={{
                ...inputBase, cursor: 'pointer', textAlign: 'left',
                color: fileName ? 'rgba(200,212,232,0.85)' : 'rgba(80,95,120,0.55)',
                borderStyle: 'dashed',
                borderColor: fileText ? 'rgba(0,255,102,0.20)' : 'rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
              }}>
                <FileIcon size={13} color={fileText ? G : 'rgba(80,95,120,0.45)'} />
                {fileName || '选择文件，agent 将全程处理'}
              </button>
            </>
          )}

          <div style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(40,52,72,0.55)', letterSpacing: '0.04em', display: 'flex', justifyContent: 'space-between' }}>
            <span>agent 自动分类 · 提炼 · 生成知识节点</span>
            {mode === 'text' && <span>⌘ + Enter</span>}
          </div>

          {/* Action row: Submit + Relay */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={submit} disabled={!canSubmit} style={{
              flex: 2, fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em',
              color: canSubmit ? '#020a04' : `${G}30`,
              background: canSubmit ? `linear-gradient(135deg, ${G}, #00cc55)` : 'rgba(0,255,102,0.06)',
              border: 'none', borderRadius: 7, padding: '9px 0',
              cursor: canSubmit ? 'pointer' : 'not-allowed', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: canSubmit ? `0 0 16px ${G}28` : 'none',
            }}>
              <Send size={11} />委托 Agent
            </button>
            <button onClick={handleRelay} disabled={!captureContent.trim()} style={{
              flex: 1, fontFamily: MONO, fontSize: 9, letterSpacing: '0.07em',
              color: captureContent.trim() ? `${G}80` : 'rgba(60,72,95,0.35)',
              background: 'rgba(0,255,102,0.05)',
              border: `1px solid rgba(0,255,102,${captureContent.trim() ? '0.18' : '0.06'})`,
              borderRadius: 7, padding: '9px 0',
              cursor: captureContent.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
              <ArrowRight size={10} />转发
            </button>
          </div>
        </div>
      )}

      {/* ── AGENT PIPELINE DISPLAY ── */}
      {showPipeline && (
        <>
          <AgentPipeline steps={pipeline.steps} result={pipeline.result} error={pipeline.pipelineError} />
          {!pipeline.running && (
            <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Relay to next pod */}
              {pipeline.result && (
                <button onClick={() => {
                  workflow.sendRelay(
                    text || url || fileText,
                    'capture',
                    intent === 'act' ? 'action' : 'retrieval'
                  );
                  pipeline.reset();
                }} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  fontFamily: MONO, fontSize: 9, letterSpacing: '0.07em',
                  color: G, background: 'rgba(0,255,102,0.07)',
                  border: `1px solid rgba(0,255,102,0.22)`,
                  borderRadius: 6, padding: '7px 0', cursor: 'pointer',
                }}>
                  <ArrowRight size={10} />
                  {intent === 'act' ? '→ 发送至行动舱' : '→ 发送至检索舱'}
                </button>
              )}
              <button onClick={pipeline.reset} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                fontFamily: MONO, fontSize: 9, letterSpacing: '0.07em',
                color: 'rgba(80,95,120,0.70)',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 6, padding: '7px 0', cursor: 'pointer',
              }}>
                <RotateCcw size={10} />新的委托
              </button>
            </div>
          )}
        </>
      )}

      {/* OCR Modal */}
      {ocrOpen && (
        <OcrCaptureModal
          onClose={() => setOcrOpen(false)}
          onFlashNote={onFlashNote}
          onOpenStaging={() => window.dispatchEvent(new CustomEvent('open-staging'))}
        />
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
  outline: 'none', transition: 'border-color 0.15s',
};
