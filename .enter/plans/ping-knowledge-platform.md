# QR 现实锚点 — 完整功能实现计划

## Context

用户要求完善"QR 锚点"功能。当前状态：
- **DB 表** `reality_anchors` 已存在：`id, user_id, universe_id, anchor_type(note/tag/universe), target_id, label, created_at`
- **CreateAnchorModal** 已有底部面板 (phone) / 居中弹窗 (desktop)，支持 QR 生成 + NFC
- **AnchorLanding** (`/anchor/:anchorId`) 已有基础落地页，只显示 label + type badge + "Enter Universe" 按钮
- **useAnchorLanding hook** 读取 `?anchor=` 参数并切换宇宙 + flash 目标节点
- **路由** `/anchor/:anchorId` 已注册
- **入口**: NodeContextMenu + MobileNodeCard 已有 "QR 锚点" 按钮

**问题**：
1. `CreateAnchorModal` 接口不匹配 — 组件声明 `open/userId/universeId/defaultType/defaultTargetId/defaultLabel`，但 KnowledgeStarMap 传 `noteId/noteTitle/onClose`
2. DB 表缺少用户要求的字段：`name`, `description`, `anchor_slug`, `target_type`
3. `anchor_type` CHECK 约束只允许 `note/tag/universe`，需扩展为 `note/galaxy/project/workbench`
4. 无 slug 短链（目前用 UUID `/anchor/:uuid`）
5. AnchorLanding 落地页过于简单，缺少：查看知识、记录内容、继续工作、范围检索
6. 无锚点管理页
7. 缺少星系/项目菜单入口

---

## 步骤 1: 数据库迁移

**新增字段 + 修改约束**:

```sql
-- 扩展 reality_anchors 表
ALTER TABLE reality_anchors ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '';
ALTER TABLE reality_anchors ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE reality_anchors ADD COLUMN IF NOT EXISTS target_type text NOT NULL DEFAULT 'note';
ALTER TABLE reality_anchors ADD COLUMN IF NOT EXISTS anchor_slug text;
ALTER TABLE reality_anchors ADD COLUMN IF NOT EXISTS scan_count integer NOT NULL DEFAULT 0;
ALTER TABLE reality_anchors ADD COLUMN IF NOT EXISTS last_scanned_at timestamptz;

-- 唯一索引 slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_reality_anchors_slug ON reality_anchors(anchor_slug) WHERE anchor_slug IS NOT NULL;

-- 扩展 anchor_type CHECK（先删旧的再建新的）
ALTER TABLE reality_anchors DROP CONSTRAINT IF EXISTS reality_anchors_anchor_type_check;
ALTER TABLE reality_anchors ADD CONSTRAINT reality_anchors_anchor_type_check CHECK (anchor_type IN ('qr','nfc'));

-- 新增 target_type CHECK
ALTER TABLE reality_anchors ADD CONSTRAINT reality_anchors_target_type_check CHECK (target_type IN ('note','galaxy','project','workbench','universe'));

-- slug 生成函数
CREATE OR REPLACE FUNCTION generate_anchor_slug() RETURNS trigger AS $$
BEGIN
  IF NEW.anchor_slug IS NULL OR NEW.anchor_slug = '' THEN
    NEW.anchor_slug := lower(substr(md5(NEW.id::text || now()::text), 1, 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_anchor_slug BEFORE INSERT ON reality_anchors
FOR EACH ROW EXECUTE FUNCTION generate_anchor_slug();
```

**说明**：
- `anchor_type` 改为描述锚点介质类型 (`qr`/`nfc`)，之前的 `note/tag/universe` 语义由新字段 `target_type` 承担
- `name` 取代 `label`（保留 `label` 列兼容旧数据，后续可迁移）
- `anchor_slug` 自动生成 8 位短码
- `scan_count` + `last_scanned_at` 用于统计

---

## 步骤 2: 短链路由

**新增路由** `/a/:slug`

文件: `src/router.tsx`
```tsx
{ path: "/a/:slug", element: <AnchorLanding /> }
```

文件: `src/pages/AnchorLanding.tsx` — 兼容 slug + UUID 查询

---

## 步骤 3: 重写 CreateAnchorModal

**文件**: `src/components/anchors/CreateAnchorModal.tsx`

接口统一为：
```ts
interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  universeId: string;
  /** 预设 target */
  defaultTargetType?: TargetType;    // 'note' | 'galaxy' | 'project' | 'workbench' | 'universe'
  defaultTargetId?: string;
  defaultName?: string;
}
```

表单字段：
1. **名称** (name) — 必填，如 "AI 论文文件夹"
2. **目标类型** (target_type) — 节点 / 星系 / 项目 / 工作台 / 宇宙
3. **目标选择器** — 根据 target_type 动态展示：
   - `note`: 搜索/选择节点（当从节点菜单进入时自动填充）
   - `galaxy`: 下拉选择当前宇宙的星系 (tags)
   - `workbench`: 选择已有工作台 (pods)
   - `universe`: 自动填充当前宇宙
4. **描述** (description) — 可选 textarea
5. **锚点类型** (anchor_type) — QR / NFC 切换

生成后：
- 显示 QR 码 (qrcode 库已安装)
- 链接格式: `{origin}/a/{slug}`
- 支持下载 PNG + 复制链接 + NFC 写入

---

## 步骤 4: 重写 AnchorLanding 落地页

**文件**: `src/pages/AnchorLanding.tsx`

**改动**：
- 支持 `/a/:slug` (slug 查询) + `/anchor/:anchorId` (UUID 兼容)
- 每次访问增加 `scan_count` (通过 RPC 或直接 update)
- 已登录用户显示丰富操作面板：
  1. **查看相关知识** — 跳转到目标节点/星系/工作台
  2. **快速记录** — 内嵌 textarea，保存为新 capture 节点并关联到目标
  3. **继续未完成工作** — 列出目标范围内最近的 actions (status=pending)
  4. **范围内检索** — 内嵌搜索框，搜索目标范围内的 knowledge_chunks
- 未登录用户: 显示锚点信息 + 登录/注册按钮

---

## 步骤 5: 锚点管理页

**新文件**: `src/pages/AnchorsManage.tsx`

功能：
- 列出当前用户所有锚点 (分页, 按 created_at 降序)
- 每个锚点卡片显示：name, target_type badge, slug 短链, scan_count, created_at
- 点击卡片 → 展开详情：QR 码预览, 复制链接, 下载, 删除
- 空状态引导创建

**路由**: `/app/anchors` (子路由在 StarMapLayout 下)

---

## 步骤 6: 入口点

| 位置 | 触发方式 | 文件 |
|------|---------|------|
| 节点右键菜单 | 已有 "QR 锚点" | `NodeContextMenu.tsx` — 修复 prop 传递 |
| MobileNodeCard | 已有 "锚点" 按钮 | `MobileNodeCard.tsx` — 修复 prop |
| 星系右键菜单 | 新增 "QR 锚点" | `GalaxyContextMenu.tsx` |
| 设置/工具栏 | GuideCenterModal 已有 | 无需改动 |
| 锚点管理页 | 新增 "创建锚点" 按钮 | `AnchorsManage.tsx` |

---

## 步骤 7: 修复 KnowledgeStarMap 接口

**文件**: `src/components/starmap/KnowledgeStarMap.tsx`

修复 `CreateAnchorModal` 调用，对齐新接口：
```tsx
<CreateAnchorModal
  open={!!anchorNoteId}
  onClose={() => setAnchorNoteId(null)}
  userId={user.id}
  universeId={activeUniverseId}
  defaultTargetType="note"
  defaultTargetId={anchorNoteId ?? undefined}
  defaultName={notesMap.get(anchorNoteId!)?.title ?? ''}
/>
```

新增星系锚点状态 + GalaxyContextMenu 传递。

---

## 文件变更清单

| 文件 | 操作 |
|------|------|
| DB migration | 新增字段 + slug 触发器 |
| `src/router.tsx` | 新增 `/a/:slug` 和 `/app/anchors` 路由 |
| `src/components/anchors/CreateAnchorModal.tsx` | 重写：统一接口，支持5种 target_type |
| `src/pages/AnchorLanding.tsx` | 重写：slug 支持 + 丰富操作面板 |
| `src/pages/AnchorsManage.tsx` | 新建：锚点管理列表页 |
| `src/components/starmap/KnowledgeStarMap.tsx` | 修复接口 + 新增星系锚点状态 |
| `src/components/starmap/GalaxyContextMenu.tsx` | 新增 "QR 锚点" 菜单项 |
| `src/hooks/useAnchorLanding.ts` | 扩展：支持 galaxy/workbench target_type |

---

## MVP 执行顺序

1. **DB 迁移** — 基础数据结构
2. **CreateAnchorModal 重写** — 核心创建流程
3. **KnowledgeStarMap 接口修复** — 现有入口恢复工作
4. **短链路由 + AnchorLanding 重写** — 扫码体验
5. **GalaxyContextMenu 入口** — 星系锚点
6. **AnchorsManage 管理页** — 管理已创建的锚点
7. **useAnchorLanding 扩展** — 落地后跳转逻辑

---

## 验证

- 从节点菜单创建 QR 锚点 → 成功生成 QR 码，链接为 `/a/{slug}`
- 从星系菜单创建星系锚点 → target_type = galaxy
- 访问 `/a/{slug}` → 显示锚点详情 + 操作按钮
- 未登录访问 → 显示信息 + 引导登录
- 已登录访问 → 可快速记录、查看知识、检索
- 锚点管理页显示所有锚点，可预览 QR / 删除
