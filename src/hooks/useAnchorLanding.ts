/**
 * useAnchorLanding — reads ?anchor= query params in StarMapLayout,
 * switches universe and flashes the target node.
 */
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

interface Deps {
  switchUniverse: (id: string) => void;
  flashNote: (id: string) => void;
}

export function useAnchorLanding({ switchUniverse, flashNote }: Deps) {
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

    // After a short delay to let notes load, flash the target
    if (atype === 'note') {
      setTimeout(() => flashNote(atarget), 800);
    }

    // Clean up URL params
    const next = new URLSearchParams(searchParams);
    next.delete('anchor');
    next.delete('atype');
    next.delete('atarget');
    next.delete('auniverse');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, switchUniverse, flashNote]);
}
