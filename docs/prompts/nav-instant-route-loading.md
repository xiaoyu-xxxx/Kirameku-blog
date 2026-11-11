# 菜单先切路由再 loading 内容（v1）

**状态：** handoff-ready v1  
**日期：** 2026-11-11（Asia/Shanghai）  
**线上：** https://blog.xiaoyu-hh.cn 顶栏/移动菜单/Tab 径向菜单跨页跳转  
**范围：** 前台公开站跨路由导航的即时反馈与内容区骨架；**Cloud Agent OFF**；本地分支 + PR open；不合 main / 不部署直至设计师验收 + 用户「合并推送」。  
**不做：** R2 / Demo；不重做 WelcomeScreen；不改 OML2D / 接口契约；不回退 #28 页内分类乐观切换与各页数据骨架。

---

## 0. 现状结论（已摸仓 main，Next 16.2.4）

- `Navbar`（`Kirameku/components/layout/Navbar.tsx`）用 `<Link>` + `usePathname()` 决定高亮；移动菜单同理。
- `RadialMenu` 用 `router.push`，同样等 `pathname`。
- 根 layout 的 `<main>{children}</main>` 外是 Navbar 等壳层；**全站没有路由级 `loading.tsx`**。
- Next App Router 默认：目标页 RSC/JS 未就绪前保持当前页，地址栏和高亮都不动。弱网体感是「点菜单没反应」。
- #28（`nav-nonblocking-loading`）只修了页内筛选（如 `/posts` 分类）和挂载后的 `ContentSkeleton`；跨菜单跳转未覆盖。
- 已有 `Kirameku/components/ui/ContentSkeleton.tsx`（`PostCardGridSkeleton` / `PostDetailSkeleton` / `ListBlockSkeleton` / `BookmarkGridSkeleton` / `PhotoWallGridSkeleton` / `FriendsScatterSkeleton` / `TimelineRiverSkeleton`），直接复用。
- 仓库里的 `PageTransition`（全屏 z-[9998] 遮罩，等 pathname 变化后才出现约 400ms）既救不了点击无反馈，还会盖住导航。本次禁止使用；若已挂到壳层请卸掉，不要接到这次导航上。

---

## 1. 体验原则

1. **点击立刻响应**：目标菜单项立即高亮（含底部指示点）；不必等 `usePathname()` 更新。
2. **先换路由意图，再 loading 内容**：主内容区立刻离开旧页，换成目标路由对应骨架；壳层（顶栏、主题、设置、音乐控件）保持可点。
3. **可打断**：跳转未完成时可再点其它菜单或 Logo；以最后一次点击为准。
4. **加载只占 `<main>`**：禁止新的全屏 `fixed inset-0` 且挡住 Navbar 的遮罩（含传送门/Tips 全屏）。
5. **`/garden`、`/auth` 不走这套公开页骨架**（花园仍隐藏主站导航，逻辑保持现状）。

目标流：

```
点菜单 / Logo / 松开 Tab 径向项
  → 立刻 setPendingHref(目标路径) + 菜单高亮切到目标 + 移动菜单关闭
  → 主内容区立刻渲染该路径骨架（旧页不再停留）
  → 发起 Next 导航（Link 或 router.push）
  → pathname 追上 pending 后交给目标 page；页内再按 #28 拉数与骨架
  → 期间可再点其它项，覆盖 pending 并改骨架
```

---

## 2. 实现要点（P0，同 PR）

### 2.1 共享待跳转状态

抽一个轻量 client provider（名称自定，如 `NavigationPendingProvider`），由根 layout 包在 Navbar 与 `<main>` 都能读到的位置。

- `pendingHref: string | null`；点击站内前台路由时立刻写入。
- 展示路径：`pendingHref ?? pathname`。Navbar 桌面/移动、Logo、RadialMenu 高亮都用展示路径（`/` 仍精确匹配，其它 `startsWith` 规则与现网一致）。
- `pathname` 已等于或已落到该路由时清空 pending（含浏览器前进/后退）。
- 同路径连点可忽略；不同路径必须立刻切换 pending。

把「声明即将去哪」集中在一处，避免只改 Navbar、径向菜单仍等 pathname。站内其它指向公开页的 `Link`/`router.push` 能接就接（至少壳层入口必须接）。

### 2.2 主内容区乐观换骨架

在 `<main>` 内：当 `pendingHref` 存在且与当前 `pathname` 还不是同一路由时，**不要继续展示旧页 children**，改为按 `pendingHref` 选骨架。

这层不要等 Next 提交导航（只靠 `loading.tsx` 不够，弱网下 URL 也可能晚更新）。

骨架映射（没有专用变体就用 `ListBlockSkeleton` 或同等简洁块，不要大 Spinner）：

| 目标路径 | 骨架 |
|---|---|
| `/` | 简洁首页块（标题/卡片条即可，勿新造复杂欢迎动画） |
| `/posts` | `PostCardGridSkeleton` |
| `/posts/[slug]` | `PostDetailSkeleton` |
| `/moments` `/messages` | `ListBlockSkeleton` |
| `/timeline` | `TimelineRiverSkeleton` |
| `/bookmark` | `BookmarkGridSkeleton` |
| `/photowall` | `PhotoWallGridSkeleton` |
| `/friends` | `FriendsScatterSkeleton` |
| `/novel` `/music` `/resume` `/about` 及其它公开页 | `ListBlockSkeleton` 或同等页壳骨架 |

骨架外保留与各页大致相当的内边距，避免闪到贴边。简历门禁（ResumeGate）仍只在 `/resume` 页本身，乐观骨架阶段不必提前做登录判断。

### 2.3 路由级 `loading.tsx`

为公开页补路由级 `loading.tsx`，让地址栏尽早切到目标路由；骨架选择与 2.2 同一套映射（可用小的 client 组件读 pathname）。

不要用根 `app/loading.tsx` 误伤 `/garden`、`/auth`。优先 route group（如 `app/(site)/…`）只包公开页；若移动成本高，也可用分段 `loading.tsx`，但须覆盖 Navbar 里全部公开项（含详情 `/posts/[slug]`）。说明采取了哪种结构。

### 2.4 明确不要做的

- 不要启用或改接 `PageTransition` 全屏遮罩；已挂载则卸载。
- 不要改 WelcomeScreen、品牌色、接口、Demo/R2。
- 不要为进度条新做一条顶栏进度（非本需求）。
- 不要禁用 `Link` prefetch。

---

## 3. 验收清单

1. DevTools Slow 3G：从任一带数据的页点顶栏另一项（如 文章→说说）→ 高亮立刻切过去，主内容立刻换骨架，旧页不再停留；不必等接口。
2. 未完成前再点第三项 → 高亮与骨架跟最后一次点击走。
3. 快网不应明显闪一帧空骨架（可极短；不要额外人为 delay）。
4. 浏览器前进/后退后，高亮与内容与历史一致，pending 不卡住。
5. 移动菜单：点击后菜单关掉，高亮/骨架规则同上。
6. Tab 径向菜单松手跳转同一套 pending + 骨架。
7. `/garden` 不出现主站这套骨架；主站 Navbar 仍按现状在花园隐藏。
8. 无新的全屏遮罩盖住 Navbar。
9. 本地分支；PR open；Cloud Agent OFF；不合入 / 不部署。
10. SoT 落入 `docs/prompts/nav-instant-route-loading.md`。

---

## 4. 建议触及文件

- 新建 pending provider + `<main>` 乐观骨架槽
- `Kirameku/components/layout/Navbar.tsx`（高亮改用展示路径；点击写 pending）
- `Kirameku/components/ui/RadialMenu.tsx`（`router.push` 前写 pending）
- `Kirameku/app/layout.tsx`（接入 provider；注意不要用根 loading 误伤花园）
- 公开页 `loading.tsx` 或 `(site)` route group
- 复用 `Kirameku/components/ui/ContentSkeleton.tsx`（缺的变体才补，保持现有视觉）
- 卸载已挂载的 `PageTransition`（若未挂载，不要新接）
- `docs/prompts/nav-instant-route-loading.md`
