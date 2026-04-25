# Fix: OOM Crash from Galaxy Particle Drift Animation

## Context
The galaxy variant system added per-frame particle position updates that cause OOM:
1. **Additive drift** — `posArr[i] += sin(t) * drift` accumulates forever (positions → infinity)
2. **Every-frame vertex updates** — `needsUpdate = true` for 600-1200+ vertices at 60fps causes GC pressure
3. These two issues combined cause memory exhaustion and crash

The "Router inside Router" error is a secondary symptom of the OOM crash.

## Fix

**File: `src/components/starmap/CosmosScene.tsx`**

### Change 1: Remove per-frame particle vertex mutation
Replace the drift loop with a simple `Points.rotation` animation. Rotating the entire Points object is GPU-native and costs essentially nothing vs. mutating every vertex CPU-side.

```typescript
// BEFORE (causes OOM):
const posArr = ...array as Float32Array;
for (let i = 0; i < posArr.length; i += 3) {
  posArr[i] += Math.sin(...) * drift;
  ...
}
pts.geometry.attributes.position.needsUpdate = true;

// AFTER (GPU rotation, zero CPU cost):
pts.rotation.y += drift * 0.02;
pts.rotation.x += drift * 0.005;
```

### Change 2: Core glow breathe is fine
The core breathe animation only sets `opacity` and `scale.setScalar()` — these are cheap uniform updates, no issue.

## Files to Modify
- `src/components/starmap/CosmosScene.tsx` — replace particle drift loop with rotation

## Verification
- `/app` loads without OOM
- Galaxy particles slowly rotate around center (visible at near/mid distance)
- No "Router inside Router" error (was secondary to crash)
