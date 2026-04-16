import React from 'react';

interface PestaLogoProps {
  /** Icon only (no wordmark) */
  iconOnly?: boolean;
  /** Size of the icon square in px */
  size?: number;
  /** Show wordmark next to the icon */
  showName?: boolean;
  /** Custom class on the root element */
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Pesta brand logo — a geometric "P" formed by star-nodes on an orbital arc,
 * over a deep-space background. Works on dark and transparent backgrounds.
 */
export function PestaLogo({
  iconOnly = false,
  size = 32,
  showName = true,
  className,
  style,
}: PestaLogoProps) {
  const r = size / 2;

  return (
    <div
      className={className}
      style={{
        display:    'inline-flex',
        alignItems: 'center',
        gap:        size * 0.3,
        userSelect: 'none',
        ...style,
      }}
    >
      {/* ── Icon ── */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Pesta"
      >
        <defs>
          <radialGradient id="pg-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#00e5ff" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#00e5ff" stopOpacity="0"   />
          </radialGradient>
          <filter id="pg-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="pg-glow-purple" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background subtle radial glow */}
        <circle cx="16" cy="16" r="14" fill="url(#pg-core)" />

        {/* Orbital arc — the P curve */}
        <path
          d="M 10 8 A 7 7 0 0 1 10 20"
          stroke="#a855f7"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.5"
          filter="url(#pg-glow-purple)"
        />

        {/* Vertical stem of the P */}
        <line
          x1="10" y1="7"
          x2="10" y2="25"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Star nodes on the P curve */}
        {/* Top node */}
        <circle cx="10" cy="8"  r="2"   fill="#00e5ff" filter="url(#pg-glow)" />
        {/* Middle node */}
        <circle cx="17" cy="14" r="2.2" fill="#00e5ff" filter="url(#pg-glow)" />
        {/* Bottom-of-curve node */}
        <circle cx="10" cy="20" r="2"   fill="#00e5ff" filter="url(#pg-glow)" />

        {/* Connector lines: stem-top → mid-node, mid-node → stem-mid */}
        <line
          x1="10" y1="8"
          x2="17" y2="14"
          stroke="#00e5ff"
          strokeWidth="0.9"
          strokeLinecap="round"
          opacity="0.6"
        />
        <line
          x1="17" y1="14"
          x2="10" y2="20"
          stroke="#00e5ff"
          strokeWidth="0.9"
          strokeLinecap="round"
          opacity="0.6"
        />

        {/* Tiny satellite dot */}
        <circle cx="22" cy="10" r="1.2" fill="#a855f7" opacity="0.7" filter="url(#pg-glow-purple)" />
      </svg>

      {/* ── Wordmark ── */}
      {!iconOnly && showName && (
        <span
          style={{
            fontFamily:  '"Inter", sans-serif',
            fontWeight:  700,
            fontSize:    size * 0.6,
            letterSpacing: '0.04em',
            background:  'linear-gradient(90deg, #ffffff 60%, #00e5ff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor:  'transparent',
            lineHeight:  1,
          }}
        >
          Pesta
        </span>
      )}
    </div>
  );
}
