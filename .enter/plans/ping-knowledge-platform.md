# Admin Dashboard Full Expansion Plan

## Context
当前后台已有 `/admin/payments` 页面，含订单/用户/数据分析三个 tab。
用户要求：
1. 独立后台路由体系（`/admin/*`），带侧边栏布局，与前台宇宙彻底分离
2. SettingsCapsule 中添加管理员专属入口（仅 admin 可见）
3. 用户账号关停/打开功能
4. 更多功能模块：Credits 台账、套餐管理、项目管理、系统监控

---

## Route Structure
```
/admin                → 重定向到 /admin/orders
/admin/orders         → 订单审核（迁移自现有 OrdersPanel）
/admin/users          → 用户管理（迁移自现有 UsersPanel）
/admin/credits        → Credits 台账与管理
/admin/plans          → 套餐与权益管理
/admin/projects       → 项目内容管理
/admin/system         → 系统监控
```
旧 `/admin/payments` → 301 redirect 到 `/admin/orders`

---

## DB Migrations (1 migration)
```sql
-- 1. 用户禁用状态
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_reason text;

-- 2. Credits 台账
CREATE TABLE public.credit_ledger (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  delta       integer NOT NULL,       -- positive = add, negative = deduct
  balance_after integer NOT NULL,
  reason      text NOT NULL,          -- 'manual_grant' | 'order_fulfill' | 'admin_deduct' | 'ai_usage'
  ref_id      text,                   -- order_id or admin_grant_id
  admin_id    uuid REFERENCES auth.users(id),
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own ledger" ON public.credit_ledger FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins view all ledger" ON public.credit_ledger FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "admins insert ledger" ON public.credit_ledger FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
CREATE INDEX ON public.credit_ledger (user_id, created_at DESC);

-- 3. 系统事件日志
CREATE TABLE public.system_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  text NOT NULL,          -- 'order_fulfilled' | 'order_rejected' | 'grant_credits' | 'user_banned' | 'error'
  severity    text NOT NULL DEFAULT 'info', -- 'info' | 'warn' | 'error'
  user_id     uuid REFERENCES auth.users(id),
  payload     jsonb DEFAULT '{}',
  message     text,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage events" ON public.system_events FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
CREATE INDEX ON public.system_events (event_type, created_at DESC);
CREATE INDEX ON public.system_events (severity, created_at DESC);
```

---

## New Edge Function: `admin-toggle-user`
```typescript
// POST { targetUserId, action: 'ban' | 'unban', reason? }
// Sets profiles.banned_at + profiles.ban_reason
// Logs to system_events
```

---

## Frontend Architecture

### 1. AdminLayout (`src/components/admin/AdminLayout.tsx`)
- Left sidebar (220px) — logo + nav items
- Topbar (60px) — breadcrumb + back-to-app button  
- Content area — scrollable, max-width 1040px
- Style: `bg-[#080c18]`, white sidebar with subtle borders, NOT cosmos dark gradient

### 2. Nav Items (sidebar)
| Icon | Label | Route |
|------|-------|-------|
| CreditCard | 订单审核 | /admin/orders |
| Users | 用户管理 | /admin/users |
| Zap | Credits | /admin/credits |
| Crown | 套餐管理 | /admin/plans |
| FolderOpen | 项目管理 | /admin/projects |
| Activity | 系统监控 | /admin/system |
| Settings | 收款设置 | /admin/settings |

### 3. File Structure
```
src/
  pages/admin/
    AdminLayout.tsx       ← NEW shared layout with sidebar
    OrdersPage.tsx        ← 迁移自 AdminPaymentsPage (OrdersPanel)
    UsersPage.tsx         ← 迁移自 AdminPaymentsPage (UsersPanel)
    CreditsPage.tsx       ← NEW: ledger table + add/deduct form
    PlansPage.tsx         ← NEW: subscription list + grant form (reuse GrantModal)
    ProjectsPage.tsx      ← NEW: project list per user
    SystemPage.tsx        ← NEW: system_events log
    SettingsPage.tsx      ← 迁移自 QrSettings + AnalyticsBar
  components/admin/
    (已有文件保留，被各 Page 引用)
```

---

## SettingsCapsule Change
在 SettingsCapsule 下拉菜单 "Sign out" 上方添加：
```tsx
{isAdmin && (
  <button onClick={() => navigate('/admin')}>
    <LayoutDashboard size={12} />
    管理后台
  </button>
)}
```
需要查询 `profiles.is_admin` — 用 `useBilling` 或独立 `useAdminCheck` hook。

---

## UsersPanel Enhancement (toggle user)
在每个用户行添加：
- 红色"禁用账号"按钮 / 绿色"恢复账号"按钮（根据 `banned_at` 是否为空）
- 调用 `admin-toggle-user` edge function
- 被禁用用户在前台登录时显示"账号已被暂停"提示

---

## Router Changes (`src/router.tsx`)
```typescript
// 新增子路由
{
  path: '/admin',
  element: <AdminLayout />,
  children: [
    { index: true, element: <Navigate to="/admin/orders" /> },
    { path: 'orders',   element: <OrdersPage /> },
    { path: 'users',    element: <UsersPage /> },
    { path: 'credits',  element: <CreditsPage /> },
    { path: 'plans',    element: <PlansPage /> },
    { path: 'projects', element: <ProjectsPage /> },
    { path: 'system',   element: <SystemPage /> },
    { path: 'settings', element: <SettingsPage /> },
  ]
}
// /admin/payments → 旧路由保留但重定向
{ path: '/admin/payments', element: <Navigate to="/admin/orders" /> }
```

---

## Files to Create/Modify
**Create:**
- `src/pages/admin/AdminLayout.tsx`
- `src/pages/admin/OrdersPage.tsx`
- `src/pages/admin/UsersPage.tsx`
- `src/pages/admin/CreditsPage.tsx`
- `src/pages/admin/PlansPage.tsx`
- `src/pages/admin/ProjectsPage.tsx`
- `src/pages/admin/SystemPage.tsx`
- `src/pages/admin/SettingsPage.tsx`
- `supabase/functions/admin-toggle-user/index.ts`

**Modify:**
- `src/router.tsx` — add /admin/* routes + redirect
- `src/components/floating/SettingsCapsule.tsx` — add admin entry
- `src/pages/AdminPaymentsPage.tsx` — make it a redirect to /admin/orders
- `src/components/admin/UsersPanel.tsx` — add ban/unban button
- `supabase/functions/admin-grant-benefits/index.ts` — also log to credit_ledger

---

## Verification
1. Admin login → auto-redirect to `/admin/orders` (already implemented in Auth.tsx)
2. SettingsCapsule shows "管理后台" button only for admin user
3. Sidebar shows current active route highlighted
4. User ban: click "禁用账号" → user row shows "已禁用" badge → unban restores
5. Credits page shows ledger table with add/deduct form
6. System page shows latest events log
7. Non-admin navigating to `/admin/*` redirects to `/`
