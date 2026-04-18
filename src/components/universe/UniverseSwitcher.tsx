/**
 * UniverseSwitcher — top-left HUD widget for switching between knowledge universes.
 * Shows current universe name + icon, click to open floating panel with list + create.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Plus, Sparkles, Globe, BookOpen, Brain, Rocket, Heart, Lightbulb, Compass, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useActiveUniverse } from '@/contexts/UniverseContext';
import { useUniverses } from '@/hooks/useUniverses';
import { useBilling } from '@/hooks/useBilling';
import { CreateUniversePanel } from './CreateUniversePanel';
import { supabase } from '@/integrations/supabase/client';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

const UNIVERSE_LIMITS: Record<string, number> = {
  free: 1,
  pro: 5,
  team: 20,
};

const ICON_MAP: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  globe: Globe,
  'book-open': BookOpen,
  brain: Brain,
  rocket: Rocket,
  heart: Heart,
  lightbulb: Lightbulb,
  compass: Compass,
};

const COLOR_MAP: Record<string, string> = {
  blue:   '#66b3ff',
  purple: '#b496ff',
  cyan:   '#66f0ff',
  green:  '#00ff66',
  amber:  '#ffa040',
  rose:   '#ff6688',
};

interface Props {
  userId: string;
}

export function UniverseSwitcher({ userId }: Props) {
  const { activeUniverseId, activeUniverse, setActiveUniverseId, loading: ctxLoading } = useActiveUniverse();
  const { universes, createUniverse } = useUniverses();
  const billing = useBilling(userId);

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Fetch note counts per universe
  useEffect(() => {
    if (!open || universes.length === 0) return;
    (async () => {
      const counts: Record<string, number> = {};
      for (const u of universes) {
        const { count } = await supabase
          .from('notes')
          .select('id', { count: 'exact', head: true })
          .eq('universe_id', u.id)
          .is('deleted_at', null);
        counts[u.id] = count ?? 0;
      }
      setNoteCounts(counts);
    })();
  }, [open, universes]);

  const handleCreate = useCallback(async (params: { name: string; description?: string; color_seed: string; icon: string }) => {
    const created = await createUniverse(userId, params);
    if (created) {
      setActiveUniverseId(created.id);
      setCreating(false);
      setOpen(false);
    }
  }, [userId, createUniverse, setActiveUniverseId]);

  const handleSwitch = useCallback((id: string) => {
    if (id === activeUniverseId) return;
    setActiveUniverseId(id);
    setOpen(false);
    setCreating(false);
  }, [activeUniverseId, setActiveUniverseId]);

  if (ctxLoading || !activeUniverse) return null;

  const accent = COLOR_MAP[activeUniverse.color_seed] ?? '#66b3ff';
  const IconCmp = ICON_MAP[activeUniverse.icon] ?? Star;
  const maxUniverses = UNIVERSE_LIMITS[billing.plan] ?? 1;
  const atLimit = universes.length >= maxUniverses;

  const planLabel = billing.plan === 'pro' ? 'Pro' : billing.plan === 'team' ? 'Team' : 'Free';

  return (
    <div ref={panelRef} style={{ position: 'relative', pointerEvents: 'auto' }}>
      {/* Trigger button */}
      <button
        onClick={() => { setOpen(o => !o); setCreating(false); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontFamily: INTER, fontSize: 'clamp(9px, 0.85vw, 11px)', fontWeight: 500,
          color: accent,
          background: `${accent}0a`,
          border: `1px solid ${accent}20`,
          borderRadius: 5, padding: 'clamp(3px, 0.4vh, 5px) clamp(7px, 0.7vw, 11px)',
          cursor: 'pointer', transition: 'all 0.15s',
          letterSpacing: '0.02em',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = `${accent}18`; }}
        onMouseLeave={e => { e.currentTarget.style.background = `${accent}0a`; }}
      >
        <IconCmp size={12} />
        {activeUniverse.name}
        <ChevronDown size={10} style={{
          opacity: 0.5,
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s',
        }} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: 6,
          width: 260,
          background: 'rgba(6,10,22,0.96)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(16px)',
          overflow: 'hidden',
          zIndex: 100,
          animation: 'cosmos-window-in 0.2s ease',
        }}>
          {creating ? (
            <CreateUniversePanel
              onClose={() => setCreating(false)}
              onCreate={handleCreate}
              atLimit={atLimit}
              planLabel={planLabel}
            />
          ) : (
            <>
              {/* Universe list header */}
              <div style={{
                fontFamily: MONO, fontSize: 9, letterSpacing: '0.10em',
                color: 'rgba(140,150,170,0.5)', padding: '12px 16px 6px',
              }}>
                UNIVERSES ({universes.length}/{maxUniverses})
              </div>

              {/* Universe list */}
              <div style={{ maxHeight: 260, overflowY: 'auto', padding: '0 6px 6px' }}>
                {universes.map(u => {
                  const isActive = u.id === activeUniverseId;
                  const uAccent = COLOR_MAP[u.color_seed] ?? '#66b3ff';
                  const UIcon = ICON_MAP[u.icon] ?? Star;
                  return (
                    <button
                      key={u.id}
                      onClick={() => handleSwitch(u.id)}
                      style={{
                        width: '100%',
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 10px',
                        background: isActive ? `${uAccent}10` : 'transparent',
                        border: isActive ? `1px solid ${uAccent}20` : '1px solid transparent',
                        borderRadius: 7,
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                        textAlign: 'left',
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: 7,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: `${uAccent}14`,
                        color: uAccent,
                        flexShrink: 0,
                      }}>
                        <UIcon size={14} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: INTER, fontSize: 12, fontWeight: 500,
                          color: isActive ? 'rgba(230,238,255,0.95)' : 'rgba(200,208,220,0.75)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {u.name}
                        </div>
                        <div style={{
                          fontFamily: MONO, fontSize: 9,
                          color: 'rgba(140,150,170,0.4)',
                          letterSpacing: '0.06em',
                        }}>
                          {noteCounts[u.id] ?? '—'} nodes
                        </div>
                      </div>
                      {isActive && (
                        <div style={{
                          width: 5, height: 5, borderRadius: '50%',
                          background: uAccent, boxShadow: `0 0 6px ${uAccent}`,
                          flexShrink: 0,
                        }} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Create button */}
              <div style={{ padding: '4px 6px 8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <button
                  onClick={() => setCreating(true)}
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em',
                    color: atLimit ? 'rgba(140,150,170,0.3)' : 'rgba(200,208,220,0.6)',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 6, padding: '8px 0',
                    cursor: atLimit ? 'not-allowed' : 'pointer',
                    transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => { if (!atLimit) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                >
                  <Plus size={12} />
                  创建新宇宙
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
