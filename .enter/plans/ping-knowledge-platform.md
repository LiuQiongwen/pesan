# iOS PWA + Dynamic Island Bottom Bar

## Context

User wants:
1. **iOS-friendly PWA packaging** — "添加到主屏幕" after which the app runs fullscreen like a native app
2. **Dynamic Island style bottom bar** — collapsed = a small capsule pill floating at the bottom; tap = spring-expands into the full 5-pod function bar + OCR FAB; tap outside / auto-collapse when a pod sheet opens

Current state:
- `manifest.json` exists with `display: standalone` but is missing Apple-specific meta tags (`apple-mobile-web-app-capable`, `apple-touch-icon`, `apple-mobile-web-app-status-bar-style`)
- No PWA icon files (`icon-192.png`, `icon-512.png` are referenced but don't exist)
- `MobileTabBar.tsx` is a full-width static bar that hides when a pod is open — no collapse animation
- Spring motion tokens (`--spring`, `--dur-standard`, etc.) are already in `index.css`

## Plan

### Step 1: PWA meta tags — `index.html`

Add Apple-specific meta tags to `<head>`:
```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

### Step 2: Generate PWA icon — `public/apple-touch-icon.png`

Use `image_generation` to create a 180x180 app icon with the Pesta brand style (dark cosmic background + green accent).

Also generate `public/icon-192.png` and `public/icon-512.png` so the manifest references work.

### Step 3: Rewrite `MobileTabBar.tsx` → Dynamic Island capsule

**Collapsed state (default):**
- Small pill capsule (≈120px wide × 36px tall) centered at bottom
- Shows subtle pulsing dot + "Pesta" text
- `border-radius: 50vh` for full pill shape
- Positioned above safe area

**Expanded state (on tap):**
- Pill morphs to full-width bar via `width` + `border-radius` spring transition
- 5 pod icons + center OCR FAB appear with staggered fade
- Auto-collapses when any pod opens (sheet takes over)

**Transitions use existing spring tokens:**
- Pill → bar: `--dur-standard` + `--spring` (width, border-radius, padding)
- Icons fade-in: `--dur-snap` + `--spring-snap` (staggered 30ms per icon)
- Bar → pill: `--dur-standard` + `--spring` (reverse)

**State machine:**
```
collapsed ──tap──▶ expanded ──tap-pod──▶ collapsed (pod sheet opens)
                  ──tap-outside──▶ collapsed
                  ──4s-idle──▶ collapsed
```

### Step 4: Wire up auto-collapse in `MobileBottomSheet.tsx`

When sheet opens, MobileTabBar auto-collapses (already hidden via `anyPodOpen` check — keep this behavior, the pill just re-appears when sheet closes).

---

## Files to Modify

| File | Action |
|------|--------|
| `index.html` | Add 3 Apple meta tags |
| `public/manifest.json` | Verify icons, no change needed |
| `src/components/floating/MobileTabBar.tsx` | Full rewrite → Dynamic Island capsule |
| `public/apple-touch-icon.png` | Generate via image_generation |
| `public/icon-192.png` | Generate via image_generation |
| `public/icon-512.png` | Generate via image_generation |

## Verification

1. Mobile Chrome/Safari: bar appears as centered pill capsule
2. Tap pill → spring-expands to full 5-icon bar with OCR FAB
3. Tap any pod → sheet opens, bar collapses back to pill (hidden behind sheet)
4. Close sheet → pill reappears
5. Tap outside expanded bar → collapses
6. 4s idle with expanded bar → auto-collapses
7. iOS Safari: "Add to Home Screen" → app launches fullscreen with status bar styled dark
8. Desktop: unchanged (CommandDock renders, not MobileTabBar)
