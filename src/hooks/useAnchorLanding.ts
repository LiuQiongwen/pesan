/**
 * useAnchorLanding — reads ?anchor= query params in StarMapLayout,
 * switches universe and navigates to the target (note flash, galaxy focus, etc).
 */
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

interface Deps {
  switchUniverse: (id: string) => void;
  flashNote: (id: string) => void;
  focusGalaxy?: (tag: string) => void;
}

export function useAnchorLanding({ switchUniverse, flashNote, focusGalaxy }: Deps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    const anchorId  = searchParams.get('anchor');
    const atype     = searchParams.get('atype');
    const atarget   = searchParams.get('atarget');
    const auniverse = searchParams.get('auniverse');

    if (!anchorId || !atype || !atarget || !auniverse) return;
    handled.current = true;

    // Switch to the anchor's universe
    switchUniverse(auniverse);

    // After a short delay to let notes load, navigate to target
    setTimeout(() => {
      switch (atype) {
        case 'note':
          flashNote(atarget);
          break;
        case 'galaxy':
          focusGalaxy?.(atarget);
          break;
        case 'workbench':
        case 'universe':
        default:
          // For workbench/universe, just switching universe is enough
          break;
      }
    }, 800);

    // Clean up URL params
    const next = new URLSearchParams(searchParams);
    next.delete('anchor');
    next.delete('atype');
    next.delete('atarget');
    next.delete('auniverse');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, switchUniverse, flashNote, focusGalaxy]);
}
