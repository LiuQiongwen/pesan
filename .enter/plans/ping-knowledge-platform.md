# Plan: Drag Node to Pod — "委托给能力舱"

## Context

The system has 5 ability pods (Capture / Retrieval / Insight / Memory / Action) in the CommandDock.
Users currently click dock buttons to open pods. This plan adds a spatial drag interaction:
hold-drag a note from the 3D star map, move toward the dock, and release over a pod button to
"delegate" that knowledge to that ability for processing.

The existing drag mechanism (350 ms hold) is already implemented in CosmosScene.tsx and feeds
`onNodeConnect` (node-to-node) and `onNodeDropToGalaxy` (galaxy assignment). This plan adds a
third destination type: **pod drop**, detected when the cursor is over a dock button on mouseup.

The `AgentWorkflowContext.sendRelay(content, from, to)` system already handles cross-pod
content delivery — Retrieval, Insight, Action, and Memory pods all need to be wired to consume it.

---

## Architecture Decision

**Detection method**: On hold-drag start, add global `window.mousemove` + `window.mouseup`
listeners (in addition to existing canvas-level ones). Global events fire regardless of which
HTML element the cursor is over, solving the cross-layer detection problem.

**Dock hit-testing**: Each dock button gets `data-pod-id="xxx"` attribute. On global `mouseup`,
use `document.querySelectorAll('[data-pod-id]')` + `getBoundingClientRect()` to detect pod drop.

**Dock feedback**: Use `window.dispatchEvent(new CustomEvent('cosmos:pod-drag', {...}))` from
CosmosScene during drag. CommandDock listens to these events (via `useEffect`) and shows
receiving-mode visuals — no prop drilling needed.

---

## Files to Modify

| File | Change |
|---|---|
| `src/components/starmap/CosmosScene.tsx` | Global drag listeners + pod-drop detection + CustomEvent dispatch |
| `src/components/floating/CommandDock.tsx` | `data-pod-id` attrs + receiving-mode visuals |
| `src/components/starmap/KnowledgeStarMap.tsx` | Pass `onNodeDropToPod` prop to CosmosScene |
| `src/components/layout/StarMapLayout.tsx` | `handleNodeDropToPod` handler + relay dispatch |
| `src/components/pods/RetrievalBox.tsx` | Add `consumeRelay('retrieval')` + auto-search |
| `src/components/pods/InsightBox.tsx` | Add `consumeRelay('insight')` + auto-select note |
| `src/components/pods/MemoryBox.tsx` | Add `pinnedNoteId?: string` prop |

---

## Implementation Steps

### 1. `CosmosScene.tsx` — Global Listeners + Pod-Drop Detection

**New props** (added to both `CosmosSceneProps` and `CoreProps`):
```ts
onNodeDropToPod?: (noteId: string, podId: string) => void;
```

**Hold timer callback** (when 350ms fires): additionally attach global listeners:
```ts
// After setting connectStateRef:
window.addEventListener('mousemove', onMoveGlobal);
window.addEventListener('mouseup',   onUpGlobal);
window.dispatchEvent(new CustomEvent('cosmos:pod-drag', {
  detail: { active: true, noteId }
}));
```

**`cancelConnect` cleanup**: remove global listeners + dispatch deactivate event:
```ts
window.removeEventListener('mousemove', onMoveGlobal);
window.removeEventListener('mouseup',   onUpGlobal);
window.dispatchEvent(new CustomEvent('cosmos:pod-drag', { detail: { active: false } }));
```

**`onMoveGlobal`**: Same as canvas `onMove` PLUS dispatch cursor position:
```ts
window.dispatchEvent(new CustomEvent('cosmos:pod-drag', {
  detail: { active: true, noteId: cs.sourceId, x: e.clientX, y: e.clientY }
}));
```

**`onUpGlobal`** — pod drop detection runs BEFORE galaxy/node detection:
```ts
// Check dock button bounds FIRST
const podEls = document.querySelectorAll('[data-pod-id]');
for (const el of podEls) {
  const r = el.getBoundingClientRect();
  // Expand hit area slightly (±12px) for easier targeting
  if (e.clientX >= r.left - 12 && e.clientX <= r.right + 12 &&
      e.clientY >= r.top  - 12 && e.clientY <= r.bottom + 12) {
    const podId = el.getAttribute('data-pod-id')!;
    cancelConnect();
    onNodeDropToPodRef.current?.(sourceId, podId);
    return;
  }
}
// Else: fall through to existing galaxy/node logic
```

### 2. `CommandDock.tsx` — Receiving Mode

Add `data-pod-id={step.id}` to each button element.

Listen to `cosmos:pod-drag` CustomEvent in `useEffect`:
```ts
const [receiveMode, setReceiveMode] = useState(false);
const [receiveHover, setReceiveHover] = useState<PodId | null>(null);

useEffect(() => {
  const handler = (e: CustomEvent) => {
    const { active, x, y } = e.detail;
    setReceiveMode(active);
    if (!active) { setReceiveHover(null); return; }
    // Determine which button cursor is nearest / over
    const podEls = document.querySelectorAll('[data-pod-id]');
    let closest: PodId | null = null, closestDist = Infinity;
    for (const el of podEls) {
      const r = el.getBoundingClientRect();
      const cx = (r.left + r.right) / 2;
      const cy = (r.top + r.bottom) / 2;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist < closestDist) { closestDist = dist; closest = el.getAttribute('data-pod-id') as PodId; }
    }
    // Only highlight if within 120px of a button
    setReceiveHover(closestDist < 120 ? closest : null);
  };
  window.addEventListener('cosmos:pod-drag', handler as EventListener);
  return () => window.removeEventListener('cosmos:pod-drag', handler as EventListener);
}, []);
```

**Visual states during receive mode**:
- `receiveMode === true`: dock container rises 6px (`translateY(-6px)`), all buttons: 
  border brightens to `accentAlpha(0.35)`, background: `accentAlpha(0.07)`
- `receiveHover === step.id`: button scales 1.10×, border full brightness `accentAlpha(0.90)`,
  background gradient brightens, bottom indicator bar glows, label changes to `"委托"`,
  sublabel changes to `"释放以处理"`
- Drop flash: on `cosmos:pod-drop` event, trigger a 400ms scale-flash animation on the dropped button

New CSS animation:
```css
@keyframes pod-receive-flash {
  0%   { transform: scale(1.10); box-shadow: 0 0 40px var(--accent); }
  60%  { transform: scale(1.20); }
  100% { transform: scale(1.00); box-shadow: none; }
}
```

### 3. `KnowledgeStarMap.tsx`

Add prop to `KnowledgeStarMapProps`:
```ts
onNodeDropToPod?: (noteId: string, podId: string) => void;
```

Pass through to `CosmosScene` in the `createElement(Canvas, ...)` block.

### 4. `StarMapLayout.tsx`

Add handler using existing `notes`, `openPod`, `sendRelay`:

```ts
const handleNodeDropToPod = useCallback((noteId: string, podId: string) => {
  const note = notes.find(n => n.id === noteId);
  if (!note) return;

  // Format note content for relay
  const content = [
    note.title,
    note.summary,
    note.tags?.join(', '),
  ].filter(Boolean).join('\n\n');

  openPod(podId as PodId);

  if (podId === 'memory') {
    // Memory uses hoveredNode — set it directly, no relay needed
    setHoveredNode({ noteId: note.id, title: note.title, tags: note.tags, summary: note.summary });
  } else {
    sendRelay(content, 'capture', podId as PodId);
  }

  // Dispatch drop-flash event for dock button
  window.dispatchEvent(new CustomEvent('cosmos:pod-drop', { detail: { podId } }));
}, [notes, openPod, sendRelay, setHoveredNode]);
```

Wire into `KnowledgeStarMap`: `onNodeDropToPod={handleNodeDropToPod}`.

Note: `sendRelay` is from `useAgentWorkflow()`. Currently `AgentWorkflowProvider` wraps `StarMapInner` children. We need to call `useAgentWorkflow()` in `StarMapInner` and pass `sendRelay` to the handler.

### 5. `RetrievalBox.tsx` — Relay Support

Add `consumeRelay('retrieval')` with auto-search:
```ts
// At top of RetrievalBox component:
const workflow = useAgentWorkflow();

useEffect(() => {
  const relayed = workflow.consumeRelay('retrieval');
  if (relayed) {
    // Extract first line as query
    const query = relayed.split('\n')[0]?.slice(0, 120) || '';
    setQuery(query);
    workflow.setActiveStep('retrieval');
    // Auto-search after brief delay
    setTimeout(() => search(query), 400);
  }
}, [workflow.relay?.timestamp]);
```

### 6. `InsightBox.tsx` — Relay Support

Add `consumeRelay('insight')` + auto-select:
```ts
useEffect(() => {
  const relayed = workflow.consumeRelay('insight');
  if (relayed) {
    // Find matching note by title match
    const title = relayed.split('\n')[0];
    const match = notes.find(n => n.title === title);
    if (match) setSelectedId(match.id);
    workflow.setActiveStep('insight');
  }
}, [workflow.relay?.timestamp, notes]);
```

### 7. `MemoryBox.tsx` — Pinned Note Prop

```ts
interface Props {
  hoveredNoteId?: string | null;
  pinnedNoteId?:  string | null;  // from drag-to-pod drop, overrides hover
}
// Update buildCards call:
const effectiveId = pinnedNoteId ?? hoveredNoteId;
```

In `StarMapLayout.tsx`, pass `pinnedNoteId` to MemoryBox after drag-to-memory drop.
Use local state `pinnedMemoryNoteId` that gets set in `handleNodeDropToPod` and cleared after 30s.

---

## Visual Interaction Summary

| Phase | What the user sees |
|---|---|
| Hold 350ms | Node lifts, drag line appears (existing), dock rises 6px, all 5 buttons subtly brighten |
| Drag toward dock | As cursor enters bottom 25% of screen, dock glows; nearest button starts expanding |
| Hover over button | Button scales 1.10×, label → "委托", sublabel → "释放以处理", glow burst |
| Release on button | Button flash (scale 1.20 → 1.0 in 400ms), pod opens, processing starts immediately |
| Pod receives | Shows "已接收来自星图的知识粒" banner for 3s (reuse ConnectToast style) |

## Answering the 6 Design Questions

1. **Retrieval**: Note title → auto-fills query → auto-triggers semantic search
2. **Insight**: Note ID matched → pre-selects note → user clicks analyze (or auto-triggers on relay)
3. **Action**: Note content → pre-fills ActionBox input → user picks conversion type
4. **Memory**: Note ID → MemoryBox anchors to that note → shows top 5 related memories
5. **Highlight/snap feedback**: Dock rises, buttons brighten during drag; target button scales + label changes; drop causes flash burst
6. **Not a trash can**: Language is "委托" (delegation). The pod immediately shows activity. Drop triggers processing, not just "accepting". The spatial gesture (flying from cosmos into the control console) reinforces the delegation metaphor.

---

## Verification

1. Hold 350ms on any note node → dock should visibly rise + button borders brighten
2. Move cursor to Retrieval button → button should expand + show "委托" label
3. Release → Retrieval pod opens, search query pre-filled with note title, auto-search fires
4. Same for Action → ActionBox input pre-filled with note content
5. Same for Memory → MemoryBox shows memories related to dragged note
6. Release NOT on a pod button → existing galaxy/node logic fires (no regression)
