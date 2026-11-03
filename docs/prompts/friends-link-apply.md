# 友链申请 · 博客入口 + 管理端审核（v1）

**状态：** handoff-ready v1.2（仅页头申请按钮；弹层 token 对齐现网详情弹窗；交「博客前端重构」落地）  
**日期：** 2026-11-03（Asia/Shanghai）  
**线上页：** https://blog.xiaoyu-hh.cn/friends  
**线框：** `/workspace/friends-apply/friends-apply-mock.html`  
**范围：** 博客 `/friends` 申请入口 + 公开申请 API + 管理端审核轻量强化；**Cloud Agent OFF**；不合 main / 不部署，待确认。  
**不做：** R2；Demo；改漂流瓶散落算法；公开端头像文件上传（仅 URL）。

---

## 0. 现状结论（已摸仓 / 现网）

### 博客端（Kirameku Next）

| 项 | 现状 |
|---|---|
| 页面 | `Kirameku/app/friends/page.tsx`：页头「友链」+ 漂流瓶散落 + 底部文案「点击漂流瓶查看朋友详情 · 欢迎交换友链」+ 玻璃详情弹窗 |
| 公开 API 客户端 | `app/api/friends.ts` → `GET /api/friend-links`；**无申请方法** |
| 视觉语气 | liquid glass：`bg-white/70 dark:bg-slate-800/80 backdrop-blur-2xl`、`rounded-2xl/3xl`、主色 `sky-500`、页头 `Users` 图标 |

### 后端 / 管理端（已有大半）

| 项 | 现状 |
|---|---|
| 表 | `friend_link`：`name/url/avatar/description/sort/is_approved/created_at/updated_at` |
| 公开列表 | `GET /api/friend-links` → **仅** `is_approved=True` |
| 管理列表 | `GET /api/friend-links/admin`（需登录）→ 含未审核 |
| 写接口 | `POST/PUT/DELETE /api/friend-links[...]` **全部依赖 `get_current_user`**；现网匿名 `POST` → **403** |
| 创建默认 | Model 默认 `is_approved=False`；`FriendLinkCreate` **不含** `is_approved`（Pydantic 会忽略多余字段） |
| 管理 UI | `admin/src/views/friend-link/index.vue`：列表 + 状态 Tag 点击切换审核 + 新增/编辑（含审核开关） |

**缺口（本 SoT 要补）：**

1. 博客端无申请入口（只有欢迎文案）。  
2. **无公开申请 API**（不能复用需登录的 `POST /api/friend-links`）。  
3. 管理端缺「待审核」筛选 / 角标（功能可用但审核队列不醒目）。

---

## 1. 信息架构 / 用户流

```
访客 /friends
  → 页头幽灵胶囊「申请友链」
  → 玻璃弹层表单（同详情弹窗语汇）
  → POST /api/friend-links/apply （强制 is_approved=false）
  → 成功态「瓶子已投放，等待审核」
      ↓
站长 管理端 · 友链管理
  → 默认或一键筛「待审核」
  → 点状态 Tag / 开关 → 通过
      ↓
公开 GET /api/friend-links 出现该友链 → 漂流瓶区可见
```

拒绝：管理端删除记录（或保持未通过且不出现在公开列表）；**不做访客自查进度页（v1）**。

---

## 2. 博客 UI（必须克制，不突兀）

### 2.1 入口放置（唯一）

**唯一入口：** 页头右侧幽灵胶囊「申请友链」，与 `h1` 同一行 `justify-between`；移动端折到副标题下方。

- 样式：极淡 glass 幽灵胶囊 `rounded-full border border-white/40 dark:border-white/10 bg-white/40 dark:bg-slate-800/40 px-2.5 py-0.5 text-sky-600/90 dark:text-sky-400 text-xs font-semibold`（与详情弹层语汇同族）。  
- 底部 tip **保持现网文案** `点击漂流瓶查看朋友详情 · 欢迎交换友链`，**不加**申请文字链、不加第二入口。  
- **禁止：** 底部申请 tip、全宽实心大按钮、强对比色块、打断散落区的 sticky 条、散落区假瓶子入口。

### 2.2 申请弹层

复用详情弹窗骨架（`AnimatePresence` + 同款 scrim / glass）：

| 元素 | 说明 |
|---|---|
| 标题 | 「投放一只漂流瓶」 |
| 副文 | 「填写后进入审核；通过后会出现在友链海面。」 |
| 字段 | 见 §3；表单区 `text-left`，标题/副文/按钮区仍居中 |
| 主按钮 | 与详情「访问主页」同款「投递」 |
| 次按钮 | 文字「取消」+ 右上角 X（同详情关闭钮） |
| 成功态 | 同卡内替换：渐变圆标 + 短句 +「好的」；**不**整页跳转 |
| 错误态 | 卡内红字或 toast（若项目已有 `ToastProvider` 可复用） |

### 2.4 弹层 / 入口 Token（对照 `app/friends/page.tsx` 详情弹窗，必须对齐）

| Token | 值（Tailwind / 实现） |
|---|---|
| Scrim | `bg-black/40 backdrop-blur-sm` |
| 卡片宽 | `w-full max-w-xs`（**不是** max-w-sm） |
| 卡片圆角 | `rounded-2xl md:rounded-3xl` |
| 卡片面 | `bg-white/70 dark:bg-slate-800/80 backdrop-blur-2xl border border-white/50 dark:border-white/10 shadow-2xl` |
| 卡片内边距 | `p-5 md:p-8` |
| 关闭钮 | `absolute top-3 right-3 md:top-4 md:right-4 w-6 h-6 md:w-7 md:h-7 rounded-full bg-white/50 dark:bg-slate-700/50 text-slate-400` |
| 标题 | `text-base md:text-lg font-bold text-slate-800 dark:text-white mb-1.5 md:mb-2` |
| 副文 | `text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4 md:mb-6` |
| 主 CTA | `rounded-full bg-sky-500 hover:bg-sky-600 text-white text-xs md:text-sm font-medium px-4 py-2 md:px-6 md:py-2.5 shadow-lg shadow-sky-500/20` |
| 次按钮 | 透明文字 `text-slate-400 text-xs font-medium` |
| 字段 label | `text-[11px] font-semibold tracking-wide text-slate-500`；必填 `*` 用 `text-sky-500` |
| 字段控件 | `rounded-xl border border-white/40 dark:border-white/10 bg-white/55 dark:bg-slate-900/40 px-3 py-2.5 text-[13px]`；focus `ring` sky 淡圈 |
| 脚注 | `text-[10px] text-slate-400` |
| 页头入口胶囊 | 对齐瓶子名条：`rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-white/40 dark:border-white/10 px-2 py-0.5 md:px-3 md:py-1 text-[10px] md:text-xs font-bold text-sky-700/90 dark:text-sky-300` |

暗色模式：卡片 / 边框 / 关闭钮 / 输入底 **必须**带上表 `dark:`，与详情弹窗同族，禁止另起一套灰阶。

### 2.3 不做

- 不改瓶子散落 / 拖拽逻辑。  
- 不在散落区塞「假瓶子」当入口（易与真友链混淆）。  
- 不要求登录才能申请（与留言不同；友链交换通常匿名）。

---

## 3. 表单字段

| 字段 | 必填 | 约束 | 映射 DB |
|---|---|---|---|
| 站点名称 `name` | ✓ | 1–100 字 | `name` |
| 站点链接 `url` | ✓ | `http(s)://`，≤300 | `url` |
| 头像链接 `avatar` | 可选 | URL ≤500；**仅填链接，不上传文件** | `avatar` |
| 简介 `description` | 可选 | ≤300 | `description` |
| 邮箱 / 联系 `contact` | 可选 v1 | 仅后端日志或扩展列；**若不加列则 v1 不收** | 见 §4 |
| 蜜罐 `website`（隐藏） | — | 填了则静默成功、不落库 | — |

文案提示（表单脚注，小字）：「建议互链本站；头像请使用可公网访问的图片 URL。」

校验：前端即时 + 后端再验；非法 URL → 400。

---

## 4. API / DB

### 4.1 已有（保留）

- `GET /api/friend-links` — 公开已审核  
- `GET /api/friend-links/admin` — 全量  
- `PUT /api/friend-links/{id}` — 含 `is_approved`  
- `DELETE /api/friend-links/{id}`  
- 表结构 **足够支撑 v1**，可不加列

### 4.2 新增（必须）

`POST /api/friend-links/apply`（**公开、无登录**）

请求体：

```json
{
  "name": "某站",
  "url": "https://example.com",
  "avatar": "https://…/avatar.png",
  "description": "一句话介绍",
  "website": ""
}
```

行为：

1. 蜜罐非空 → 返回与成功同形的假成功（防爬），不写库。  
2. 校验 name/url；强制 `is_approved=False`，`sort=0`（或排到末尾策略由实现定，默认 0）。  
3. **禁止**客户端传 `is_approved` / `sort` 生效。  
4. 建议：同 IP / 同 url 短时限流（如 10 分钟 3 次；同 url 未审核重复则 409 或更新描述——**推荐 409「已有待审申请」**）。  
5. 响应：`FriendLinkOut` 或精简 `{ ok: true, id }`；**不要**在公开响应里强调可伪造的审核态文案以外的内部字段滥用。

**不要**把现有 `POST /api/friend-links` 改成匿名；管理端创建仍走鉴权 POST。

### 4.3 可选扩展（非 v1 阻塞）

- `contact_email` 列：方便站长回信。  
- `source=apply|admin` 列：区分来源。  
- 审核通过 webhook / 邮件：不做。

### 4.4 博客客户端

`app/api/friends.ts` 增加：

```ts
export function applyFriendLink(data: {
  name: string;
  url: string;
  avatar?: string;
  description?: string;
  website?: string;
}) {
  return request<…>("/api/friend-links/apply", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
```

---

## 5. 管理端 UX（轻量）

现有「状态 Tag 点击切换」**保留**为通过/取消主路径。

建议补（工作量小）：

1. 顶栏筛选：`全部 | 待审核 | 已通过`（前端 filter 即可，不必新 API）。  
2. 「待审核」数量 Badge（列表里 `!is_approved` 计数）。  
3. 待审行可视觉弱高亮（如左侧 sky 条或 warning Tag 已够）。  
4. 新增友链默认：管理端手动新增可继续默认「通过」——若 Create schema 仍忽略 `is_approved`，落地时 **一并修**：管理 `POST` 允许 `is_approved` 或创建后立刻 PUT（二选一，写进验收）。

---

## 6. 视觉语气清单（验收对照）

- [ ] 唯一入口是页头幽灵胶囊「申请友链」；底部 tip 无申请链；不是实心大 Banner  
- [ ] 弹层 token 按 §2.4：`max-w-xs`、`rounded-2xl md:rounded-3xl`、`white/70`、`blur-2xl`、sky CTA 与详情弹窗一致  
- [ ] 明暗色均可读（`dark:` 对齐现页）  
- [ ] 散落区高度与瓶子交互无回归  
- [ ] 移动端弹层 `max-w-xs` + `p-5` 不溢出；md 起 `p-8`

---

## 7. 验收清单

### 博客

1. `/friends` 可见申请入口；点击打开玻璃表单。  
2. 必填校验；投递成功后成功态；关闭后列表不出现未审核站。  
3. 刷新公开 API 仍不含该条。  

### 后端

4. 匿名 `POST /api/friend-links/apply` → 201/200 且 DB `is_approved=false`。  
5. 匿名 `POST /api/friend-links` 仍 401/403。  
6. 蜜罐 / 限流按约定行为。  

### 管理端

7. 友链管理可见待审；一键通过后公开列表与漂流瓶出现该友。  
8. 取消审核后公开消失。  

### 流程约束

9. 本地分支实现；开 PR 保持 open；**不**合 main / **不**部署直至设计师/用户点头。  
10. Cloud Agent 不启用。

---

## 8. 实现分工建议

| 角色 | 任务 |
|---|---|
| 设计师（本 SoT） | IA / 视觉 / 验收；线框 |
| 博客前端重构 | `/friends` UI + `friends.ts` apply；对接 apply API |
| 后端（同仓 Kirameku-backend，可由前端重构或运维协） | `POST …/apply` + 限流/蜜罐；可选管理端筛选项 |
| 独立站运维 | 仅部署阶段介入；本阶段不部署 |

---

## 9. 下一步

1. ~~用户确认~~ → v1.2 已定：仅页头「申请友链」+ §2.4 token；邮箱 v1 不收。  
2. **交 博客前端重构**：本地分支 + PR open；Cloud Agent OFF；不合 main / 不部署。  
3. 设计师按 §7 + §6 验收后再谈合入。
