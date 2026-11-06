# 发言链前台严谨 + 简历登录门禁（v1）
**状态：** ready-for-dev
**日期：** 2026-11-06（Asia/Shanghai）
**仓库：** xiaoyu-xxxx/Kirameku-blog（main tip 含 PR #35）

## 背景（审计结论摘要）
- 后端写路径已齐：登录强制 + `assert_not_banned` → 403「账号已被禁用，无法发言」。
- 前台缺口：`GitHubUser` 无 `is_banned`、三页不读 `/me.is_banned`；`client.ts` 不解析 FastAPI `detail`；说说页 catch 写死「发送失败」。
- 简历 `/resume` + Navbar 公开，`resumeData.ts` 打进包。本档只做**前台门禁**（不迁后端 API、不移出 bundle）。

## 范围 A · 发言链前台
1. **类型**：`GitHubUser`（及 `/me` 映射）增加 `is_banned: boolean`（及可选 `ban_reason` 若后端有返回则透传，没有则不要编）。
2. **统一错误**：`Kirameku` 的 API client 解析 JSON `detail`（string 或 `{msg}`/`[…]` 常见 FastAPI 形），抛出可读中文；403 优先展示后端文案。
3. **三页 UX**（评论 `PostComments` / 留言 `messages/page` / 说说 `moments/page`）：
   - 有 token 时拉 `/me`；`is_banned===true` → 输入区禁用 + 明确提示「账号已被禁用，无法发言」（勿再显示可写框）。
   - 发送失败：展示解析后的 `detail`，禁止写死「发送失败」盖住 403。
4. **明确不做（本 PR）**：JWT 加 `exp`、OAuth `state`、token 改 cookie/fragment、点赞鉴权、发言改审核闸。可在 SoT「后续」一笔记一笔。

## 范围 B · 简历前台门禁
1. **Navbar**：仅当存在有效 `github_token`（建议以 `/me` 成功为准；若 `is_banned` 仍可看简历——禁言≠禁看，除非你发现产品另有约定）才显示「简历」链接。
2. **`/resume` 页**：无 token → 不渲染 `ResumeView` 正文；占位「请先使用 GitHub 登录后查看简历」+ 登录按钮；登录前写 `sessionStorage.github_redirect=/resume`。
3. **有 token**：渲染现有 `ResumeView`（数据仍可来自 `resumeData.ts`，本档不迁 API）。
4. **不做**：后端 `GET /api/resume`、把 `resumeData` 移出前端包、middleware 硬 404（token 在 localStorage，middleware 看不到）。

## 验收
1. 未登录：导航无「简历」；直开 `/resume` 见占位 + 可登录并回跳。
2. 登录后：导航有「简历」，页可看全文。
3. 被禁用户：评论/留言/说说输入禁用且提示禁言；若强行调 API，前端展示「账号已被禁用，无法发言」。
4. 正常用户发送失败时能看到后端 detail。
5. SoT 入库；PR open。

## 约束
本地分支改码；不合不部署；Cloud Agent OFF。

## 后续（本 PR 不做）
- JWT 加 `exp` / 刷新策略
- OAuth `state` 防 CSRF
- token 改 cookie / fragment 传递
- 点赞接口鉴权
- 发言改审核闸 / 前台审核态
- 简历数据迁后端 API、移出前端 bundle、middleware 硬门禁
