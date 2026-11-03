# 看板娘管理端 · 预览固定 + 模型/装扮独立滚动

**状态：** ready-for-dev（待用户确认后交「博客前端重构」落地）  
**日期：** 2026-11-03（v2，取代同日左中右中栏可滚稿）  
**基线：** `main`（含 PR #20 Cubism 多版本、#21 deploy exclude）  
**线框：** `docs/oml2d-handoff/live2d-admin-preview-fixed-mock.html`  
**范围：** 仅管理端 `Kirameku-backend/admin` Live2D 页 UI + 预览 fit；不合 main / 不部署，待设计师验收。

---

## 1. 问题（不变）

1. 装扮与预览同处可滚主栏，点装扮后常需上滚才能看效果。  
2. OML2D 写死 `scale: 0.18`、`position: [0, 40]`，人物常被舞台裁切。

---

## 2. 信息架构（v2 · 用户纠偏后）

**不要**再做成「左模型 | 中预览+元信息+可滚内容 | 右装扮」里中栏仍可能滚走的结构。

改为：

| 区域 | 行为 |
|---|---|
| **顶栏** | 站点默认 / 导入 / 上传（现有能力） |
| **预览带（固定）** | 左：Live 舞台 + 工具条（重新生成 / 生成本模型缺失）；右：当前模型紧凑元信息与操作。**整带 `flex: 0 0 auto`，固定高度（建议舞台区 ≈360px），不参与下方滚动，永不被装扮列表顶走。** |
| **下方双栏** | 左：模型列表（搜索/筛选可放栏头）；右：装扮列表。**两栏各自 `overflow: auto`，互不影响，也不滚动预览带。** |

交互：

- 点左模型 → 上方预览换模（默认装扮）+ 右栏刷新装扮。  
- 点右装扮 → **上方**预览立刻换肤；用户视线与预览同屏，无需滚动。  
- `<1100px`：预览带仍置顶固定；下方模型/装扮可改为上下两段，但顺序必须是 **预览 → 模型 → 装扮**，预览仍不进滚动容器。

线框：`live2d-admin-preview-fixed-mock.html`。

---

## 3. 预览 fit（必做，与 v1 相同）

**文件：** `Kirameku-backend/admin/src/utils/live2dPreviewCapture.ts`

- 去掉全局写死 `scale: 0.18` / `position: [0, 40]`。  
- 目标：舞台内 **完整可见、大致居中**（contain）。  
- Cubism2：可对齐前台 `fitModelToLegacyStage` 思路。  
- Cubism3/4：勿硬套 Cubism2 layout hack；用 bounds / 加载后包围盒缩放到舞台并居中。  
- `ResizeObserver` 补齐：容器尺寸变化后 remount 或重算 fit。  
- 抓拍 offscreen 与 Live **共用同一 fit 函数**。  
- 静图回退 `object-fit: contain`，避免过窄 `max-width`。

---

## 4. 实现要点

- `admin/src/views/live2d/index.vue`  
  - 拆掉「主栏纵向：预览行 + 装扮网格 + overflow:auto」结构。  
  - 预览带移出滚动容器；装扮迁到下方右栏独立 pane。  
  - 模型列表迁到下方左栏（或保持左侧整列，但预览必须在独立固定带——以实现线框为准：**预览在上、双列表在下**）。  
- `live2dPreviewCapture.ts`：§3。  
- 过时「Cubism2 live / 右栏」文案改为 OhMyLive2D · Cubism 2/3/4。

**保留能力：** 导入/强制导入、上传 zip、追加装扮、删除、站点默认、启用/排序/label、组装预览与缺失批量、preview_kind、Cubism entry 路径。

---

## 5. 不做

- 不改公开 catalog / 前台布局。  
- 不改 DB / R2 / Demo。  
- 不做每模型手动 scale 滑条（本迭代自动 fit）。  
- 不合 main、不部署、不启用 Cloud Agent（除非「启用一次」）。

---

## 6. 验收

1. 桌面宽：预览带始终在视口上半；滚模型或装扮列表时预览不动。  
2. 点任意装扮，无需滚动即可看到上方 Live/静图变化。  
3. ≥2 个 Cubism2 +（若有）1 个 Cubism4：人物完整入镜。  
4. 改预览带宽度后 resize/重载仍完整入镜；落盘预览同样完整。  
5. 原导入上传默认等无回归。  
6. 截图：全貌、滚列表时预览仍在、点装扮变化、曾裁切模型 fit 前后。

---

## 7. 给「博客前端重构」的下一句

按 `docs/prompts/live2d-admin-lcr-layout.md`（v2 预览固定）+ `docs/oml2d-handoff/live2d-admin-preview-fixed-mock.html` 落地；开 PR 后 @ 博客设计师验收，保持 open 不合 main。
