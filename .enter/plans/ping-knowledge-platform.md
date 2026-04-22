# Redesign: Mobile Onboarding Tour + Usage Guide

## Context

Current state:
- **TourOverlay** is imported but NOT rendered (disabled in StarMapLayout). Also has `device === 'phone'` bug (comparing object to string).
- **TourProvider** has 2 steps (create/explore), persists to `profiles.tour_state`.
- **TourStepContent** returns mobile-aware copy for each step.
- **GuideCenterModal** is a desktop-centric centered modal with 5 accordion sections, progress tracking, and hint settings. Works on mobile but uses mouse hover handlers and small text — not mobile-native.
- **InteractionHints** shows contextual key-action pairs, already mobile-aware (轻点/长按).
- **useHintState** tracks 8 hint keys with seen/completed/dismissed states.

User wants: Redesign both the onboarding tour and usage guide to be **mobile-native** — touch-first interaction patterns, swipeable, bottom-sheet layouts, etc.

---

## Plan

### 1. Redesign TourProvider — expand to 4 mobile-native steps

**File: `src/components/tour/TourProvider.tsx`**

Current 2 steps → 4 steps for richer mobile onboarding:
```
1. 'move'    — Pinch/drag to explore the universe (touch gesture)
2. 'create'  — Open Capture pod via bottom tab and enter text
3. 'explore' — Tap the new star to see details
4. 'connect' — Long press → select "Connect" → tap second node
```

New signals:
- `'universe-moved'` → completes 'move'
- `'first-note-created'` → completes 'create' (existing)
- `'note-detail-opened'` → completes 'explore' (existing)
- `'first-connection-made'` → completes 'connect'

### 2. Rewrite TourStepContent for mobile-first copy

**File: `src/components/tour/TourStepContent.tsx`**

4 steps with mobile-specific task text + gesture hints:
| Step | Mobile Task | Hint |
|------|------------|------|
| move | 双指缩放或拖动探索知识宇宙 | 试着转动星空看看 |
| create | 轻点底栏「捕获」，输入一句想法并发送 | AI 会自动编译为知识星 |
| explore | 轻点刚生成的星球查看内容 | 查看 AI 生成的摘要和关联 |
| connect | 长按节点 → 连接 → 轻点另一颗星 | 建立知识之间的关联 |

### 3. Rewrite TourOverlay as mobile bottom toast

**File: `src/components/tour/TourOverlay.tsx`**

- Fix `device === 'phone'` bug → use `device.isPhone`
- Phone: fixed bottom bar (above MobileTabBar safe area), compact single-line with swipe-to-dismiss
- Icon + task text + progress dots + skip
- Touch-only dismiss gesture (swipe down)
- Desktop: keep current center-bottom HUD

### 4. Rewrite GuideCenterModal as mobile bottom sheet

**File: `src/components/tour/GuideCenterModal.tsx`**

**Phone version** — full-screen bottom sheet (like CreateAnchorModal):
- Drag handle + title bar ("使用攻略 / GUIDE CENTER")
- Horizontally scrollable tab pills for sections (快速开始 / 核心交互 / 进阶 / 移动端 / 锚点) instead of accordion
- Cards with larger touch targets (min 44px)
- Each card: icon + title + desc + completion badge
- Bottom: "重新体验新手导览" button + hint settings
- Drag-to-dismiss

**Desktop version** — keep existing centered modal, no changes needed

### 5. Re-enable TourOverlay in StarMapLayout

**File: `src/components/layout/StarMapLayout.tsx`**

Add `<TourOverlay />` back into the render tree inside `<TourProvider>`.

### 6. Wire new tour signals

**File: `src/hooks/useTourTrigger.ts`** (or wherever gesture events are dispatched)

Add signal dispatches for:
- `'universe-moved'` — from CosmosScene touch/drag handler
- `'first-connection-made'` — from connection confirm handler

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/tour/TourProvider.tsx` | 4 steps, new signals |
| `src/components/tour/TourStepContent.tsx` | 4 mobile-first step copies |
| `src/components/tour/TourOverlay.tsx` | Fix device bug, mobile bottom toast |
| `src/components/tour/GuideCenterModal.tsx` | Mobile bottom sheet with tab pills |
| `src/components/layout/StarMapLayout.tsx` | Re-enable `<TourOverlay />` |
| `src/components/starmap/CosmosScene.tsx` | Dispatch 'universe-moved' signal |
| `src/components/starmap/KnowledgeStarMap.tsx` | Dispatch 'first-connection-made' signal |

## Verification

- Open on mobile → new user sees 4-step tour starting with "探索宇宙"
- Each step advances on correct touch action
- Swipe down dismisses tour overlay
- Open Guide Center from settings → shows as bottom sheet with horizontal tabs
- Large touch targets, no hover-dependent interactions
- Desktop: existing behavior preserved
