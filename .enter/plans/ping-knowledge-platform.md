# Capture 输入提示

## Context

新用户首次打开 Capture Pod 或宇宙为空时，需要一个明确的引导提示告诉他们"输入内容可以生成知识星"。提示在首次成功提交后永久消失。

## 方案：内嵌引导区（非气泡）

选择在 textarea 上方、routing preview 下方插入一个内嵌的引导区块，而非外部气泡。理由：
- Capture Pod 内部空间紧凑，内嵌引导和输入区在同一视觉流中更自然
- placeholder 只有聚焦才能看到，引导区块始终可见且更醒目
- `pointerEvents: none` 不阻塞任何交互

## 修改文件

### 1. `src/components/pods/CaptureBox.tsx`
- 导入 `useHintState`
- 在组件内调用 `hints.shouldShowHint('first_create_star')` 判断是否展示
- 在 `{!showPipeline && (` 输入区域块（line 174）的 `<div>` 内，textarea 之前，插入引导区块：
  ```
  {showCaptureHint && (
    <div style={{ ... 无边框淡绿引导样式 ... pointerEvents: 'none' }}>
      <p>输入一句想法，生成第一颗知识星</p>
      <p>你的输入不会只是被保存，而会被编译成知识节点</p>
    </div>
  )}
  ```
- 样式：淡绿背景 `rgba(0,255,102,0.04)`，绿色主文案 + 更淡的副文案，圆角 6px，8px 内边距
- `pointerEvents: 'none'` 确保不遮挡

### 2. 消失条件
- 已有逻辑：StarMapLayout 在 noteCount 从 0→1+ 时调用 `hints.markCompleted('first_create_star')`
- CaptureBox 读取 `shouldShowHint('first_create_star')` — 当 completed 后自动返回 false → 区块消失
- 无需新增任何 hint key 或 action_feedback 联动

### 3. 不需修改的文件
- `useHintState.ts` — `first_create_star` key 已存在，`noteCount === 0` 的上下文判断已正确
- `StarMapLayout.tsx` — `markCompleted('first_create_star')` 已在 noteCount 变化时触发
- `PodWelcomeHint.tsx` — 保留不变，它是通用 pod 欢迎语；新引导区块是 Capture 专属的更醒目版本

## Verification
1. 新用户（无节点）→ 打开 Capture Pod → 看到绿色引导区块
2. 输入内容提交成功 → noteCount 变为 1 → 引导区块消失
3. 再次打开 Capture Pod → 引导区块不再出现
4. 引导区块不遮挡 textarea 的点击/输入
