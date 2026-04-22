# Move Bottom Popups to Top on Mobile — Light, Semi-transparent

## Context

On mobile, several toast/overlay components render at the bottom of the screen where they overlap with the Dynamic Island tab bar, bottom sheets, and pod content. The user wants them moved to the **top of the screen**, styled as **lightweight semi-transparent hints** that don't block or get blocked by anything.

## Components to Update

| Component | Current Position | z-index | Change |
|-----------|-----------------|---------|--------|
| `TourOverlay` | top on phone (already moved), bottom on desktop | 60 | Make more translucent on phone, reduce visual weight |
| `ContextToast` | `bottom: 72px` (all devices) | 55 | Phone: move to top, reduce opacity |
| `UndoToast` | `bottom: clamp(100px,10vh,140px)` | 1400 | Phone: move to top |
| `ConnectConfirmOverlay` | `bottom: clamp(130px,12.5vh,170px)` | 1200 | Phone: move to top |
| `InteractionHints` | bottom-left | 8 | Phone: move to top-left |

## Implementation

### 1. `TourOverlay.tsx`
Already at top on phone. Make it more translucent:
- Background: `rgba(6,10,22,0.88)` → `rgba(6,10,22,0.55)` on phone
- Border: softer, lower alpha
- Smaller padding and font on phone
- Lower z-index to 45 (doesn't need to be above sheets on phone)

### 2. `ContextToast.tsx`
- Import `useDevice`
- Phone: `top: calc(env(safe-area-inset-top, 0px) + 12px)` instead of `bottom: 72px`
- Background: `rgba(6,10,22,0.50)` on phone (more translucent)
- Animate from top (translateY: -12px → 0) instead of bottom

### 3. `UndoToast.tsx`
- Import `useDevice`
- Phone: `top: calc(env(safe-area-inset-top, 0px) + 12px)` instead of `bottom: clamp(...)`
- Background: keep dark enough to read but reduce to `rgba(2,5,16,0.75)` on phone
- z-index stays high (needs to be above most things)

### 4. `ConnectConfirmOverlay.tsx`
- Import `useDevice`
- Phone: `top: calc(env(safe-area-inset-top, 0px) + 12px)` instead of `bottom: clamp(...)`
- Width: `calc(100vw - 24px)` on phone
- Background: `rgba(2,5,16,0.80)` on phone (slightly more translucent)

### 5. `InteractionHints.tsx`
- Phone: `top: calc(env(safe-area-inset-top, 0px) + 56px)` (below tour/toast area), `left: 12px`
- Remove `bottom` positioning on phone

## Files

| File | Action |
|------|--------|
| `src/components/tour/TourOverlay.tsx` | Modify — lighter bg on phone |
| `src/components/hints/ContextToast.tsx` | Modify — top position on phone |
| `src/components/starmap/UndoToast.tsx` | Modify — top position on phone |
| `src/components/starmap/ConnectConfirmOverlay.tsx` | Modify — top position on phone |
| `src/components/starmap/InteractionHints.tsx` | Modify — top-left on phone |

## Verification

1. Phone: All toasts/overlays appear at top of screen, below safe area
2. Phone: Toasts are semi-transparent, lightweight feel
3. Phone: No overlap with Dynamic Island tab bar or bottom sheets
4. Desktop: All positions unchanged (bottom as before)
5. TourOverlay stays translucent and non-blocking on phone
6. UndoToast "UNDO" button still tappable at top
7. ConnectConfirmOverlay still functional (type selection, countdown, input)
