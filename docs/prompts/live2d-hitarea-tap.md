# 看板娘 HitArea 点触表情/短动作（v1）

**状态：** handoff-ready（用户定案方案 2，经独立站运维同步；交「博客前端重构」落地）  
**日期：** 2026-11-03（Asia/Shanghai）  
**范围：** 博客前台 OhMyLive2D（`components/widgets/Live2D.tsx` 一带）；**仅**对「有 HitArea 且 model3 声明了 Expressions 和/或非 Idle Motions」的模型包生效。  
**首发对照包：** `dsh-whale-girl` / `rel_path=dsh-whale-girl/20261103150424`（HitAreas 已按 §3.1 落盘；公开 model3 已核对）。  
**Cloud Agent：** OFF。不合 main / 不部署，直至设计师验收 + 用户点头。

---

## 0. 定案与硬约束

| 项 | 约定 |
|---|---|
| 交互 | **方案 2**：点击模型 **HitArea** → 触发表情和/或短动作 |
| 旧模型 | **不得影响**：无 HitArea、Cubism2、仅 Idle 的包保持现网行为（拖拽、菜单、tips、换装/换模不变） |
| 生效条件 | `HitAreas.length > 0` **且**（`Expressions.length > 0` **或** 存在非 `Idle`/`idle` 的 Motion 组） |
| 资源 | 运维维护磁盘包；前端 **不** 为点触再拷贝一份模型 |

**资源状态：** 旧 `20261103140114` 为 `HitAreas:[]`；现网已切 `20261103150424` 且 HitAreas 非空（2026-11-03 公开 URL 核对通过）。前端仍以 **运行时探测** 为准，不要写死模型名。

---

## 1. 行为规格

### 1.1 触发

- 用户在舞台上对模型做一次 **短按/单击**，命中某个已声明 HitArea 的可点区域。  
- **拖拽移位** 不触发表情/动作（与现有 `#oml2d-stage` 拖拽共存：移动阈值点击）。  
- 点菜单 / tips / 状态条不走本逻辑。

### 1.2 播放策略（能力降级，按序）

命中 HitArea 后，在 **同一模型实例** 上：

1. **优先短动作（若有非 Idle Motion 组）**  
   - 从非 `Idle`/`idle` 组中 **随机** 取一组，播放其中一条；或按 HitArea 的 `Name`/`Id` 映射（见 §3.2）。  
   - 若 model3 已按 OML2D 惯例配置 `TapHead` / `TapBody` + HitAreas.`Motion`，可直接依赖引擎内置 hit→motion，**不必**再叠一层随机（二选一，见 §2）。  
2. **表情（若有 Expressions）**  
   - 同时或紧随：对 `expressionManager` 做一次 **随机表情**（或按 HitArea 映射的命名表情）；无 API 时允许经 `internalModel.motionManager.expressionManager` 的窄封装，需 try/catch。  
3. **Tips（可选，弱）**  
   - 可用现有 `tipsMessage` 抛一句短提示（如「哼！」「嘿嘿～」），优先级低于拖拽 tips；**不要**刷屏。

失败静默：无 expressionManager / 无可用 motion → 不报错、不打断 Idle。

### 1.3 明确不做（v1）

- 不为旧 Cubism2 伪造 HitArea。  
- 不在管理端加「点触配置」UI（v1）。  
- 不改 catalog schema。  
- 不默认 `showHitAreaFrames: true`（仅本地调试可临时开）。  
- 不引入第二套 Live2D 引擎。

---

## 2. 实现路径（推荐）

**路径 A（推荐，改动面小）：模型数据驱动 + 薄运行时门闩**

1. 确保目标包 model3：`HitAreas` 非空 + Motions/Expressions 齐全（运维，§3）。  
2. 前端：模型 `onLoad` 成功后探测当前模型是否满足 §0 生效条件。  
3. 若满足：  
   - **A1** 若 HitAreas 已带 OML2D 可识别的 `Motion`（如 `TapBody` / `TapHead:...`）且对应 Motion 组存在 → 信任引擎内置点击播动作；另加表情随机（若有 Expressions）。  
   - **A2** 若仅有 `Id`/`Name`（如 `Head`/`Body`）而无 Tap* 组 → 自行监听模型 hit/点击，映射到 §3.2 短动作池 + 随机表情。  
4. 若不满足：不注册新监听、不改 options。

**路径 B（不推荐）：** 全局 canvas click 对所有模型 `setRandomExpression` —— **禁止**（会伤旧模型手感）。

技术栈：继续 `oh-my-live2d`；调试可用 `showHitAreaFrames` / `showModelHitAreaFrames()`，合并前必须关闭。

---

## 3. 资源约定（运维 / 包内容）

### 3.1 HitAreas 最低集（蓝色大肥鱼）

若现网为空，补：

```json
"HitAreas": [
  { "Id": "Head", "Name": "头" },
  { "Id": "Body", "Name": "身体" }
]
```

（Id 须与 moc3 可命中 drawable/hit 定义一致；Andersen 包已验证使用 `Head`/`Body`。）

可选增强（OML2D 文档惯例，有则更好）：

```json
{ "Id": "Head", "Name": "头", "Motion": "TapHead" },
{ "Id": "Body", "Name": "身体", "Motion": "TapBody" }
```

并增加 `TapHead` / `TapBody` 组，文件可复用现有短动作（喷水、开盖、吹泡泡、自拍简单等），**不要**把 Idle 放进 Tap*。

### 3.2 无 Tap* 时的前端映射（A2）

| HitArea Name/Id | 短动作池（从现有组名中取，存在才用） |
|---|---|
| 头 / Head | `自拍简单`、`吹泡泡`、`开盖`（或英文别名 `selfieQuick`/`bubble`/`openLid`） |
| 身体 / Body | `喷水`、`番茄酱`、`重锤出击`（或 `splash`/`ketchup`/`aidale`） |
| 其他 | 任一非 Idle 组随机 |

表情：全量 Expressions 随机即可（v1 不做分区映射）。

### 3.3 首发包

- slug / rel_path：`dsh-whale-girl` / `dsh-whale-girl/20261103150424`（skin 125 / model 22）  
- 公开 model3：https://blog.xiaoyu-hh.cn/live2d/model/dsh-whale-girl/20261103150424/c_0120.model3.json  
- 已核对：`HitAreas=[{Id:Head,Name:头},{Id:Body,Name:身体}]`，Expressions 44，非 Idle Motions 齐全。

---

## 4. 验收清单

### 能力门闩

1. 切换到 **无 HitArea** 的旧 Cubism2 模型：单击身体/头 **不** 新播表情/短动作；拖拽、换装、菜单、tips 与改前一致。  
2. 切换到蓝色大肥鱼（`20261103140114`）：单击头/身体区域能触发短动作和/或表情，可重复触发。  
3. 代码路径 **无** 写死 `dsh-whale-girl` 字符串作为唯一开关；以运行时 HitAreas/Expressions/Motions 探测为准（日志可打 slug，逻辑不能只认一个 slug）。

### 交互与共存

4. 短拖舞台仍只移位，松手不误触发点触（或可接受极低误触；拖拽优先）。  
5. 点触不打断到白屏 / 不卸载 OML2D；Idle 在短动作结束后能恢复。  
6. 生产构建 **不** 显示 HitArea 调试框。

### 回归

7. 换模 / 换装 / 拍照 / 一言等菜单项仍可用。  
8. 路由切换卸载清理仍有效（无残留 `#oml2d-*`）。  

### 流程

9. 本地分支 + PR open；Cloud Agent 不启用；不合 main / 不部署直至设计师/用户点头。

---

## 5. 分工

| 角色 | 任务 |
|---|---|
| 独立站运维 | 确认/补齐服务器包 HitAreas；公开 URL 可访问；回复 HitAreas 原文 |
| 博客前端重构 | 按 §2 路径 A 落地；自测 §4 |
| 博客设计师 | 验收 §4；本 SoT |

---

## 6. 下一步

1. ~~运维补 HitAreas~~ → `20261103150424` 已就绪。  
2. 博客前端重构冒烟 + PR @设计师。  
3. 设计师按 §4 验收后再谈合入。
