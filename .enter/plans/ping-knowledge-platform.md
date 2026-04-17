# Credits 消费系统打通方案

## Context

当前产品已具备：
- `user_credits` 表（balance 字段）、`credit_ledger` 台账表、`subscriptions` 套餐表
- `useBilling` hook 读取余额/套餐
- `BillingPanel` / `PricingPage` 前端购买流程（手动支付 → 管理员审核 → 发放）
- `admin-grant-benefits` edge function 手动加减 credits
- **11 个 AI edge functions** 全部直接调用 LLM，**无任何计费拦截**

**核心问题：** 功能与点数完全断开——所有 AI 功能零消费运行，`credit_ledger` 仅记录管理员手动操作。

本方案目标：建立 **统一计费网关**，让所有 AI 功能经过 estimate → reserve → settle → refund 四段链路。

---

## 1. 计费系统总体架构

```
前端调用
  │
  ▼
Edge Function（业务函数，如 distill-insight）
  │
  ├─① import { gate } from "../_shared/billing-gate.ts"
  ├─② const ticket = await gate.enter(userId, 'insight.distill', { tokens_est })
  │     ↳ 查 entitlements → 估算 cost → 检查余额 → 写 reserve 行 → 返回 ticket
  ├─③ 执行 AI 调用（真实业务）
  ├─④ await gate.settle(ticket, { actual_tokens })
  │     ↳ 计算实际消耗 → 更新 reserve→settled → 扣减 balance → 写 ledger
  └─⑤ 如果失败：await gate.refund(ticket)
        ↳ reserve→refunded → 回退 balance
```

**关键设计：**
- 所有计费逻辑集中在 `_shared/billing-gate.ts`，业务函数只需 3 行调用
- `gate.enter()` 是唯一的权限 + 余额检查入口
- 不改动现有 AI 调用逻辑，只在前后包裹 gate

---

## 2. 哪些功能应计费 vs 不应计费

### 应计费（调用 AI / 消耗计算资源）

| 功能 | feature_code | 调用的 Edge Function | 计费维度 |
|------|-------------|---------------------|---------|
| 内容分析 | `capture.analyze` | `analyze-content` | 固定 3 credits |
| 知识蒸馏 | `insight.distill` | `distill-insight` | 固定 2 credits |
| RAG 语义检索 | `retrieval.rag` | `rag-search` | 固定 2 credits |
| 记忆唤醒 | `memory.wake` | `memory-wake` | 固定 1 credit |
| 知识转换 | `action.convert` | `knowledge-convert` | 固定 2 credits |
| 视角切换 | `insight.perspective` | `perspective-switch` | 固定 2 credits |
| 认知镜像 | `insight.cognitive` | `cognitive-mirror` | 固定 3 credits |
| 预见层分析 | `insight.anticipation` | `anticipation-layer` | 固定 2 credits |
| 知识缩放 | `retrieval.zoom` | `knowledge-zoom` | 固定 2 credits |
| 知识分块索引 | `capture.chunk` | `chunk-and-index` | 免费（非 AI） |

### 不应计费（纯 CRUD / 本地计算）

- 创建/编辑/删除笔记
- 3D 星图浏览、节点拖拽、连线
- 标签管理、星系分组
- 登录/注册/个人设置
- 管理员操作
- `chunk-and-index`（纯文本分割 + FTS 索引，不调 AI）

---

## 3. 功能计费映射设计（feature_codes）

```typescript
// supabase/functions/_shared/feature-registry.ts

export type FeatureCode =
  | 'capture.analyze'
  | 'insight.distill'
  | 'insight.perspective'
  | 'insight.cognitive'
  | 'insight.anticipation'
  | 'retrieval.rag'
  | 'retrieval.zoom'
  | 'memory.wake'
  | 'action.convert';

export interface FeatureDefinition {
  code: FeatureCode;
  label_zh: string;
  base_cost: number;          // 固定基础 credits
  min_plan: 'free' | 'pro' | 'team';  // 最低所需套餐
  free_daily_limit: number;   // free 套餐每日免费次数
  pro_daily_limit: number;    // pro 套餐每日免费次数（0=不限）
}

export const FEATURE_REGISTRY: Record<FeatureCode, FeatureDefinition> = {
  'capture.analyze':       { code: 'capture.analyze',       label_zh: '内容分析',   base_cost: 3, min_plan: 'free', free_daily_limit: 5,  pro_daily_limit: 0 },
  'insight.distill':       { code: 'insight.distill',       label_zh: '知识蒸馏',   base_cost: 2, min_plan: 'free', free_daily_limit: 3,  pro_daily_limit: 0 },
  'retrieval.rag':         { code: 'retrieval.rag',         label_zh: '语义检索',   base_cost: 2, min_plan: 'free', free_daily_limit: 5,  pro_daily_limit: 0 },
  'memory.wake':           { code: 'memory.wake',           label_zh: '记忆唤醒',   base_cost: 1, min_plan: 'free', free_daily_limit: 5,  pro_daily_limit: 0 },
  'action.convert':        { code: 'action.convert',        label_zh: '知识转换',   base_cost: 2, min_plan: 'free', free_daily_limit: 3,  pro_daily_limit: 0 },
  'insight.perspective':   { code: 'insight.perspective',   label_zh: '视角切换',   base_cost: 2, min_plan: 'pro',  free_daily_limit: 0,  pro_daily_limit: 0 },
  'insight.cognitive':     { code: 'insight.cognitive',     label_zh: '认知镜像',   base_cost: 3, min_plan: 'pro',  free_daily_limit: 0,  pro_daily_limit: 0 },
  'insight.anticipation':  { code: 'insight.anticipation',  label_zh: '预见层',     base_cost: 2, min_plan: 'pro',  free_daily_limit: 0,  pro_daily_limit: 0 },
  'retrieval.zoom':        { code: 'retrieval.zoom',        label_zh: '知识缩放',   base_cost: 2, min_plan: 'pro',  free_daily_limit: 0,  pro_daily_limit: 0 },
};
```

**套餐 × 功能权限矩阵：**

| 功能 | Free | Pro | Team |
|------|------|-----|------|
| capture.analyze | 5次/天免费，超出扣credits | 不限 | 不限 |
| insight.distill | 3次/天免费，超出扣credits | 不限 | 不限 |
| retrieval.rag | 5次/天免费，超出扣credits | 不限 | 不限 |
| memory.wake | 5次/天免费，超出扣credits | 不限 | 不限 |
| action.convert | 3次/天免费，超出扣credits | 不限 | 不限 |
| insight.perspective | 需Pro，每次扣credits | 不限 | 不限 |
| insight.cognitive | 需Pro，每次扣credits | 不限 | 不限 |
| insight.anticipation | 需Pro，每次扣credits | 不限 | 不限 |
| retrieval.zoom | 需Pro，每次扣credits | 不限 | 不限 |

**计费策略说明：**
- **Free 用户：** 基础功能有每日免费额度，超出后扣 credits；高级功能（perspective/cognitive/anticipation/zoom）需升级 Pro 或购买 credits
- **Pro/Team 用户：** 所有功能在订阅期内不扣 credits（包含在订阅内）
- **Credits 仅在以下情况扣除：** Free 用户超出每日免费次数 or Free 用户使用 Pro 功能（如果 min_plan='free' 允许 credits 解锁）

---

## 4. 点数价格规则设计

**MVP 采用固定点数制，不按 tokens 计费（原因：简化用户心智模型，tokens 对用户不直观）。**

```
定价公式：base_cost 固定值
- 轻量 AI 操作（memory.wake）：1 credit
- 标准 AI 操作（distill/rag/convert/perspective/anticipation/zoom）：2 credits
- 重度 AI 操作（analyze/cognitive）：3 credits
```

**未来扩展预留：**
- `FeatureDefinition` 可添加 `cost_formula: 'fixed' | 'per_token' | 'per_node'` 字段
- MCP 外部工具调用按工具类别计费：`mcp.{tool_name}` → 独立 base_cost

---

## 5. Estimate → Reserve → Settle → Refund 四段式链路

### 数据库新增表：`usage_events`

```sql
create table public.usage_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id),
  feature_code text not null,
  status       text not null default 'reserved'
                 check (status in ('reserved','settled','refunded','failed')),
  cost_estimate integer not null,       -- gate.enter 时的预估 credits
  cost_actual   integer,                -- gate.settle 时的实际 credits（MVP = estimate）
  metadata      jsonb default '{}',     -- 可存 { noteId, mode, tokens_used }
  created_at    timestamptz default now(),
  settled_at    timestamptz,
  ref_id        text                    -- 关联到 credit_ledger.ref_id
);

alter table usage_events enable row level security;
create policy "users view own events" on usage_events for select using (auth.uid() = user_id);

create index idx_usage_events_user on usage_events (user_id, created_at desc);
create index idx_usage_events_daily on usage_events (user_id, feature_code, created_at);
```

### billing-gate.ts 核心逻辑

```typescript
// supabase/functions/_shared/billing-gate.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { FEATURE_REGISTRY, type FeatureCode } from "./feature-registry.ts";

interface Ticket {
  eventId: string;
  userId: string;
  featureCode: FeatureCode;
  costEstimate: number;
  skipBilling: boolean;  // Pro/Team 用户免费时不实际扣除
}

export const gate = {
  /** Step 1: 权限检查 + 余额预留 */
  async enter(userId: string, featureCode: FeatureCode, _meta?: Record<string,unknown>): Promise<Ticket> {
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const feature = FEATURE_REGISTRY[featureCode];
    if (!feature) throw new Error(`Unknown feature: ${featureCode}`);

    // 1. 读取用户套餐 + 余额
    const [subRes, credRes] = await Promise.all([
      db.from('subscriptions').select('plan, status, current_period_end').eq('user_id', userId).maybeSingle(),
      db.from('user_credits').select('balance').eq('user_id', userId).maybeSingle(),
    ]);
    const plan = (subRes.data?.plan ?? 'free') as string;
    const isActive = subRes.data?.status === 'active' &&
      subRes.data?.current_period_end &&
      new Date(subRes.data.current_period_end) > new Date();
    const balance = credRes.data?.balance ?? 0;

    // 2. 权限判断：Pro/Team 订阅有效 → 全部功能免费
    let skipBilling = false;
    if ((plan === 'pro' || plan === 'team') && isActive) {
      skipBilling = true;
    }

    // 3. Free 用户检查每日免费额度
    let costEstimate = feature.base_cost;
    if (!skipBilling && plan === 'free') {
      // 检查 min_plan 限制
      if (feature.min_plan !== 'free') {
        // Free 用户可以用 credits 解锁 Pro 功能
        // (不硬拦截，但需要有足够 credits)
      }
      // 检查今日已用次数
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count } = await db.from('usage_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('feature_code', featureCode)
        .in('status', ['settled', 'reserved'])
        .gte('created_at', todayStart.toISOString());
      const usedToday = count ?? 0;

      if (usedToday < feature.free_daily_limit) {
        costEstimate = 0;  // 在免费额度内
        skipBilling = true;
      } else {
        // 超出免费额度，需要扣 credits
        if (balance < costEstimate) {
          throw new Error(`INSUFFICIENT_CREDITS:${balance}:${costEstimate}:${feature.label_zh}`);
        }
      }
    }

    // 4. 写入 reserved 事件
    const { data: event } = await db.from('usage_events').insert({
      user_id: userId,
      feature_code: featureCode,
      status: 'reserved',
      cost_estimate: costEstimate,
      metadata: _meta ?? {},
    }).select('id').single();

    // 5. 非免费时预扣余额
    if (!skipBilling && costEstimate > 0) {
      await db.rpc('deduct_credits', { p_user_id: userId, p_amount: costEstimate });
    }

    return {
      eventId: event!.id,
      userId,
      featureCode,
      costEstimate,
      skipBilling,
    };
  },

  /** Step 2: 任务完成 → 结算 */
  async settle(ticket: Ticket, meta?: Record<string,unknown>): Promise<void> {
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const actualCost = ticket.costEstimate; // MVP: actual = estimate

    await db.from('usage_events').update({
      status: 'settled',
      cost_actual: actualCost,
      settled_at: new Date().toISOString(),
      metadata: meta ?? {},
    }).eq('id', ticket.eventId);

    // 写入 credit_ledger（即使 skipBilling 也记录 0 消耗用于统计）
    if (!ticket.skipBilling && actualCost > 0) {
      const { data: cred } = await db.from('user_credits')
        .select('balance').eq('user_id', ticket.userId).single();
      await db.from('credit_ledger').insert({
        user_id: ticket.userId,
        delta: -actualCost,
        balance_after: cred!.balance,
        reason: 'ai_usage',
        ref_id: `usage:${ticket.eventId}`,
      });
    }
  },

  /** Step 3: 任务失败 → 退还预留 */
  async refund(ticket: Ticket): Promise<void> {
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await db.from('usage_events').update({
      status: 'refunded',
      settled_at: new Date().toISOString(),
    }).eq('id', ticket.eventId);

    if (!ticket.skipBilling && ticket.costEstimate > 0) {
      await db.rpc('add_credits', { p_user_id: ticket.userId, p_amount: ticket.costEstimate });
      const { data: cred } = await db.from('user_credits')
        .select('balance').eq('user_id', ticket.userId).single();
      await db.from('credit_ledger').insert({
        user_id: ticket.userId,
        delta: ticket.costEstimate,
        balance_after: cred!.balance,
        reason: 'ai_refund',
        ref_id: `refund:${ticket.eventId}`,
      });
    }
  },
};
```

### 需要的数据库辅助函数

```sql
-- 原子扣减 credits
create or replace function deduct_credits(p_user_id uuid, p_amount integer)
returns void language plpgsql security definer as $$
begin
  update user_credits
  set balance = balance - p_amount, updated_at = now()
  where user_id = p_user_id and balance >= p_amount;
  if not found then raise exception 'INSUFFICIENT_CREDITS'; end if;
end;$$;

-- 原子增加 credits
create or replace function add_credits(p_user_id uuid, p_amount integer)
returns void language plpgsql security definer as $$
begin
  insert into user_credits (user_id, balance)
  values (p_user_id, p_amount)
  on conflict (user_id) do update
  set balance = user_credits.balance + p_amount, updated_at = now();
end;$$;
```

---

## 6. 套餐权限 + 点数 + 资源上限统一判断

`gate.enter()` 内部判断链路：

```
1. 读取 plan + isActive + balance
2. if (plan=Pro/Team && isActive) → skipBilling=true, pass
3. if (plan=Free):
   a. 检查 feature.min_plan
      - 如果 min_plan='pro' 且无 credits → 抛 PLAN_REQUIRED 错误
      - 如果 min_plan='pro' 但有 credits → 允许，扣 credits
   b. 检查 free_daily_limit
      - 今日已用 < limit → costEstimate=0, skipBilling=true
      - 今日已用 >= limit → 需扣 credits
   c. 检查 balance >= costEstimate → 否则抛 INSUFFICIENT_CREDITS
4. 写入 usage_events(reserved)
5. 预扣 balance
6. 返回 ticket
```

**资源上限（笔记数、星系数）单独在前端 + CRUD 层检查，不走 billing-gate：**

```typescript
// src/hooks/useEntitlements.ts
export function useEntitlements(plan: string) {
  return {
    maxNotes:    plan === 'free' ? 50 : Infinity,
    maxGalaxies: plan === 'free' ? 3  : Infinity,
    // 后续扩展
  };
}
```

---

## 7. 数据库表设计

### 新增表

| 表 | 用途 |
|----|------|
| `usage_events` | 四段式事件记录（见上方 DDL） |

### 新增函数

| 函数 | 用途 |
|------|------|
| `deduct_credits(uuid, int)` | 原子扣减余额 |
| `add_credits(uuid, int)` | 原子增加余额 |

### 现有表改动

| 表 | 改动 |
|----|------|
| `credit_ledger.reason` | 新增枚举值 `'ai_usage'` / `'ai_refund'` |
| `user_credits` | 无结构改动；新用户注册时自动创建行（已有） |

---

## 8. API 路由 / Edge Function 改造

### 新增共享模块

```
supabase/functions/_shared/
  ├── billing-gate.ts        # gate.enter / settle / refund
  └── feature-registry.ts    # FEATURE_REGISTRY 定义
```

### 改造现有 Edge Functions（以 distill-insight 为例）

```typescript
// 改造前：
Deno.serve(async (req) => {
  // ... 直接执行 AI 调用
});

// 改造后：
import { gate } from "../_shared/billing-gate.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") { ... }
  
  // 从 Authorization header 提取 userId
  const authHeader = req.headers.get("Authorization") ?? "";
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  const userId = user?.id;
  if (!userId) throw new Error("Unauthorized");

  // ① 计费网关 — 进入
  const ticket = await gate.enter(userId, 'insight.distill', { noteId: body.noteId });
  
  try {
    // ② 执行原有 AI 逻辑（不改动）
    const result = await doAICall(...);
    
    // ③ 结算
    await gate.settle(ticket, { tokens: result.usage?.total_tokens });
    
    return new Response(JSON.stringify(result), { headers });
  } catch (e) {
    // ④ 失败退还
    await gate.refund(ticket);
    throw e;
  }
});
```

### 需要改造的 9 个 Edge Functions

1. `analyze-content` → `capture.analyze`
2. `distill-insight` → `insight.distill`
3. `rag-search` → `retrieval.rag`
4. `memory-wake` → `memory.wake`
5. `knowledge-convert` → `action.convert`
6. `perspective-switch` → `insight.perspective`
7. `cognitive-mirror` → `insight.cognitive`
8. `anticipation-layer` → `insight.anticipation`
9. `knowledge-zoom` → `retrieval.zoom`

**不需要改造的：** `chunk-and-index`（无 AI）、所有 `admin-*`、所有 `manual-pay-*`、`alipay-*`

---

## 9. 前端展示与交互建议

### 9.1 全局 Credits 指示器（常驻）

在 `CommandDock` / `MobileTabBar` 旁添加小型余额徽章：

```
[⚡ 128]  ← 当前余额，点击打开 BillingPanel
```

- 正常：`#b496ff`
- 余额 < 10：`#ff4466` 闪烁
- Pro 用户：显示 `PRO ⚡ ∞`

### 9.2 功能触发前的消费估算（低打扰）

在 AI 按钮旁显示 cost badge（不阻断操作）：

```
[蒸馏] ²   ← 右上角小数字表示 2 credits
[蒸馏] FREE ← 在免费额度内
```

### 9.3 余额不足拦截（CreditGateModal）

当 `gate.enter` 返回 `INSUFFICIENT_CREDITS` 错误时，前端弹出：

```
┌─────────────────────────────┐
│  Credits 不足               │
│                             │
│  「知识蒸馏」需要 2 credits │
│  当前余额：0               │
│                             │
│  [购买 Credits]  [升级 Pro] │
└─────────────────────────────┘
```

### 9.4 扣费成功反馈（Toast）

```
✓ 知识蒸馏完成 · -2 credits · 余额 126
```

### 9.5 新增前端文件

| 文件 | 用途 |
|------|------|
| `src/hooks/useEntitlements.ts` | 套餐权限 + 资源上限 |
| `src/hooks/useCreditGate.ts` | 包装 `functions.invoke` + 捕获 `INSUFFICIENT_CREDITS` 错误 → 弹出 CreditGateModal |
| `src/components/billing/CreditBadge.tsx` | 全局余额徽章 |
| `src/components/billing/CostTag.tsx` | AI 按钮旁的 cost 小标签 |
| `src/components/billing/CreditGateModal.tsx` | 余额不足弹窗 |

---

## 10. MVP 最适合先打通的功能

### Sprint 1（最小闭环）

1. **数据库迁移：** 创建 `usage_events` 表 + `deduct_credits` / `add_credits` 函数
2. **billing-gate.ts + feature-registry.ts** 共享模块
3. **改造 2 个最常用函数：** `distill-insight` + `rag-search`
4. **前端：** `CreditBadge` 余额指示 + `CreditGateModal` 拦截 + Toast 反馈
5. **验证：** Free 用户超出免费次数后扣费 → Pro 用户不扣费 → 余额不足被拦截

### Sprint 2（全量接入）

6. 改造剩余 7 个 AI Edge Functions
7. `CostTag` 组件在所有 AI 按钮旁显示消耗预估
8. `useEntitlements` + 笔记数/星系数限制

### Sprint 3（高级特性）

9. MCP 工具调用计费接入
10. 按 tokens 动态计费选项
11. 用量统计仪表盘（用户侧）

---

## 实现文件清单

### 新增文件

| 文件路径 | 说明 |
|---------|------|
| `supabase/functions/_shared/billing-gate.ts` | 统一计费网关 |
| `supabase/functions/_shared/feature-registry.ts` | 功能注册表 |
| `src/hooks/useEntitlements.ts` | 套餐权限 hook |
| `src/hooks/useCreditGate.ts` | 前端计费拦截 hook |
| `src/components/billing/CreditBadge.tsx` | 余额徽章 |
| `src/components/billing/CostTag.tsx` | 消耗标签 |
| `src/components/billing/CreditGateModal.tsx` | 余额不足弹窗 |

### 修改文件

| 文件路径 | 改动 |
|---------|------|
| `supabase/functions/distill-insight/index.ts` | 接入 billing-gate |
| `supabase/functions/rag-search/index.ts` | 接入 billing-gate |
| `supabase/functions/analyze-content/index.ts` | 接入 billing-gate |
| `supabase/functions/memory-wake/index.ts` | 接入 billing-gate |
| `supabase/functions/knowledge-convert/index.ts` | 接入 billing-gate |
| `supabase/functions/perspective-switch/index.ts` | 接入 billing-gate |
| `supabase/functions/cognitive-mirror/index.ts` | 接入 billing-gate |
| `supabase/functions/anticipation-layer/index.ts` | 接入 billing-gate |
| `supabase/functions/knowledge-zoom/index.ts` | 接入 billing-gate |
| `src/components/floating/CommandDock.tsx` | 添加 CreditBadge |
| `src/components/floating/MobileTabBar.tsx` | 添加 CreditBadge |
| `src/components/pods/InsightBox.tsx` | 添加 CostTag + 错误处理 |
| `src/components/pods/ActionBox.tsx` | 添加 CostTag + 错误处理 |
| `src/pages/Distiller.tsx` | 添加 CostTag + 错误处理 |
| `src/pages/Analyze.tsx` | 添加 CostTag + 错误处理 |
| `src/hooks/useRAG.ts` | 错误处理 → CreditGateModal |
| `src/hooks/useMemoryWake.ts` | 错误处理 → CreditGateModal |

### 数据库迁移

```sql
-- 1. usage_events 表
-- 2. deduct_credits 函数
-- 3. add_credits 函数
-- (见上方 DDL)
```

---

## 验证方案

1. **Free 用户 + 免费额度内：** 调用 distill-insight → 成功，usage_events 记录 cost_estimate=0, status=settled
2. **Free 用户 + 超出额度：** 调用第 4 次 distill-insight → 扣 2 credits，credit_ledger 写入 -2
3. **Free 用户 + 余额不足：** 调用 → 返回 INSUFFICIENT_CREDITS → 前端弹出 CreditGateModal
4. **Pro 用户：** 调用任意功能 → 成功，skipBilling=true，不扣 credits
5. **AI 调用失败：** gate.refund 退还 → usage_events status=refunded，余额恢复
