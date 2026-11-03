# 非阻塞导航与加载态（v1）

**状态：** handoff-ready v1  
**日期：** 2026-11-03（Asia/Shanghai）  
**线上页：** https://blog.xiaoyu-hh.cn/posts（主诉）；同类加载页见 §3  
**范围：** 前台壳层与页内筛选/列表在接口未返回时仍可切换；**Cloud Agent OFF**；本地分支 + PR open；不合 main / 不部署直至设计师验收 + 用户「合并推送」。  
**不做：** R2 / Demo；不为进度条改品牌色；不重做欢迎屏 WelcomeScreen；不改 OML2D。

---

## 0. 现状结论（已摸仓 main）

### 主诉根因：`/posts` 分类切换「等接口再动 UI」

`Kirameku/app/posts/page.tsx` → `handleCategoryChange`：

1. `switchingRef.current = true` → 后续分类点击直接 `return`  
2. **先** `await fetchPage(slug, 1)`（文章列表接口）  
3. 接口回来后才 `flushSync` 改 `activeCategory` / `posts`，再 `router.replace`  
4. 可选 `document.startViewTransition` 包在网络之后  

结果：文章接口未返回前，**分类菜单点不动**；慢网时体感卡死。顶栏 `Navbar` 的 `Link` 本身未 `disabled`，但页内筛选锁与「整页转圈」叠在一起，用户描述为「没办法切换菜单」。

### 同类模式（内容区 gate，一般不锁顶栏）

下列页多为 `"use client"` + `useEffect` 拉数 + `loading && <Loader2 />` 占满主内容（壳层仍在 layout 里可点，但无骨架、切换路由后仍要干等空白转圈）：

| 路由 | 文件 | 机制 |
|---|---|---|
| `/posts` | `app/posts/page.tsx` | **分类 await + switchingRef（主 bug）**；首屏/加载更多 Loader |
| `/posts/[slug]` | `app/posts/[slug]/page.tsx` | `getPostBySlug` 前整页 Spinner |
| `/friends` | `app/friends/page.tsx` | 列表 loading gate |
| `/moments` | `app/moments/page.tsx` | `if (loading)` 整页 Spinner |
| `/timeline` | `app/timeline/page.tsx` | 同上 |
| `/photowall` | `app/photowall/page.tsx` | albums+photos 串联 await 后才出墙 |
| `/bookmark` | `app/bookmark/page.tsx` | 列表 loading gate |

**壳层：** `app/layout.tsx` 中 `Navbar` 在 `<main>` 外，未见全局 `pointer-events: none` 遮罩锁导航（WelcomeScreen 仅首访 session 一次，排除在本 SoT）。

---

## 1. 体验原则（全站）

1. **壳层永不因页面数据阻塞**  
   顶栏 / 移动菜单 / DesktopMenu 在任意页 loading 期间保持可点；禁止页面级全屏遮罩盖住 `Navbar`（`z` 与 `pointer-events`）。

2. **页内筛选 / Tab / 分类：乐观切换**  
   点击后**立即**更新选中态 + URL（`router.replace` / `push`，`scroll: false` 按需）；内容区进 skeleton / 淡出旧列表；**禁止** `await` 接口成功后再改选中态。

3. **请求可打断**  
   用 `AbortController`（或递增 `fetchGen` 已有则保留）取消过期请求；新点击立即生效，旧响应丢弃。删除「整段交互期间 `switchingRef` 吞点击」；若需防抖，只防同 slug 重复点击，不锁其它项。

4. **加载只占内容区**  
   首屏与切换用与版面同构的 skeleton（卡片栅格灰块 / 详情标题+段落条），保留页头与筛选条可见可点；`Loader2` 居中仅作次要兜底（如加载更多脚部）。

5. **View Transition 不绑网络**  
   若保留 `/posts` VT：只包「已有数据的 DOM 提交」或改为 CSS 短过渡；**禁止** `await fetch` 后再 `startViewTransition` 拉长不可点窗口。慢网或 `prefers-reduced-motion` 时跳过 VT（现有检测可留）。

6. **路由离开即清理**  
   `useEffect` 拉取须在 cleanup 里 `abort` / `active=false`；切走顶栏路由后不得再 `setState`。

---

## 2. `/posts` 必改（P0）

### 2.1 分类点击目标流

```
点分类 Tab
  → 立刻 setActiveCategory(slug) + 内容区 skeleton（可清空 posts 或留旧列表加半透明/遮罩二选一，推荐 skeleton）
  → router.replace(?category=) 立刻
  → Abort 上一次列表请求 → fetch 新列表
  → 仅当 gen/信号仍为当前时 setPosts / setHasMore
  → 任何时候可再点其它分类或顶栏
```

### 2.2 删除 / 改写

- 删除或降级 `switchingRef` 对**其它分类**的互斥；最多忽略「同 slug 连点」。  
- `handleCategoryChange` **不得**在 `await fetchPage` 之后才改 UI/URL。  
- 首屏 `urlCategory` effect 与点击路径共用同一套「乐观 + abort」逻辑，避免双通道打架。

### 2.3 UI

- 筛选条在 loading 时保持渲染、不 `disabled`。  
- `loading && posts.length === 0`：用 **3× 栅格骨架卡**（对齐现网 `grid-cols-1 sm:2 lg:3`），不要只有一颗大 Spinner。  
- 加载更多：保留底部小 Spinner；按钮在 flight 时可 disabled 自身，不影响分类与顶栏。

---

## 3. 其它页（P1，同 PR 或紧随）

统一口径：**页头保留 + 内容骨架；fetch abort；不盖 Navbar**。

| 页 | 最低改动 |
|---|---|
| `/posts/[slug]` | 详情骨架（标题/meta/段落条）；slug 变或卸载 abort |
| `/moments` `/timeline` `/bookmark` `/friends` | 首屏骨架替整页 Spinner；离开 abort |
| `/photowall` | 先出相册壳/网格骨架，再填图；避免双 await 全白屏 |

P1 可与 P0 同 PR；若体积过大，P0 单独 PR，P1 注明 follow-up 文件列表。

---

## 4. 明确不改

- `WelcomeScreen` 首访遮罩（非接口问题）  
- Logo 彩纸 canvas（已 `pointer-events: none`）  
- 管理端 Live2D / 友链审核（本 SoT 仅前台公开站）  
- 接口契约、分页 size、分类 API 本身  

---

## 5. 验收清单

### P0 `/posts`

1. 弱网（DevTools Slow 3G）：点分类 A→立刻高亮 A；未返回前再点 B→高亮 B，最终列表为 B；中途可点顶栏「友链/首页」立即离开。  
2. 快网：分类切换无整页卡死；骨架或过渡 ≤ 感知卡顿。  
3. 浏览器后退/前进 `?category=` 与选中态一致。  
4. 加载更多与分类切换互不永久锁死。  
5. `prefers-reduced-motion: reduce` 下无 VT 异常。  

### 壳层

6. 任意上述页 loading 中，桌面顶栏与移动菜单 `Link` 可点且路由变化。  
7. 无新的全屏 `fixed inset-0` 且 `pointer-events: auto` 盖住 `Navbar`。  

### 流程

8. 本地分支；PR open；**Cloud Agent OFF**；不合 main / 不部署，等设计师验收 + 用户「合并推送」。  
9. SoT 落入 `docs/prompts/nav-nonblocking-loading.md`（本文件）。  

---

## 6. 实现分工

| 角色 | 任务 |
|---|---|
| 博客设计师 | 本 SoT / 验收；不合入 |
| 博客前端重构 | 本地改 `posts/page.tsx`（P0）+ P1 骨架/abort；开 PR |
| 独立站运维 | 仅合入后 Deploy 跟进 |

---

## 7. 建议触及文件

- `Kirameku/app/posts/page.tsx`（P0 必改）  
- `Kirameku/app/posts/[slug]/page.tsx`  
- `Kirameku/app/moments/page.tsx`、`timeline/page.tsx`、`friends/page.tsx`、`bookmark/page.tsx`、`photowall/page.tsx`  
- 可选：抽 `components/ui/ContentSkeleton.tsx`（卡片/详情两种）避免复制  
- `docs/prompts/nav-nonblocking-loading.md`（提交本 SoT）  
- VT 相关：`app/globals.css` 中 `.vt-posts-*` 仅当仍使用 VT 时复核，不强制删  

## Changelog

- **v1（2026-11-03）**：首版；主因 posts 分类 await+switchingRef；全站非阻塞原则 + P0/P1。
