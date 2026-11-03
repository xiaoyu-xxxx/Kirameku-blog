# 友链管理端 · 表格修复 + 预览（v1）

**状态：** ready-for-dev  
**日期：** 2026-11-03（Asia/Shanghai）  
**基线：** main（fe453b1 及之后）  
**SoT 仓内路径：** docs/prompts/friends-admin-redesign.md  
**线框：** docs/oml2d-handoff/friends-admin-mock.html（本轮已入库；按 §1–4 实现）  
**范围：** Kirameku-backend/admin/src/views/friend-link/index.vue（及相关 scoped 样式）；不改公开 /friends 散落算法；不改 apply API。  
**不做：** Cloud Agent；R2；Demo；合 main / 部署直至用户「合并推送」。

## 0. 用户反馈
管理端友链表格样式全乱、头部 tab 被挤没；要重新设计修复，并新增友链预览。

对照现网问题假设（落地自验）：列过多 + table-layout=auto + 无 min-w-0/overflow → 横向撑破内容区、PureAdmin tags-view 被挤；el-radio-button 内嵌 el-badge 变形；URL formatter 裸 HTML 长链不加宽截断；无预览。

## 1. IA
≥1100px 左右分栏：左列表 ~15fr，右预览 ~9fr。窄屏列表在上预览在下。
壳：page flex column height 100% min-h-0；toolbar flex0；main flex1 min-h-0 min-w-0 grid；pane min-w-0 min-h-0 overflow auto。硬约束：整页不得横滚；横滚只允许左栏表容器内。

## 2. 页头筛选
标题「友链管理」| 筛选 全部 / 待审核(n) / 已通过（segmented 或 radio，角标不要塞进 radio-button 子节点）| 「打开前台」→ https://blog.xiaoyu-hh.cn/friends 新标签 + 「新增友链」。筛选固定在 header，不被表滚走。

## 3. 左栏表
默认列：头像64、名称 min120（下可小字描述 ellipsis）、链接 min140 单行 ellipsis（el-link/title，禁 formatter 裸 HTML 无限拉宽）、状态88（Tag 点击切换审核保留）、排序72、操作 fixed~160。默认隐藏 ID/创建/修改时间。单击行 selectedId → 右栏跟随。待审行保留左侧 sky 条。table-layout fixed 或明确列宽。
增删改对话框字段与现逻辑保留；新建默认 is_approved=true。

## 4. 右栏预览（新）
主：对齐前台 /friends 详情弹窗（max-w-xs 玻璃卡、渐变圆环头像、名、描述空则「这个朋友很懒…」、sky「访问主页」、角标已审/待审）。未选中空态。
次：下方「前台可见 · N」迷你条，已通过友链小圆头像+名；点击同步选中左表。不要复刻漂流瓶物理散落/拖拽；不要 iframe 整页 /friends。

## 5. 验收
1 顶栏 tags-view 可见不被挤  2 筛选整齐角标不破布局  3 长 URL 省略、整页不横滚  4 点行右栏预览卡  5 切换审核同步海面条  6 打开前台  7 窄屏可用  8 增删改无回归  9 PR open、Cloud Agent OFF
