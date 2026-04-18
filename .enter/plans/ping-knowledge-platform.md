# NFC Reality Anchor — Phase 2 Implementation Plan

## Context

Reality Anchors already exist in the project (`reality_anchors` table + QR creation/scanning).
This plan adds **NFC** as a second trigger medium — same anchor data, different physical interface.

**Web NFC limitations (critical):**
- Only works on **Chrome Android 89+** with **HTTPS**
- Does NOT work on: iOS (any browser), Desktop Chrome, Firefox, Safari
- Requires **user gesture** to start scanning (security restriction)
- Cannot run in background — must be on active tab
- This is why NFC is Phase 2 (QR works everywhere; NFC is an enhancement for Android users)

## Architecture

NFC shares the **exact same `reality_anchors` table** and `AnchorLanding` page.
- QR encodes URL: `{origin}/anchor/{id}`
- NFC writes the same URL as an **NDEF text record** to the tag
- When scanned, the browser opens `/anchor/{id}` — identical flow

No DB changes needed. Only frontend additions.

## Implementation Steps

### Step 1: Create `useNfc.ts` hook

**File:** `src/hooks/useNfc.ts`

Thin wrapper around Web NFC API (`NDEFReader`), inspired by react-nfc-hook:
- `supported: boolean` — feature-detect `'NDEFReader' in window`
- `scanning: boolean` — currently reading
- `error: string | null`
- `scan(onRead: (url: string) => void): Promise<void>` — request permission + start reading
- `write(url: string): Promise<void>` — write NDEF text record to tag
- `stop()` — abort controller cleanup
- Uses `AbortController` for clean teardown (borrow from react-nfc-hook pattern)
- All methods wrapped in try/catch with permission/NotAllowed error messages

### Step 2: Create `NfcWriterSheet.tsx` component

**File:** `src/components/anchors/NfcWriterSheet.tsx`

Portal overlay (like QrScannerSheet) for writing an anchor URL to an NFC tag:
- Input: `anchorId` (existing anchor from `reality_anchors`)
- Flow:
  1. Show "Hold phone near NFC tag" prompt
  2. Call `useNfc().write(url)` — writes `{origin}/anchor/{anchorId}` to tag
  3. Success → green check + "Tag written" confirmation
  4. Error → red alert + retry button
- Phone-tap animation (CSS pulse ring)

### Step 3: Create `NfcScannerSheet.tsx` component

**File:** `src/components/anchors/NfcScannerSheet.tsx`

Portal overlay for reading NFC tags:
- Calls `useNfc().scan()` — waits for NDEF read
- On success: parse URL → extract anchor ID → navigate to `/anchor/{id}`
- Same URL parsing logic as `QrScannerSheet.handleSuccess`
- Shows "Hold phone near tag" prompt with animated NFC icon
- Auto-close on successful read

### Step 4: Add NFC write option to `CreateAnchorModal.tsx`

**File:** `src/components/anchors/CreateAnchorModal.tsx`

After QR code is generated (phase 2 of existing modal):
- If `useNfc().supported`, show additional "Write to NFC" button alongside Download/Copy
- Clicking opens `NfcWriterSheet` with the anchor's URL
- Button hidden on unsupported devices (no feature-flag clutter)

### Step 5: Add NFC scan entry to `SettingsCapsule.tsx`

**File:** `src/components/floating/SettingsCapsule.tsx`

Next to the existing QR scanner button:
- If `useNfc().supported`, show NFC scan icon button (Nfc from lucide-react)
- Clicking opens `NfcScannerSheet`
- Button hidden on unsupported devices

### Step 6: Add NFC scan entry to `QrScannerSheet.tsx`

**File:** `src/components/anchors/QrScannerSheet.tsx`

At the bottom of the QR scanner overlay:
- If `useNfc().supported`, show "Or tap NFC tag" button
- Tapping switches to NFC scanning mode (reuses NfcScannerSheet inline)

## Files Modified

| File | Change |
|---|---|
| `src/hooks/useNfc.ts` | NEW — Web NFC hook |
| `src/components/anchors/NfcWriterSheet.tsx` | NEW — NFC tag writer overlay |
| `src/components/anchors/NfcScannerSheet.tsx` | NEW — NFC tag scanner overlay |
| `src/components/anchors/CreateAnchorModal.tsx` | Add "Write to NFC" button |
| `src/components/floating/SettingsCapsule.tsx` | Add NFC scan entry point |
| `src/components/anchors/QrScannerSheet.tsx` | Add "Or tap NFC" fallback link |

## Verification

1. **Android Chrome**: NFC buttons visible, scan/write functional with NDEF tags
2. **iOS / Desktop**: NFC buttons hidden, QR flow unaffected
3. **NFC write**: Tag contains correct URL, native phone scan opens anchor page
4. **NFC scan**: Reading tag navigates to `/anchor/{id}`, same as QR
5. **Permission denied**: Error shown with retry option, no crash
