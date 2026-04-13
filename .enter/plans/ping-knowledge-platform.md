# 「平」- 个人智能知识管理平台 产品方案

## Context

用户希望建立个人知识管理工具，将来自网站、文件、图片、文字、视频的多源信息通过 AI 进行深度分析整理，形成结构化知识输出。产品定位为未来可上线的正式产品，需完整的账号体系、AI 分析、编辑、思维导图、多格式下载等功能。

---

## 产品名称 & 设计系统

- **产品名**：平（Píng）— 寓意平铺信息、平静思考
- **主色调**：深蓝系 (#1E3A8A → #3B82F6)
- **辅助色**：靛青 / 浅蓝紫
- **风格**：简洁科技风、微渐变卡片、带流光/光晕动效
- **支持**：亮色 / 暗色双主题

---

## 整体架构

### 技术栈
- **前端**：React 19 + Vite + TypeScript + Tailwind CSS + Shadcn UI
- **后端**：Enter Cloud (Supabase) — Auth + PostgreSQL + Storage + Edge Functions
- **AI 分析**：Edge Function 调用 Enter LLM API（deep research 级别分析）
- **思维导图**：`@xyflow/react`（react-flow）
- **Markdown 渲染**：`react-markdown` + `@tailwindcss/typography`
- **导出**：Markdown 内置、PDF 使用 `html2pdf.js`、Word 使用 `docx`

---

## 页面结构 & 路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | Landing | 产品介绍 + 登录/注册入口 |
| `/auth` | Auth | 登录 / 注册 / 忘记密码 |
| `/dashboard` | Dashboard | 首页总览：统计、最近笔记、快速分析入口 |
| `/analyze` | Analyze | 多类型输入 + 实时分析进度展示 |
| `/library` | Library | 知识库列表（搜索/筛选/排序）|
| `/note/:id` | Note | 笔记详情 + 二次编辑 + 下载 |
| `/mindmap/:id` | MindMap | 交互式思维导图 |
| `/settings` | Settings | 个人信息 / 主题 / 隐私配置 |

---

## 功能模块详解

### 1. 账号体系（Auth）
- 邮箱 + 密码注册/登录
- Supabase Auth 管理 session
- 密码找回
- 用户头像（首字母 Avatar）
- 所有数据通过 RLS 隔离，严格私密

### 2. 内容输入（Analyze Page）
支持 5 种输入类型，Tab 切换：
- **URL** — 网站链接（Edge Function 内获取内容）
- **文字** — 直接粘贴文本
- **文件** — PDF / TXT 上传（Supabase Storage）
- **图片** — JPG/PNG 上传分析
- **视频** — YouTube / 视频链接（提取文字信息）

### 3. AI 深度分析（Edge Function: `analyze-content`）
调用 Enter LLM API，返回结构化 JSON：
```
{
  title: string,
  summary: string,          // 核心摘要
  key_points: string[],     // 关键信息点
  analysis: {               // 多维度分析
    main_viewpoints: string[],
    critical_analysis: string,
    innovative_insights: string[],
    knowledge_connections: string[]
  },
  tags: string[],
  mindmap_data: {           // 思维导图数据
    root: string,
    nodes: MindMapNode[]
  },
  content_markdown: string  // 完整 Markdown 报告
}
```

### 4. 输出展示 & 编辑（Note Page）
- **顶部**：标题 + 来源类型 + 时间 + 操作按钮
- **Tab 布局**：
  - 「摘要」— 核心摘要 + 关键点卡片
  - 「深度分析」— 主要观点 / 批判分析 / 创新洞见
  - 「完整报告」— Markdown 全文
  - 「思维导图」— 内嵌 MindMap 视图
- **编辑模式**：点击编辑按钮，切换为可编辑 Textarea，自动保存
- **下载菜单**：Markdown / PDF / Word（Docx）

### 5. 思维导图（MindMap Page）
- 使用 `@xyflow/react` 渲染层级节点
- 支持：拖拽移动、缩放、折叠/展开子节点
- 颜色：按层级深度区分节点颜色
- 操作栏：适应屏幕、导出 PNG、切换布局
- 数据来自 `notes.mindmap_data`（AI 生成后可手动调整节点）

### 6. 知识库（Library Page）
- 卡片网格 / 列表切换
- 顶部：搜索框 + 类型筛选（URL/文字/文件/图片/视频）+ 时间排序
- 卡片：标题 + 来源类型 icon + 摘要前 100 字 + 标签 + 时间
- 右键/悬停菜单：查看 / 编辑 / 删除

### 7. 设置（Settings Page）
- 个人资料：头像 / 用户名
- 外观：亮色 / 暗色模式切换
- 隐私：数据全部私密（RLS 说明）
- 账号：修改密码 / 登出

---

## 数据库 Schema（Supabase）

```sql
-- analyses 表（输入记录）
create table analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text,
  source_type text not null, -- 'url'|'text'|'file'|'image'|'video'
  source_content text,
  source_url text,
  status text default 'pending', -- 'pending'|'analyzing'|'done'|'error'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- notes 表（AI 输出内容）
create table notes (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid references analyses on delete cascade,
  user_id uuid references auth.users not null,
  title text,
  summary text,
  key_points jsonb default '[]',
  analysis_content jsonb default '{}',
  tags text[] default '{}',
  mindmap_data jsonb default '{}',
  content_markdown text,
  is_edited boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 行级安全策略（用户只能访问自己的数据）
alter table analyses enable row level security;
alter table notes enable row level security;
```

---

## 组件结构

```
src/
  pages/
    Index.tsx          (Landing)
    Auth.tsx           (登录/注册)
    Dashboard.tsx      (首页总览)
    Analyze.tsx        (内容分析)
    Library.tsx        (知识库)
    Note.tsx           (笔记详情)
    MindMap.tsx        (思维导图)
    Settings.tsx       (设置)
  components/
    layout/
      AppLayout.tsx    (应用壳：侧边栏 + 主内容区)
      Sidebar.tsx      (左侧导航)
    analyze/
      InputPanel.tsx   (输入类型切换面板)
      UrlInput.tsx
      TextInput.tsx
      FileInput.tsx
      AnalysisProgress.tsx  (实时进度动画)
    notes/
      NoteCard.tsx     (知识库卡片)
      NoteViewer.tsx   (查看模式)
      NoteEditor.tsx   (编辑模式)
      DownloadMenu.tsx (下载选项)
    mindmap/
      MindMapCanvas.tsx (react-flow 画布)
      MindMapNode.tsx   (自定义节点)
    dashboard/
      StatsBar.tsx
      RecentNotes.tsx
    auth/
      AuthForm.tsx
  hooks/
    useAuth.ts
    useAnalysis.ts
    useNotes.ts
  lib/
    supabase.ts
    export.ts       (Markdown/PDF/Word 导出工具)
```

---

## Edge Functions

| 函数名 | 功能 |
|--------|------|
| `analyze-content` | 接收内容，调用 LLM，返回结构化分析 JSON |

---

## 新增依赖

- `@xyflow/react` — 思维导图
- `react-markdown` — Markdown 渲染
- `remark-gfm` — GitHub Flavored Markdown 扩展
- `html2pdf.js` — PDF 导出
- `docx` — Word 文档导出

---

## 设计 Token 更新（index.css）

深蓝色系：
- `--primary`: 217 91% 60% (蓝色)
- `--gradient-primary`: 蓝→靛青渐变
- `--gradient-hero`: 暗蓝背景渐变
- 流光动效 + 卡片 hover 光晕

---

## 实施顺序

1. **设计系统** — 更新 index.css 和 tailwind.config.ts
2. **Supabase 集成** — lib/supabase.ts + Auth hooks
3. **数据库建表** — 通过 Edge Function 初始化
4. **Landing + Auth 页面**
5. **AppLayout + Sidebar**
6. **Analyze 页面 + Edge Function**
7. **Note 详情页（查看 + 编辑 + 下载）**
8. **MindMap 页面**
9. **Library 知识库页面**
10. **Dashboard**
11. **Settings 页面**

---

## 验证方式

- 用户可完成注册 → 登录 → 提交 URL 分析 → 查看结构化笔记 → 查看思维导图 → 下载 Markdown
- 退出后重新登录，笔记数据持久化
- 其他账号无法访问自己的笔记（私密性）
