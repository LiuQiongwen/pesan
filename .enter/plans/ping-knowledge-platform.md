# Refactor: Lightweight Onboarding Tour + Guide Center

## Context
The current tour system uses full-screen overlay with dark radial gradient mask (`TourOverlay.tsx` lines 38-48, `zIndex: 99999`, background opacity 0.45-0.82). This blocks all user interaction behind it. The tooltip card has `pointerEvents: 'auto'` which further steals focus. The 6-step flow is too long for a first-time experience.

**Goal**: Replace with a non-blocking bottom task bar (HUD strip), compress to 3 core steps, add Guide Center to Settings for post-onboarding learning.

---

## Changes

### 1. Rewrite `TourOverlay.tsx` → Bottom HUD strip
- **Remove**: Full-screen overlay div with dark background
- **Replace with**: Fixed bottom-center strip (48px tall, ~500px wide, glassmorphic dark bg)
- Position: `bottom: 24px`, `left: 50%`, `transform: translateX(-50%)`, `zIndex: 60`
- `pointerEvents: 'auto'` only on the strip itself — nothing else blocked
- Content: icon + task text + progress dots + skip/dismiss button
- Compact inline layout, no title/body/sub/hint — just one action sentence
- Slide-up entrance animation, slide-down exit

### 2. Rewrite `TourProvider.tsx` — 3 steps, first-session logic
**Old steps**: welcome → capture → pipeline → star-born → note-detail → complete (6 steps)
**New steps** (3 only):
1. `orbit` — "拖动星空，转动你的宇宙" (drag to orbit)  
   Signal: `camera-moved` (detect orbit control interaction)
2. `create` — "粘贴一段文字，生成第一颗知识星" (capture first note)  
   Signal: `first-note-created`
3. `explore` — "点击星球，查看 AI 分析" (click a node to open detail)  
   Signal: `note-detail-opened`

After step 3 completes → mark `tour_state = { core_completed: true, completed_at: <timestamp> }` → auto-dismiss

**Trigger condition change**:
- Old: `noteCount === 0 && !core_completed` (triggers even on revisit if user never created a note)
- New: `!core_completed` AND this is the first session (check `tour_state.core_completed` is explicitly `false` or `{}` empty). Once skipped or completed, never auto-trigger again.

### 3. Rewrite `TourStepContent.tsx` — inline task copy
Replace multi-field object with single-line task descriptions:
```
orbit:   { task: '拖动星空，转动你的宇宙', icon: 'orbit' }
create:  { task: '粘贴一段文字，生成第一颗知识星', icon: 'plus' }
explore: { task: '点击星球，查看 AI 分析', icon: 'mouse-pointer-click' }
```

### 4. Rewrite `useTourTrigger.ts` — 3 signals only
- Remove: `capture-pod-opened`, `pipeline-started`, `returned-to-map`
- Add: `camera-moved` (detect orbit controls interaction via CustomEvent from CosmosScene)
- Keep: `first-note-created`, `note-detail-opened`
- Simplify: Only 3 effects matching the 3 steps

### 5. Add camera-moved detection in `CosmosScene.tsx`
- In the orbit controls `onChange` handler, dispatch `window.dispatchEvent(new CustomEvent('tour-camera-moved'))` once
- `useTourTrigger` listens for this event when step is `orbit`

### 6. Add Guide Center to `SettingsCapsule.tsx`
- Add new menu item between "Wiki Compile" and the admin divider
- Icon: `Compass` from lucide-react
- Label: "使用攻略" / Guide Center
- Opens `GuideCenterModal` component

### 7. Create `GuideCenterModal.tsx`
- Modal overlay with topic cards:
  - "重新体验新手导览" → resets `tour_state` to `{}` and closes modal
  - "星图操作" — text block: orbit, zoom, click, right-click, drag
  - "五大功能舱" — text block: Capture, Retrieval, Insight, Memory, Action
  - "连接与星系" — text block: how to connect nodes, galaxy formation
  - "Obsidian 导入" — text block: import/export
  - "关闭所有引导" → sets `tour_state = { core_completed: true, hints_disabled: true }`
- Scrollable list, glassmorphic dark theme matching SettingsCapsule style

### 8. Remove from `StarMapLayout.tsx` 
- Remove the `useEffect` that auto-opens capture pod on step change (line ~100-104)
- The new tour doesn't force-open pods — user does it naturally

---

## Files to modify

| File | Action |
|------|--------|
| `src/components/tour/TourOverlay.tsx` | **Rewrite** — bottom HUD strip |
| `src/components/tour/TourProvider.tsx` | **Rewrite** — 3 steps, simplified state |
| `src/components/tour/TourStepContent.tsx` | **Rewrite** — inline task copy |
| `src/hooks/useTourTrigger.ts` | **Rewrite** — 3 signals only |
| `src/components/starmap/CosmosScene.tsx` | **Edit** — add camera-moved CustomEvent dispatch |
| `src/components/floating/SettingsCapsule.tsx` | **Edit** — add Guide Center menu item |
| `src/components/tour/GuideCenterModal.tsx` | **New** — Guide Center modal |
| `src/components/layout/StarMapLayout.tsx` | **Edit** — remove capture-pod auto-open effect |

---

## Verification
1. New user login → bottom task bar appears with step 1 "拖动星空"
2. User drags the star map → bar advances to step 2 "粘贴一段文字"
3. User creates a note → bar advances to step 3 "点击星球"
4. User clicks the node → bar slides out, tour complete, never shows again
5. User can interact with all UI elements during entire tour (nothing blocked)
6. Settings → "使用攻略" → modal with topic cards
7. "重新体验导览" resets tour and shows bottom bar again
8. Returning user (tour already completed) → no auto-tour, no interference
