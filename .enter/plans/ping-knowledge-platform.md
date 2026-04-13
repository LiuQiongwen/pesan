# Knowledge Star Map Landing Page

## What's Being Built
Replace the scrollable SaaS landing page in `src/pages/Index.tsx` with a single-screen immersive knowledge cosmos. The entire viewport is an animated star-map canvas with minimal floating UI chrome.

## Files to Modify
- `src/pages/Index.tsx` — complete rewrite (only file needed)

## Architecture

### Layout (no scroll)
```
position: fixed, 100vw × 100vh
├── <canvas> — full-viewport animated star map (z: 0)
├── <FloatingNav> — absolute, top, nearly invisible (z: 10)
├── <HeroText> — absolute, lower-left quadrant (z: 10)
├── <CommandBar> — absolute, bottom-center (z: 10)
└── <NodeTooltip> — absolute, follows cursor (z: 20)
```

### Canvas Animation (requestAnimationFrame)

**Node data structure:**
```ts
interface StarNode {
  id: number
  x, y: number          // current position (canvas px)
  baseX, baseY: number  // original position (canvas px)
  vx, vy: number        // micro drift velocity (~0.02–0.12)
  size: number          // base radius (2–10)
  phase: number         // sin oscillation offset
  color: 'white' | 'green' | 'cyan' | 'purple'
  alpha: number         // base opacity
  label: string
  cluster: number       // 0–4
  isAnchor: boolean
  connections: number[] // connected node ids
}
```

**5 thematic clusters (normalized positions):**
| # | Theme | Position | Color |
|---|-------|----------|-------|
| 0 | AI / ML | 0.72, 0.28 | green |
| 1 | Systems | 0.30, 0.38 | cyan |
| 2 | Philosophy | 0.18, 0.68 | purple |
| 3 | Design | 0.64, 0.62 | cyan |
| 4 | Knowledge | 0.50, 0.30 | green |

**~50 named nodes** spread around cluster centers with Gaussian noise (σ~0.08).

**Connections:**
- Within cluster: ~35% chance per pair
- Cross-cluster: anchor nodes bridge to nearest anchor in another cluster
- Rendered as thin lines, opacity based on distance

**Per-frame draw loop:**
1. Deep space background gradient (radial, slightly lighter center)
2. Faint nebula blobs behind each cluster (radial gradient smear)
3. Draw connections (lineWidth 0.5, varying alpha)
4. Update node positions: basePos + drift*t + sin(phase + t*0.001)*jitter
5. Draw nodes (arc + shadowBlur glow)
6. Draw anchor labels (always visible, small, monospace)
7. Draw hovered node label (larger, highlighted)
8. "Shooting star" streaks (rare, ~1 every 8 seconds)

**Mouse interactions:**
- `mousemove` → find closest node within 48px → set as `hovered`
- Hovered node: radius × 1.6, brighter glow, full-opacity label
- Parallax: deeper clusters shift slightly more with mouse movement
- `click` on node → navigate to `/auth` (with node label as query hint)

**Glow technique:**
```js
ctx.shadowBlur = 20
ctx.shadowColor = nodeColor
ctx.fill()
ctx.shadowBlur = 0
```

### Floating Nav (absolute, top)
- `position: absolute, top: 0, left: 0, right: 0, z-index: 10`
- Background: `rgba(4,5,8, 0.0)` (fully transparent by default)
- No border, very subtle
- Left: Pe logo square + "Pesan"
- Right: "登录" text button + "开始使用 →" pill button (neon green)
- Height: 64px, padding: 0 40px

### Hero Text Overlay (absolute, lower-left)
- `position: absolute, bottom: 120px, left: 60px`
- Very brief — 2 lines max
- Small monospace overline: `[ PERSONAL KNOWLEDGE OS ]`
- H1 (two lines, large, tight): "思维的宇宙\n知识的星图"
- Subtle CTA hint: "点击任意知识节点开始探索 →"
- Semi-transparent backdrop behind text (very subtle blur)

### Command Bar (absolute, bottom-center)
- `position: absolute, bottom: 40px, centered`
- Pill shape, width ~360px
- Dark surface, thin green border on focus
- Placeholder: "搜索你的知识宇宙..."
- Left icon: Search (14px, muted)
- Right: `⌘K` monospace badge
- On focus: subtle neon green border glow

### Node Tooltip
- Follows cursor (offset 16px right, 16px up)
- Shows: node label (bold) + cluster name + small connecting line count
- Dark surface, thin border, no shadow
- Fades in on hover (opacity transition)

## Color Constants
```ts
BG = '#040508'          // deep space
NODE_WHITE = [220,225,235]
NODE_GREEN = [0,255,102]
NODE_CYAN = [102,227,255]
NODE_PURPLE = [180,150,255]
LINE_ALPHA_MAX = 0.25
GLOW_GREEN = 'rgba(0,255,102,0.6)'
GLOW_CYAN = 'rgba(102,227,255,0.5)'
GLOW_PURPLE = 'rgba(180,150,255,0.4)'
```

## Verification
- Navigate to `/landing` in preview → see full-viewport animated star map
- Move mouse → nodes respond, tooltips appear
- Hover cluster anchors → labels visible
- Click any node → navigates to /auth
- "开始使用" button → navigates to /auth
- No scrollbar, no layout overflow
