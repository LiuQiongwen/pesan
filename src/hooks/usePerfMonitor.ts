/**
 * usePerfMonitor — lightweight R3F performance sampler.
 * Runs inside Canvas; exposes snapshot ref for external HUD.
 *
 * Collects: FPS, frame ms, draw calls, triangles, geometries, textures,
 * raycast timing, node/edge counts.
 */
import { useRef, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';

export interface PerfSnapshot {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  raycastMs: number;
  nodeCount: number;
  edgeCount: number;
}

const EMPTY: PerfSnapshot = {
  fps: 0, frameMs: 0, drawCalls: 0, triangles: 0,
  geometries: 0, textures: 0, raycastMs: 0, nodeCount: 0, edgeCount: 0,
};

const HISTORY_SIZE = 120; // ~2s at 60fps

export interface PerfMonitorAPI {
  /** Current averaged snapshot (read from outside Canvas via ref) */
  snapshotRef: React.MutableRefObject<PerfSnapshot>;
  /** Ring-buffer of recent snapshots for sparkline */
  historyRef: React.MutableRefObject<PerfSnapshot[]>;
  /** Call before raycast block */
  raycastStart: () => void;
  /** Call after raycast block */
  raycastEnd: () => void;
  /** Update scene counts each frame */
  setCounts: (nodeCount: number, edgeCount: number) => void;
}

export function usePerfMonitor(enabled: boolean): PerfMonitorAPI {
  const { gl } = useThree();

  const snapshotRef = useRef<PerfSnapshot>({ ...EMPTY });
  const historyRef = useRef<PerfSnapshot[]>([]);

  // Accumulators for averaging over 1-second windows
  const frameCount = useRef(0);
  const frameMsSum = useRef(0);
  const windowStart = useRef(performance.now());
  const lastFrameTime = useRef(performance.now());

  // Raycast timing scratch
  const rcStart = useRef(0);
  const rcMs = useRef(0);

  // Scene counts (set externally)
  const nodeCountRef = useRef(0);
  const edgeCountRef = useRef(0);

  const raycastStart = useCallback(() => { rcStart.current = performance.now(); }, []);
  const raycastEnd = useCallback(() => { rcMs.current = performance.now() - rcStart.current; }, []);
  const setCounts = useCallback((n: number, e: number) => {
    nodeCountRef.current = n;
    edgeCountRef.current = e;
  }, []);

  useFrame(() => {
    if (!enabled) return;

    const now = performance.now();
    const delta = now - lastFrameTime.current;
    lastFrameTime.current = now;

    frameCount.current++;
    frameMsSum.current += delta;

    const elapsed = now - windowStart.current;
    if (elapsed >= 1000) {
      const info = gl.info;
      const snap: PerfSnapshot = {
        fps: Math.round(frameCount.current / (elapsed / 1000)),
        frameMs: +(frameMsSum.current / frameCount.current).toFixed(1),
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        raycastMs: +rcMs.current.toFixed(2),
        nodeCount: nodeCountRef.current,
        edgeCount: edgeCountRef.current,
      };

      snapshotRef.current = snap;

      const h = historyRef.current;
      h.push(snap);
      if (h.length > HISTORY_SIZE) h.shift();

      // Reset accumulators
      frameCount.current = 0;
      frameMsSum.current = 0;
      windowStart.current = now;
    }
  });

  return { snapshotRef, historyRef, raycastStart, raycastEnd, setCounts };
}
