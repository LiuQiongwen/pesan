# Mobile Experience Optimization — MVP Plan

## Context
Mobile pods are partially visible causing button obstruction, z-index layering is inconsistent,
and mobile lacks dedicated guidance. Most infrastructure already exists (MobileBottomSheet,
MobileTabBar, NodeContextMenu with mobile mode, CosmosScene long-press).

## Root Analysis
1. MobileBottomSheet `maxHeight: 78vh` can clip content; MobileTabBar at bottom `z-40` sits below sheet `z-51` but can overlap other elements
2. When a bottom sheet is open, MobileTabBar stays visible underneath — occupying screen real estate without utility
3. CosmosScene touch: tap → open node, long-press → context menu already works
4. NodeContextMenu already has mobile action sheet mode with "Send to Pod" options
5. No mobile-specific hints exist in InteractionHints or GuideCenterModal

## MVP Scope (3 changes)

### Change 1: MobileBottomSheet layout fix
**File: `src/components/floating/MobileBottomSheet.tsx`**
- Change `maxHeight: 78vh` → `maxHeight: calc(90vh - env(safe-area-inset-bottom))` 
- Add `paddingBottom: env(safe-area-inset-bottom)` to body for keyboard safety
- Add `paddingTop: env(safe-area-inset-top)` to handle area

### Change 2: Hide MobileTabBar when a pod sheet is open
**File: `src/components/floating/MobileTabBar.tsx`**
- Read `pods` from `useToolbox()`
- If any pod is open, hide the tab bar (return null or translate off screen)
- This eliminates the z-index conflict entirely

### Change 3: Add mobile section to GuideCenterModal
**File: `src/components/tour/GuideCenterModal.tsx`**
- Add a 4th section "移动端操作" after "进阶效率" with these items:
  - **轻点查看**: 轻点星球查看内容，长按打开更多操作
  - **发送到功能舱**: 长按节点 → 选择目标舱，替代桌面端拖拽
  - **连接节点**: 长按选择「建立连接」→ 轻点第二个节点
  - **上拉展开舱页**: 舱页底部上拉可展开更多空间，下滑可关闭

### Change 4: Mobile-specific InteractionHints
**File: `src/components/starmap/InteractionHints.tsx`**
- Detect `useDevice()` — on phone show mobile-specific hint text:
  - browse mode: `轻点星球 · 长按更多操作`  (instead of desktop mouse hints)
  - node hover: hide (no hover on mobile)
  - connect: `轻点第二颗星完成连接`

## Files to Modify
1. `src/components/floating/MobileBottomSheet.tsx` — maxHeight + safe area
2. `src/components/floating/MobileTabBar.tsx` — auto-hide when pod open
3. `src/components/tour/GuideCenterModal.tsx` — add mobile section
4. `src/components/starmap/InteractionHints.tsx` — mobile hint text

## Verification
- Open on mobile viewport (< 768px): open any pod → tab bar disappears, sheet fills most of screen
- Close pod → tab bar reappears
- Open GuideCenterModal → see "移动端操作" section
- InteractionHints shows touch-specific text on mobile
