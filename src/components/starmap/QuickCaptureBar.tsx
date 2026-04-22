import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

interface QuickCaptureBarProps {
  userId:       string;
  onFlashNote?: (noteId: string) => void;
  hasNotes?:    boolean;
  hidden?:      boolean;
}

export function QuickCaptureBar({ userId, onFlashNote, hasNotes = true, hidden = false }: QuickCaptureBarProps) {
  const [value,    setValue]   = useState('');
  const [focused,  setFocused] = useState(false);
  const [saving,   setSaving]  = useState(false);
  const [success,  setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: press '/' or 'Q' to focus the bar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === '/' || e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Auto-focus after 3s when there are no notes (second path for first action)
  useEffect(() => {
    if (hasNotes) return;
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 3000);
    return () => clearTimeout(timer);
  }, [hasNotes]);

  const handleSubmit = useCallback(async () => {
    const text = value.trim();
    if (!text || saving) return;

    setSaving(true);
    try {
      const { data, error } = await supabase.from('notes').insert({
        user_id:           userId,
        node_type:         'capture',
        title:             text.slice(0, 80),
        summary:           text.length > 80 ? text : null,
        tags:              [],
        key_points:        [],
        analysis_content:  {},
        mindmap_data:      {},
        content_markdown:  null,
        summary_markdown:  null,
        analysis_markdown: null,
        mindmap_markdown:  null,
        analysis_id:       null,
        is_edited:         false,
      }).select().maybeSingle();

      if (error) throw error;

      if (data?.id) {
        onFlashNote?.(data.id);
        setValue('');
        setSuccess(true);
        setTimeout(() => setSuccess(false), 1800);
      }
    } catch {
      toast.error('创建节点失败');
    } finally {
      setSaving(false);
    }
  }, [value, saving, userId, onFlashNote]);

  const glowColor   = success ? '#00ff66' : focused ? '#66f0ff' : 'transparent';
  const borderColor = success
    ? 'rgba(0,255,102,0.55)'
    : focused
    ? 'rgba(102,240,255,0.40)'
    : 'rgba(40,48,65,0.70)';

  // When no notes and not focused: add attention animation class
  const showAttention = !hasNotes && !focused && !success;

  return (
    <div style={{
      position:  'fixed',
      bottom:    'var(--qbar-bottom)',
      left:      '50%',
      transform: 'translateX(-50%)',
      zIndex:    25,
      width:     'clamp(300px, 34vw, 560px)',
      maxWidth:  'calc(100vw - 32px)',
      opacity:   hidden ? 0 : 1,
      pointerEvents: hidden ? 'none' : 'auto',
      transition: 'opacity 0.25s',
    }}>
      <div style={{
        display:         'flex',
        alignItems:      'center',
        gap:             8,
        height:          'clamp(40px, 4.5vh, 54px)',
        background:      'rgba(2,4,11,0.92)',
        backdropFilter:  'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border:          `1px solid ${borderColor}`,
        borderRadius:    'clamp(8px, 0.9vw, 12px)',
        padding:         '0 clamp(10px, 1.0vw, 14px)',
        transition:      'border-color 0.2s, box-shadow 0.2s',
        boxShadow:       focused || success
          ? `0 0 22px ${glowColor}25, 0 8px 32px rgba(0,0,0,0.55)`
          : '0 4px 24px rgba(0,0,0,0.40)',
        animation:       showAttention ? 'qbar-attention 3.0s ease-in-out infinite' : 'none',
      }}>
        {/* Icon */}
        <div style={{
          width:           'clamp(22px, 2.1vw, 28px)',
          height:          'clamp(22px, 2.1vw, 28px)',
          flexShrink:      0,
          display:         'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius:    6,
          background:      success ? 'rgba(0,255,102,0.12)' : 'rgba(102,240,255,0.07)',
          border:          `1px solid ${success ? 'rgba(0,255,102,0.25)' : 'rgba(102,240,255,0.14)'}`,
          transition:      'all 0.2s',
        }}>
          <Plus size={12} color={success ? '#00ff66' : 'rgba(102,240,255,0.65)'} />
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSubmit();
            if (e.key === 'Escape') { inputRef.current?.blur(); setValue(''); }
          }}
          placeholder={success ? '✓ 已落入星图' : '输入一条知识，按 Enter 落入星图…'}
          style={{
            flex:          1,
            background:    'none',
            border:        'none',
            outline:       'none',
            fontFamily:    MONO,
            fontSize:      'clamp(11px, 0.95vw, 13px)',
            letterSpacing: '0.02em',
            color:         success ? 'rgba(0,255,102,0.85)' : 'rgba(200,215,240,0.88)',
            transition:    'color 0.2s',
          }}
          disabled={saving}
        />

        {/* Submit button — shows only when there's content */}
        {value.trim() && (
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              width:        'clamp(26px, 2.4vw, 32px)',
              height:       'clamp(26px, 2.4vw, 32px)',
              flexShrink:   0,
              display:      'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 6,
              background:   'rgba(0,255,102,0.10)',
              border:       '1px solid rgba(0,255,102,0.28)',
              cursor:       saving ? 'wait' : 'pointer',
              transition:   'all 0.15s',
              opacity:      saving ? 0.5 : 1,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,255,102,0.18)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,255,102,0.10)'; }}
          >
            <Send size={12} color="rgba(0,255,102,0.80)" />
          </button>
        )}

        {/* Keyboard hint */}
        {!value && !focused && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
          }}>
            {['/', 'Q'].map(k => (
              <span key={k} style={{
                fontFamily:   MONO,
                fontSize:     'clamp(8.5px, 0.75vw, 10px)',
                color:        'rgba(70,80,100,0.50)',
                background:   'rgba(30,36,50,0.60)',
                border:       '1px solid rgba(50,60,80,0.50)',
                padding:      '1px 5px', borderRadius: 4,
              }}>{k}</span>
            ))}
          </div>
        )}
      </div>

      <style>{`
        input::placeholder { color: rgba(60,75,100,0.55); }
        @keyframes qbar-attention {
          0%,100% { border-color: rgba(0,255,102,0.14); box-shadow: 0 4px 24px rgba(0,0,0,0.40); }
          50%      { border-color: rgba(0,255,102,0.42); box-shadow: 0 0 20px rgba(0,255,102,0.12), 0 4px 24px rgba(0,0,0,0.40); }
        }
      `}</style>
    </div>
  );
}
