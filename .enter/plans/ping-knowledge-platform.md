# Fix: Replace Remaining "pesan" Brand Identifiers with Pesta

## Context
After the main rebrand, 3 places still use the lowercase `pesan` string:
1. `CommandDock.tsx` — Left logo box in the function bar shows `pesan` text (green monospace box), with `PESTA` label below
2. `StarMapLayout.tsx` — Loading screen shows `pesan` in a green monospace box
3. `LanguageContext.tsx` — localStorage key `pesan_lang`

## Changes

### 1. `src/components/floating/CommandDock.tsx` (~line 140–167)
- Import `PestaLogo` from `@/components/brand/PestaLogo`
- Replace the hand-built `<div>pesan</div>` + `PESTA` label block with:
  ```tsx
  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    paddingRight:'clamp(10px,1.1vw,18px)', borderRight:'1px solid rgba(255,255,255,0.07)',
    marginRight:'clamp(10px,1.1vw,18px)', gap:3 }}>
    <PestaLogo size={clamp value ~32} iconOnly />
    <span style={{ fontFamily:MONO, fontSize:'clamp(6.5px,0.6vw,8.5px)',
      color:'rgba(60,75,100,0.60)', letterSpacing:'0.06em' }}>PESTA</span>
  </div>
  ```
  Use fixed size 32 for the iconOnly logo to keep it proportional in the dock.

### 2. `src/components/layout/StarMapLayout.tsx` (~line 133–141)
- Import `PestaLogo` from `@/components/brand/PestaLogo`
- Replace the hand-built loading box:
  ```tsx
  // BEFORE:
  <div style={{ width:44, height:44, borderRadius:10, border:'1px solid rgba(0,255,102,0.25)',
    background:'rgba(0,255,102,0.06)', display:'flex', alignItems:'center', justifyContent:'center',
    animation:'pulse-glow 2s ease-in-out infinite' }}>
    <span style={{ fontFamily:MONO, fontWeight:700, fontSize:14, color:'#00ff66' }}>pesan</span>
  </div>
  // AFTER:
  <PestaLogo size={44} iconOnly style={{ animation:'pulse-glow 2s ease-in-out infinite' }} />
  ```

### 3. `src/contexts/LanguageContext.tsx`
- Rename localStorage key: `pesan_lang` → `pesta_lang`
- Add migration: read old key if new key is absent, then delete old key

## Files Modified
- `src/components/floating/CommandDock.tsx`
- `src/components/layout/StarMapLayout.tsx`
- `src/contexts/LanguageContext.tsx`

## Verification
- Open the app — function bar (CommandDock) left badge should show the PestaLogo SVG (star-node P) with `PESTA` label
- Refresh on loading state — loading screen should show PestaLogo instead of `pesan` text box
- No `pesan` strings anywhere in UI
