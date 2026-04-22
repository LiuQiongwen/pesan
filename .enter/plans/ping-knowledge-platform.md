# QR Anchor: Guide Center section + CreateAnchorModal step guide

## Context
User wants QR anchor feature to be better documented in-app: explain what it does, how to create/scan/use anchors, and how to get QR codes.

## Plan

### 1. GuideCenterModal — add "现实锚点" section
Add a new section after "移动端操作" with items:
- **创建 QR 锚点**: 右键节点 → QR 锚点，生成专属二维码
- **扫描锚点**: 设置 → QR 锚点扫码，打开摄像头扫描
- **NFC 轻触**: 创建锚点后可写入 NFC 标签，手机靠近即跳转
- **打印使用**: 下载二维码打印贴到书/物品/墙上，扫码直达知识节点

### 2. CreateAnchorModal — add step guide before form
Add a 3-step visual guide at the top of the modal (before label input):
1. 创建 → 输入标签，选择锚点类型，生成二维码
2. 部署 → 下载打印贴到现实物体，或写入 NFC 标签
3. 使用 → 用手机扫码/NFC 轻触，直达知识节点

Also add a "如何获取二维码" hint below the QR display after creation.

## Files
- `src/components/tour/GuideCenterModal.tsx` — add REALITY ANCHOR section
- `src/components/anchors/CreateAnchorModal.tsx` — add step guide UI
