/**
 * useRenderTracer — lightweight DEV-only render tracking.
 *
 * Records every render of tagged components into a shared ring buffer.
 * Zero cost in production (guarded by import.meta.env.DEV).
 */
import { useRef } from 'react';

export interface RenderEntry {
  ts: number;
  name: string;
  changedKeys: string[];
  renderIndex: number;
}

const MAX_LOG = 120;
const log: RenderEntry[] = [];
let globalIndex = 0;

/** Read the shared render log (most recent first). */
export function getRenderLog(): readonly RenderEntry[] {
  return log;
}

/** Clear all entries. */
export function clearRenderLog() {
  log.length = 0;
}

/**
 * Call at the top of a component body (after hooks):
 *
 * ```ts
 * useRenderTracer('FloatingPod', { id, title, open });
 * ```
 *
 * In production builds, this is a no-op.
 */
export function useRenderTracer(
  name: string,
  props: Record<string, unknown> = {},
) {
  const prevRef = useRef<Record<string, unknown> | null>(null);

  if (!import.meta.env.DEV) return;

  const prev = prevRef.current;
  const changedKeys: string[] = [];

  if (prev) {
    const allKeys = new Set([...Object.keys(prev), ...Object.keys(props)]);
    allKeys.forEach(k => {
      if (!Object.is(prev[k], props[k])) changedKeys.push(k);
    });
  } else {
    changedKeys.push('(initial)');
  }

  prevRef.current = { ...props };

  globalIndex++;
  log.push({
    ts: performance.now(),
    name,
    changedKeys,
    renderIndex: globalIndex,
  });
  if (log.length > MAX_LOG) log.shift();
}
