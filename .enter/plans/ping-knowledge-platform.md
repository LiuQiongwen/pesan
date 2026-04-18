# Fix: New User Email Registration Failure

## Context
New users registering via email encounter failures. After tracing the full chain (frontend signUp → Supabase Auth → trigger → profiles → subscriptions/credits → universe), the root causes are identified.

## Root Cause Analysis (by priority)

### 1. CRITICAL — `handle_new_user` trigger lacks `subscriptions` + `user_credits` init
The DB trigger `on_auth_user_created` calls `handle_new_user()` which only inserts into `profiles`. There is NO row created in `subscriptions` or `user_credits`. The frontend's `useBilling` hook does handle missing rows gracefully (uses `maybeSingle()` + defaults), so this **won't crash** but leaves the user in an inconsistent state.

### 2. CRITICAL — Auth.tsx treats signUp `error === null` + `session === null` as success, but then immediately switches to login mode
When `Confirm Email` is enabled, `supabase.auth.signUp()` returns `{ data: { user, session: null }, error: null }`. The current code:
```ts
const { error } = await signUp(email, password);
if (error) { toast.error(...); return; }
toast.success(...);
setMode('login');
```
This correctly shows success, but the user doesn't know they need to **check their email** first. The success message `t('auth.success.signUp')` may not mention email verification. If auto-confirm is disabled, the user tries to login immediately and gets "Email not confirmed" error — which they perceive as "registration failed".

### 3. MODERATE — `create_default_universe` trigger may conflict with `UniverseContext`
Both the DB trigger `trg_create_default_universe` (on `auth.users` INSERT) and `UniverseContext.fetchUniverses()` try to create a default universe. This can cause a **duplicate insert** race condition, though the current code handles it gracefully.

### 4. LOW — Auto-confirm email setting
Need to verify and ensure auto-confirm is enabled for development/testing so new users can log in immediately after registration.

## Fix Plan

### Fix 1: Upgrade `handle_new_user` trigger (DB Migration)
Replace the trigger function to also create `subscriptions` and `user_credits` rows:

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO profiles (id, username)
  VALUES (NEW.id, split_part(NEW.email, '@', 1));

  INSERT INTO subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO user_credits (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
```

### Fix 2: Fix Auth.tsx registration flow
- After signUp success, show different messages based on whether session exists:
  - If `data.session` exists → auto-confirmed, navigate to `/app`
  - If `data.session` is null → email confirmation required, show clear message
- Don't auto-switch to login mode when email confirmation is pending

### Fix 3: Enable auto-confirm email
Call `supabase_configure_auth` to enable `auto_confirm_email: true` for seamless dev/test experience.

## Files to Modify

1. **DB Migration** — `handle_new_user()` trigger function
2. **`src/pages/Auth.tsx`** — signUp flow handling
3. **`src/hooks/useAuth.ts`** — return session alongside error from signUp
4. **Auth config** — enable auto_confirm_email

## Verification
1. Register a brand new email → should succeed without errors
2. User should have rows in: `profiles`, `subscriptions`, `user_credits`, `universes`
3. Login immediately after registration should work (with auto-confirm)
4. Toast message should clearly indicate next steps
