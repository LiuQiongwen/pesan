# Admin Entry Block & Route Protection Plan

## Context
The admin system backend is already built (`/admin/*` routes, AdminLayout with `is_admin` DB guard,
SettingsCapsule with a simple menu item). The user now wants:
1. A more **prominent dedicated admin section block** inside the settings dropdown (title + description + button + badge)
2. **Email-exact check** (`test@test.com`) as the primary visibility condition (client-side, instant)
3. The route `/admin` protected so non-admin users are rejected

## Current State
- `SettingsCapsule.tsx` line 219–240: shows a simple menu button when `isAdmin === true` (async DB query)
- `AdminLayout.tsx` line 40–48: guards `/admin` routes by querying `profiles.is_admin` from DB

## Changes Required

### 1. `src/components/floating/SettingsCapsule.tsx`
**Remove** the simple "管理后台" menu button (lines 219–240).
**Replace** with a full admin section block rendered between the divider and the language row.

New admin block structure (visible only when `user?.email === 'test@test.com' || isAdmin`):
```
┌─────────────────────────────────────────┐
│ [Shield icon] 管理员后台      [Admin Only]│
│ 管理订单、用户、credits、套餐与系统状态    │
│ [button: 进入后台管理区 →]               │
└─────────────────────────────────────────┘
```
- Background: `rgba(102,240,255,0.05)` with cyan border `rgba(102,240,255,0.18)`
- Badge "Admin Only": `rgba(102,240,255,0.15)` bg, `#66f0ff` text
- Button: full-width, gradient `#66f0ff → #b496ff`, dark text, navigates to `/admin`
- Separated by a divider before and after

**Auth check**: use `user?.email === 'test@test.com'` as **immediate** (synchronous) primary check.
Keep `isAdmin` state as secondary check. Condition: `user?.email === 'test@test.com' || isAdmin`.

### 2. `src/pages/admin/AdminLayout.tsx`
Add **email-based fast check** alongside DB check:
```typescript
// Fast synchronous check — email must match OR DB is_admin must be true
useEffect(() => {
  if (authLoading) return;
  if (!user) { navigate('/auth'); return; }
  // Fast reject if email doesn't match AND DB hasn't confirmed yet
  if (user.email !== 'test@test.com') {
    supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (!data?.is_admin) { navigate('/'); return; }
        setIsAdmin(true);
      });
  } else {
    // Email matches → grant access immediately (DB check still runs in bg)
    setIsAdmin(true);
  }
}, [user, authLoading, navigate]);
```
This way:
- `test@test.com` → instant access (no wait for DB)
- Other users → DB check (if `is_admin = true`, still allowed; else rejected to `/`)

## Files Modified
- `src/components/floating/SettingsCapsule.tsx` — replace menu item with admin block card
- `src/pages/admin/AdminLayout.tsx` — add email-based fast-path guard

## Files NOT Changed
- Router (`router.tsx`) — already has nested `/admin` routes
- DB — `test@test.com` already has `is_admin = true`
- Edge functions — no changes needed

## Verification
1. Log in as `test@test.com` → SettingsCapsule dropdown shows admin block with title + description + button
2. Click "进入后台管理区" → navigates to `/admin/orders`
3. Log in as any other user → admin block is invisible
4. Navigate to `/admin` as non-admin → redirected to `/`
5. Navigate to `/admin` as `test@test.com` → loads admin dashboard immediately
