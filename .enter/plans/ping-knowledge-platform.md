# Onboarding Tour — "Action + Feedback + Value" Design Plan

## Context

New users land on an empty star map with only a `< CLICK TO BEGIN >` CTA. They have no guidance on the product's unique value propositions: the 3D knowledge universe, 5 functional pods, AI agent pipeline, node detail pages, or relationship building. The goal is to create an **action-driven onboarding** that teaches by doing — not reading.

The `profiles` table has no tour-tracking field yet. No tour/onboarding component exists.

---

## Architecture

### Data: Tour State Tracking

Add `tour_state jsonb DEFAULT '{}'` to `profiles` table. Structure:
```json
{
  "core_completed": false,    // first-run core tour
  "advanced_unlocked": false, // after creating 5+ notes
  "steps_seen": ["welcome", "capture", ...]
}
```
This allows incremental unlocking and resumable state.

### Component Structure

```
src/components/tour/
  TourProvider.tsx        — Context: current step, advance, skip, completion
  TourOverlay.tsx         — Spotlight mask + tooltip bubble
  TourStepContent.tsx     — Step content renderer (action prompt, value text)
  useTourTrigger.ts       — Watches for action completion to auto-advance
```

### Integration Point

`StarMapContents` (in `StarMapLayout.tsx`) wraps children with `<TourProvider>`. The provider reads `profiles.tour_state` on mount. If `core_completed` is false and `notes.length === 0`, it activates.

---

## Core Tour: 6 Steps (First Run)

### Step 1: Welcome — "你的知识宇宙"
- **Trigger**: notes.length === 0, tour not completed
- **Spotlight**: Full screen (no mask), star background visible
- **UI**: Center-screen panel with brand logo
- **Copy**:
  - Title: `欢迎来到你的知识宇宙`
  - Body: `这不是一个笔记工具，这是一个会思考的知识星图。`
  - Sub: `每一条知识都会成为一颗星，AI 会帮你建立它们之间的联系。`
  - CTA button: `创造第一颗星 →`
- **Action**: Click CTA → opens Capture Pod → advance to step 2
- **Value**: "Your knowledge is a living universe, not a folder."

### Step 2: Capture — "投入第一条知识"
- **Trigger**: Capture Pod is open
- **Spotlight**: Capture Pod (CommandDock "Capture" icon highlighted)
- **UI**: Tooltip anchored to QuickCaptureBar or CaptureBox
- **Copy**:
  - Title: `投入第一条知识`
  - Body: `粘贴一段文字、一个网址、或一个想法。`
  - Sub: `输入任何内容，AI 会自动分析、摘要、建立关联。`
  - Hint: `试试粘贴一篇你最近在读的文章`
- **Action**: User submits content in CaptureBox → agent pipeline starts
- **Auto-advance**: When `pipeline.running` becomes true → advance to step 3
- **Value**: "One input triggers a full AI analysis pipeline."

### Step 3: Agent Pipeline — "AI 正在工作"
- **Trigger**: Pipeline is running (agent indicator visible)
- **Spotlight**: AgentTrail / pipeline progress
- **UI**: Tooltip near the "AGENT WORKING" indicator
- **Copy**:
  - Title: `AI 正在处理你的知识`
  - Body: `分析内容 → 生成摘要 → 提取关键点 → 建立知识索引 → 编译知识图谱`
  - Sub: `7 步自动化管道，从原始信息到结构化知识。`
- **Action**: Wait for pipeline completion
- **Auto-advance**: When first note appears in notes array → advance to step 4
- **Value**: "Not just storage — your knowledge is processed by a 7-step AI pipeline."

### Step 4: Star Born — "你的第一颗知识星"
- **Trigger**: notes.length === 1, star visible on map
- **Spotlight**: The newly created star node on the map
- **UI**: Tooltip anchored near the star (using its 3D projected screen position)
- **Copy**:
  - Title: `你的第一颗知识星诞生了`
  - Body: `点击它，查看 AI 为你生成的分析报告。`
  - Sub: `每颗星都有摘要、分析、报告、思维导图四个视角。`
- **Action**: User clicks the star node → navigates to note detail
- **Auto-advance**: When route changes to `/note/:id` → advance to step 5
- **Value**: "Every piece of knowledge gets 4 AI-generated perspectives."

### Step 5: Note Detail — "四个视角看知识"
- **Trigger**: On note detail page
- **Spotlight**: Tab bar (summary / analysis / report / mindmap)
- **UI**: Tooltip pointing at tabs
- **Copy**:
  - Title: `四个视角，一条知识`
  - Body: `切换标签页，查看摘要、分析、报告和思维导图。`
  - Sub: `这不是你写的笔记 — 这是 AI 从你的输入中提炼出的结构化知识。`
- **Action**: User clicks any tab
- **Auto-advance**: User clicks back to star map → advance to step 6
- **Value**: "AI transforms raw input into structured, multi-view knowledge."

### Step 6: Complete — "开始探索"
- **Trigger**: Back on star map with 1+ notes
- **Spotlight**: CommandDock (all 5 pods)
- **UI**: Center tooltip showing the 5 pod icons in a row
- **Copy**:
  - Title: `五大功能舱，等你探索`
  - Body: `捕获 · 检索 · 洞察 · 记忆 · 行动 — 知识从输入到执行的完整链路。`
  - Sub: `继续添加更多知识，星图会越来越丰富。`
  - CTA: `开始自由探索 →`
- **Action**: Click CTA → tour completes
- **On complete**: Update `profiles.tour_state = { core_completed: true }`
- **Value**: "A complete knowledge lifecycle, not just a note-taker."

---

## Advanced Tour (Unlocked after 5+ notes)

Triggered when `notes.length >= 5` and `advanced_unlocked === false`. Shows as a subtle HUD notification: "解锁进阶功能" — user can dismiss or start.

Steps (tooltip hints, not full spotlight):
1. **Retrieval Pod** — "用自然语言搜索你的所有知识" (hover CommandDock retrieval icon)
2. **Tag Clusters** — "相同标签的节点自动聚成星系" (when clusters visible)
3. **Node Connections** — "长按节点建立知识关联" (when 3+ nodes exist)
4. **Drag to Pod** — "拖拽节点到功能舱，触发深度分析" (hover CommandDock)
5. **Obsidian Import** — "导入 Obsidian，迁移你的知识库" (in settings)

---

## Key Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `src/components/tour/TourProvider.tsx` | Context + state machine for tour steps |
| `src/components/tour/TourOverlay.tsx` | Spotlight mask + positioned tooltip |
| `src/components/tour/TourStepContent.tsx` | Per-step content (title, body, sub, CTA) |
| `src/hooks/useTourTrigger.ts` | Watches actions (pipeline start, note created, page nav) to auto-advance |

### Modified Files
| File | Change |
|------|--------|
| `src/components/layout/StarMapLayout.tsx` | Wrap with TourProvider, pass tour callbacks |
| `src/index.css` | Add tour overlay animations (fade, spotlight) |
| DB migration | Add `tour_state jsonb` to `profiles` |

---

## Implementation Details

### TourProvider
```tsx
interface TourStep {
  id: string;
  spotlightSelector?: string;    // CSS selector for spotlight target
  spotlightPosition?: 'center' | { x: number; y: number }; // for 3D elements
  placement: 'center' | 'top' | 'bottom' | 'left' | 'right';
}

interface TourContext {
  active: boolean;
  currentStep: TourStep | null;
  advance: () => void;
  skip: () => void;
  completeTour: () => void;
}
```

### TourOverlay
- Full-screen fixed overlay (z-index: 9999)
- SVG mask with animated spotlight hole around target element
- Tooltip bubble positioned relative to spotlight
- `pointerEvents: none` on the mask, `pointerEvents: auto` on tooltip + spotlight area
- Backdrop: `background: radial-gradient(ellipse at [spotlight], transparent 120px, rgba(0,0,0,0.75) 200px)`

### Auto-advance via useTourTrigger
- Watches `notes.length` changes (0→1 = "star born")
- Watches `pipeline.running` state
- Watches route changes via `useLocation`
- Dispatches `advance()` on matching conditions

### Skip & Persistence
- "跳过导览" link on every step (small, bottom-right of tooltip)
- On skip or complete: `supabase.from('profiles').update({ tour_state: {...} })`
- Tour never auto-starts again once `core_completed: true`

---

## MVP Scope (First Implementation)

**Include:**
1. `profiles.tour_state` column migration
2. `TourProvider` with 6-step state machine
3. `TourOverlay` with spotlight + tooltip (CSS-only, no SVG complexity)
4. `TourStepContent` with hardcoded Chinese copy
5. Auto-advance for steps 2→3 (pipeline start), 3→4 (note created), 4→5 (nav to detail)
6. Manual advance for steps 1→2 (CTA click), 5→6 (back to map), 6→done (CTA click)
7. Skip button on all steps
8. Persist completion to profiles

**Exclude (post-MVP):**
- Advanced tour (5+ notes)
- i18n for tour copy
- Custom spotlight shapes for 3D elements
- Tour analytics/tracking
- Re-triggerable tour from settings

---

## Verification

1. New user signs up → empty star map → tour starts at Step 1
2. Click "创造第一颗星" → Capture Pod opens → Step 2
3. Submit content → pipeline starts → Step 3 shows
4. Pipeline completes, star appears → Step 4 highlights star
5. Click star → detail page → Step 5 shows tabs
6. Navigate back → Step 6 shows pods → "开始探索" completes tour
7. Refresh page → tour does NOT restart (persisted)
8. Click "跳过导览" at any step → tour ends, persisted
9. Existing user with notes → tour does NOT show
