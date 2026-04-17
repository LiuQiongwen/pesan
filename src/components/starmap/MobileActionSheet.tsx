import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { CosmosNote } from '@/components/starmap/cosmos-layout';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

const PODS = [
  { id: 'capture',   label: '捕获', color: '#00ff66' },
  { id: 'retrieval', label: '检索', color: '#66f0ff' },
  { id: 'insight',   label: '洞察', color: '#b496ff' },
  { id: 'memory',    label: '记忆', color: '#ffa040' },
  { id: 'action',    label: '行动', color: '#ff4466' },
];

interface Props {
  noteId: string;
  note: CosmosNote | undefined;
  onClose: () => void;
  onOpenNote: (noteId: string) => void;
  onDistill: (noteId: string) => void;
  onSendToPod: (noteId: string, podId: string) => void;
  onFlash: (noteId: string) => void;
}

function hexA(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function MobileActionSheet({ noteId, note, onClose, onOpenNote, onDistill, onSendToPod, onFlash }: Props) {
  // Close on back / escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const title = note?.title || '(未命名)';
  const nodeColor = '#66f0ff';

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 55,
          background: 'rgba(0,0,0,0.35)',
          animation: 'fade-in 0.15s ease-out',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 56,
        background: 'rgba(3,5,13,0.98)',
        backdropFilter: 'blur(40px) saturate(2)',
        WebkitBackdropFilter: 'blur(40px) saturate(2)',
        borderTop: `1.5px solid rgba(102,240,255,0.25)`,
        borderRadius: '18px 18px 0 0',
        boxShadow: '0 -4px 40px rgba(0,0,0,0.80), 0 0 30px rgba(102,240,255,0.06)',
        paddingBottom: 'env(safe-area-inset-bottom, 12px)',
        animation: 'slide-up 0.22s cubic-bezier(0.22,1,0.36,1)',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Title */}
        <div style={{ padding: '0 20px 12px' }}>
          <div style={{
            fontFamily: INTER, fontSize: 15, fontWeight: 700,
            color: 'rgba(220,230,250,0.92)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {title.slice(0, 36)}{title.length > 36 ? '...' : ''}
          </div>
          {note?.tags?.length ? (
            <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
              {note.tags.slice(0, 3).map(tag => (
                <span key={tag} style={{
                  fontFamily: MONO, fontSize: 10, color: hexA(nodeColor, 0.70),
                  background: hexA(nodeColor, 0.08),
                  border: `1px solid ${hexA(nodeColor, 0.18)}`,
                  padding: '2px 7px', borderRadius: 4,
                }}>#{tag}</span>
              ))}
            </div>
          ) : null}
        </div>

        {/* Primary actions — large touch targets */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8, padding: '0 16px 12px',
        }}>
          {[
            { label: '打开',   act: () => { onOpenNote(noteId); onClose(); }, icon: '~', bg: 'rgba(102,240,255,0.06)', border: 'rgba(102,240,255,0.18)' },
            { label: '蒸馏',   act: () => { onDistill(noteId); onClose(); },  icon: '~', bg: 'rgba(180,150,255,0.06)', border: 'rgba(180,150,255,0.18)' },
            { label: '送舱',   act: () => {},                                  icon: '~', bg: 'rgba(0,255,102,0.06)',   border: 'rgba(0,255,102,0.18)',   isSend: true },
            { label: '定位',   act: () => { onFlash(noteId); onClose(); },    icon: '~', bg: 'rgba(255,160,64,0.06)',  border: 'rgba(255,160,64,0.18)' },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={'isSend' in btn ? undefined : btn.act}
              style={{
                height: 52, borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: MONO, fontSize: 13, fontWeight: 600, letterSpacing: '0.04em',
                color: 'rgba(220,230,250,0.88)',
                background: btn.bg,
                border: `1px solid ${btn.border}`,
                cursor: 'pointer',
                transition: 'background 0.12s',
              }}
            >{btn.label}</button>
          ))}
        </div>

        {/* Send-to-pod row */}
        <div style={{
          display: 'flex', gap: 6,
          padding: '0 16px 16px',
          overflowX: 'auto',
        }}>
          {PODS.map(pod => (
            <button
              key={pod.id}
              onClick={() => { onSendToPod(noteId, pod.id); onClose(); }}
              style={{
                flex: '0 0 auto',
                height: 40, padding: '0 16px',
                borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: MONO, fontSize: 11, fontWeight: 600,
                color: pod.color,
                background: hexA(pod.color, 0.06),
                border: `1px solid ${hexA(pod.color, 0.22)}`,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {pod.label}舱
            </button>
          ))}
        </div>
      </div>
    </>,
    document.body
  );
}
