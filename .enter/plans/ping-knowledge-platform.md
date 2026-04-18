# Fix: 注册按钮点击无反应

## Context
用户反馈注册按钮点击后没有任何反应。根因分析：
1. `<form>` 使用了 HTML5 原生验证（`required` + `type="email"`），在 iframe 预览环境中浏览器无法显示验证气泡提示，导致表单被静默阻止提交
2. 浏览器密码管理器在 iframe 中自动弹出也可能干扰用户操作

## Fix — `src/pages/Auth.tsx`

### 1. 给 `<form>` 添加 `noValidate` 属性
禁用浏览器原生验证，改用自定义 JS 验证逻辑

### 2. 在 `handleSubmit` 中添加手动验证
- 检查 email 是否为空
- 检查 email 格式是否合法
- 检查 password 是否为空
- 对应显示 toast 错误提示

### 3. 给 Input 添加 `autoComplete` 属性
- email: `autoComplete="email"`
- password: `autoComplete="current-password"` (login) / `autoComplete="new-password"` (register)
- 减少密码管理器干扰

## 验证
- 在注册模式下，空表单点击注册 → 应出现 toast 提示"请输入邮箱"
- 输入无效邮箱 → toast 提示"邮箱格式不正确"
- 正常输入 → 调用 signUp 成功跳转
