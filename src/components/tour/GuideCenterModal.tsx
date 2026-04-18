/**
 * GuideCenterModal — Full "使用攻略" with 4 sections,
 * hint-key status badges, and settings controls.
 */
import { useState } from 'react';
import {
  X, RotateCcw, RefreshCw, EyeOff, Eye, Check,
  Move, Sparkles, MousePointerClick,
  ArrowRightToLine, Link2, Layers3, Crosshair, Navigation,
  Keyboard, LayoutGrid, Download, FileArchive,
  Smartphone, Hand, Send, ChevronsUp,
} from 'lucide-react';
import { useTour } from './TourProvider';
import { useHintState, HINT_KEYS } from '@/hooks/useHintState';
import type { InteractionHintKey } from '@/hooks/useHintState';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

/* ── Data ─────────────────────────────────────────────── */

type GuideItem = {
  icon: typeof Move;
  color: string;
  title: string;
  desc: string;
  hintKey?: InteractionHintKey;
};

type Section = { label: string; tag: string; items: GuideItem[] };

const SECTIONS: Section[] = [
  {
    label: '快速开始', tag: 'QUICK START',
    items: [
      {
        icon: Move, color: '#66f0ff',
        title: '移动知识宇宙',
        desc: '鼠标拖动旋转宇宙 / 滚轮缩放远近 / 双指手势移动缩放',
        hintKey: 'first_move_universe',
      },
      {
        icon: Sparkles, color: '#00ff88',
        title: '生成第一颗知识星',
        desc: '打开 Capture 舱，输入一句想法，AI 会将其编译为知识节点',
        hintKey: 'first_create_star',
      },
      {
        icon: MousePointerClick, color: '#66f0ff',
        title: '打开节点详情',
        desc: '单击星图中的星球查看内容，可从中发起检索或提炼',
        hintKey: 'first_click_node',
      },
    ],
  },
  {
    label: '核心交互', tag: 'CORE INTERACTIONS',
    items: [
      {
        icon: ArrowRightToLine, color: '#b496ff',
        title: '拖拽到 Pod',
        desc: '长按节点拖到底部功能舱，继续检索、提炼或转为行动',
        hintKey: 'drag_to_pod',
      },
      {
        icon: Link2, color: '#00ff66',
        title: '建立连接',
        desc: '长按节点拖向另一个节点建立关联 / Alt+拖动移动整个星系',
        hintKey: 'action_feedback',
      },
      {
        icon: Layers3, color: '#ffa040',
        title: '使用工作台',
        desc: '右键节点「加入工作台」或拖入，比较合并后发布回宇宙',
        hintKey: 'workbench_empty',
      },
      {
        icon: Crosshair, color: '#66f0ff',
        title: '私人云 RAG 检索',
        desc: '进入 Retrieval 舱，选择知识范围后提问，答案只基于你的资料',
        hintKey: 'retrieval_scope',
      },
      {
        icon: Navigation, color: '#66f0ff',
        title: '来源回溯',
        desc: '检索结果中点击引用来源，镜头飞回原始知识节点',
        hintKey: 'trace_source',
      },
    ],
  },
  {
    label: '进阶效率', tag: 'ADVANCED',
    items: [
      {
        icon: Keyboard, color: '#888fa8',
        title: '快捷键',
        desc: '1–5 切换功能舱 / F 聚焦悬浮节点 / C 连接模式 / W 工作台',
      },
      {
        icon: LayoutGrid, color: '#888fa8',
        title: '多节点整理',
        desc: '工作台支持拖拽排序、AI 合并蒸馏、批量标签',
      },
      {
        icon: Download, color: '#888fa8',
        title: '导出与回流',
        desc: '设置 → Export to Obsidian，导出 _cosmos/ 文件夹 zip',
      },
      {
        icon: FileArchive, color: '#a855f7',
        title: 'Obsidian 导入',
        desc: '设置 → Import Obsidian → 上传 vault.zip，支持增量同步',
      },
    ],
  },
  {
    label: '移动端操作', tag: 'MOBILE',
    items: [
      {
        icon: Hand, color: '#66f0ff',
        title: '轻点查看',
        desc: '轻点星球查看内容，长按打开更多操作菜单',
      },
      {
        icon: Send, color: '#b496ff',
        title: '发送到功能舱',
        desc: '长按节点 → 选择目标舱，替代桌面端拖拽操作',
      },
      {
        icon: Link2, color: '#00ff66',
        title: '连接节点',
        desc: '长按选择「建立连接」→ 轻点第二个节点完成关联',
      },
      {
        icon: ChevronsUp, color: '#ffa040',
        title: '上拉展开舱页',
        desc: '舱页底部上拉可展开更多空间，下滑可关闭',
      },
    ],
  },
];

/* ── Component ────────────────────────────────────────── */

interface Props { onClose: () => void }

export function GuideCenterModal({ onClose }: Props) {
  const { restart } = useTour();
  const hints = useHintState();
  const { completedCount, totalCount, globalDisabled } = hints;
  const [expandedIdx, setExpandedIdx] = useState(0);

  const handleRestart = () => { restart(); onClose(); };
  const handleResetHints = () => { hints.resetAll(); restart(); onClose(); };

  const getStatus = (key?: InteractionHintKey) => {
    if (!key) return null;
    const entry = hints.getEntry(key);
    return entry?.status === 'completed';
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
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 'min(480px, calc(100vw - 32px))',
        maxHeight: 'calc(100vh - 60px)',
        overflowY: 'auto',
        background: 'rgba(6,10,22,0.96)',
        border: '1px solid rgba(102,240,255,0.15)',
        borderRadius: 14,
        boxShadow: '0 0 60px rgba(102,240,255,0.04), 0 24px 60px rgba(0,0,0,0.6)',
      }}>

        {/* ── Header ── */}
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
              GUIDE CENTER — {completedCount}/{totalCount} COMPLETED
            </p>
            <div style={{
              marginTop: 6, width: 140, height: 3, borderRadius: 2,
              background: 'rgba(255,255,255,0.06)',
            }}>
              <div style={{
                width: `${totalCount ? (completedCount / totalCount) * 100 : 0}%`,
                height: '100%', borderRadius: 2,
                background: 'rgba(102,240,255,0.50)',
                transition: 'width 0.4s ease',
              }} />
            </div>
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

        {/* ── Restart tour ── */}
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

        {/* ── Sections ── */}
        <div style={{ padding: '4px 22px 10px' }}>
          {SECTIONS.map((section, sIdx) => {
            const isExpanded = expandedIdx === sIdx;
            const sectionCompleted = section.items.filter(i => getStatus(i.hintKey) === true).length;
            const sectionTotal = section.items.filter(i => i.hintKey).length;

            return (
              <div key={section.tag} style={{ marginBottom: 6 }}>
                {/* Section header — clickable accordion */}
                <button
                  onClick={() => setExpandedIdx(isExpanded ? -1 : sIdx)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 10px', borderRadius: 8,
                    background: isExpanded ? 'rgba(255,255,255,0.03)' : 'transparent',
                    border: 'none', cursor: 'pointer', transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isExpanded ? 'rgba(255,255,255,0.03)' : 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontFamily: INTER, fontSize: 12, fontWeight: 700,
                      color: 'rgba(220,228,245,0.88)',
                    }}>
                      {section.label}
                    </span>
                    <span style={{
                      fontFamily: MONO, fontSize: 8, letterSpacing: '0.06em',
                      color: 'rgba(102,240,255,0.30)',
                    }}>
                      {section.tag}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {sectionTotal > 0 && (
                      <span style={{
                        fontFamily: MONO, fontSize: 9,
                        color: sectionCompleted === sectionTotal
                          ? 'rgba(0,255,102,0.60)'
                          : 'rgba(140,155,185,0.45)',
                      }}>
                        {sectionCompleted}/{sectionTotal}
                      </span>
                    )}
                    <span style={{
                      fontSize: 10, color: 'rgba(140,155,185,0.35)',
                      transform: isExpanded ? 'rotate(90deg)' : 'none',
                      transition: 'transform 0.15s', display: 'inline-block',
                    }}>
                      ▸
                    </span>
                  </div>
                </button>

                {/* Section items */}
                {isExpanded && (
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: 4,
                    padding: '4px 0 6px 10px',
                  }}>
                    {section.items.map(item => {
                      const completed = getStatus(item.hintKey);
                      return (
                        <div
                          key={item.title}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: 10,
                            padding: '10px 12px', borderRadius: 8,
                            background: 'rgba(255,255,255,0.015)',
                            border: '1px solid rgba(255,255,255,0.04)',
                          }}
                        >
                          <item.icon
                            size={14}
                            color={item.color}
                            style={{ opacity: 0.75, marginTop: 1, flexShrink: 0 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{
                              fontFamily: INTER, fontSize: 12, fontWeight: 600,
                              color: 'rgba(220,228,245,0.85)',
                            }}>
                              {item.title}
                            </span>
                            <p style={{
                              fontFamily: INTER, fontSize: 11, lineHeight: 1.5,
                              color: 'rgba(170,180,210,0.60)', margin: '3px 0 0',
                            }}>
                              {item.desc}
                            </p>
                          </div>
                          {item.hintKey && (
                            <div style={{
                              width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                              marginTop: 1,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: completed
                                ? 'rgba(0,255,102,0.12)'
                                : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${completed
                                ? 'rgba(0,255,102,0.30)'
                                : 'rgba(255,255,255,0.08)'}`,
                            }}>
                              {completed
                                ? <Check size={10} color="rgba(0,255,102,0.80)" strokeWidth={2.5} />
                                : <div style={{
                                    width: 5, height: 5, borderRadius: '50%',
                                    background: 'rgba(140,155,185,0.25)',
                                  }} />
                              }
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Settings controls ── */}
        <div style={{
          padding: '10px 22px 18px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <span style={{
            fontFamily: MONO, fontSize: 8, letterSpacing: '0.06em',
            color: 'rgba(102,240,255,0.28)', padding: '0 12px 4px',
          }}>
            HINT SETTINGS
          </span>

          {/* Reset all */}
          <SettingsBtn
            icon={<RefreshCw size={12} color="rgba(102,240,255,0.50)" />}
            label="重置所有交互提示"
            hoverBg="rgba(102,240,255,0.06)"
            color="rgba(102,240,255,0.55)"
            onClick={handleResetHints}
          />

          {/* Toggle global */}
          <SettingsBtn
            icon={globalDisabled
              ? <Eye size={12} color="rgba(102,240,255,0.50)" />
              : <EyeOff size={12} color="rgba(210,70,70,0.50)" />
            }
            label={globalDisabled ? '重新开启引导提示' : '关闭所有引导提示'}
            hoverBg={globalDisabled ? 'rgba(102,240,255,0.06)' : 'rgba(255,64,64,0.06)'}
            color={globalDisabled ? 'rgba(102,240,255,0.55)' : 'rgba(195,75,75,0.55)'}
            onClick={() => { if (globalDisabled) { hints.enableAll(); } else { hints.disableAll(); } }}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Tiny helper ── */

function SettingsBtn({ icon, label, hoverBg, color, onClick }: {
  icon: React.ReactNode; label: string; hoverBg: string; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderRadius: 8,
        background: 'transparent', border: 'none',
        cursor: 'pointer', transition: 'background 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = hoverBg; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      {icon}
      <span style={{ fontFamily: INTER, fontSize: 11, color }}>
        {label}
      </span>
    </button>
  );
}
