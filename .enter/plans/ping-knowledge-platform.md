# Mobile Edit Mode + Settings Adaptation

## Context

Current state:
- `LayoutEditBar` (grid/snap/font/presets) — **hidden on phone** (`device !== 'phone'`)
- `SettingsCapsule` (settings dropdown) — renders on all devices but uses desktop-only hover/mousedown patterns; dropdown is a small fixed panel that overflows on small screens
- On mobile, users have no access to: lock/unlock layout, grid settings, font scaling, layout presets, or a properly sized settings panel

User wants: edit mode settings to be accessible and usable on mobile.

## Plan

### Step 1: Create `MobileSettingsSheet.tsx`

A full-height bottom sheet (reusing MobileBottomSheet pattern) containing all settings + edit-mode controls combined in one scrollable panel, organized as:

**Section 1 — User & Plan** (same as current SettingsCapsule user block)
**Section 2 — Edit Mode** (adapted from LayoutEditBar)
- Lock/Unlock toggle
- Grid size selector (0/8/16/24)
- Edge snap toggle
- Font scale slider
- Note: presets are desktop-only complexity — skip on mobile

**Section 3 — Tools** (from SettingsCapsule)
- Import Obsidian, Export, Wiki, Guide Center, QR scan, NFC scan

**Section 4 — Footer**
- Language toggle, Sign out, version

### Step 2: Modify `SettingsCapsule.tsx`

- Import `useDevice()` hook
- On phone: tap gear → opens `MobileSettingsSheet` instead of dropdown
- On desktop: keep existing dropdown behavior unchanged

### Step 3: Remove `device !== 'phone'` gate on LayoutEditBar

No longer needed since edit-mode controls live inside `MobileSettingsSheet` on phone. The desktop LayoutEditBar stays as-is for desktop/tablet.

---

## Files

| File | Action |
|------|--------|
| `src/components/floating/MobileSettingsSheet.tsx` | **Create** — mobile full settings sheet |
| `src/components/floating/SettingsCapsule.tsx` | **Modify** — phone → open MobileSettingsSheet |

## Verification

1. **Phone**: tap gear icon → bottom sheet slides up with all settings sections
2. Edit-mode controls (lock, grid, snap, font) work via touch
3. Tools (Obsidian, QR, NFC, etc.) all open their modals correctly
4. Sign out works
5. **Desktop**: unchanged dropdown behavior
6. No layout shift or z-index conflicts with Dynamic Island tab bar
