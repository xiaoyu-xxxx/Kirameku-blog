# 启动提示词：看板娘管理端二期（列表 · 上传 · 站点默认）

> 角色：第三方全栈/前后端实施（本地分支改码；可由「博客前端重构」统筹落地）  
> 设计师/验收：博客设计师（方案与验收统筹，不写业务代码）  
> 状态：`ready-for-dev` · 2026-11-02 Asia/Shanghai  
> 仓库：https://github.com/xiaoyu-xxxx/Kirameku-blog → 目录 `Kirameku/`（含 Next 前台 + FastAPI 管理端/后端，以仓库实际布局为准）  
> 线上：https://blog.xiaoyu-hh.cn  
> **禁止** Cursor Cloud Agent / Background Agent（未经用户明确「启用一次」）  
> **禁止**写入 Cloudflare R2 的 `demos/` 前缀；**禁止**改 `DEMO_STORAGE` / Demo 案例上传链路  
> **禁止**用现有 `POST /api/upload/image`（仅图片 → `kirameku/`/`photowall/`）传 Live2D 包  
> 验收：PR + 自检清单；管理端与公开 API 可用；前台默认模型逻辑可测。不强制截图除非用户另要。

---

## 0. 目标（本阶段一次做完「二期」）

在管理端管理看板娘资源与站点默认形象，并让博客前台（OhMyLive2D）读公开配置：

1. **管理端**：模型列表 + 各组对应服装/皮肤资源（path）  
2. **上传**：管理员可上传其他 Cubism2 模型包并登记启用  
3. **站点默认**：可设置博客默认模型 + 默认皮肤（影响无 localStorage 的新访客）

交付后前台不再只靠硬编码 `DEFAULT_MODEL_INDEX=20` 与静态 git 内 `model_list.json` 作为唯一真相（可保留文件作兼容/导入源）。

---

## 1. 现网事实（实施前再核对）

| 项 | 现状 |
|----|------|
| 引擎 | `Kirameku/components/widgets/Live2D.tsx`，`oh-my-live2d@0.19.3`，`NEXT_PUBLIC_USE_OML2D` |
| 清单 | `public/live2d/model_list.json`：`models[][]` + `messages[]`（约 21 组 / 124 套） |
| 资源 | `public/live2d/model/{rel_path}/index.json` + moc/贴图/动作；整库约 213MiB |
| 「换衣服」语义 | OML2D 组内 `path: string[]` = **多套独立 Cubism2 包**，不是同一 moc 换 texture 槽 |
| 默认 | 代码 `DEFAULT_MODEL_INDEX=20` / `DEFAULT_CLOTHES_INDEX=0`；优先 `localStorage`：`OML2D_MODEL_INDEX`、`OML2D_MODEL_CLOTHES_INDEX`（兼容旧 `modelId` / `modelTexturesId`）；另有拖拽 `waifu-pos` |
| 公开配置 | 已有 `GET /api/public/config` + `site_setting` / `AppConfigProvider`；**尚无 live2d 字段** |
| 上传参考 | 案例 Demo：本地盘 zip + 校验（`DEMO_LOCAL_ROOT`）；**Live2D 须独立根目录与前缀，勿混用 demos** |
| 边缘缓存 | 运维已为 `blog.xiaoyu-hh.cn` 的 `/live2d/` 设 `Cache-Control: public, max-age=31536000, immutable` + CF HIT。**禁止原地覆盖同 URL**；新包用版本化路径或新 path，改文件后需改名或 purge |

---

## 2. 产品约束

| 项 | 要求 |
|----|------|
| 权限 | 仅管理员；上传限流（可对齐 Demo 上传限流量级） |
| 访客 | **不**做访客自助上传；**不**默认强刷已有 localStorage（除非另做「配置版本号强制重置」开关且默认关） |
| 默认优先级 | ① 有效 OML2D/旧 LS → ② 站点公开默认 → ③ 代码兜底（可保留 20/0） |
| 内置包 | 一次性 import 现有 `model_list.json`；内置可禁用不建议物理删；上传为 `source=upload` |
| 存储 | MVP/本阶段默认 **服务器本地** `LIVE2D_LOCAL_ROOT`（或约定目录）；公开 URL 仍经 `/live2d/...` 或可配置 `asset_base`。R2 仅允许独立前缀 `live2d/`（或专用子域），**禁止 `demos/`**；本阶段可不迁 R2，但路径设计须兼容日后迁 |
| Cubism | 以现网 Cubism2（`index.json` + `.moc`）为准；Cubism3/4 若接收须单独标注，且不破坏现有 layout fix |
| 版权 | 仅管理员私有上传；不在 PR/文档鼓励公开投稿未授权模型 |

---

## 3. 推荐架构（须落地）

### 3.1 数据（元数据表 + 兼容 manifest，勿纯扫盘当唯一真相）

- `live2d_model`：`id, slug, name, sort, enabled, default_skin_id, package_size, file_count, source(builtin|upload), created_at…`
- `live2d_skin`：`id, model_id, rel_path, label, sort, enabled`（`rel_path` 如 `za/zastavam21_2104/normal`）
- 站点默认：落在 `site_setting`（如 `live2d_default_model_index` / `live2d_default_clothes_index` 或更稳的 id/slug 引用）**或**模型表标记 + 公开 API 解析成 index；须在 PR 说明选型

启动/迁移：脚本或管理命令 **import** 现有 `model_list.json` → 表。

### 3.2 公开 API（二选一或组合，须有文档）

- 推荐：`GET /api/public/live2d/catalog`  
  返回至少：`{ models, messages, default_model_index, default_clothes_index, asset_base }`  
  形状兼容今日前台：`models` 为 `string[][]`（每组皮肤 rel_path），`messages` 为组名。
- 或扩展 `GET /api/public/config` 增加 `live2d` 对象（字段同上）。

**缓存**：catalog / public config **短缓存或协商缓存**；**禁止**对 catalog 使用 immutable 长缓存。

### 3.3 管理端能力清单（本阶段要有）

1. 模型列表：名称、启用、排序、皮肤数、体积、来源  
2. 展开皮肤：label、`rel_path`、启用；可设「该模型默认皮肤」  
3. 站点默认：默认模型 + 默认皮肤  
4. 上传 zip → 校验 → 解压到 Live2D 根 → 登记 → 可选启用  
5. 禁用；删除策略：上传可删（盘+库）；内置软禁/不可物理删（写明）  
6. 菜单：管理端侧栏新增「看板娘」或挂在系统设置下（与现有站点设置/关于页风格一致）

### 3.4 前台

- `Live2D.tsx` 的 `resolveInitialIndexes`：无有效 LS 时读公开 catalog/config 的站点默认  
- 模型 URL：`asset_base + "model/" + rel_path + "/index.json"`（今日 `asset_base` 可为 `"/live2d/"`）  
- 保留拖拽 `waifu-pos`、布局/菜单既有修复；宽 &lt;768 不加载；`/garden` 不挂  
- 切模后位置持久化逻辑勿回退

---

## 4. 上传规范（强制）

**包格式**

- zip；内含一套或多套目录；每套须有 `index.json`，且含 `model`（`.moc`）与非空 `textures`；引用文件须在包内存在  
- 可选：`motions` / physics 等现网已有类型  

**限制（建议起步，可在配置中调）**

- zip ≤ 30–50MB；单文件（PNG）≤ 8–15MB；单包文件数 ≤ 200  
- 扩展名白名单：`.json` `.moc` `.mtn` `.png` `.jpg` `.jpeg` `.mp3`（及现网确有的同类）；**禁止** `.html` `.js` `.php` `.wasm` 等脚本/可执行  
- 路径规范化：禁 `..`、绝对路径、zip slip  
- 仅管理员 + 限流  

**与 immutable 对齐**

- 新上传路径必须 **版本化或唯一 path**（例如 `model/<slug>/<ver>/...` 或新 slug），更新 catalog 指向新 path  
- **禁止**覆盖已在 CDN 上 immutable 的同一 URL  
- 运维已配置 `/live2d/` 长缓存；实施后在 PR 写清「如何更新资源 / 是否需要 purge」

**存储环境变量（示例名，以实现为准）**

- `LIVE2D_LOCAL_ROOT`：磁盘根  
- `LIVE2D_PUBLIC_BASE` 或 catalog 内 `asset_base`：浏览器前缀  
- 与 `DEMO_LOCAL_ROOT` / `DEMO_STORAGE` **完全分离**

---

## 5. 范围

### 做

- 后端：表 + 迁移/import、管理 CRUD API、公开 catalog（或 config 扩展）、zip 上传校验落盘  
- 管理前端：看板娘管理页（列表/皮肤/默认/上传）  
- 博客前台：读站点默认 + catalog/`asset_base`  
- 文档：环境变量、导入步骤、缓存/purge 注意  

### 不做

- Demo 案例、`demos/` R2、音乐 Cookie、无关站点设置大重构  
- 访客上传、公开投稿  
- 批量 WebP 替换 Cubism2 PNG（未验证前）  
- 依赖 GitHub raw / jsDelivr 作生产模型源  
- 未经「启用一次」使用 Cloud Agent  
- 本任务不要求迁完整库到 R2（可选预留 `asset_base`）

---

## 6. 验收自检

- [ ] import 后管理端能看到与现网一致的组/皮肤数量级（允许展示优化，但 path 正确）  
- [ ] 设置站点默认后：清 LS 的新会话出场为该默认；有 LS 时仍跟访客选择  
- [ ] 上传合法 Cubism2 zip 后可启用，前台切角/切肤能加载  
- [ ] 非法 zip（缺 index、含 `.js`、zip slip、超限）被拒并有明确错误  
- [ ] 公开 catalog 与管理启用状态一致；禁用模型不出现在前台列表（或不可切到）  
- [ ] `/live2d/` 静态仍可被 CF 缓存；catalog **非** immutable  
- [ ] 未写入 `demos/` R2；未破坏 Demo 上传  
- [ ] `npm run build`（或项目等价）与后端测试/启动检查通过  
- [ ] PR 说明：默认优先级、存储路径、版本化策略、环境变量  

---

## 7. 交付物

1. 指向 `main` 的 PR（或按团队约定的分支），标题标明 Live2D 管理端二期  
2. 迁移/import 说明  
3. 本节自检勾选结果  

验收方：博客设计师代码/行为审核；用户确认后再合并（实施方勿擅自合 main，除非用户另令）。

---

## 8. 参考路径（以仓库为准）

- 前台：`Kirameku/components/widgets/Live2D.tsx`  
- 清单：`Kirameku/public/live2d/model_list.json`  
- 公开配置 / `site_setting` / 管理端「系统设置」现有模式  
- Demo zip 上传与校验（只抄模式，不共用存储）  
- 同目录历史：`OML2D_MIGRATION_PROMPT.md`（引擎迁移，已完成；本任务是管理与资源生命周期）
