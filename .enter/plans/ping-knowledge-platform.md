# NFC Cross-Platform Copy & Guidance

## Context

NFC Reality Anchors only work on Android Chrome (Web NFC API). Desktop users see no explanation, mobile iOS users get no fallback. The goal is:
- **Desktop**: explain that NFC is a mobile-touch feature; provide create/manage/QR-fallback
- **Mobile (NFC supported)**: guided scan/write experience with clear feedback
- **Mobile (no NFC)**: graceful fallback to QR scan with explanation

All copy should be in Chinese matching the product's existing UI language.

## Implementation Steps

### Step 1: NfcScannerSheet — full copy redesign
**File**: `src/components/anchors/NfcScannerSheet.tsx`

Replace all English strings with Chinese copy and add richer states:
- Scanning: title "轻触 NFC 标签", subtitle "将手机背面靠近物体上的标签"
- Success flash: title "已识别", subtitle "正在跳转..."
- Error (permission): "NFC 权限被拒绝 · 请在系统设置中开启"
- Error (not supported): "当前设备不支持 NFC · 请使用 Android Chrome"
- Footer: "仅支持 Android Chrome · 桌面端请使用 QR 码"

### Step 2: NfcWriterSheet — full copy redesign
**File**: `src/components/anchors/NfcWriterSheet.tsx`

Replace English strings:
- Header: "写入 NFC 标签"
- Idle: "点击下方按钮，然后将手机靠近空白 NFC 标签"
- Writing: "正在写入，请保持贴近..."
- Success: "写入成功！标签已关联到锚点"
- Error: "写入失败 · {error}"
- Retry button: "重新写入"
- Write button: "写入 NFC 标签"
- Done button: "完成"

### Step 3: CreateAnchorModal — NFC section copy + desktop explanation
**File**: `src/components/anchors/CreateAnchorModal.tsx`

Changes:
- After QR is generated, add a section explaining NFC:
  - If NFC supported: show existing "写入 NFC 标签" button (already works)
  - If NFC NOT supported (desktop/iOS): show an info card:
    ```
    Icon: Smartphone
    Title: "NFC 标签？用手机写入"
    Body: "NFC 写入需要 Android 手机。在手机端打开此锚点即可写入 NFC 标签。"
    ```
- Replace "Write to NFC Tag" button text → "写入 NFC 标签"
- Replace QrCode icon on NFC button → Nfc icon

### Step 4: SettingsCapsule NFC entry — desktop explanation
**File**: `src/components/floating/SettingsCapsule.tsx`

When `nfcSupported === false` (desktop/iOS):
- Still show the NFC menu item but dimmed, with a tooltip/subtitle:
  - Label: "NFC 轻触"
  - Subtitle: "仅限 Android 手机"
  - Click → open a small info sheet instead of scanner

When `nfcSupported === true`:
- Keep existing behavior, update label to "NFC 轻触锚点"

### Step 5: Create NfcDesktopInfoSheet — lightweight explanation overlay
**File**: `src/components/anchors/NfcDesktopInfoSheet.tsx` (NEW)

A simple centered modal with:
- Nfc icon + "NFC 轻触是什么？"
- Body: "用 NFC 标签把现实物体连接到你的知识宇宙。手机轻触标签，即可跳转到对应的节点或星系。"
- 3 bullet points:
  1. Smartphone icon — "在 Android 手机上打开本应用"
  2. Nfc icon — "进入锚点页面，写入 NFC 标签"  
  3. QrCode icon — "桌面端可直接使用 QR 码"
- Bottom: "QR 码同样有效" → button "创建 QR 锚点" (dispatches open-anchor-create event)
- Close button

### Step 6: QrScannerSheet — update NFC fallback copy
**File**: `src/components/anchors/QrScannerSheet.tsx`

Update the NFC alternative text at the bottom:
- If NFC supported: "或轻触 NFC 标签" (keep existing)
- If NOT supported: show "NFC 标签？用手机轻触" in dimmed text (no click action)

## Files Modified
1. `src/components/anchors/NfcScannerSheet.tsx` — Chinese copy
2. `src/components/anchors/NfcWriterSheet.tsx` — Chinese copy
3. `src/components/anchors/CreateAnchorModal.tsx` — NFC section + desktop fallback
4. `src/components/floating/SettingsCapsule.tsx` — always-visible NFC entry
5. `src/components/anchors/NfcDesktopInfoSheet.tsx` — NEW desktop explanation
6. `src/components/anchors/QrScannerSheet.tsx` — NFC fallback copy

## Verification
1. Desktop browser: NFC menu item visible but shows info sheet on click
2. Desktop CreateAnchorModal: shows "用手机写入" info card after QR generated
3. Android Chrome (or simulated): NFC scanner/writer show full Chinese copy
4. All text is concise, action-oriented, no technical jargon
