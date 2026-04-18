# Fix: onNodeDropToPodRef is not defined

## Context
CosmosScene.tsx line 1702 passes `onNodeDropToPodRef.current` to NodeWindow's `onDropToPod` prop. But `onNodeDropToPodRef` is a ref defined inside the child `ImperativeCore` component (line 219), while NodeWindow is rendered in the outer `CosmosScene` component (line 1696). The outer component only has `onNodeDropToPod` (plain prop, line 1500).

## Fix
**File**: `src/components/starmap/CosmosScene.tsx`  
**Line 1702**: Change `onDropToPod={onNodeDropToPodRef.current}` → `onDropToPod={onNodeDropToPod}`

## Verification
Click a star node — NodeWindow should open without error. Agent action buttons should work correctly.
