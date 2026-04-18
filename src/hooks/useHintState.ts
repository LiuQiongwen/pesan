/**
 * useHintState — Unified interaction hints state system.
 *
 * Three-layer state per hint:
 *   seen       — hint was displayed to user
 *   completed  — user performed the expected action
 *   dismissed  — user explicitly closed the hint
 *
 * A hint shows when: NOT completed AND NOT dismissed AND NOT globally disabled.
 * Once "seen" it still shows until completed or dismissed.
 *
 * Persisted in localStorage; ready to sync to Supabase profiles.tour_state later.
 */
import { useState, useCallback, useEffect, useMemo } from 'react';

// ── Type definitions ──────────────────────────────────────────────────────────

export const HINT_KEYS = [
  'first_move_universe',
  'first_click_node',
  'first_create_star',
  'drag_to_pod',
  'workbench_empty',
  'retrieval_scope',
  'trace_source',
  'action_feedback',
] as const;

export type InteractionHintKey = (typeof HINT_KEYS)[number];

export type HintStatus = 'idle' | 'seen' | 'completed' | 'dismissed';

export type HintEntry = {
  status: HintStatus;
  seenAt?: number;       // timestamp
  completedAt?: number;
  dismissedAt?: number;
};

export type InteractionHintsState = {
  globalDisabled: boolean;
  hints: Record<InteractionHintKey, HintEntry>;
};

// ── Context types for shouldShowHint ──────────────────────────────────────────

export type HintContext = {
  noteCount?: number;
  nodeWindowOpen?: boolean;
  connectMode?: boolean;
  workbenchNoteCount?: number;
};

// ── Defaults ──────────────────────────────────────────────────────────────────

const LS_KEY = 'pesta_hints_v2';

const DEFAULT_ENTRY: HintEntry = { status: 'idle' };

function defaultState(): InteractionHintsState {
  const hints = {} as Record<InteractionHintKey, HintEntry>;
  for (const k of HINT_KEYS) hints[k] = { ...DEFAULT_ENTRY };
  return { globalDisabled: false, hints };
}

// ── Persistence ───────────────────────────────────────────────────────────────

function load(): InteractionHintsState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      // Migrate from v1 (old dismissed-set format)
      const v1 = localStorage.getItem('pesta_hints');
      if (v1) {
        const dismissed: string[] = JSON.parse(v1);
        const state = defaultState();
        if (dismissed.includes('all-disabled')) state.globalDisabled = true;
        // Map old keys → new keys
        const keyMap: Record<string, InteractionHintKey> = {
          'first-move': 'first_move_universe',
          'node-window-seen': 'first_click_node',
          'first-note-created': 'first_create_star',
          'drop-to-pod-feedback': 'drag_to_pod',
          'connect-mode': 'action_feedback',
        };
        for (const old of dismissed) {
          const mapped = keyMap[old];
          if (mapped) {
            state.hints[mapped] = { status: 'completed', completedAt: Date.now() };
          }
        }
        save(state);
        localStorage.removeItem('pesta_hints');
        return state;
      }
      return defaultState();
    }
    const parsed = JSON.parse(raw) as InteractionHintsState;
    // Ensure all keys exist (forward compat)
    const state = defaultState();
    state.globalDisabled = parsed.globalDisabled ?? false;
    for (const k of HINT_KEYS) {
      if (parsed.hints?.[k]) state.hints[k] = parsed.hints[k];
    }
    return state;
  } catch {
    return defaultState();
  }
}

function save(state: InteractionHintsState) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useHintState() {
  const [state, setState] = useState<InteractionHintsState>(load);

  // Cross-tab sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY) setState(load());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const update = useCallback((key: InteractionHintKey, patch: Partial<HintEntry>) => {
    setState(prev => {
      const next: InteractionHintsState = {
        ...prev,
        hints: {
          ...prev.hints,
          [key]: { ...prev.hints[key], ...patch },
        },
      };
      save(next);
      return next;
    });
  }, []);

  const markSeen = useCallback((key: InteractionHintKey) => {
    update(key, { status: 'seen', seenAt: Date.now() });
  }, [update]);

  const markCompleted = useCallback((key: InteractionHintKey) => {
    update(key, { status: 'completed', completedAt: Date.now() });
  }, [update]);

  const markDismissed = useCallback((key: InteractionHintKey) => {
    update(key, { status: 'dismissed', dismissedAt: Date.now() });
  }, [update]);

  // ── Convenience: dismiss (backward compat alias) ──────────────────────────

  const dismiss = useCallback((key: string) => {
    if (HINT_KEYS.includes(key as InteractionHintKey)) {
      markDismissed(key as InteractionHintKey);
    }
  }, [markDismissed]);

  // ── Query ─────────────────────────────────────────────────────────────────

  const shouldShowHint = useCallback((key: InteractionHintKey, ctx?: HintContext): boolean => {
    if (state.globalDisabled) return false;
    const entry = state.hints[key];
    if (!entry) return false;
    if (entry.status === 'completed' || entry.status === 'dismissed') return false;

    // Context-aware rules
    switch (key) {
      case 'first_move_universe':
        return true; // show until user drags
      case 'first_click_node':
        return (ctx?.noteCount ?? 0) > 0; // only if there are nodes to click
      case 'first_create_star':
        return (ctx?.noteCount ?? 0) === 0; // only if no stars yet
      case 'drag_to_pod':
        return (ctx?.noteCount ?? 0) > 0;
      case 'workbench_empty':
        return (ctx?.workbenchNoteCount ?? 0) === 0;
      case 'retrieval_scope':
        return true; // show first time retrieval pod opens
      case 'trace_source':
        return true; // show first time a citation appears
      case 'action_feedback':
        return true; // show first time any action completes
      default:
        return true;
    }
  }, [state]);

  // Backward compat: simple shouldShow(key)
  const shouldShow = useCallback((key: string): boolean => {
    if (HINT_KEYS.includes(key as InteractionHintKey)) {
      return shouldShowHint(key as InteractionHintKey);
    }
    // Legacy keys — treat as not dismissed
    return !state.globalDisabled;
  }, [shouldShowHint, state.globalDisabled]);

  // ── Bulk operations ───────────────────────────────────────────────────────

  const resetAll = useCallback(() => {
    const fresh = defaultState();
    save(fresh);
    setState(fresh);
  }, []);

  const disableAll = useCallback(() => {
    setState(prev => {
      const next = { ...prev, globalDisabled: true };
      save(next);
      return next;
    });
  }, []);

  const enableAll = useCallback(() => {
    setState(prev => {
      const next = { ...prev, globalDisabled: false };
      save(next);
      return next;
    });
  }, []);

  // ── Derived state ─────────────────────────────────────────────────────────

  const completedCount = useMemo(() =>
    HINT_KEYS.filter(k => state.hints[k].status === 'completed').length,
  [state]);

  const totalCount = HINT_KEYS.length;

  return {
    state,
    // Mutations
    markSeen,
    markCompleted,
    markDismissed,
    dismiss,       // backward compat
    // Queries
    shouldShowHint,
    shouldShow,    // backward compat
    getEntry: (key: InteractionHintKey) => state.hints[key],
    // Bulk
    resetAll,
    disableAll,
    enableAll,
    // Stats
    completedCount,
    totalCount,
    globalDisabled: state.globalDisabled,
  };
}
