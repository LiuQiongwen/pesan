# Unified Animation Language — Spring-Physics Motion System

## Context

The star map product has 70+ inline `@keyframes` and `transition` declarations scattered across components, each with its own easing and duration. Current problems:

1. **Inconsistent easing** — Pod uses `cubic-bezier(0.16,1,0.3,1)`, BottomSheet uses `cubic-bezier(0.22,1,0.36,1)`, overlays use `ease`, hints use `ease-out` — no shared rhythm
2. **Duplicate keyframes** — `cosmos-window-in`, `pod-in`, `toolbox-in`, `cco-in`, `fade-up`, `slide-up` all do nearly the same "slide-up + fade" with slightly different offsets
3. **No exit animations** — Components appear with animation but disappear instantly
4. **Three.js vs DOM mismatch** — Camera uses smoothDamp springs (via `useCosmosCam`) but DOM panels use CSS keyframes, creating a perceptual disconnect

**Goal**: Establish a 3-tier CSS spring-like animation system (Snap / Standard / Gentle) using a single shared cubic-bezier that mimics a critically damped spring, then apply it to the top-5 highest-impact surfaces.

## Approach: CSS Custom Properties + Shared Keyframes

Rather than installing `react-spring` (heavy, introduces new render model), we define **spring-like cubic-beziers** as CSS custom properties and consolidate all keyframes into `index.css`. This matches the existing architecture (inline styles + CSS keyframes) with zero dependency cost.

**Spring-like cubic-bezier curves:**
```
--ease-spring:  cubic-bezier(0.22, 1.00, 0.36, 1.00)   /* Standard (overdamped spring feel) */
--ease-snap:    cubic-bezier(0.16, 1.00, 0.30, 1.00)   /* Fast micro-feedback */
--ease-gentle:  cubic-bezier(0.33, 1.00, 0.68, 1.00)   /* Slow settle for large panels */
```

**Duration tiers:**
| Tier | Duration | Use Case |
|------|----------|----------|
| **Snap** | 0.15-0.20s | Button press, pill select, micro-feedback |
| **Standard** | 0.28-0.35s | Panel slide, toast appear, overlay enter |
| **Gentle** | 0.45-0.55s | Bottom sheet, full-screen transitions, modal enter |

---

## File Plan

### 1. MODIFY: `src/index.css` — Consolidate animation tokens

Add CSS custom properties for timing and curves, plus unified keyframes that replace scattered inline `<style>` blocks.

**New tokens in `:root`:**
```css
--spring:        cubic-bezier(0.22, 1.00, 0.36, 1.00);
--spring-snap:   cubic-bezier(0.16, 1.00, 0.30, 1.00);
--spring-gentle: cubic-bezier(0.33, 1.00, 0.68, 1.00);
--dur-snap:      0.18s;
--dur-standard:  0.30s;
--dur-gentle:    0.50s;
```

**Consolidated keyframes (replace duplicates):**
- `spring-in` → replaces `pod-in`, `toolbox-in`, `cosmos-window-in`, `cco-in`
- `spring-out` → new exit animation
- `spring-up` → replaces `slide-up`, `mobile-sheet-up`, `fade-up`
- `spring-down` → replaces `slide-down`, `mobile-sheet-down`
- `toast-in` / `toast-out` → for bottom-center toasts
- Keep existing unique animations: `flow-light`, `pulse-glow`, `node-flash`, `shimmer`, `spin-slow`, `hint-pulse-ring`

**Utility classes:**
```css
.spring-in      { animation: spring-in    var(--dur-standard) var(--spring) both; }
.spring-up      { animation: spring-up    var(--dur-gentle)   var(--spring) both; }
.toast-enter    { animation: toast-in     var(--dur-standard) var(--spring-snap) both; }
```

### 2. MODIFY: `src/components/floating/FloatingPod.tsx`
- Replace inline `@keyframes pod-in` and `@keyframes edit-rim-pulse` with global `spring-in` class
- Change `animation: 'pod-in 0.22s ...'` → `animation: 'spring-in var(--dur-standard) var(--spring)'`
- Replace `transition: 'max-height 0.24s cubic-bezier(0.4,0,0.2,1)'` → use `--spring` token
- Replace `transition: 'all 0.14s'` on buttons → `transition: 'all var(--dur-snap) var(--spring-snap)'`

### 3. MODIFY: `src/components/floating/MobileBottomSheet.tsx`
- Replace `transition: 'transform 0.28s cubic-bezier(0.22,1,0.36,1)'` → `transition: 'transform var(--dur-gentle) var(--spring)'`
- Replace `animation: 'slide-up 0.28s cubic-bezier(0.22,1,0.36,1)'` → `animation: 'spring-up var(--dur-gentle) var(--spring)'`
- Replace backdrop `animation: 'fade-in 0.2s ease-out'` → `animation: 'fade-in var(--dur-standard) var(--spring-snap)'`

### 4. MODIFY: `src/components/starmap/ConnectConfirmOverlay.tsx`
- Remove inline `@keyframes cco-in` block
- Replace `animation: 'cco-in 0.22s cubic-bezier(0.22,1,0.36,1)'` → `animation: 'spring-in var(--dur-standard) var(--spring)'`
- Replace `transition: 'all 0.14s'` on type pills → `var(--dur-snap) var(--spring-snap)`

### 5. MODIFY: `src/components/starmap/UndoToast.tsx`
- Replace `animation: 'cosmos-window-in 0.2s ease'` → `animation: 'toast-in var(--dur-standard) var(--spring-snap)'`

### 6. MODIFY: `src/components/hints/ContextToast.tsx`
- Replace `transition: 'opacity 0.35s ease, transform 0.35s ease'` → `transition: 'opacity var(--dur-standard) var(--spring), transform var(--dur-standard) var(--spring)'`

### 7. MODIFY: `src/components/starmap/KnowledgeStarMap.tsx`
- Remove inline `@keyframes cosmos-pulse` and `@keyframes cosmos-window-in` (moved to index.css)

### 8. MODIFY: `src/components/starmap/NodeWindow.tsx`
- Remove inline `@keyframes cosmos-window-in` (already in index.css)
- Use `spring-in` animation

---

## What NOT to Animate

- **Three.js scene** — already uses `useCosmosCam` smoothDamp for camera; node position/color tweens in `useFrame` stay as-is (GPU-side, not DOM)
- **Scroll content** — pod body scroll should remain native, no spring on scroll
- **Typing/input** — zero animation on text input fields
- **Radix overlays** (dialog, sheet from shadcn) — keep their built-in animations; only align duration tokens

## Three.js vs DOM Division of Labor

| Layer | Animation Engine | Easing Model |
|-------|-----------------|-------------|
| Camera transitions | `useCosmosCam` smoothDamp | Critically damped spring |
| Node/edge mesh animation | `useFrame` lerp | GPU-side per-frame interpolation |
| DOM panels (FloatingPod, BottomSheet) | CSS `@keyframes` + custom properties | `--spring` cubic-bezier |
| DOM micro-feedback (toast, pill, button) | CSS `transition` | `--spring-snap` cubic-bezier |
| DOM overlays (confirm, galaxy join) | CSS `@keyframes` | `--spring` cubic-bezier |

The spring cubic-bezier `(0.22, 1.00, 0.36, 1.00)` is designed to *feel* similar to the smoothDamp spring used in the camera, creating perceptual unity without coupling the implementations.

---

## Verification

1. **FloatingPod**: Open a pod → smooth scale+fade entry with spring deceleration, not linear
2. **MobileBottomSheet**: Open on phone → slides up with spring-gentle timing, drag-dismiss still works
3. **ConnectConfirmOverlay**: Drag-connect two nodes → overlay springs in from bottom with consistent easing
4. **UndoToast**: Delete a node → toast appears with snap-spring from below
5. **ContextToast**: Trigger a hint → toast fades in with spring curve, fades out naturally
6. **Button hover**: All pod window control buttons → snap-tier transition (0.18s)
7. **No regression**: Camera spring (Shift+P perf overlay), Three.js node animations unchanged
8. **Lint**: Zero new lint errors
