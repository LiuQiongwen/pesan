# Plan: Knowledge Cosmos UI — Full Redesign

## Context

Replace the traditional sidebar + page layout with a **full-screen knowledge star map** as the permanent background, and all features as lightweight floating input toolboxes. The star map is the output layer; toolboxes are only input windows. All analysis results, search highlights, and relationships manifest directly on the canvas.

---

## User Vision (confirmed)
- Note detail: **translucent light band** at bottom of screen — small input window, output on star map
- Toolboxes: **compact input-only panels** (~320-440px wide)
- The star map is the primary interface, always visible

---

## Architecture

```
<StarMapLayout> (fixed fullscreen, no sidebar)
  ├── <KnowledgeStarMap>          z=0   always-on canvas
  ├── <NodeLightBand>             z=10  bottom strip on node hover/click
  ├── <ToolboxLayer>              z=20  all open floating toolboxes
  │     ├── <FloatingToolbox id="analyze">
  │     ├── <FloatingToolbox id="search">
  │     └── ... (8 toolboxes total)
  └── <CommandDock>               z=30  bottom-center icon pill
```

---

## New Files to Create

### 1. `src/contexts/ToolboxContext.tsx`
Global state: which toolboxes are open, their positions, z-index ordering.
```ts
interface ToolboxState {
  open: boolean;
  minimized: boolean;
  pos: { x: number; y: number };
  zIndex: number;
}
type ToolboxId = 'analyze'|'search'|'library'|'distiller'|'mirror'|'anticipation'|'actions'|'settings';
// Provides: openToolbox(id), closeToolbox(id), minimizeToolbox(id), bringToFront(id), setPos(id, pos)
// Persists positions to localStorage key 'cosmos_toolbox_positions'
```

### 2. `src/components/floating/FloatingToolbox.tsx`
Generic draggable glass panel. Props: `id, title, icon, width, children`.
- Drag handle on title bar (mousedown → mousemove → mouseup)
- Minimize button: collapses to 42px title bar only
- Close button: calls `closeToolbox(id)`
- Pin button: disables dragging
- Calls `bringToFront(id)` on any click
- Style: `background: rgba(5,7,12,0.82)`, `backdrop-filter: blur(18px)`, `border: 1px solid rgba(0,255,102,0.12)`, neon green glow on active
- Active glow: `box-shadow: 0 0 0 1px rgba(0,255,102,0.25), 0 8px 32px rgba(0,0,0,0.6)`

### 3. `src/components/floating/CommandDock.tsx`
Bottom-center floating pill. 
- 8 icons (Upload/Brain, Search, BookOpen, FlaskConical, Scan, Sparkles, CheckSquare, Settings)
- Click toggles toolbox open/close
- Active icon: neon green glow
- Style: dark glass pill, `position: fixed, bottom: 24px, left: 50%, transform: translateX(-50%)`, z=30

### 4. `src/components/layout/StarMapLayout.tsx`
New root layout — replaces AppLayout:
- Auth guard (redirect to /auth if no user)
- Renders full-screen `<KnowledgeStarMap>` (position: fixed, inset 0)
- Renders `<ToolboxLayer>` with all 8 toolboxes
- Renders `<CommandDock>`
- Renders `<NodeLightBand>` (receives hovered/selected node from starmap)
- Small top-right: user email initial + date (no sidebar)

### 5. `src/components/starmap/KnowledgeStarMap.tsx`
Lift star map canvas logic from `Dashboard.tsx` into standalone component:
- All existing canvas rendering code (nodes, edges, glows, streaks) 
- NEW: `onNodeHover(node | null)` callback → feeds NodeLightBand
- NEW: `onNodeClick(noteId)` callback → opens note route
- NEW: `highlightedNoteIds?: string[]` prop → glows those nodes in search results
- NEW: `flashNoteId?: string` prop → flash animation on newly added note
- Position: `position: fixed, inset: 0, width: 100vw, height: 100vh`

### 6. `src/components/layout/NodeLightBand.tsx`
Bottom translucent strip shown when a node is hovered/clicked.
- `position: fixed, bottom: 0, left: 0, right: 0, height: 88px`
- `background: linear-gradient(to top, rgba(5,7,12,0.90), rgba(5,7,12,0.40))`
- `backdrop-filter: blur(12px)`, `border-top: 1px solid rgba(0,255,102,0.10)`
- Content: note title (neon green), tags (tiny chips), one-line summary, date
- Right side: "展开 →" button → navigates to `/note/:id`
- Slides in/out with CSS transform animation (`translateY(100%)` hidden)
- Receives `hoveredNode: {noteId, title, tags, summary, createdAt, clusterIdx} | null`

---

## Toolbox Content Components (INPUT ONLY)

### `src/components/toolboxes/AnalyzeBox.tsx` (420px wide)
- Source type tabs: URL | Text | File (compact 32px tabs)
- Single input field + submit button
- Loading: progress steps shown as animated dots in the toolbox
- On complete: toolbox auto-minimizes; new node flashes on starmap
- Reuse: import Analyze.tsx state logic (useAnalysis hook, analyze logic)

### `src/components/toolboxes/SearchBox.tsx` (400px wide)
- Single search input
- After search: answer shown in toolbox (compact, 4-line max), cited notes highlighted on starmap
- Reuse: `useRAG.ts` hook

### `src/components/toolboxes/LibraryBox.tsx` (360px wide)
- Search filter input
- Compact note list (3 notes visible at once, scrollable)
- Each note row: icon, title (truncated), date → click highlights on starmap + opens light band
- Delete action in context menu
- Reuse: `useNotes` hook, Library.tsx filter logic

### `src/components/toolboxes/DistillerBox.tsx` (380px wide)
- "Select a note" dropdown (or pick from starmap click)
- Run distillation button
- Shows last result inline (compact, collapsible layers)
- Reuse: Distiller.tsx logic, `distill-insight` edge function call

### `src/components/toolboxes/MirrorBox.tsx` (360px wide)
- "Run Cognitive Mirror" button
- Shows last report date + dominant_themes as tags
- "View full report" → opens `/mirror` route in overlay
- Reuse: CognitiveMirror.tsx trigger logic

### `src/components/toolboxes/AnticipationBox.tsx` (360px wide)
- "Run Anticipation Analysis" button
- Shows last 3 predictions (compact 1-line each)
- Reuse: AnticipationLayer.tsx trigger logic

### `src/components/toolboxes/ActionsBox.tsx` (360px wide)
- Action item list with checkboxes (compact)
- Quick-add input
- Reuse: ActionLayer.tsx logic + actions DB table

### `src/components/toolboxes/SettingsBox.tsx` (320px wide)
- Language toggle (中/EN)
- Account info + sign out button
- Reuse: Settings.tsx, useLanguage hook

---

## Default Toolbox Positions (first open, before localStorage)
```
analyze:      { x: 80,  y: 100 }
search:       { x: 80,  y: 180 }   ← stagger so they don't all overlap
library:      { x: 120, y: 140 }
distiller:    { x: 160, y: 120 }
mirror:       { x: 200, y: 100 }
anticipation: { x: 240, y: 120 }
actions:      { x: 160, y: 140 }
settings:     { x: window.innerWidth - 360, y: 80 }
```
Positions randomize slightly with `Math.random() * 40` offset to avoid total overlap.

---

## Files to Modify

### `src/router.tsx`
- Remove AppLayout-wrapped children
- Add StarMapLayout as the root shell for all auth-required routes
- Keep `/note/:id` route under StarMapLayout (renders as overlay/full-screen on top)
- Keep `/auth` as standalone
- Remove /dashboard (StarMapLayout IS the home)
- Route `/` → redirect to `/` inside StarMapLayout (show star map + toolboxes)

```tsx
{
  path: '/',
  element: <StarMapLayout />,
  children: [
    { index: true, element: null },           // star map only
    { path: 'note/:id', element: <NotePage /> },  // full overlay
    { path: 'mindmap/:id', element: <MindMapPage /> },
  ]
}
```

### `src/pages/Note.tsx`
- Wrap in `position: fixed, inset: 0` overlay style over starmap
- Keep all existing content unchanged
- Add back-button behavior: navigate(-1) or navigate('/')

### `src/index.css`
Replace design tokens with pure cosmic dark:
```css
:root {
  /* Always dark — cosmic black */
  --background: 0 0% 2%;              /* #040508 */
  --foreground: 220 15% 88%;
  --neon-green: 145 100% 50%;         /* #00ff66 */
  --neon-cyan: 185 100% 70%;          /* #66f0ff */
  --neon-purple: 265 70% 72%;
  /* toolbox glass tokens */
  --glass-bg: rgba(5,7,12,0.82);
  --glass-border: rgba(0,255,102,0.12);
  --glass-glow: rgba(0,255,102,0.20);
}
/* Remove light mode — force dark cosmos */
```

### `src/App.tsx`
- Add `ToolboxProvider` wrapper
- Remove LanguageProvider is already there — keep it

### Delete
- `src/components/layout/Sidebar.tsx` (no longer needed)

---

## Star Map Output Behaviors

| Event | Star Map Visual Response |
|-------|--------------------------|
| New note analyzed | Node flash-in: `pulse 0.8s`, bright glow fade |
| Search results | Matched nodes: ring glow in cyan-blue |
| Search cleared | All nodes back to normal |
| Library row hovered | That node highlights on starmap |
| Distiller runs | Source + related nodes: connections strengthen temporarily |

---

## Implementation Order (batches to avoid timeout)

**Batch A:** `index.css` redesign + `ToolboxContext` + `FloatingToolbox`
**Batch B:** `KnowledgeStarMap` + `NodeLightBand` + `CommandDock`  
**Batch C:** `StarMapLayout` + router update + delete Sidebar
**Batch D:** 4 toolboxes: `AnalyzeBox`, `SearchBox`, `LibraryBox`, `ActionsBox`
**Batch E:** 4 toolboxes: `DistillerBox`, `MirrorBox`, `AnticipationBox`, `SettingsBox`
**Batch F:** `Note.tsx` overlay style + App.tsx provider update

---

## Verification
- App loads: full-screen black canvas with animated nodes, no sidebar
- CommandDock visible at bottom-center
- Click any dock icon: floating toolbox opens with neon border
- Drag toolbox: follows mouse, position persists on reload
- Minimize toolbox: collapses to title bar
- Hover star map node: NodeLightBand slides up from bottom
- Click node: navigates to `/note/:id` as overlay
- Analyze new URL: on completion, new node flashes on map
- Search: cited nodes glow cyan
- TypeScript: 0 errors, 0 lint errors
