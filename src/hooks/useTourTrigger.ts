/**
 * useTourTrigger — watches user actions and signals the TourProvider
 * to auto-advance the 2-step onboarding.
 * Signals: first-note-created, note-detail-opened
 */
import { useEffect, useRef, useCallback } from 'react';
import { useTour, type TourSignal } from '@/components/tour/TourProvider';

interface TriggerOpts {
  noteCount: number;
}

export function useTourTrigger({ noteCount }: TriggerOpts) {
  const { active, step, signal } = useTour();
  const sentSignals   = useRef(new Set<TourSignal>());
  const signalRef     = useRef(signal);
  signalRef.current   = signal;

  const send = useCallback((s: TourSignal) => {
    if (sentSignals.current.has(s)) return;
    sentSignals.current.add(s);
    signalRef.current(s);
  }, []);

  // Step 1: As soon as there is at least 1 note, advance past 'create'
  useEffect(() => {
    if (!active || step?.id !== 'create') return;
    if (noteCount > 0) {
      send('first-note-created');
    }
  }, [active, step, noteCount, send]);

  // Step 2: Watch node detail opened (NodeWindow toggle)
  useEffect(() => {
    if (!active || step?.id !== 'explore') return;
    const handler = () => send('note-detail-opened');
    window.addEventListener('tour-node-opened', handler);
    return () => window.removeEventListener('tour-node-opened', handler);
  }, [active, step, send]);
}
