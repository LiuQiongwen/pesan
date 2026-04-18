/**
 * GuideCenterModal — "使用攻略" modal accessible from Settings.
 * Shows topic cards for learning + restart tour + disable hints.
 */
import { X, Orbit, Boxes, Link2, FileArchive, RotateCcw, EyeOff, RefreshCw } from 'lucide-react';
import { useTour } from './TourProvider';
import { useHintState } from '@/hooks/useHintState';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

interface Props {
  onClose: () => void;
}

const GUIDES: Array<{ icon: typeof Orbit; color: string; title: string; desc: string }> = [
  {
    icon: Orbit, color: '#66f0ff',
    title: '星图操作',
    desc: '拖动旋转宇宙 / 滚轮缩放远近 / 单击节点打开详情 / 右键菜单删除或连接',
  },
  {
    icon: Boxes, color: '#b496ff',
    title: '五大功能舱',
    desc: '捕获 (Capture) · 检索 (Retrieval) · 洞察 (Insight) · 记忆 (Memory) · 行动 (Action)，底部 Dock 栏打开',
  },
  {
    icon: Link2, color: '#00ff66',
    title: '连接与星系',
    desc: '长按节点拖向另一个节点可建立连接 / 相同标签的节点自动形成星系 / Alt+拖动可移动整个星系',
  },
  {
    icon: FileArchive, color: '#a855f7',
    title: 'Obsidian 导入',
    desc: '设置 → Import Obsidian → 上传 vault.zip / 支持增量同步 / 导入后自动建立星图',
  },
];

export function GuideCenterModal({ onClose }: Props) {
  const { restart } = useTour();
  const { resetAll, disableAll } = useHintState();

  const handleRestart = () => {
    restart();
    onClose();
  };

  const handleResetHints = () => {
    resetAll();
    restart();
    onClose();
  };

  const handleDisableAll = () => {
    disableAll();
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99990,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(8px)',
        animation: 'tour-hud-in 0.25s ease',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: 'min(440px, calc(100vw - 40px))',
          maxHeight: 'calc(100vh - 80px)',
          overflowY: 'auto',
          background: 'rgba(6,10,22,0.96)',
          border: '1px solid rgba(102,240,255,0.15)',
          borderRadius: 14,
          boxShadow: '0 0 60px rgba(102,240,255,0.04), 0 24px 60px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div>
            <h2 style={{
              fontFamily: INTER, fontWeight: 700, fontSize: 16,
              color: 'rgba(230,238,255,0.92)', margin: 0,
            }}>
              使用攻略
            </h2>
            <p style={{
              fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em',
              color: 'rgba(102,240,255,0.40)', margin: '4px 0 0',
            }}>
              GUIDE CENTER
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 6, padding: 6, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
          >
            <X size={14} color="rgba(255,255,255,0.45)" />
          </button>
        </div>

        {/* Restart tour button */}
        <div style={{ padding: '14px 22px 10px' }}>
          <button
            onClick={handleRestart}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px', borderRadius: 10,
              background: 'rgba(102,240,255,0.06)',
              border: '1px solid rgba(102,240,255,0.18)',
              cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(102,240,255,0.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(102,240,255,0.06)'; }}
          >
            <RotateCcw size={14} color="#66f0ff" />
            <div style={{ textAlign: 'left' }}>
              <span style={{
                fontFamily: INTER, fontSize: 12, fontWeight: 600,
                color: 'rgba(102,240,255,0.90)',
              }}>
                重新体验新手导览
              </span>
              <div style={{
                fontFamily: MONO, fontSize: 9, color: 'rgba(102,240,255,0.40)',
                letterSpacing: '0.04em', marginTop: 2,
              }}>
                3 步快速回顾核心操作
              </div>
            </div>
          </button>
        </div>

        {/* Guide cards */}
        <div style={{ padding: '6px 22px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {GUIDES.map((g) => (
            <div
              key={g.title}
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <g.icon size={13} color={g.color} style={{ opacity: 0.8 }} />
                <span style={{
                  fontFamily: INTER, fontSize: 12, fontWeight: 600,
                  color: 'rgba(220,228,245,0.88)',
                }}>
                  {g.title}
                </span>
              </div>
              <p style={{
                fontFamily: INTER, fontSize: 11.5, lineHeight: 1.55,
                color: 'rgba(170,180,210,0.70)', margin: 0,
              }}>
                {g.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Reset & disable hints */}
        <div style={{
          padding: '10px 22px 18px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <button
            onClick={handleResetHints}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 8,
              background: 'transparent', border: 'none',
              cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(102,240,255,0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <RefreshCw size={12} color="rgba(102,240,255,0.50)" />
            <span style={{
              fontFamily: INTER, fontSize: 11,
              color: 'rgba(102,240,255,0.55)',
            }}>
              重置所有交互提示
            </span>
          </button>
          <button
            onClick={handleDisableAll}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 8,
              background: 'transparent', border: 'none',
              cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,64,64,0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <EyeOff size={12} color="rgba(210,70,70,0.50)" />
            <span style={{
              fontFamily: INTER, fontSize: 11,
              color: 'rgba(195,75,75,0.55)',
            }}>
              关闭所有引导提示
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
