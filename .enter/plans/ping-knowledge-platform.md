# Plan: Admin Dashboard + User UX Improvements

## Context
Three improvements requested:
1. **Admin**: Show order user account info (email) + better proof image display
2. **Admin**: Analytics section — order counts by type/status + revenue stats
3. **User UX**: After submitting payment proof, show explicit save/close buttons (not auto-redirect)

---

## Change 1 — Admin: Show User Email

**Problem**: `OrderCard` only shows `username`, not email.

**Approach**: In `manual-pay-admin-list` edge function, use service role `auth.admin.listUsers()` to build an `emailMap`, then attach `user_email` to each order object.

**Files**:
- `supabase/functions/manual-pay-admin-list/index.ts`
  - After fetching orders, call `svc.auth.admin.listUsers({ perPage: 1000 })`
  - Build `emailMap: Record<userId, email>`
  - Attach `user_email: emailMap[order.user_id] ?? null` to each order
- `src/pages/AdminPaymentsPage.tsx`
  - Add `user_email: string | null` to `Order` interface
  - Display below username in `OrderCard` header: `order.user_email`

---

## Change 2 — Admin: Analytics Dashboard

**New component**: `AnalyticsBar` — inserted at the **top** of the admin page (above QrSettings)

**Data**: Direct Supabase query (admin RLS allows reading all orders):
```typescript
supabase.from('manual_orders').select('status, product_type, amount_fen, created_at')
```

**Stats cards**:
- 待审核 — count where status = 'submitted'
- 已发放 — count where status = 'fulfilled'  
- 总收入 — sum of amount_fen where status = 'fulfilled' (formatted as ¥xx.xx)
- 今日新增 — count where created_at >= today

**Product breakdown row** (below stats cards):
- 订阅订单 — count where product_type = 'subscription'
- Credits 订单 — count where product_type = 'credits'
- Simple inline bar proportional chart (CSS only, no library)

**File**: `src/pages/AdminPaymentsPage.tsx` — add `AnalyticsBar` function component before `QrSettings`

---

## Change 3 — User UX: Explicit Close Buttons After Proof Submission

**Problem**: `ProofSubmitForm` `done` state auto-calls `onSubmitted()` after 1.8s with no user control.

**Solution**: Replace auto-redirect with explicit action buttons:
- Remove `setTimeout(() => onSubmitted(), 1800)`
- Keep `state === 'done'` success screen (with Check icon + success text)
- Add two buttons:
  - **"返回应用"** — calls `onSubmitted()` (closes billing panel)
  - **"查看订单状态"** — also calls `onSubmitted()` but BillingPanel will be updated to open "我的订单" tab; pass an optional `onViewOrders` callback

**Additionally**: Add a backdrop click handler on the `done` state overlay that also closes (calls `onSubmitted()`), so user can click outside to dismiss.

**Files**:
- `src/components/payment/ProofSubmitForm.tsx`
  - Remove `setTimeout(() => onSubmitted(), 1800)`
  - Add `onViewOrders?: () => void` prop
  - Render two buttons in `done` state
- `src/components/payment/ManualPayModal.tsx`
  - Pass `onViewOrders` callback that calls `onSubmitted()` (billing handles tab switch)

---

## Files Modified
| File | Change |
|------|--------|
| `supabase/functions/manual-pay-admin-list/index.ts` | Add user email lookup |
| `src/pages/AdminPaymentsPage.tsx` | Add AnalyticsBar, email display in OrderCard |
| `src/components/payment/ProofSubmitForm.tsx` | Explicit buttons on done state |
| `src/components/payment/ManualPayModal.tsx` | Pass onViewOrders callback |

---

## Verification
1. Login as `test@test.com` → `/admin/payments` → See analytics bar at top
2. Expand any order → See user email below username
3. Create a test order as another user → Submit proof → See explicit close buttons appear
4. Clicking "返回应用" closes the entire payment flow
