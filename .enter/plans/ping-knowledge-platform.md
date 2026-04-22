# Settings Integration + Tour / QuickCaptureBar Mobile Fix

## Context

Three user-reported issues:

1. **LayoutEditBar too obtrusive** — wants edit mode controls moved *inside* the settings panel on all devices, not as a separate floating overlay
2. **Mobile tour blocks capture input** — TourOverlay (z-index 60, fixed bottom 24px) overlaps the Capture pod's input when auto-opened on `create` step
3. **QuickCaptureBar blocks input on mobile** — on phone the bar (z-index 25, bottom 72px) sits above the Dynamic Island capsule and covers pod content; it also doesn't hide/adapt when pods open or tour is active

---

## Plan

### Task 1: Merge Edit Mode into Settings (all devices)

**Goal:** Remove the floating `LayoutEditBar` entirely. All edit-mode controls (lock, grid, snap, font, presets) become a collapsible section inside `SettingsCapsule`'s dropdown (desktop) and a new `MobileSettingsSheet` (phone).

**Step 1a: Add edit-mode section to SettingsCapsule dropdown (desktop)**

In `SettingsCapsule.tsx`:
- Import `useToolbox` to get `layoutConfig`, `setLocked`, `setGridSize`, `setSnapToEdge`, `setGlobalFontScale`, `presets`, `savePreset`, `loadPreset`, `deletePreset`, `resetToDefault`
- Add a new "Edit Mode" collapsible section in the dropdown above the Tools section (after credits, before Obsidian import)
- Include: Lock/Unlock toggle, grid size buttons (0/8/16/24), edge-snap toggle, font-scale slider, preset save/load/delete, reset button
- Reuse the visual style of `LayoutEditBar`'s Section/ToggleRow patterns

**Step 1b: Create `MobileSettingsSheet.tsx` (phone)**

Full bottom sheet (reuse `MobileBottomSheet` pattern) with sections:
- **User & Plan** — user info, credits, plan badge (from SettingsCapsule)
- **Edit Mode** — lock toggle, grid, snap, font scale (from LayoutEditBar)
- **Tools** — Obsidian Import, Export, Wiki, Guide Center, QR scan, NFC scan
- **Footer** — language toggle, sign out, version

**Step 1c: Modify `SettingsCapsule.tsx` for phone branching**

- Import `useDevice()`
- On phone: tap gear opens `MobileSettingsSheet` instead of dropdown
- On desktop/tablet: keep existing dropdown + new edit-mode section

**Step 1d: Remove standalone `LayoutEditBar` from `StarMapLayout.tsx`**

- Remove `{device !== 'phone' && <LayoutEditBar />}` render line
- Remove `LayoutEditBar` import
- The `LayoutEditBar.tsx` file can remain but is no longer rendered

### Task 2: Fix Tour Overlay blocking mobile capture input

**Problem:** `TourOverlay` renders at `fixed bottom:24px z-index:60`. On mobile the `create` step auto-opens Capture pod, but the tour HUD overlaps the text input inside the pod sheet (z-index 51).

**Fix in `TourOverlay.tsx`:**
- Add `useDevice()` hook
- On phone: render tour strip at **top** of screen (`top: env(safe-area-inset-top) + 12px`) instead of bottom, so it never overlaps the bottom sheet
- On desktop: keep `bottom: 24px` (no change)
- Also reduce padding and font sizes slightly on phone for a tighter mobile strip

**Fix in `TourStepContent.tsx`:**
- Update the `create` step text to be mobile-friendly — currently says "在左侧 Capture Pod 输入" which doesn't make sense on mobile (no "左侧"). Change to "在已打开的捕获舱中输入文字，点击发送" for mobile, keep existing copy for desktop.

### Task 3: Fix QuickCaptureBar overlapping on mobile

**Problem:** QuickCaptureBar is only rendered for `device !== 'phone'` (line 461 in StarMapLayout), so it should NOT appear on phone at all. However if it does appear on tablet, it can overlap with the tour or pods.

**Wait — re-reading code:** `QuickCaptureBar` is already hidden on phone (`device !== 'phone'`). The user says "输入想法的框会在功能舱之上阻挡输入" — this likely means:
- On phone: the QuickCaptureBar-like experience comes from `CaptureBox` inside `MobileBottomSheet` — the **tour overlay at the bottom** blocks typing in the capture sheet
- OR: on tablet the `QuickCaptureBar` overlaps with the pod

**Fix (safe for both cases):**
- In `QuickCaptureBar.tsx`: add visibility logic — hide (opacity 0, pointer-events none) when any pod is open (already the QuickCaptureBar has `z-index: 25` which is below pods at `z-index: 50+`, but visually it still shows behind and can be distracting)
- Accept optional `podOpen` prop from StarMapLayout; when true, hide with `opacity: 0; pointer-events: none`
- In `StarMapLayout.tsx`: pass `podOpen={anyPodOpen}` to QuickCaptureBar where `anyPodOpen = Object.values(pods).some(p => p.open)`
- Also hide QuickCaptureBar when tour is active (on `create` step the tour auto-opens Capture pod, so QuickCaptureBar becomes confusing)

---

## Files

| File | Action |
|------|--------|
| `src/components/floating/SettingsCapsule.tsx` | **Modify** — add edit-mode section to dropdown + phone branching |
| `src/components/floating/MobileSettingsSheet.tsx` | **Create** — mobile full settings sheet |
| `src/components/tour/TourOverlay.tsx` | **Modify** — top position on phone |
| `src/components/tour/TourStepContent.tsx` | **Modify** — mobile-friendly copy |
| `src/components/starmap/QuickCaptureBar.tsx` | **Modify** — hide when pod open or tour active |
| `src/components/layout/StarMapLayout.tsx` | **Modify** — remove LayoutEditBar, pass podOpen/tourActive to QuickCaptureBar |

## Existing patterns to reuse

- `MobileBottomSheet.tsx` — drag-to-dismiss sheet pattern, hexA helper, title bar pattern
- `LayoutEditBar.tsx` — Section, ToggleRow, smallBtnStyle helpers (copy into settings)
- `useDevice()` hook — phone/tablet/desktop branching
- `useToolbox()` — layoutConfig and all actions
- Spring motion tokens — `var(--spring)`, `var(--dur-standard)` etc.

## Verification

1. **Desktop:** Settings gear dropdown now includes Edit Mode section with lock/grid/snap/font/presets
2. **Desktop:** No more floating LayoutEditBar in bottom-right corner
3. **Phone:** Settings gear opens full bottom sheet with user/edit-mode/tools/footer
4. **Phone:** Tour `create` step renders at top of screen, does not block Capture pod input
5. **Phone:** QuickCaptureBar hidden during tour and when pods are open
6. **Tablet:** QuickCaptureBar hides when pods open, reappears when all closed
7. All existing functionality (Obsidian import, QR scan, NFC, sign out, etc.) still works
