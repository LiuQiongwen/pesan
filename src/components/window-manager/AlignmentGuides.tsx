/**
 * AlignmentGuides — full-screen SVG overlay showing snap guide lines
 * during window drag/resize. Listens to custom event `cosmos:snap-guides`.
 */
import { useState, useEffect } from 'react';

interface SnapGuide {
  type:  'v' | 'h';
  value: number;
  color: string;
}

export function AlignmentGuides() {
  const [guides, setGuides] = useState<SnapGuide[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;

    const onGuides = (e: Event) => {
      const detail = (e as CustomEvent<{ guides: SnapGuide[]; active: boolean }>).detail;
      if (fadeTimer) clearTimeout(fadeTimer);
      if (!detail.active) {
        fadeTimer = setTimeout(() => { setGuides([]); setVisible(false); }, 350);
        return;
      }
      setGuides(detail.guides);
      setVisible(detail.guides.length > 0);
    };

    window.addEventListener('cosmos:snap-guides', onGuides);
    return () => {
      window.removeEventListener('cosmos:snap-guides', onGuides);
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, []);

  if (!visible || guides.length === 0) return null;

  const W = window.innerWidth;
  const H = window.innerHeight;

  return (
    <svg
      style={{
        position:      'fixed',
        inset:         0,
        width:         '100vw',
        height:        '100vh',
        pointerEvents: 'none',
        zIndex:        9998,
        opacity:       0.7,
      }}
    >
      {guides.map((g, i) => (
        g.type === 'v' ? (
          <line
            key={i}
            x1={g.value} y1={0} x2={g.value} y2={H}
            stroke={g.color}
            strokeWidth={1}
            strokeDasharray="4 6"
            opacity={0.6}
          />
        ) : (
          <line
            key={i}
            x1={0} y1={g.value} x2={W} y2={g.value}
            stroke={g.color}
            strokeWidth={1}
            strokeDasharray="4 6"
            opacity={0.6}
          />
        )
      ))}
    </svg>
  );
}
