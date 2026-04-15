import type { SnapGuide } from '@/hooks/useWindowSnap';

/** Dispatch snap guide lines to the AlignmentGuides overlay */
export function emitSnapGuides(guides: SnapGuide[], active: boolean) {
  window.dispatchEvent(new CustomEvent('cosmos:snap-guides', { detail: { guides, active } }));
}
