# Responsive Sci-Fi UI — Desktop Viewport Adaptation

## Context
All interactive UI elements use hard-coded `px` values. This causes:
- CommandDock buttons that overflow on narrow windows
- FloatingPod windows too small on large screens, clipped on small ones
- QuickCaptureBar and HUD text illegible at small viewport sizes
- No minimum click targets enforced on different screen densities

The goal: keep the exact sci-fi aesthetic, replace rigid `px` with `clamp(min, vw/vh, max)` on all key sizing properties. No layout restructure — just fluid scaling.

---

## Strategy: clamp() everywhere

```
clamp(MIN, PREFERRED, MAX)
MIN  → usable floor (accessibility / minimum tap target)
PREFERRED → viewport-relative (vw, vh, vmin)
MAX  → ceiling so it doesn't look absurd on 4K
```

---

## Files to Modify

### 1. `src/components/floating/CommandDock.tsx`

| Property | Before | After |
|---|---|---|
| Button width | `80px` | `clamp(64px, 6.0vw, 88px)` |
| Button height | `62px` | `clamp(50px, 5.2vh, 68px)` |
| Button gap | `8px` | `clamp(5px, 0.6vw, 10px)` |
| Icon container | `32×32px` | `clamp(26px, 2.4vw, 34px)` sq |
| Icon size | `size={22}` | via `style` override: `clamp(16px,1.5vw,22px)` |
| Label (Inter) | `12px` | `clamp(10px, 0.9vw, 13px)` |
| Sublabel (Mono) | `9px` | `clamp(7.5px, 0.7vw, 10px)` |
| Dock padding | `10px 16px` | `clamp(8px,0.8vh,12px) clamp(12px,1.1vw,18px)` |
| Brand mark box | `36px sq` | `clamp(28px,2.8vw,38px)` |
| Connector line | `20px` | `clamp(10px,1.4vw,22px)` |
| Border radius (button) | `14px` | `clamp(10px,1.1vw,15px)` |
| Dock border-radius | `20px` | `clamp(14px,1.6vw,22px)` |

Lucide icon size prop stays numeric `22` but is overridden via `style={{ width: 'clamp(16px,1.5vw,22px)', height: 'clamp(16px,1.5vw,22px)' }}` — Lucide React honors this override.

---

### 2. `src/components/floating/FloatingPod.tsx`

Replace fixed `SIZE` record with CSS `clamp` strings:

```ts
const SIZE: Record<SizeMode, { width: string; bodyMaxH: string }> = {
  light:    { width: 'clamp(280px, 28vw, 440px)',  bodyMaxH: 'clamp(200px, 28vh, 340px)' },
  expanded: { width: 'clamp(320px, 34vw, 660px)',  bodyMaxH: 'clamp(240px, 44vh, 580px)' },
};
```

Responsive header and title:
| Property | Before | After |
|---|---|---|
| Icon container | `40×40px` | `clamp(32px, 3.0vw, 44px)` |
| Icon size | `size={20}` | via `style` override `clamp(15px,1.4vw,20px)` |
| Title font | `14px` | `clamp(12px, 1.1vw, 15px)` |
| Subtitle font | `10px` | `clamp(9px, 0.8vw, 11px)` |
| Header gap | `12px` | `clamp(9px, 1.0vw, 13px)` |
| Header padding | `13px 16px` | `clamp(10px,1.1vh,14px) clamp(13px,1.3vw,18px)` |
| Control buttons | `28×28px` | `clamp(24px, 2.2vw, 30px)` |
| Footer font | `9px` | `clamp(8px, 0.75vw, 10px)` |
| Left accent bar | `5px` | `clamp(4px, 0.4vw, 5px)` |

**Drag boundary fix**: Replace `window.innerWidth - width - 4` (where `width` was a fixed number) with `window.innerWidth - (panelRef.current?.getBoundingClientRect().width ?? 400) - 4` so the clamp CSS is correctly respected.

Also update `top: y` drag constraint to use `window.innerHeight - (panelRef.current?.getBoundingClientRect().height ?? 300)` instead of hardcoded `- 60`.

---

### 3. `src/components/starmap/QuickCaptureBar.tsx`

| Property | Before | After |
|---|---|---|
| Width | `460px` | `clamp(300px, 34vw, 560px)` |
| Height | `46px` | `clamp(40px, 4.5vh, 54px)` |
| Bottom offset | `130px` | `clamp(105px, 11.5vh, 148px)` |
| Input font | `12px` | `clamp(11px, 0.95vw, 13px)` |
| Icon box | `26px` | `clamp(22px, 2.1vw, 28px)` |
| Submit button | `30px` | `clamp(26px, 2.4vw, 32px)` |
| Border radius | `10px` | `clamp(8px, 0.9vw, 12px)` |
| Sub-label font | `10px` | `clamp(9px, 0.8vw, 11px)` |

---

### 4. `src/components/layout/StarMapLayout.tsx`

Top-left HUD sizing:
| Property | Before | After |
|---|---|---|
| HUD padding | `18px 22px` | `clamp(14px,1.5vh,22px) clamp(16px,1.5vw,22px)` |
| Username font | `13px` | `clamp(11px, 1.0vw, 14px)` |
| Stats font | `8px` | `clamp(7px, 0.7vw, 9px)` |
| Recenter button font | `8px` | `clamp(7.5px, 0.7vw, 9px)` |
| Recenter button padding | `4px 9px` | `clamp(3px,0.4vh,5px) clamp(7px,0.7vw,11px)` |
| HUD margin-bottom (username) | `2px` | `clamp(1px, 0.2vh, 3px)` |
| Stats margin-bottom | `10px` | `clamp(7px, 0.8vh, 12px)` |

---

### 5. `src/components/floating/SettingsCapsule.tsx`

| Property | Before | After |
|---|---|---|
| top/right position | `18px` | `clamp(12px, 1.5vh, 22px)` / `clamp(12px, 1.5vw, 22px)` |
| Trigger padding | `6px 10px` | `clamp(5px,0.5vh,8px) clamp(8px,0.8vw,12px)` |
| Trigger font | `9px` | `clamp(8px, 0.75vw, 10px)` |
| Dropdown width | `260px` | `clamp(220px, 20vw, 280px)` |

---

## No Changes Needed
- `CosmosScene.tsx` — Three.js fills 100vw/100vh, nodes scale naturally
- `KnowledgeStarMap.tsx` — Canvas covers viewport
- Pod content components (CaptureBox, etc.) — children scroll inside the responsive FloatingPod body

---

## Key CSS Rules Added to `index.css`
Add two CSS custom properties for responsive dock/pod spacing:
```css
:root {
  --dock-bottom: clamp(20px, 2.2vh, 32px);
  --qbar-bottom: clamp(105px, 11.5vh, 148px);
}
```
Then use `var(--dock-bottom)` in CommandDock and `var(--qbar-bottom)` in QuickCaptureBar for consistent vertical spacing between the two.

---

## Verification
- [ ] At 800×600: dock fits without overflow, buttons ≥ 44px height, fonts ≥ 10px
- [ ] At 1440×900 (standard laptop): dock buttons ~80px, fonts at comfortable size
- [ ] At 2560×1440 (2K): pods expand to max clamp values, nothing overly large
- [ ] Pods can be dragged to edges without going off-screen at any viewport size
- [ ] QuickCaptureBar stays above CommandDock at all viewport heights
