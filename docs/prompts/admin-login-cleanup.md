# 管理端登录页清理

仓库：xiaoyu-xxxx/Kirameku-blog，base `main`。范围限管理端 Vue 登录页，主要在 `Kirameku-backend/admin/src/views/login/`。

### 现状

页面是 vue-pure-admin 演示模板。

- `index.vue` 的 `ruleForm` 硬编码预填 `username: "admin"`、`password: "admin123"`。
- 除账密登录外，还挂了无后端对接的演示入口：手机号登录、二维码登录、注册（`operates` / `currentPage` 1–3，`LoginPhone` / `LoginQrCode` / `LoginRegist`）、忘记密码（跳 `currentPage` 4，`LoginUpdate`）、第三方登录（微信 / 支付宝 / QQ / 微博，`thirdParty`）。
- 真正登录仍只走 `loginByUsername` → `getLogin({ username, password })`。

### 要改

1. 移除无用登录项（UI 与入口一并去掉）
   - 删掉或卸载：手机号登录、二维码登录、注册、忘记密码、第三方登录（图标与分隔文案一起去）。
   - 相关组件若无引用可删：`LoginPhone.vue`、`LoginQrCode.vue`、`LoginRegist.vue`、`LoginUpdate.vue`；清掉 `enums.ts` 里的 `operates` / `thirdParty` 以及 `currentPage` 1–4 的切换。
   - 不再使用的校验（`phoneRules` / `updateRules`）一并清理。

2. 移除默认密码（与账号）填充
   - `ruleForm` 改为空字符串：`username: ""`、`password: ""`、`verifyCode: ""`。
   - 页面任何位置都不要再硬编码演示账密（含 `admin` / `admin123`）。
   - 不要禁止浏览器密码管理器：账号框 `autocomplete="username"`，密码框 `autocomplete="current-password"`。

### 保留

- 账号 + 密码 + 登录按钮（含 Enter）
- 前端图形验证码（`verifyCode` / `ReImageVerify`）
- 记住登录 / 免登录天数
- 右上主题切换、国际化
- 现有布局与视觉（背景、插画、头像、标题动效）、密码强度校验、登录 API 与后端 auth

### 验收

- 无存档身份的清窗口打开登录页：账号、密码为空，不出现 `admin` / `admin123`
- 页面不再出现手机号 / 二维码 / 注册 / 忘记密码 / 第三方登录
- 手工输入正确账密 + 验证码能正常登入
- 浏览器已保存的管理端账号仍可自动填入

不改 mock 代理接口逻辑（除非登录页还在展示默认账密）。
