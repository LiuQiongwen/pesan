# First Action Interaction Design — Knowledge Cosmos Homepage

## Context

The homepage is a 3D star map (Three.js / R3F) not a dashboard. The goal is:
> **User enters → within 3 seconds produces one natural action → immediately feels the cosmos is operable**

Current state (already implemented):
- Empty state: large pulsing green orb + 3 concentric rings + Html CTA label
- Non-empty: entrance note (most recent) gets 2 rings
- Camera fly-in when any node is clicked (lerp to ~20 units)
- QuickCaptureBar: floating input above dock, `/`/`Q` shortcut, Enter → creates node + flash
- Drag feedback: 3× node animation amplitude during drag

This plan strengthens the **signal quality**, **feedback chain**, and **dual path** so the first action feels inevitable and rewarding.

---

## Design: 5 Questions

### 1. Primary Entry Object

**Single rule**: at any moment, exactly ONE object in the scene should pulse at maximum luminance. Everything else should be dimmer.

- **Empty state (0 notes)**: Central breathing orb (radius 2.0, #00ff66) with 3 outward-sweeping rings. This is the ONLY bright green element in the scene.
- **Non-empty (1+ notes)**: Most recently created note gets a pulsing double-ring halo 2× brighter than normal nodes. It is the brightest single point in the galaxy.

Both objects draw the eye because they violate the otherwise uniform visual field — they are obviously "different."

### 2. Best First Action: Click

**Recommended: Click → Camera fly-in + Panel open**

Why not drag? Drag feels like navigation, not creation. It doesn't give a "reward."
Why not text first? Text requires intent. Click only requires curiosity.
Why not fly-in alone? Camera movement without a panel opening feels like watching, not doing.

The ideal sequence is **click → two simultaneous outputs: camera moves AND a panel opens**. This combination says: "You just did something. The cosmos responded. Here's where to go next."

### 3. Feedback Chain After First Click

```
t=0ms    User clicks the entrance orb/node
t=0ms    Orb: emits one radial wave mesh (Ring, scales 1→8, opacity 1→0, 600ms)
t=80ms   Camera: begins smooth lerp toward orb position at dist=20 (1200ms duration)
t=150ms  Capture Pod: opens with pod-in animation (scale 0.92→1, opacity 0→1, 280ms)
t=300ms  QuickCaptureBar: input auto-focuses, placeholder cursor blinks
t=600ms  Orb: rings resume normal breathing animation
```

User sees: **space moves, a panel opens, an input blinks at them.** Three sensory confirmations at once. They know exactly what happened and what to do next.

### 4. "No Learning, No Failure, Immediate Feedback" Rules

| Principle | Implementation |
|-----------|----------------|
| No learning | Orb is visually unique — no text needed to identify it as clickable |
| No failure | Every click on the star map does SOMETHING (fly-in + panel or node detail) |
| Immediate feedback | Three simultaneous outputs within 600ms guarantee perceptible response |
| Secondary path | QuickCaptureBar is always visible — typing is equally valid as first action |
| No wrong answer | Clicking wrong node still flies camera there + shows node content |

### 5. First Action Visibility Without Breaking Immersion

Rules to follow:
- No modals, no onboarding flows, no tooltips on hover
- No "START HERE →" text labels — use animation amplitude instead
- The orb's breathing period (2.4s) matches human heartbeat rhythm → subconsciously "alive"
- The outward ring sweep (every 3.2s) mimics a radar ping → universally understood as "active"
- On hover: cursor changes to `pointer`, orb brightens 20% → affordance confirmed silently
- The only text near the orb: `< CLICK TO BEGIN >` in 9px MONO at 55% opacity — readable but not dominating

---

## Implementation Plan

### Files to Modify

#### 1. `src/components/starmap/CosmosScene.tsx`

**A. Radial wave on orb/node click**
- When `emptyCTAMeshRef.current` is clicked → create a temporary `Ring` mesh at the orb position
- Animate: `scale` from `1` to `10`, `opacity` from `0.8` to `0` over 600ms
- Done in `useFrame` with a `waveRef` array tracking `{ mesh, t }` entries

**B. Cursor feedback on hover**
- When raycasting in `useFrame` hits the empty CTA mesh: `gl.domElement.style.cursor = 'pointer'`
- On hover clear: restore `gl.domElement.style.cursor = 'grab'` (or 'default')

**C. Entrance rings improvement**
- Increase entrance ring emissiveIntensity from 0.8 to 2.0
- Add a `MeshBasicMaterial` (unlit) ring at 1.5x node radius, opacity cycling 0.3→0.9

**D. Orb text improvement**
- Change CTA Html label text from "点击开始第一条知识" to `< CLICK TO BEGIN >`
- Add second line (sub-label): "在宇宙中创造第一条知识" at 50% opacity

#### 2. `src/components/starmap/QuickCaptureBar.tsx`

**A. First-load auto-focus (empty state)**
- Accept new prop: `hasNotes: boolean`
- When `hasNotes === false`: after 3000ms delay, auto-focus the input
- This silently activates the "typing path" if user hasn't clicked the orb yet

**B. Attention animation when idle**
- When `hasNotes === false` and not focused: add a CSS `attention-pulse` animation to the border
- Border cycles: `rgba(0,255,102,0.12)` → `rgba(0,255,102,0.38)` → `rgba(0,255,102,0.12)` every 3s
- When `hasNotes === true` or focused: no extra animation (normal behavior)

#### 3. `src/components/layout/StarMapLayout.tsx`

**A. Pass `hasNotes` to QuickCaptureBar**
```tsx
<QuickCaptureBar 
  userId={user.id} 
  onFlashNote={flashNote}
  hasNotes={notes.length > 0}
/>
```

### CSS-Only Changes (inline in component)

```css
/* QuickCaptureBar idle pulse for empty state */
@keyframes qbar-attention {
  0%,100% { border-color: rgba(0,255,102,0.12); box-shadow: none; }
  50%      { border-color: rgba(0,255,102,0.38); box-shadow: 0 0 18px rgba(0,255,102,0.10); }
}
```

---

## Implementation Order

1. **CosmosScene.tsx** — radial wave on click + cursor pointer + entrance ring brightness
2. **QuickCaptureBar.tsx** — `hasNotes` prop + auto-focus + attention pulse
3. **StarMapLayout.tsx** — pass `hasNotes` to QuickCaptureBar

---

## Verification

| Test scenario | Expected result |
|---------------|----------------|
| First visit (0 notes), no action for 3s | Capture bar auto-focuses, cursor blinks |
| Click empty state orb | Radial wave expands, camera moves forward, Capture Pod opens |
| Click any node (non-empty state) | Camera flies to that node, node window opens |
| Type text + Enter in capture bar | New node flashes into star map, bar shows success state |
| Drag the star map | All nodes increase wobble amplitude (cosmos "stirs") |
| Hover over entrance node | Cursor changes to pointer |
