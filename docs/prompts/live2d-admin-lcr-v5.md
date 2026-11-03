# 看板娘管理端 · 真·左中右三栏并排（v5）

**状态：** ready-for-dev（用户已纠偏：必须横向左|中|右，禁止上预览下双栏；比例已定为 **6:12:6**）  
**日期：** 2026-11-03（v5 · 默认比例 6:12:6）  
**基线：** `main`（含 PR #22 `fitModelToStage`）  
**线框：** `docs/oml2d-handoff/live2d-admin-lcr-v5-mock.html`（工作副本：`/workspace/live2d-admin-lcr/live2d-admin-lcr-v5-mock.html`）  
**SoT 仓内路径约定：** `docs/prompts/live2d-admin-lcr-v5.md`  
**范围：** 仅管理端 Live2D 页布局（`admin/src/views/live2d/index.vue`）；不合 main / 不部署，待设计师验收。  
**不做：** Cloud Agent；不改 capture/fit 逻辑；不嵌第二套引擎。

---

## 1. 问题与纠偏

此前「预览固定带 + 下方双列表」及若干稿在用户眼中均为 **上中下**（上预览 / 下模型+装扮）。用户明确要求：

> **左中右，不是上中下。**

本版 SoT / 线框锁定为：**页头下单行三列并排**；预览只占中列宽度，**绝不全宽置顶**。

废弃作为主 IA：

- `live2d-admin-preview-fixed-*`（上预览下双栏）
- `live2d-admin-preview-compact-*`（预览带压高的上中下变体）
- 任何把 preview-band 拉成 `grid-column: 1 / -1` 的布局

v4 语义已是左中右，但视觉与标注不够醒目，用户仍判为上中下 → **以 v5 线框为准**。

---

## 2. 信息架构

| 左 · 模型 | 中 · 预览 | 右 · 装扮 |
|---|---|---|
| 搜索/筛选 + 模型列表；`overflow: auto` 独立滚动 | **同列内**：舞台（`flex:1; min-height:0`）→ 工具条 → 紧凑元信息/操作（meta 过多时中栏局部滚，舞台保持列内上部可见） | 当前模型装扮列表；`overflow: auto` 独立滚动 |

交互：

- 点左模型 → 中栏换模（默认装扮）+ 右栏刷新装扮。  
- 点右装扮 → **中栏立刻换肤**；三栏同屏，无需为看预览而滚动页面。

窄屏 `<1100px`：纵向堆叠顺序 **模型 → 预览 → 装扮**（预览仍夹在中间，不是全宽顶带语义的回归）。

---

## 3. 栅格比例（24 语义）

用户（居易白）已选定 **6:12:6** 为默认：左模型窄 · **中预览加宽** · 右装扮窄。

CSS `grid-template-columns`（线框可切换；落地默认只实现 6:12:6）：

| 比例 | CSS | 说明 |
|---|---|---|
| **默认 `6:12:6`** | `6fr 12fr 6fr` | 中栏预览加宽（用户选定，发版默认） |
| 备选 `8:8:8` | `1fr 1fr 1fr` | 三栏均分；仅对照 / 变量预留 |
| 备选 `6:6:12` | `6fr 6fr 12fr` | 右装扮更宽；仅对照 / 变量预留 |

落地：`--cols: 6fr 12fr 6fr` 为发版默认；8:8:8 / 6:6:12 仅作备选切换，不作为主路径。

---

## 4. 相对 #22 / 旧稿

**保留（不得改坏）：**

- PR #22 `fitModelToStage`、ResizeObserver、静图 `object-fit: contain`
- 现有预览管线：`textures[0]` 静图 / OML2D capture（**不要**在管理端再嵌第二套引擎栈）
- 业务能力：导入/强制导入、上传 zip、追加装扮、删除、站点默认、启用/排序/label、重新生成、生成本模型缺失、preview_kind、Cubism entry

**必须改：**

- `index.vue`：拆掉全宽 preview-band + 下方双栏；改为页头下三列 grid
- 中列宽度只占一列；高度随壳列高分配，不再 `min-height: 360` 全宽带

**默认不改：**

- `live2dPreviewCapture.ts`（除非为配合列宽做无行为变化的样式微调）

---

## 5. 实现要点

1. 壳：`display:flex; flex-direction:column; height: 100%`（或等价视口高）；页头 `flex:0`；主区 `flex:1; min-height:0`。  
2. 主区：`display:grid; grid-template-columns: var(--cols); gap: 10~12px; min-height:0`。  
3. 每列：`display:flex; flex-direction:column; min-height:0; overflow:hidden`。  
4. 左/右列表容器：`flex:1; min-height:0; overflow:auto`。  
5. 中列：舞台 `flex:1; min-height:0`；工具条+meta `flex:0 0 auto`（meta 可 `max-height` + `overflow:auto`）。  
6. 列头文案建议保留「左·模型 / 中·预览 / 右·装扮」以便验收对照线框。

进仓文件：

- `docs/prompts/live2d-admin-lcr-v5.md`（本 SoT）
- `docs/oml2d-handoff/live2d-admin-lcr-v5-mock.html`

---

## 6. 不做

- catalog / 前台布局 / DB / R2 / Demo  
- 每模型手动 scale 滑条  
- 合 main、部署（除非用户下令）  
- Cloud Agent  
- 在 mock 或管理页再挂第二套 Live2D 运行时

---

## 7. 验收清单

1. 桌面宽：一眼可见 **横向三列**；顶注/列头能读到「左·模型」「中·预览」「右·装扮」。  
2. 预览舞台宽度 = 中列宽，**不**横跨整页。  
3. 滚左列表 / 滚右列表时，另一侧与中栏舞台不被整页带走；左右可独立滚。  
4. 点装扮 → 中栏立刻变，无需滚动。  
5. #22 fit 无回归：人物 contain 入镜。  
6. 默认比例 **6:12:6** 目测正确（中栏约为左右各栏的 2 倍宽）；备选 8:8:8 均分、6:6:12 右栏更宽仅作对照。  
7. 截图：全貌（三列同屏）+ 点装扮前后。

---

## 8. 给「博客前端重构」

按本 SoT + **v5** 线框从最新 `main` 开分支；**默认实现 6:12:6**（`6fr 12fr 6fr`，中栏预览加宽）。8:8:8 / 6:6:12 仅作 CSS 变量备选，不作为发版默认。开 PR @ 博客设计师，保持 open，不合 main。
