# Fix: 新用户注册时数据库报错

## Context
注册时 `handle_new_user` 和 `create_default_universe` 两个触发器在 `auth.users INSERT` 后执行。
`handle_new_user` 正确设置了 `SET search_path = 'public'`，但 `create_default_universe` **缺少 search_path 设置**，
导致在 Supabase auth trigger 上下文中可能找不到 `universes` 表而报错，阻断整个注册事务。

## Root Cause
```sql
-- create_default_universe: proconfig = NULL (no search_path!)
-- handle_new_user:         proconfig = [search_path=public] ✓
```
Supabase auth 触发器的执行上下文 search_path 可能不含 `public`，导致 `INSERT INTO universes` 失败。
由于两个触发器在同一事务中执行，任一失败都会回滚整个 `auth.users` INSERT，表现为"注册失败+数据库错误"。

## Fix

### 1. 修复 `create_default_universe` 函数 (DB Migration)
- 添加 `SET search_path = 'public'`
- 添加 `ON CONFLICT` 防御

### 2. Files Modified
- DB migration only (no frontend changes needed)

## Verification
1. 新注册用户 → 成功创建 `profiles` + `subscriptions` + `user_credits` + `universes` 行
2. 现有用户登录不受影响
