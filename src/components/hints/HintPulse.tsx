/**
 * HintPulse — subtle pulsing ring / border glow overlay.
 * Wraps its children with an animated outline. Does NOT block clicks.
 *
 * Usage:
 *   <HintPulse active={shouldPulse} accent="#66f0ff">
 *     <button>Pod Button</button>
 *   </HintPulse>
 */
import type { ReactNode, CSSProperties } from 'react';

interface Props {
  /** Whether the pulse is active */
  active: boolean;
  /** Pulse accent color (CSS color string) */
  accent?: string;
  /** Ring border-radius — match the child's shape */
  borderRadius?: number | string;
  /** Extra styles on the wrapper */
  style?: CSSProperties;
  children: ReactNode;
}

export function HintPulse({
  active,
  accent = 'rgba(102,240,255,0.55)',
  borderRadius = 10,
  style,
  children,
}: Props) {
  return (
    <div style={{
      position: 'relative',
      display: 'inline-flex',
      ...style,
    }}>
      {children}

      {active && (
        <>
          {/* Static soft glow border */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: -2,
              borderRadius,
              border: `1.5px solid ${accent}`,
              opacity: 0.35,
              pointerEvents: 'none',
              transition: 'opacity 0.4s ease',
            }}
          />
          {/* Expanding pulse ring */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: -2,
              borderRadius,
              border: `1.5px solid ${accent}`,
              pointerEvents: 'none',
              animation: 'hint-pulse-ring 2.2s ease-out infinite',
            }}
          />
        </>
      )}
    </div>
  );
}
