# Fix: NODE_TYPE_CFG missing fallback → crash on unknown node_type

## Context

`TypeError: can't access property "color", L is undefined` — When a note has a `node_type` not in `NODE_TYPE_CFG` (e.g. wiki types like `wiki_overview`), the lookup returns `undefined`, then accessing `.color` crashes.

## Fix

Add fallback `?? NODE_TYPE_CFG['capture']` in both files:

### `src/components/starmap/NodeWindow.tsx` line 55
```ts
const typeCfg = NODE_TYPE_CFG[nodeType] ?? NODE_TYPE_CFG['capture'];
```

### `src/components/starmap/MobileNodeCard.tsx` line 80
```ts
const typeCfg = NODE_TYPE_CFG[(note.node_type as NodeType) ?? 'capture'] ?? NODE_TYPE_CFG['capture'];
```

### `src/components/starmap/NodeWindow.tsx` line 108
Check if `NODE_TYPE_CFG[node_type]` exists before accessing `.label`.

## Verification
- Open a wiki node → no crash, shows capture-style label as fallback
- Open regular capture/insight/action nodes → unchanged behavior
