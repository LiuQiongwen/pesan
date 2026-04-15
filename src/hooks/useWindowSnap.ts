/**
 * useWindowSnap — grid + screen-edge + inter-window edge snapping
 * Returns a `snap` function used during FloatingPod drag/resize.
 */
import { useCallback } from 'react';
import type { PodId, PodState, LayoutConfig } from '@/contexts/ToolboxContext';

const SNAP_DIST = 12; // px — magnetic distance for edge snap

export interface SnapGuide {
  type:  'v' | 'h';      // vertical or horizontal line
  value: number;         // x for 'v', y for 'h'
  color: string;
}

export interface SnapResult {
  pos:    { x: number; y: number };
  guides: SnapGuide[];
}

export function useWindowSnap() {
  const snap = useCallback((
    draggingId: PodId,
    rawPos:     { x: number; y: number },
    winSize:    { w: number; h: number },
    config:     LayoutConfig,
    allPods:    Record<PodId, PodState>,
    reportedSizes: Partial<Record<PodId, { w: number; h: number }>>,
    accentColor: string,
  ): SnapResult => {
    let { x, y } = rawPos;
    const guides: SnapGuide[] = [];
    const W = window.innerWidth;
    const H = window.innerHeight;
    const { w, h } = winSize;

    // ── Grid snap ────────────────────────────────────────────────────────
    if (config.gridSize > 0) {
      const g = config.gridSize;
      x = Math.round(x / g) * g;
      y = Math.round(y / g) * g;
    }

    if (config.snapToEdge) {
      // ── Screen edge snap ──────────────────────────────────────────────
      // Left edge
      if (Math.abs(x) < SNAP_DIST) {
        x = 0;
        guides.push({ type: 'v', value: 0, color: accentColor });
      }
      // Right edge
      if (Math.abs(x + w - W) < SNAP_DIST) {
        x = W - w;
        guides.push({ type: 'v', value: W, color: accentColor });
      }
      // Top edge
      if (Math.abs(y) < SNAP_DIST) {
        y = 0;
        guides.push({ type: 'h', value: 0, color: accentColor });
      }
      // Bottom edge
      if (Math.abs(y + h - H) < SNAP_DIST) {
        y = H - h;
        guides.push({ type: 'h', value: H, color: accentColor });
      }

      // ── Inter-window edge snap ─────────────────────────────────────────
      for (const otherId of Object.keys(allPods) as PodId[]) {
        if (otherId === draggingId) continue;
        const other = allPods[otherId];
        if (!other.open) continue;
        const os = reportedSizes[otherId] ?? { w: 400, h: 300 };
        const oRight  = other.pos.x + os.w;
        const oBottom = other.pos.y + os.h;

        // Snap left edge of dragging to right edge of other
        if (Math.abs(x - oRight) < SNAP_DIST) {
          x = oRight;
          guides.push({ type: 'v', value: oRight, color: accentColor });
        }
        // Snap right edge of dragging to left edge of other
        if (Math.abs(x + w - other.pos.x) < SNAP_DIST) {
          x = other.pos.x - w;
          guides.push({ type: 'v', value: other.pos.x, color: accentColor });
        }
        // Snap left edges (align left)
        if (Math.abs(x - other.pos.x) < SNAP_DIST) {
          x = other.pos.x;
          guides.push({ type: 'v', value: other.pos.x, color: accentColor });
        }
        // Snap top edge of dragging to bottom of other
        if (Math.abs(y - oBottom) < SNAP_DIST) {
          y = oBottom;
          guides.push({ type: 'h', value: oBottom, color: accentColor });
        }
        // Snap bottom edge of dragging to top of other
        if (Math.abs(y + h - other.pos.y) < SNAP_DIST) {
          y = other.pos.y - h;
          guides.push({ type: 'h', value: other.pos.y, color: accentColor });
        }
        // Snap top edges (align top)
        if (Math.abs(y - other.pos.y) < SNAP_DIST) {
          y = other.pos.y;
          guides.push({ type: 'h', value: other.pos.y, color: accentColor });
        }
      }
    }

    // Clamp to viewport
    x = Math.max(0, Math.min(W - w, x));
    y = Math.max(0, Math.min(H - 60, y));

    return { pos: { x, y }, guides };
  }, []);

  return { snap };
}
