/**
 * useTourTrigger — watches user actions and signals the TourProvider
 * to auto-advance steps based on what the user does.
 */
import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useTour, type TourSignal } from '@/components/tour/TourProvider';

interface TriggerOpts {
  noteCount:       number;
  pipelineRunning: boolean;
  capturePodOpen:  boolean;
}

export function useTourTrigger({ noteCount, pipelineRunning, capturePodOpen }: TriggerOpts) {
  const { active, step, signal } = useTour();
  const location = useLocation();
  const prevNoteCount = useRef(noteCount);
  const prevLocation  = useRef(location.pathname);
  const sentSignals   = useRef(new Set<TourSignal>());
  const signalRef     = useRef(signal);
  signalRef.current   = signal;

  // Helper: send signal only once per tour session
  const send = useCallback((s: TourSignal) => {
    if (sentSignals.current.has(s)) return;
    sentSignals.current.add(s);
    signalRef.current(s);
  }, []);

  // Watch capture pod open
  useEffect(() => {
    if (!active || step?.id !== 'welcome') return;
    if (capturePodOpen) send('capture-pod-opened');
  }, [active, step, capturePodOpen, send]);

  // Watch pipeline start
  useEffect(() => {
    if (!active || step?.id !== 'capture') return;
    if (pipelineRunning) send('pipeline-started');
  }, [active, step, pipelineRunning, send]);

  // Watch first note creation (noteCount 0 → 1+)
  useEffect(() => {
    if (!active || step?.id !== 'pipeline') return;
    if (prevNoteCount.current === 0 && noteCount > 0) {
      send('first-note-created');
    }
    prevNoteCount.current = noteCount;
  }, [active, step, noteCount, send]);

  // Watch navigation to note detail
  useEffect(() => {
    if (!active) return;
    const path = location.pathname;
    if (step?.id === 'star-born' && path.startsWith('/note/')) {
      send('note-detail-opened');
    }
    if (step?.id === 'note-detail' && prevLocation.current.startsWith('/note/') && !path.startsWith('/note/')) {
      send('returned-to-map');
    }
    prevLocation.current = path;
  }, [active, step, location.pathname, send]);
}
