# QR Reality Anchor — MVP Plan

## Context
Users want to bind physical objects (books, folders, devices) to knowledge universe regions via QR codes. Scanning a QR code should land the user in the right universe/node/tag area.

## Architecture

### DB Table: `reality_anchors`
```sql
id          uuid PK
user_id     uuid FK → auth.users
universe_id uuid FK → universes
anchor_type text  ('note' | 'tag' | 'universe')
target_id   text  -- note id, tag string, or universe id
label       text  -- human name, e.g. "AI Papers Folder"
created_at  timestamptz
```
QR payload = `{origin}/anchor/{id}` — simple URL, scannable by any QR reader.

### Route: `/anchor/:id`
New page `AnchorLanding.tsx` — fetches anchor row, redirects authenticated user to `/app` with `?anchor={id}&type={type}&target={target}`. StarMapLayout reads query params and performs: switch universe → flash node / filter by tag.

### Components (4 new files)

1. **`src/pages/AnchorLanding.tsx`** — public route, fetches anchor, shows mini-card, redirects to `/app?anchor=...`
2. **`src/components/anchors/CreateAnchorModal.tsx`** — modal to create anchor (pick type + target + label), generate QR via `qrcode` npm package (pure JS, no camera needed for generation)
3. **`src/components/anchors/QrScannerSheet.tsx`** — camera scanner using `html5-qrcode` `Html5Qrcode` low-level API, wrapped in MobileBottomSheet style. Parses scanned URL, extracts anchor ID, navigates.
4. **`src/hooks/useAnchorLanding.ts`** — reads `?anchor=` query param in StarMapLayout, performs universe switch + node flash

### Entry Points
- **Create anchor**: NodeContextMenu → "创建二维码锚点" / SettingsCapsule → "Reality Anchors"
- **Scan anchor**: MobileTabBar → scan icon / SettingsCapsule → "扫码进入"

### QR Generation
Use `qrcode` npm package (lightweight, zero-dependency) to generate QR as data URL. No backend needed.

### QR Scanning (from html5-qrcode)
Key borrowings:
- `Html5Qrcode` class: `new Html5Qrcode(elementId)` → `.start(cameraId, config, onSuccess, onError)` → `.stop()`
- Camera permission: `Html5Qrcode.getCameras()` — returns list, pick `environment` facing
- Config: `{ fps: 10, qrbox: { width: 250, height: 250 } }`
- On success: parse URL → extract `/anchor/{id}` → navigate

### Files to Modify
| File | Change |
|---|---|
| `src/router.tsx` | Add `/anchor/:id` route |
| `src/components/starmap/NodeContextMenu.tsx` | Add "创建锚点" menu item |
| `src/components/floating/MobileTabBar.tsx` | Add scan button |
| `src/components/floating/SettingsCapsule.tsx` | Add anchors entry |
| `src/components/layout/StarMapLayout.tsx` | Read `?anchor=` param, handle landing |

### MVP Execution Order
1. DB migration: create `reality_anchors` table
2. Install `html5-qrcode` + `qrcode` packages
3. Create `AnchorLanding.tsx` + route
4. Create `CreateAnchorModal.tsx` (QR generation)
5. Create `QrScannerSheet.tsx` (camera scanning)
6. Create `useAnchorLanding.ts` (query param handler)
7. Wire entry points (context menu, mobile tab, settings)

### Verification
1. Create an anchor for a note → see QR code displayed
2. Open QR URL in browser → AnchorLanding shows anchor info → redirects to app
3. Use scanner on mobile → camera opens → scan QR → navigates to correct node
