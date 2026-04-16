# Admin Login Fix & Entry Point Plan

## Context
- `test@test.com` cannot log in (password needs to be reset to "test")
- After admin login, there's no redirect to the admin panel — the app always sends to `/app`
- User wants admin accounts to be automatically redirected to `/admin/payments` on login

---

## Changes

### 1. Reset Password via SQL Migration
Use `crypt()` + `gen_salt()` from pgcrypto to update the password hash directly:
```sql
UPDATE auth.users
SET encrypted_password = crypt('test', gen_salt('bf')),
    updated_at = now()
WHERE email = 'test@test.com';
```

### 2. Auth.tsx — Smart Redirect After Login
After `signIn` succeeds, query `profiles.is_admin` for the logged-in user.
- `is_admin = true` → `navigate('/admin/payments')`
- `is_admin = false` → `navigate('/app')`

The `useEffect` that watches `user` already redirects to `/app`. This must also be updated to check admin status (async, with a short query).

**Updated logic in Auth.tsx:**
```typescript
// Replace the current useEffect
useEffect(() => {
  if (!user) return;
  supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
    .then(({ data }) => {
      navigate(data?.is_admin ? '/admin/payments' : '/app');
    });
}, [user, navigate]);
```

This replaces the simple `if (user) navigate('/app')` check.

---

## Files Modified
- `supabase/migrations/migration_YYYYMMDD_reset_admin_pass` — password reset SQL
- `src/pages/Auth.tsx` — smart redirect logic (4-line change)

## Verification
1. Log in with `test@test.com` / `test` → redirects to `/admin/payments`
2. Log in with a regular user → redirects to `/app`
