# Remove Redundant Close Button from MobileBottomSheet

## Context
MobileBottomSheet currently has two ways to close: a drag-to-dismiss handle (swipe down) AND an X close button in the title bar. These conflict — only one should remain. The drag handle is the standard mobile bottom sheet pattern and should be kept.

## Plan

### File: `src/components/starmap/MobileBottomSheet.tsx`
- **Remove** the X close button (`<button onClick={() => closePod(id)}>`) at lines 162-174
- **Keep** the drag handle bar (lines 105-120) as the sole dismiss method

## Verification
- Open any pod on mobile → no X button in title bar
- Swipe down on the drag handle → sheet dismisses as before
