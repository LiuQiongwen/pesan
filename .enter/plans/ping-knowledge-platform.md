# Admin Dashboard Expansion Plan

## Context
Admin panel currently only handles payment order review. User wants:
1. **Direct grants**: Admin can manually give any user credits or subscription without going through payment flow
2. **State persistence**: Active tab/filter saved in URL so navigating away and back preserves state
3. **User analytics**: Per-user credit balance + subscription status
4. **Feature usage analytics**: How many notes, distillations, RAG queries, actions each user has created

---

## Architecture

### Split AdminPaymentsPage.tsx into focused components
Current file is 805 lines — adding 3 tabs would make it unmanageable.

New structure:
```
src/pages/AdminPaymentsPage.tsx         ← main shell (tabs, URL state, auth check)
src/components/admin/OrdersPanel.tsx    ← extracted: order review (moved from page)
src/components/admin/UsersPanel.tsx     ← NEW: user list + grant credits/subs
src/components/admin/AnalyticsPanel.tsx ← NEW: extended analytics (users + features)
src/components/admin/QrSettings.tsx    ← extracted from AdminPaymentsPage.tsx
src/components/admin/AnalyticsBar.tsx  ← extracted from AdminPaymentsPage.tsx
```

### URL-based state persistence
Use React Router `useSearchParams`:
- `/admin/payments?tab=orders&status=submitted`
- `/admin/payments?tab=users`
- `/admin/payments?tab=analytics`

When admin navigates away and returns, URL restores the previous view.

---

## DB Changes

### Migration 1: admin_grants audit table + admin read policies
```sql
-- Audit log for direct admin grants (not payment-triggered)
CREATE TABLE public.admin_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id),
  target_user_id uuid NOT NULL REFERENCES auth.users(id),
  grant_type text NOT NULL CHECK (grant_type IN ('credits', 'subscription')),
  credits_amount integer,
  subscription_plan text,
  subscription_days integer,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.admin_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage grants" ON public.admin_grants FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- Admin read-only policies for user data
CREATE POLICY "admins read all credits" ON public.user_credits FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "admins read all subscriptions" ON public.subscriptions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "admins read all profiles" ON public.profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));
```

---

## New Edge Functions

### `admin-grant-benefits`
```typescript
// POST { targetUserId, grantType: 'credits'|'subscription', creditsAmount?, plan?, durationDays?, notes? }
// 1. Verify admin
// 2. Grant credits: upsert user_credits (balance += creditsAmount)
// 3. Grant subscription: upsert subscriptions (plan, current_period_end = now + durationDays)
// 4. Insert admin_grants audit record
// Returns: { success, newBalance?, subscriptionEnd? }
```
Reuses the same grant logic from `manual-pay-admin-review/index.ts`.

### `admin-user-list`  
```typescript
// POST { page?, limit?, search? }
// Uses service role to fetch all users with:
//   - profiles (username)
//   - user_credits (balance)
//   - subscriptions (plan, status, current_period_end)
//   - usage counts: notes, distillations, rag_conversations, actions
// Returns: { users: [...], total }
```
Uses service role so no RLS changes needed for usage tables.

---

## Frontend Components

### AdminPaymentsPage.tsx (refactored shell)
- Tab bar: 订单审核 | 用户管理 | 数据分析
- Tab state stored in URL via `useSearchParams`
- Auth/admin check (same as before)
- Routes to appropriate sub-panel based on active tab

### OrdersPanel.tsx (extracted)
- Exact same content as current AdminPaymentsPage orders section
- Props: `onToast(msg, ok)`
- Includes AnalyticsBar + QrSettings at top
- Filter tabs, OrderCard list

### UsersPanel.tsx (new)
- Calls `admin-user-list` edge function
- Table columns: 用户名, 邮箱, Credits余额, 订阅计划, 到期时间, 操作
- Search bar (filters client-side)
- Per-row buttons: "+ Credits" and "设置订阅"
- Grant modal: form with amount/plan selector → calls `admin-grant-benefits`

### AnalyticsPanel.tsx (new)
- Two sections:
  1. **Per-user usage table**: username, notes count, distillations count, RAG queries, actions — from `admin-user-list` response
  2. **Aggregate bars**: CSS bar charts showing feature usage totals

---

## Files to Modify
- `src/pages/AdminPaymentsPage.tsx` — refactor to shell
- `src/components/admin/OrdersPanel.tsx` — NEW (extracted)
- `src/components/admin/UsersPanel.tsx` — NEW
- `src/components/admin/AnalyticsPanel.tsx` — NEW
- `src/components/admin/QrSettings.tsx` — NEW (extracted)
- `src/components/admin/AnalyticsBar.tsx` — NEW (extracted)
- `supabase/functions/admin-grant-benefits/index.ts` — NEW
- `supabase/functions/admin-user-list/index.ts` — NEW
- DB migration

## Verification
1. Login as test@test.com → lands on /admin/payments?tab=orders
2. Navigate to Users tab → see user list with credits/subscriptions
3. Grant 100 credits to a user → see updated balance
4. Set Pro subscription → user's plan shows as Pro
5. Navigate away to /app and back → URL restores last tab
6. Analytics tab shows per-user usage counts
