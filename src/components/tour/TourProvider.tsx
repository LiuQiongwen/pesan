/**
 * TourProvider — state machine for the onboarding tour.
 * Reads/writes `profiles.tour_state` for persistence.
 * Exposes context so any child can read current step or advance/skip.
 */
import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ── Step definitions ──────────────────────────────────────────────────────────
export type TourStepId =
  | 'welcome'
  | 'capture'
  | 'pipeline'
  | 'star-born'
  | 'note-detail'
  | 'complete';

export interface TourStep {
  id:        TourStepId;
  placement: 'center' | 'bottom-center' | 'top-left';
}

const STEPS: TourStep[] = [
  { id: 'welcome',      placement: 'center' },
  { id: 'capture',      placement: 'bottom-center' },
  { id: 'pipeline',     placement: 'top-left' },
  { id: 'star-born',    placement: 'center' },
  { id: 'note-detail',  placement: 'center' },
  { id: 'complete',     placement: 'center' },
];

// ── Context ───────────────────────────────────────────────────────────────────
interface TourCtx {
  active:      boolean;
  step:        TourStep | null;
  stepIndex:   number;
  totalSteps:  number;
  advance:     () => void;
  skip:        () => void;
  /** Signal the provider that a user action happened */
  signal:      (event: TourSignal) => void;
}

export type TourSignal =
  | 'capture-pod-opened'
  | 'pipeline-started'
  | 'first-note-created'
  | 'note-detail-opened'
  | 'returned-to-map';

const Ctx = createContext<TourCtx>({
  active: false, step: null, stepIndex: -1, totalSteps: STEPS.length,
  advance: () => {}, skip: () => {}, signal: () => {},
});

export const useTour = () => useContext(Ctx);

// ── Provider ──────────────────────────────────────────────────────────────────
interface Props {
  userId?: string;
  noteCount: number;
  children: ReactNode;
}

export function TourProvider({ userId, noteCount, children }: Props) {
  const [active, setActive]     = useState(false);
  const [stepIdx, setStepIdx]   = useState(0);
  const [loaded, setLoaded]     = useState(false);
  const persistedRef            = useRef(false);

  // Load tour state from profile
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('tour_state')
        .eq('id', userId)
        .maybeSingle();

      const state = (data?.tour_state ?? {}) as Record<string, unknown>;
      const completed = state.core_completed === true;

      // Only activate for users with zero notes who haven't completed tour
      if (!completed && noteCount === 0) {
        setActive(true);
        setStepIdx(0);
      }
      setLoaded(true);
    })();
  }, [userId, noteCount]);

  // Persist completion
  const persistComplete = useCallback(async () => {
    if (!userId || persistedRef.current) return;
    persistedRef.current = true;
    await supabase
      .from('profiles')
      .update({ tour_state: { core_completed: true } })
      .eq('id', userId);
  }, [userId]);

  const advance = useCallback(() => {
    setStepIdx(prev => {
      const next = prev + 1;
      if (next >= STEPS.length) {
        setActive(false);
        persistComplete();
        return prev;
      }
      return next;
    });
  }, [persistComplete]);

  const skip = useCallback(() => {
    setActive(false);
    persistComplete();
  }, [persistComplete]);

  // Signal handler: auto-advance on matching user actions
  const signal = useCallback((event: TourSignal) => {
    if (!active) return;
    setStepIdx(prev => {
      const currentId = STEPS[prev]?.id;
      // Map signals to step transitions
      if (currentId === 'welcome' && event === 'capture-pod-opened')   return prev + 1; // → capture
      if (currentId === 'capture' && event === 'pipeline-started')     return prev + 1; // → pipeline
      if (currentId === 'pipeline' && event === 'first-note-created')  return prev + 1; // → star-born
      if (currentId === 'star-born' && event === 'note-detail-opened') return prev + 1; // → note-detail
      if (currentId === 'note-detail' && event === 'returned-to-map')  return prev + 1; // → complete
      return prev;
    });
  }, [active]);

  const step = active && loaded ? (STEPS[stepIdx] ?? null) : null;

  return (
    <Ctx.Provider value={{ active: active && loaded, step, stepIndex: stepIdx, totalSteps: STEPS.length, advance, skip, signal }}>
      {children}
    </Ctx.Provider>
  );
}
