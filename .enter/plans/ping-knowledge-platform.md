# Revert: Settings button always opens dropdown (no MobileSettingsSheet)

## Context
The MobileSettingsSheet blocks other feature panels from opening. User wants to revert to the original behavior where the gear button always opens the dropdown menu on all devices.

## Fix
In `SettingsCapsule.tsx` line 104: remove `device.isPhone` branch, always call `setOpen(o => !o)`.

## File
`src/components/floating/SettingsCapsule.tsx` — line 104 only
