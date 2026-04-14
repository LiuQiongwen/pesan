# Agent-Driven Pod Workflow — Implementation Plan

## Context
The 5 pods (Capture, Retrieval, Insight, Memory, Action) currently operate as isolated floating panels with no awareness of each other. The user wants them to feel like cooperative steps in a single cognitive agent workflow: content flows automatically between pods, only one or two pods are visible at a time, and the bottom dock becomes a workflow guide showing progress and recommendations.

---

## Architecture Overview

### New: AgentWorkflowContext
Shared state for cross-pod content relay and active-step tracking.

```typescript
// src/contexts/AgentWorkflowContext.tsx
interface AgentWorkflowState {
  activeStep: PodId | null;
  workflowContent: string | null;    // content currently being relayed
  workflowSource: PodId | null;      // which pod originated content
  completedSteps: PodId[];
  setActiveStep(step: PodId | null): void;
  relay(content: string, from: PodId, to: PodId): void; // sets content + opens target pod as primary
  clearWorkflow(): void;
}
```

### Modified: ToolboxContext — Primary/Secondary/Capsule enforcement
Add `primaryPod` + `secondaryPod` tracking. When `openPod(id)` is called:
1. If `primaryPod` exists → it becomes `secondaryPod` (stays visible but border dimmed)
2. If `secondaryPod` exists → it enters "capsule" state (compact pill, not fully closed)
3. New pod becomes `primaryPod`

Add computed: `podViewMode(id): 'primary' | 'secondary' | 'capsule' | 'closed'`

### New: FloatingCapsule component
Compact 36px pill with icon + label, docked in a right-side vertical stack. Click expands back to primary.

---

## Files

### 1. NEW `src/contexts/AgentWorkflowContext.tsx`
- `AgentWorkflowProvider` wraps layout
- `relay(content, from, to)` → sets `workflowContent` + calls `openPod(to)` in ToolboxContext → target pod auto-opens as primary and reads the content
- `completedSteps[]` grows as pods finish processing

### 2. MODIFY `src/contexts/ToolboxContext.tsx`
- Add `primaryPod: PodId | null`, `secondaryPod: PodId | null`
- Update `openPod` / `togglePod` to enforce 1+1 rule
- Add `podViewMode(id): 'primary' | 'secondary' | 'capsule' | 'closed'`
- Capsule pods remain open=true, zIndex stored, but rendered as capsule

### 3. NEW `src/components/floating/FloatingCapsule.tsx`
- Renders when `podViewMode === 'capsule'`
- Vertical stack of pills anchored to right edge (bottom-right, stacked up)
- Each pill: 32px icon circle + accent dot + label on hover
- Click → `openPod(id)` which promotes to primary

### 4. MODIFY `src/components/floating/FloatingPod.tsx`
- Accept `mode: 'primary' | 'secondary'` prop
- Primary: full brightness, border accent full opacity
- Secondary: slightly dimmed (0.65 opacity on border/header), "secondary" badge in header
- No other changes

### 5. MODIFY `src/components/floating/CommandDock.tsx`
**Full redesign as workflow pipeline guide:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  [●CAPTURE] ──→── [RETRIEVAL] ──→── [INSIGHT] ──→── [MEMORY] ──→── [ACTION]   平  │
│   active          ★next                                                          │
└─────────────────────────────────────────────────────────────────────┘
```

- Each step shows: icon + label + step number
- Active step: accent color + glow ring
- Completed steps: accent color + checkmark dot
- Recommended next: subtle pulse + "→ 推荐" badge below label
- Click any step to open that pod as primary
- Connection lines between steps (SVG horizontal dashes)

### 6. NEW `src/components/layout/AgentTrail.tsx`
Fixed center overlay, only visible when `activeStep !== null`:
- Shows a breadcrumb-style horizontal path of completed + active steps
- Connected by animated dashes with a moving particle
- Fades out after workflow completes (3s delay)
- Positioned top-center, below HUD, z-index 5 (behind pods but above star map)

```
[Capture ✓] --→-- [Retrieval ●] --→-- [Insight ○] --→-- [Action ○]
```

### 7. MODIFY `src/components/layout/StarMapLayout.tsx`
- Add `AgentWorkflowProvider` wrapper
- Replace `FloatingPod` wrapper with `SmartPodShell` (internally picks `FloatingPod` vs `FloatingCapsule`)
- Pass `onRelay` to each pod for content forwarding

### 8. MODIFY `src/components/pods/CaptureBox.tsx`
**Add Intent Types + Routing Preview:**
- 5 intent chips below the mode selector: `原料 | 想法 | 问题 | 待分析 | 待执行`
- Each intent has a routing preview row: "→ 建议处理链：Capture → Retrieval → Insight → Action"
- After agent completes: show "委托下一步" button that calls `relay(result, 'capture', 'retrieval')`

### 9. MODIFY `src/components/pods/RetrievalBox.tsx`
**Add Search/Ask Toggle + Send to Insight:**
- Header toggle: `[SEARCH] [ASK]`  
  - Search: keyword search, returns list of matching note cards (each with "加入星图" = highlight, "+ 节点" = flash-note, "→ 洞察" = relay to Insight)
  - Ask: current RAG behavior (answer + citations)
- Both result types get a "→ 发送至洞察舱" button at bottom
- Results show source node type badge (capture/insight/summary)

### 10. MODIFY `src/components/pods/InsightBox.tsx`
**Auto-receive + Interpretation Modes + Send to Action:**
- Listen to `workflowContent` from context; if present and source is 'capture'/'retrieval', auto-populate the note selector or a content textarea
- Add mode selector: `摘要 | 研究 | 写作 | 反思` (4 modes change the system prompt passed to distill-insight edge function)
- Output layers: Summary / Key Points / Insights / Next Step (renamed from actionables)
- Footer: "→ 发送至行动舱" button that relays output to Action

### 11. MODIFY `src/components/pods/MemoryBox.tsx`
**Contextual resurfacing + "why it appears" + 4 actions:**
- Each card gets a "relevance reason" chip: "与 [hovered-note-title] 共享 N 个标签" or "最近访问" or "上周记录"
- 4 action buttons per card (only visible on hover): `连接 | 检视 | 蒸馏 | 稍后`
  - 连接: `relay(card.summary, 'memory', 'insight')`
  - 检视: navigate to note
  - 蒸馏: `relay(card.summary, 'memory', 'insight')`
  - 稍后: adds a visual "saved for later" tag (client-only, not persisted)

### 12. MODIFY `src/components/pods/ActionBox.tsx`
**Auto-receive from workflow context:**
- If `workflowContent` is set and source is 'capture'/'retrieval'/'insight', auto-fills the textarea (shows "已从[洞察舱]接收内容" banner)
- Remove "粘贴洞见" placeholder, replace with "内容已由 Agent 路由" when pre-filled
- Add "清空并手动输入" small link below the banner

---

## Implementation Order

1. `AgentWorkflowContext.tsx` (new foundation)
2. `ToolboxContext.tsx` (add primary/secondary/capsule logic)
3. `FloatingCapsule.tsx` (new component)
4. `CommandDock.tsx` (redesign)
5. `AgentTrail.tsx` (new)
6. `FloatingPod.tsx` (mode prop)
7. `StarMapLayout.tsx` (wire everything)
8. `CaptureBox.tsx` (intent chips + relay)
9. `RetrievalBox.tsx` (Search/Ask + relay)
10. `InsightBox.tsx` (modes + auto-receive + relay)
11. `MemoryBox.tsx` (why it appears + actions)
12. `ActionBox.tsx` (auto-receive)

---

## Key Design Decisions

- **Capsule stack position**: right edge, vertically stacked, bottom-aligned (won't overlap star map center)
- **Relay = openPod**: when content is relayed to a pod, that pod opens as primary (pod slot cascade applies)
- **AgentTrail**: top-center strip, only shown during active workflow, hidden when no `activeStep`
- **Intent types**: purely visual/UX — affects routing preview copy, does NOT change the AI pipeline
- **No new edge functions needed**: all changes are frontend context + component UI
