# Move OCR Scan Button from MobileTabBar to Settings

## Context
The OCR camera scan button (ScanLine FAB) sits between the 3rd and 4th tab in the expanded MobileTabBar. User wants it moved into the SettingsCapsule dropdown since it clutters the tab bar.

## Plan

### 1. Remove OCR FAB from MobileTabBar
**File: `src/components/floating/MobileTabBar.tsx`**
- Remove the `{idx === 2 && ( ... )}` block (lines 201-227) that renders the OCR scan button
- Remove `ScanLine` from the lucide-react import

### 2. Add OCR Scan entry to SettingsCapsule dropdown
**File: `src/components/floating/SettingsCapsule.tsx`**
- Add `ScanLine` to imports (already has many lucide imports)
- Add a new menu button (same pattern as "QR Scan" / "NFC" items) before QR scanner section
- Label: "OCR 扫描识别" / sub: "Camera OCR Capture"
- onClick: `window.dispatchEvent(new CustomEvent('open-ocr-camera')); setOpen(false);`
- Color accent: `#66f0ff` (matching existing scan items)

## Files
1. `src/components/floating/MobileTabBar.tsx` — remove OCR FAB
2. `src/components/floating/SettingsCapsule.tsx` — add OCR menu item

## Verification
- MobileTabBar expanded: 5 pod tabs only, no center FAB
- Settings dropdown: new "OCR 扫描识别" item visible, clicking opens OCR camera
