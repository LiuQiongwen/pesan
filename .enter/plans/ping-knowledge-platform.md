# Fix OOM: Router recreation + minor device check bug

## Context

**Root cause of OOM crash**: In `App.tsx` line 14, `createBrowserRouter(routers)` is called **inside** the component function body. Every re-render of `App` creates a brand-new router instance, causing React to unmount/remount the entire route tree. With the Zustand-backed `ToolboxProvider` wrapping `RouterProvider`, store state changes trigger App re-renders → new router → full unmount/remount → more state changes → infinite loop → OOM.

**Secondary bug**: In `SettingsCapsule.tsx` line 104, `device === 'phone'` compares a `DeviceInfo` object (not a string) to `'phone'` — always false, so mobile settings sheet never opens.

## Fix

### 1. `src/App.tsx` — Move router creation outside component

Move `const router = createBrowserRouter(routers)` to **module scope** (above the component). This ensures the router is created once and never recreated on re-render.

```tsx
const queryClient = new QueryClient();
const router = createBrowserRouter(routers);   // ← module scope

const App = () => {
  return (
    <LanguageProvider>
      ...
        <RouterProvider router={router} />
      ...
    </LanguageProvider>
  );
};
```

### 2. `src/components/floating/SettingsCapsule.tsx` — Fix device check

Line 104: `device === 'phone'` → `device.isPhone`

(Since `useDevice()` returns `DeviceInfo` object with `{ device, isPhone, isTablet, isDesktop, isTouch }`)

## Files

| File | Change |
|------|--------|
| `src/App.tsx` | Move `createBrowserRouter` to module scope |
| `src/components/floating/SettingsCapsule.tsx` | Fix `device === 'phone'` → `device.isPhone` |

## Verification

1. App loads without OOM or "Router inside Router" errors
2. No console errors on navigation between routes
3. Mobile: tapping gear icon opens MobileSettingsSheet
4. Desktop: tapping gear icon opens dropdown (no change)
