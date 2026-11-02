# 短提示词：看板娘管理端二期

仓库 https://github.com/xiaoyu-xxxx/Kirameku-blog → `Kirameku/`。线上 https://blog.xiaoyu-hh.cn。完整版：同目录 `LIVE2D_ADMIN_PHASE2_PROMPT.md`。

**目标（一次排二期）**：管理端模型列表+服装 path；管理员 zip 上传 Cubism2；设置站点默认模型/皮肤；前台 OhMyLive2D 读公开 catalog/config。

**必须**：
1) 表 `live2d_model` / `live2d_skin` + import 现有 `model_list.json`；公开 `GET .../live2d/catalog`（或 config.`live2d`）：`models[][]`、`messages`、`default_*`、`asset_base`。catalog **短缓存**，禁止 immutable。
2) 管理页：列表/皮肤/默认/上传/启用；菜单风格对齐现有系统设置。
3) 上传：独立 `LIVE2D_LOCAL_ROOT`（勿 demos/R2 demos）；白名单 moc/json/png…；禁脚本；zip slip；体积/文件数上限；**版本化 path**（`/live2d/` 已 immutable，禁止原地覆盖）。
4) `Live2D.tsx`：无有效 LS 时用站点默认；优先级 LS → 站点默认 → 代码兜底；保留拖拽/布局修复；宽&lt;768 与 `/garden` 行为不变。

**禁止**：Cloud Agent（无「启用一次」）；`demos/` R2；用图片上传 API 传模型；访客上传；强刷全站 LS（默认可关）。

交付：PR + 迁移说明 + 完整版第 6 节自检。验收=设计师审核，合并听用户。
