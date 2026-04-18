# OCR Cross-Platform Entry Redesign

## Context

OCR is currently buried as a mode tab inside CaptureBox — only visible when the Capture pod is open. Users don't realize it exists on desktop. This plan restructures OCR entry points so desktop and mobile both have prominent, appropriate access, while sharing the same underlying `useOcr` → `ocr-structurize` → `candidate_nodes` → StagingWorkbench pipeline.

## Approach: Desktop Drop Zone + DesktopOcrButton + Mobile Camera Button

### What Changes

| # | File | Change |
|---|------|--------|
| 1 | `src/components/ocr/OcrCaptureModal.tsx` | Add drag-drop & clipboard-paste support to upload phase; accept PDF via text extraction |
| 2 | `src/components/floating/CommandDock.tsx` | Add a **ScanLine** "OCR" icon button in the desktop dock (beside the staging button), opens OcrCaptureModal directly |
| 3 | `src/components/floating/MobileTabBar.tsx` | Add a center **ScanLine** "扫描" button that opens OcrCaptureModal with camera-first UX |
| 4 | `src/components/layout/StarMapLayout.tsx` | Add global paste listener (`Ctrl+V` / `Cmd+V` with image) → opens OCR modal with pasted image |
| 5 | `src/components/pods/CaptureBox.tsx` | Keep OCR mode tab as-is (secondary entry for in-pod use) — no changes needed |

### Detailed Design

#### Step 1: Enhance `OcrCaptureModal` with Desktop Input Methods

**Drag-and-drop** on the upload phase drop zone:
- `onDragOver` / `onDrop` handlers on the dashed-border zone
- Visual feedback: border glows cyan on drag-over
- Accept `dataTransfer.files[0]` of type `image/*`

**Clipboard paste** support:
- Accept an optional `initialImage?: File` prop
- If provided, auto-start OCR immediately (skip upload phase)
- This lets StarMapLayout pass a pasted screenshot directly

**PDF text extraction** (lightweight MVP):
- Extend file input `accept` to include `.pdf`
- For PDF files, read as text via `file.text()` and skip tesseract — go straight to `ocr-structurize`
- This is a simple first pass; full PDF OCR can come later

#### Step 2: Desktop CommandDock OCR Button

Add a `ScanLine` icon button between the staging button and the logo area:
- Gated on `isDesktop` — hidden on phone (phone uses MobileTabBar)
- Opens OcrCaptureModal as a portal overlay
- Badge shows nothing (no count like staging — OCR is action-based)
- Tooltip: "OCR 识别"

#### Step 3: Mobile MobileTabBar OCR Button

Add a center "扫描" button with `ScanLine` icon:
- Positioned as 6th tab or as a raised center FAB
- Since current tabs are 5 pods in a row, add OCR as a **raised center circle** between insight and memory
- Opens OcrCaptureModal — but camera input is auto-triggered first on mobile
- Add optional `autoCamera?: boolean` prop to OcrCaptureModal

#### Step 4: Global Paste Listener in StarMapLayout

- Listen for `paste` event on `window`
- Check `clipboardData.items` for image types
- If found, create `File` from blob, set state `pasteImage`, render OcrCaptureModal with `initialImage`
- Only trigger when no other input is focused (check `document.activeElement` tag)

### Data Flow (unchanged)

```
Image/PDF → useOcr (tesseract) → raw text
  → ocr-structurize (Edge Function / LLM)
    → candidate_nodes (DB staging table)
      → StagingWorkbench (user review)
        → notes + chunk-and-index (published to star map)
```

### Star Map Source Indicator

Already handled: candidates have `source: 'ocr'`, and notes get `node_type` mapped from candidate type. The existing CosmosScene renders nodes by type. No additional work needed for MVP — a future iteration can add a small "OCR" badge on node hover labels.

## Files to Modify

1. **`src/components/ocr/OcrCaptureModal.tsx`** — Add `initialImage` + `autoCamera` props, drag-drop handlers, paste-ready, PDF text fallback
2. **`src/components/floating/CommandDock.tsx`** — Add OCR button in desktop dock
3. **`src/components/floating/MobileTabBar.tsx`** — Add raised center OCR FAB
4. **`src/components/layout/StarMapLayout.tsx`** — Add global paste-to-OCR listener

## Verification

1. **Desktop**: Click OCR button in dock → modal opens → drag image onto drop zone → OCR runs → candidates appear
2. **Desktop paste**: Copy screenshot → Cmd+V on star map → OCR modal auto-opens with image
3. **Mobile**: Tap center scan button → camera auto-opens → take photo → OCR runs → candidates in staging
4. **CaptureBox**: OCR tab still works as before (secondary entry)
5. **PDF**: Upload .pdf → text extracted → structurized → candidates
