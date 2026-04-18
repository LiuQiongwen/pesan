# Fix: Tour not advancing + Capture Pod trapping user

## Context
After registration, the new user enters the tour. The tour auto-opens Capture Pod (step 'create'). The user inputs text, agent runs, a note is created. But:
1. The tour HUD bar stays on step 'create' — doesn't advance to 'explore'
2. The user cannot close Capture Pod because `useEffect` in StarMapLayout re-opens it whenever `pods.capture?.open` becomes false while tour is still on 'create'

## Root Cause Analysis

### Bug 1: Tour not advancing
`useTourTrigger` watches `noteCount` going from 0 to 1+. The realtime subscription in `useNotes` adds new notes to state. However, there's a subtle race condition:

- `prevNoteCount` is initialized as `useRef(noteCount)` — if noteCount is 0 at mount and then noteCount changes to 1+, the effect SHOULD fire.
- BUT the effect guard is `if (!active || step?.id !== 'create') return;` — the `step` object reference changes on every render since `STEPS[stepIdx]` creates a new lookup each time. The `signal` function's `active` dependency might cause stale closures.

The real problem: `signal` callback in TourProvider uses `useCallback([active, complete])`. When `signal` is called, `active` inside it reflects the value at callback creation time. If `active` was initially `false` (before `loaded` was set to `true`), the `signal` function captured `active = false` and returns early. The `signalRef.current = signal` in useTourTrigger should fix this, but let me trace more carefully...

Actually, the most likely root cause: **`noteCount` passed to `TourProvider` comes from `(notes as CosmosNote[]).length`**. The TourProvider's `useEffect` for auto-start checks `noteCount === 0`. But if the realtime subscription fires and adds a note BEFORE the tour state is loaded from profiles (`loaded = false`), the tour will read `noteCount > 0` by the time it checks, and will NOT auto-start. This means `active` stays `false`, and `useTourTrigger` never fires.

However, the user reports the tour DID show (they see the capture pod), so `active` was `true`. The issue is more likely that:

1. The note is created via edge function (server-side), and the realtime INSERT event fires
2. `useNotes` adds the note to state → `notes.length` goes from 0 to 1
3. `useTourTrigger` effect fires with `noteCount = 1`, `prevNoteCount.current = 0` → condition met → `send('first-note-created')`
4. `send` checks `sentSignals.current.has('first-note-created')` — should be false → calls `signalRef.current('first-note-created')`
5. `signal` in TourProvider checks `if (!active) return` — should be true
6. `setStepIdx(prev => ...)` — `STEPS[prev]?.id` should be 'create' → returns `prev + 1` = 1

This flow should work. Unless... the `notes` state update doesn't trigger a re-render that reaches `useTourTrigger`. Let me check: `notes` is defined in `StarMapWithUniverse`, passed as prop to `StarMapContents`, then `useTourTrigger({ noteCount: notes.length })`. This should cause re-render.

Wait — I think I found it! The realtime channel subscribes with `filter: user_id=eq.${userId}` but does NOT filter by `universe_id`. So a new note gets added to `notes` state regardless of universe. But the initial fetch DOES filter by `universe_id`. So after initial fetch returns 0 notes, realtime adds a note (no universe filter), `notes.length` becomes 1. But then... actually this means it WOULD trigger the tour advance.

Let me look at this from a different angle. Maybe the note creation in the edge function doesn't include `universe_id`, so the realtime INSERT fires but the note has no `universe_id` match. Let me check the edge function.

Actually, the simplest explanation: **the note IS being created and notes DO update, but the `prevNoteCount.current` gets set to the wrong value**. When `noteCount` changes from 0 to 1, the effect runs:
```
prevNoteCount.current === 0 && noteCount > 0 → true → send signal
prevNoteCount.current = noteCount (= 1)
```

But the effect has dependencies `[active, step, noteCount, send]`. If `active` or `step` changes before `noteCount` changes, the effect runs again with `prevNoteCount.current = 0` and `noteCount = 0` → no signal. Then when `noteCount` becomes 1, the effect runs with `prevNoteCount.current = 0` and `noteCount = 1` → signal sent. So this should work.

**Most likely root cause**: The agent flow takes time. During that time, `onAgentEnd` fires → `setAgentActive(false)`. But the note might not have been inserted yet when the agent flow "ends" — the edge function returns, but the INSERT happens asynchronously. The realtime subscription eventually picks it up, but there might be a delay. During that delay, the user sees no change.

**Simplification**: Rather than chasing the exact race condition, the fix should make the system more robust:

### Bug 2: Can't exit Capture Pod
The `useEffect` in StarMapLayout re-opens capture pod whenever the user closes it, as long as `tour.active && tour.step?.id === 'create'`. This is a UX trap.

## Fix Plan

### File 1: `src/components/layout/StarMapLayout.tsx`
**Change**: Remove the auto-reopen effect. Replace with a one-shot auto-open that only fires once (using a ref).

```typescript
// Auto-open capture pod ONCE when tour starts on 'create' step
const captureAutoOpened = useRef(false);
useEffect(() => {
  if (tour.active && tour.step?.id === 'create' && !captureAutoOpened.current) {
    captureAutoOpened.current = true;
    openPod('capture');
  }
}, [tour.active, tour.step, openPod]);
```

This prevents the re-open loop. User can freely close the pod.

### File 2: `src/hooks/useTourTrigger.ts`
**Change**: Add a fallback mechanism — also listen for `agent-complete` custom event (dispatched from CaptureBox) and poll `noteCount` on a short interval when on step 'create'. This handles the case where the realtime event is delayed.

Actually, simpler fix: just remove the `prevNoteCount.current === 0` guard. If `noteCount > 0` and step is 'create', advance. This handles the case where the note arrived before the effect ran.

```typescript
// Step 1: Watch first note creation
useEffect(() => {
  if (!active || step?.id !== 'create') return;
  if (noteCount > 0) {
    send('first-note-created');
  }
}, [active, step, noteCount, send]);
```

### File 3: `src/components/pods/CaptureBox.tsx`
**Change**: After agent completes and note is created, dispatch a custom event `tour-note-created` so the tour can react immediately without waiting for realtime.

Actually this is already handled by `onFlashNote` which is called after note creation. The flash triggers a re-render. And the realtime subscription should pick up the INSERT.

The simplest and most robust fix:
1. **useTourTrigger**: Change condition from `prevNoteCount.current === 0 && noteCount > 0` to just `noteCount > 0`
2. **StarMapLayout**: Use a ref to prevent re-opening capture pod

## Files to Modify
1. `src/components/layout/StarMapLayout.tsx` — one-shot auto-open with ref
2. `src/hooks/useTourTrigger.ts` — simplify step 1 detection

## Verification
1. Register new account
2. Tour should start, capture pod opens
3. Input text, agent runs, note appears on star map
4. Tour HUD should advance from 'create' to 'explore'
5. User should be able to close capture pod at any time
6. Clicking a star node should complete the tour
