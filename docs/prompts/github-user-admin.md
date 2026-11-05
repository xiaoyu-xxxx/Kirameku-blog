# GitHub 前台用户管理 · 列表 + 禁用（v1）

**状态：** ready-for-dev  
**日期：** 2026-11-05（Asia/Shanghai）  
**SoT：** docs/prompts/github-user-admin.md  
**范围：** `github_user` 管理 API + PureAdmin 新页；强制禁用用户无法再发评论/留言。  
**不做：** 启用 PureAdmin `views/system/user` 脚手架；硬删除用户（FK）；按用户一键清库（二期）；Cloud Agent；合 main。

## 0. 背景
- 表 `github_user` 已有：id / github_id / login / avatar / bio / created_at；**无禁用字段**；无管理 API。
- 管理端有评论 `/comment`、留言 `/message`、访客 `/visitor`，**没有**前台 GitHub 用户页。
- 发评/留言已要求 GitHub 登录（`401 请先登录 GitHub`）。
- OAuth 现网已通（login → 307 GitHub）；本轮只补管理面与禁用语义。

## 1. 数据模型
`Kirameku-backend/app/models/github_user.py` + `init_db.sql` 同步，并提供可重复执行的迁移（SQL 或启动迁移，生产已有空/少量表）：

```text
is_banned   BOOLEAN NOT NULL DEFAULT FALSE
banned_at   TIMESTAMP NULL
ban_reason  VARCHAR(200) DEFAULT ''
```

索引：`idx_github_user_banned` on (is_banned)；登录名检索用 `login` ILIKE。

## 2. 后端 API（管理端鉴权 `get_current_user`）
新建 `Kirameku-backend/app/api/github_users.py`（或同等命名），挂进 `router.py`。前缀建议：`/api/github-users`。

### 2.1 `GET /api/github-users/admin`
Query：
- `q`：对 `login` / `bio` ILIKE（可空）
- `is_banned`：true/false/省略=全部
- `page` ≥1，`size` 1–100 默认 20

返回优先 `{ items, total }`：
- id, github_id, login, avatar, bio, created_at
- is_banned, banned_at, ban_reason
- comment_count, message_count（含回复；仅计数，不嵌内容）

### 2.2 `GET /api/github-users/admin/{id}`
同上字段 + 最近各最多 5 条评论/留言摘要（id, content 截断 80 字, status, created_at, 类型）。

### 2.3 `PUT /api/github-users/admin/{id}/ban`
Body：`{ "reason": "可选，≤200" }` → `is_banned=true`，`banned_at=now`，写入 reason。

### 2.4 `PUT /api/github-users/admin/{id}/unban`
→ `is_banned=false`，清空 `banned_at`/`ban_reason`。

### 2.5 写路径强制
在 `comment_service.create_comment`、`message_service.create_message`（及 chatter 评论若同依赖 GitHubUser）中：已登录但 `is_banned` → **403** `账号已被禁用，无法发言`。
`GET /api/auth/github/me`：若用户 banned，仍可返回资料，但加 `is_banned: true`（便于前台提示）；**不要**在 `/me` 直接 401。JWT 签发逻辑保持；禁用后旧 token 仍可识别身份，但写操作拒绝。

## 3. 管理端 UI（PureAdmin）
路径对齐评论模块，**新建**勿复用 `views/system/user`：

- 路由：`Kirameku-backend/admin/src/router/modules/github-user.ts`
  - path `/github-user` → `/github-user/index`
  - meta.title：`前台用户`；icon：`ri:github-fill`（或 `ri:user-smile-line`）
  - rank：在 `enums.ts` 增加 `githubUser`，放在 **评论/留言附近**（建议插在 message 后：新增常量并顺延后续 rank +1，或用未占用整数并在注释标明菜单期望顺序）
- 页面：`views/github-user/index.vue`
- API：`api/github-user.ts`

### 3.1 页头
标题「前台用户」| 搜索框（login）| 筛选 全部 / 正常 / 已禁用 | 刷新。
壳参考评论页 `el-card` + `pure-table`；注意 `min-w-0`，整页不横滚（友链改版教训）。

### 3.2 表格列
头像24 | 登录名（可点开 `https://github.com/{login}` 新标签）| bio ellipsis | 评论数 | 留言数 | 状态 Tag（正常/已禁用）| 注册时间 | 操作 fixed：禁用/解禁（popconfirm；禁用可填可选 reason 的小对话框）| 详情（可选抽屉）。

默认分页 page/size；空态「暂无 GitHub 登录用户」。

### 3.3 详情抽屉（一期要做）
展示完整字段 + 最近评论/留言摘要；「去评论管理 / 去留言管理」链到现有页即可。

## 4. 明确不做
- 不接 `system/user`、dept、角色权限脚手架
- 不删 `github_user` 行、不级联删历史评论（禁用即可）
- 不改前台视觉大改；前台若方便可在发评失败时 toast 403 文案（顺手即可）
- 不部署、不合 main

## 5. 验收
1. 菜单出现「前台用户」，tags-view 不被挤  
2. 列表能搜 login、筛禁用  
3. 禁用后该用户带旧 token 发留言/评论 → 403 文案正确；解禁恢复  
4. `/me` 含 `is_banned`  
5. 计数大致正确；详情抽屉有摘要（若做了）  
6. PR open + 本 SoT 已入库；回报 PR 链接与 tip

有歧义先按本 SoT；需要我补线框再说。
