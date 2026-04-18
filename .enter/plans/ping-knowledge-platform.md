# OCR 白板/文档输入 — MVP 实施计划

## Context

用户希望将现实世界的白板、打印资料、手写草稿、文档截图通过 OCR 输入系统，
经过候选节点确认后接入知识星图和 RAG。

**核心原则**: OCR 结果不直接入主星图，必须经"候选节点确认区"审核后才写入。

---

## 参考 tesseract.js 借鉴点

1. **Worker 异步模型** — tesseract.js 用 Web Worker 隔离 CPU 密集型 OCR，不阻塞 UI
2. **进度回调** — `worker.recognize()` 的 progress callback 提供 `status + progress` 二维状态
3. **延迟加载语言包** — 仅在首次使用时下载 `eng.traineddata` / `chi_sim.traineddata`

MVP 中我们直接在前端使用 tesseract.js（纯 WASM），无需后端 OCR 服务。

---

## 架构设计

```
拍照/上传 → tesseract.js OCR (前端 Worker)
         → 原始文本
         → analyze-content Edge Function (LLM 结构化)
         → 候选节点列表 [主题/要点/行动]
         → 用户确认/编辑/删除
         → 批量写入 notes 表 + chunk-and-index → RAG
```

---

## Step 1: 安装 tesseract.js

```bash
pnpm add tesseract.js@5
```

## Step 2: 创建 OCR Hook — `src/hooks/useOcr.ts`

**职责**: 封装 tesseract.js Worker 生命周期 + 进度状态

```typescript
// 状态机: idle → loading → recognizing → done | error
type OcrStatus = 'idle' | 'loading' | 'recognizing' | 'done' | 'error';

interface OcrState {
  status: OcrStatus;
  progress: number;       // 0-1
  text: string;
  error: string | null;
}

// 核心 API:
// recognize(imageFile: File | Blob) → Promise<string>
// reset() → void
```

- 使用 `createWorker('chi_sim+eng')` 同时支持中英文
- progress callback 映射到 `{ status, progress }` 状态
- Worker 实例缓存，组件卸载时 terminate

## Step 3: 创建 Edge Function — `supabase/functions/ocr-structurize/index.ts`

**职责**: 接收 OCR 原始文本，用 LLM 结构化为候选节点

- 输入: `{ raw_text: string }`
- LLM Prompt: 将文本分为 `topic`(主题)、`keypoint`(要点)、`action`(行动) 三类节点
- 输出:
```json
{
  "candidates": [
    { "type": "topic",    "title": "...", "summary": "...", "tags": [...] },
    { "type": "keypoint", "title": "...", "summary": "...", "tags": [...] },
    { "type": "action",   "title": "...", "summary": "...", "tags": [...] }
  ],
  "raw_cleaned": "清洗后的全文"
}
```

- 使用已有 `AI_API_TOKEN_2c7d5422f5cf` + `google/gemini-3.1-flash-lite-preview`

## Step 4: 创建 OCR 入口 + 确认区组件 — `src/components/ocr/OcrCaptureModal.tsx`

**职责**: 全流程一体化 Modal（上传 → OCR → 结构化 → 确认 → 入图）

### 4 阶段 UI:

**阶段 1: 上传/拍照**
- 虚线拖放区 + 按钮: "选择图片" + "拍照" (mobile: `capture="camera"`)
- 图片预览缩略图
- 支持格式: jpg/png/webp/heic

**阶段 2: OCR 识别中**
- 图片缩略图 + 进度条 (loading → recognizing 0-100%)
- 状态文案: "加载识别引擎..." → "正在识别文字 42%..."

**阶段 3: 候选节点确认区**
- 顶部: 原始 OCR 文本（折叠显示，可展开编辑）
- 候选卡片列表:
  - 每张卡片: 类型标签(主题/要点/行动) + 标题 + 摘要 + 标签
  - 复选框: 默认全选，用户可取消
  - 标题/摘要可内联编辑
- 底部: "确认入图 (N)" 按钮 + "重新识别" 按钮

**阶段 4: 写入完成**
- "已生成 N 个知识星" 成功提示
- 自动 flash 对应节点

### 样式
- 复用项目已有的 glassmorphic 深色风格
- 主色: `#66f0ff`（与 Retrieval pod 呼应——OCR 是一种输入检索）
- MONO + INTER 字体

## Step 5: 候选节点写入逻辑

复用已有的 `insertDerivedNode()` from `useNotes.ts`:
- `topic` → `node_type: 'capture'`
- `keypoint` → `node_type: 'summary'`
- `action` → `node_type: 'action'`

每个写入的节点自动触发 `chunk-and-index` (复用 `useAgentPipeline` 中已有的 RAG 索引模式):
```typescript
supabase.functions.invoke('chunk-and-index', {
  body: { note_id, user_id, content: summary, title, source_type: 'image', universe_id }
});
```

## Step 6: 入口集成

### 6a. CaptureBox — 新增 "OCR" Mode tab
在现有 `TEXT | URL | FILE` 模式行末追加:
```
TEXT | URL | FILE | OCR
```
- icon: `ScanLine` (lucide-react)
- 点击打开 `OcrCaptureModal`

### 6b. MobileTabBar — 无需改动
OCR 入口在 Capture pod 内部，移动端通过 Capture pod → OCR tab 访问。

---

## 文件变更清单

| 操作 | 文件路径 | 说明 |
|------|----------|------|
| 新增 | `src/hooks/useOcr.ts` | tesseract.js Worker 封装 |
| 新增 | `supabase/functions/ocr-structurize/index.ts` | LLM 结构化候选节点 |
| 新增 | `src/components/ocr/OcrCaptureModal.tsx` | 全流程 Modal |
| 修改 | `src/components/pods/CaptureBox.tsx` | 添加 OCR mode tab + 打开 Modal |
| 修改 | `src/types/index.ts` | 确认 `'image'` 已在 SourceType 中（已存在） |

---

## 污染防护设计

1. **候选节点确认区** — OCR 结果必须经用户审核才能入图
2. **可编辑** — 用户可修改 title/summary/tags，删除不需要的候选
3. **source_type: 'image'** — 所有 OCR 生成的节点标记来源类型，可追溯
4. **原始文本保留** — raw_cleaned 存入主 capture 节点的 content_markdown

---

## 验证方法

1. 在 CaptureBox 点击 OCR tab → 弹出 OcrCaptureModal
2. 上传一张白板照片 → 进度条走完 → 显示 OCR 文本
3. LLM 结构化后出现候选节点卡片
4. 编辑/取消选择部分节点 → 点击"确认入图"
5. 星图中出现对应新节点 + RAG 可检索到 OCR 内容
