/**
 * TourProvider — lightweight 3-step onboarding state machine.
 * Steps: orbit → create → explore
 * Non-blocking: never steals focus or prevents interaction.
 */
import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type TourStepId = 'create' | 'explore';

export interface TourStep {
  id: TourStepId;
}

const STEPS: TourStep[] = [
  { id: 'create' },
  { id: 'explore' },
];

export type TourSignal = 'first-note-created' | 'note-detail-opened';

interface TourCtx {
  active:     boolean;
  step:       TourStep | null;
  stepIndex:  number;
  totalSteps: number;
  skip:       () => void;
  signal:     (event: TourSignal) => void;
  /** Restart the tour (called from Guide Center) */
  restart:    () => void;
}

const Ctx = createContext<TourCtx>({
  active: false, step: null, stepIndex: -1, totalSteps: STEPS.length,
  skip: () => {}, signal: () => {}, restart: () => {},
});

export const useTour = () => useContext(Ctx);

interface Props {
  userId?: string;
  noteCount: number;
  children: ReactNode;
}

export function TourProvider({ userId, noteCount, children }: Props) {
  const [active, setActive]   = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [loaded, setLoaded]   = useState(false);
  const persistedRef          = useRef(false);

  // Load tour state from profile — only auto-start for genuinely new users
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

      // Auto-start only if never completed AND user has zero notes (true first session)
      if (!completed && noteCount === 0 && Object.keys(state).length === 0) {
        setActive(true);
        setStepIdx(0);
      }
      setLoaded(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const persistComplete = useCallback(async () => {
    if (!userId || persistedRef.current) return;
    persistedRef.current = true;
    await supabase
      .from('profiles')
      .update({ tour_state: { core_completed: true, completed_at: new Date().toISOString() } })
      .eq('id', userId);
  }, [userId]);

  const complete = useCallback(() => {
    setActive(false);
    persistComplete();
  }, [persistComplete]);

  const skip = useCallback(() => {
    complete();
  }, [complete]);

  const signal = useCallback((event: TourSignal) => {
    if (!active) return;
    setStepIdx(prev => {
      const currentId = STEPS[prev]?.id;
      if (currentId === 'create'  && event === 'first-note-created')  return prev + 1;
      if (currentId === 'explore' && event === 'note-detail-opened') {
        setTimeout(() => complete(), 1200);
        return prev;
      }
      return prev;
    });
  }, [active, complete]);

  const restart = useCallback(async () => {
    if (!userId) return;
    persistedRef.current = false;
    await supabase
      .from('profiles')
      .update({ tour_state: {} })
      .eq('id', userId);
    setStepIdx(0);
    setActive(true);
  }, [userId]);

  const step = active && loaded ? (STEPS[stepIdx] ?? null) : null;

  return (
    <Ctx.Provider value={{
      active: active && loaded,
      step,
      stepIndex: stepIdx,
      totalSteps: STEPS.length,
      skip,
      signal,
      restart,
    }}>
      {children}
    </Ctx.Provider>
  );
}
