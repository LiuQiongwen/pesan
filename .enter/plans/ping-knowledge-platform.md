# Refactor: Node Interaction Intent System

## Context
Current CosmosScene merges hover/click/shift+click/hold-drag into one `mousedown→mouseup` handler.
The `onUp` handler decides intent AFTER the fact, causing conflicts:
- Shift+click to connect still fires `onToggleRef` (opens panel) at line 679
- Hold-drag connect mode and hover preview share the same `hoveredId`
- There's no double-click path — single click directly opens/closes panels

**Root Cause**: One `onUp` handler tries to guess intent after a single pointer event chain.
The system needs an **explicit interaction mode FSM** that gates all downstream actions.

---

## Interaction Rules (New)

| Gesture | browse mode | connect mode |
|---------|-------------|--------------|
| hover | lightweight preview (NodeLightBand) | **suppressed** |
| single click | **select** node (highlight ring) | pick source → pick target → fire connect |
| double click | **open** panel (existing NodeWindow/toggle) | ignored |
| Shift+click | enter connect mode + pick source | pick target → fire connect |
| Escape | deselect | exit connect mode → browse |
| long-hold drag | existing drag-to-connect/pod/galaxy | n/a |

---

## State Design

**Current state** (all in ImperativeCore + outer CosmosScene):
- `hoveredId` — used for BOTH preview AND visual highlight
- `connectStateRef` — drag-to-connect state (hold-drag only)
- `openNodes` (in KnowledgeStarMap) — controls NodeWindows

**New state** (lifted to KnowledgeStarMap, passed down as props):

```ts
type InteractionMode = 'browse' | 'connect';

// In KnowledgeStarMap:
const [mode, setMode] = useState<InteractionMode>('browse');
const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
const [connectFromId, setConnectFromId] = useState<string | null>(null);
// hoveredId stays in CosmosScene (visual only, suppressed in connect mode)
// openNodes stays in KnowledgeStarMap (double-click opens)
```

---

## Event Flow Design

### In ImperativeCore (`onUp` handler):

```
onUp(e):
  if (was-drag) → return (existing drag-to-connect)
  hit-test → get noteId

  if (e.shiftKey && mode === 'browse'):
    setMode('connect')
    setConnectFromId(noteId)
    setSelectedNodeId(noteId)
    return

  if (mode === 'connect'):
    if (noteId && noteId !== connectFromId):
      onNodeConnect(connectFromId, noteId)  // fire connection
      // play flash feedback on both nodes
      setMode('browse')
      setConnectFromId(null)
      setSelectedNodeId(null)
    elif (noteId === connectFromId):
      // re-clicked source → deselect → back to browse
      setMode('browse')
      setConnectFromId(null)
      setSelectedNodeId(null)
    return

  // mode === 'browse':
  if (isDoubleClick):                  // <300ms since last click on same id
    onNodeToggle(noteId)               // open panel
  else:
    setSelectedNodeId(prev => prev === noteId ? null : noteId)  // select/deselect
```

### Double-click detection:
```ts
const lastClickRef = useRef<{ id: string; time: number } | null>(null);

// In onUp:
const now = performance.now();
const last = lastClickRef.current;
const isDouble = last && last.id === noteId && (now - last.time) < 300;
lastClickRef.current = { id: noteId, time: now };
```

### Hover suppression in connect mode:
```ts
// In useFrame hover raycasting (line ~990):
if (mode === 'connect') {
  // Don't update hoveredId — keep it null
  if (hoveredIdRef.current) { hoveredIdRef.current = null; setHoveredIdRef.current(null); }
  return; // skip hover
}
```

### Escape handler:
```ts
// In onKeyDown:
if (e.key === 'Escape') {
  if (mode === 'connect') {
    setMode('browse');
    setConnectFromId(null);
    setSelectedNodeId(null);
  }
  cancelConnect(); // existing drag cleanup
}
```

---

## Files to Modify

### 1. `src/components/starmap/KnowledgeStarMap.tsx`
- Add `mode`, `selectedNodeId`, `connectFromId` state
- Pass these + setters to CosmosScene as new props
- Shift+click no longer calls `onNodeWorkbenchSelectRef` — it enters connect mode
- Existing `handleNodeConnect` callback stays (called by CosmosScene on connect completion)

### 2. `src/components/starmap/CosmosScene.tsx`
**Props change:**
```ts
interface CoreProps {
  // existing...
  mode: 'browse' | 'connect';
  selectedNodeId: string | null;
  connectFromId: string | null;
  onSetMode: (m: 'browse' | 'connect') => void;
  onSetSelectedNodeId: (id: string | null) => void;
  onSetConnectFromId: (id: string | null) => void;
}
```

**`onUp` handler rewrite** (lines 609-683):
- Add double-click detection via `lastClickRef`
- Route through mode FSM instead of flat if/else
- Shift+click → enter connect mode (NOT workbench select)

**`useFrame` hover raycasting** (lines ~985-1010):
- Guard: `if (mode === 'connect') skip hover`

**Visual ring for selectedNodeId** (in mesh update loop ~line 953):
```ts
} else if (selectedNodeId === noteId) {
  scale = 1.3; intensity = 2.5; // distinct "selected" highlight
}
```

**Visual ring for connectFromId** (pulsing source indicator):
```ts
} else if (connectFromId === noteId) {
  const pulse = Math.sin(t * 4) * 0.15 + 1.45;
  scale = pulse; intensity = 3.5;
}
```

### 3. `src/components/starmap/CosmosScene.tsx` (outer component, ~line 1075)
- Accept + pass through `mode`, `selectedNodeId`, `connectFromId`, setters
- When `mode === 'connect'`: suppress `showButtons` (hover action buttons)

### 4. `src/components/layout/StarMapLayout.tsx`
- No changes needed — `openPod` and `flashNote` stay independent

### 5. `src/components/layout/NodeLightBand.tsx`
- Accept optional `mode` prop
- When `mode === 'connect'`: show "Connection Mode" indicator instead of node preview

---

## Connect Mode UI Behavior

When `mode === 'connect'`:
1. NodeLightBand shows: `"🔗 连接模式 · 点击目标节点完成连接 · Esc 取消"`
2. Hover preview is suppressed (no NodeLightBand node info)
3. Hover quick-action buttons are suppressed
4. Right-click context menu is suppressed
5. Source node pulses with a distinct visual (scale + emissive)
6. Cursor shows crosshair (via CSS class on canvas parent)

---

## Verification

1. **Browse mode**: hover shows preview → single click highlights (selected ring) → double click opens NodeWindow
2. **Connect via Shift+click**: Shift+click node A → A pulses → click node B → connection fires → mode returns to browse
3. **Connect via hold-drag**: existing hold 350ms → drag line → drop on target/galaxy/pod (unchanged)
4. **Escape from connect**: Shift+click A → Esc → mode returns to browse, A deselected
5. **No panel on connect**: completing a connection does NOT open a NodeWindow
6. **Mobile**: long-press still works for context menu (unchanged)
