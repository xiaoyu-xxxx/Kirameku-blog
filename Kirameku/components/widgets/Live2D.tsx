"use client";

import { useEffect } from "react";
import Script from "next/script";

/**
 * 看板娘引擎：OhMyLive2D（默认）或旧 waifu/autoload（回退）。
 *
 * 回退开关：NEXT_PUBLIC_USE_OML2D=false 时恢复旧 `autoload.js` 方案。
 * 注意 NEXT_PUBLIC_* 在构建时内联，仅在构建/部署层切换，勿在运行时动态改。
 *
 * 视觉与旧 `#waifu` / `#live2d`（350×350）对齐：
 * - Cubism2 的 model json 经常只写 `layout.width`。pixi-live2d 会把缺省的 height
 *   当成 2，于是 X/Y 缩放不一致，形象被纵向拉长。这里按旧 live2d 控件的
 *   ModelMatrix.setWidth 改回等比缩放，再放进 350px 方形舞台。
 * - 菜单在舞台内部。舞台 z-index 仍是 40（不盖过页面其它浮层），但菜单必须高于
 *   舞台里 z-index 9998 的 canvas，否则点击落在画布上。另外库用 mouseout 控制
 *   显隐，事件会从子元素冒泡，鼠标移向按钮时菜单会被立刻藏起来。
 */
const USE_OML2D = process.env.NEXT_PUBLIC_USE_OML2D !== "false";

const MIN_WIDTH = 768;

// 与现网 autoload.js 对齐：默认角色 index 20（za/zastavam21_2104/normal）、皮肤 0
const DEFAULT_MODEL_INDEX = 20;
const DEFAULT_CLOTHES_INDEX = 0;

// 旧 `#live2d` 的 CSS 尺寸（right.css）
const STAGE_SIZE = 350;
// Cubism2 逻辑画布边长（ModelMatrix 的 -1..1）
const LOGICAL_SIZE = 2;

// OML2D 自带的持久化 key
const OML2D_MODEL_INDEX_KEY = "OML2D_MODEL_INDEX";
const OML2D_MODEL_CLOTHES_INDEX_KEY = "OML2D_MODEL_CLOTHES_INDEX";

// 旧 waifu autoload.js 的持久化 key（用于迁移）
const LEGACY_MODEL_ID_KEY = "modelId";
const LEGACY_MODEL_TEXTURES_ID_KEY = "modelTexturesId";
// 旧 waifu initDrag 的位置持久化（OML2D 拖拽沿用，便于迁移）
const WAIFU_POS_KEY = "waifu-pos";

const DRAG_START_TIPS = ["你要带我去哪里呀～", "哇，飞起来了！", "嘿咻嘿咻～", "抓稳啦！", "这是要去哪呢？"];
const DRAG_END_TIPS = ["就这里好啦！", "这里不错呢～", "放我下来，累死了！", "新家感觉怎么样？", "好，就住这了！"];

// OML2D 挂载到 body 的元素 id（卸载时清理，避免 /garden 等路由切换残留）
const OML2D_ELEMENT_IDS = [
  "oml2d-stage",
  "oml2d-statusBar",
  "oml2d-tips",
  "oml2d-menus",
  "oml2d-global-style",
  "oml2d-extra-icons",
];

// 舞台内 canvas 的 z-index（库写死 9998）。菜单必须比它高，否则按钮点不到。
const MENU_Z_INDEX = "10000";

type ModelList = { models: string[][]; messages?: string[] };

type Oml2dModel = {
  name?: string;
  path: string[];
  scale?: number;
  mobileScale?: number;
  position?: [number, number];
  stageStyle?: { width?: number; height?: number };
};

type MatrixLike = {
  identity: () => void;
  scale: (x: number, y?: number) => void;
  translate: (x: number, y: number) => void;
};

type InternalModelLike = {
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
  localTransform: MatrixLike;
  settings?: { layout?: Record<string, number> };
  coreModel?: { getCanvasWidth?: () => number };
};

type Live2DModelLike = {
  __layoutArmed?: boolean;
  on: (event: string, cb: () => void) => void;
  internalModel?: InternalModelLike;
};

type ModelsApi = {
  __layoutHooked?: boolean;
  model?: Live2DModelLike;
  currentModelOptions?: Oml2dModel;
  create: () => Promise<unknown>;
};

type MenusApi = {
  __hoverPatched?: boolean;
  reload: (stage: HTMLElement) => void;
};

type PixiAppLike = {
  stage?: unknown;
  renderer?: { plugins?: { extract?: { canvas: (target: unknown) => HTMLCanvasElement } } };
};

type StageApi = {
  __waifuPosPatched?: boolean;
  reloadStyle: (modelSize?: Record<string, unknown>) => void;
};

type Oml2dApi = {
  stage?: StageApi;
  onLoad: (fn: (status: "loading" | "success" | "fail") => void) => void;
  onStageSlideIn: (fn: () => void) => void;
  stageSlideIn: () => Promise<void>;
  stageSlideOut: () => Promise<void>;
  tipsMessage: (message: string, duration: number, priority: number) => void;
  loadNextModel: () => Promise<void>;
  loadNextModelClothes: () => Promise<void>;
  clearTips: () => void;
  statusBarOpen: (content?: string, color?: string) => void;
  statusBarClose: (content?: string, delay?: number, color?: string) => void;
  setStatusBarClickEvent: (fn: () => void | Promise<void>) => void;
  statusBarClearEvents: () => void;
  pixiApp?: { app?: PixiAppLike };
  models?: ModelsApi;
  menus?: MenusApi;
};

type TipRule = { selector: string; text: string | string[] };
type TipsData = {
  mouseover?: TipRule[];
  click?: TipRule[];
  seasons?: { date: string; text: string | string[] }[];
  time?: { hour: string; text: string | string[] }[];
  message?: { default?: string[]; copy?: string; visibilitychange?: string; console?: string };
};

const EXTRA_ICONS = `
<symbol id="icon-hitokoto" viewBox="0 0 512 512"><path d="M512 240c0 114.9-114.6 208-256 208c-37.1 0-72.3-6.4-104.1-17.9c-11.9 8.7-31.3 20.6-54.3 30.6C73.6 471.1 44.7 480 16 480c-6.5 0-12.3-3.9-14.8-9.9c-2.5-6-1.1-12.8 3.4-17.4l0 0 0 0 0 0 0 0 .3-.3c.3-.3 .7-.7 1.3-1.4c1.1-1.2 2.8-3.1 4.9-5.7c4.1-5 9.6-12.4 15.2-21.6c10-16.6 19.5-38.4 21.4-62.9C17.7 326.8 0 285.1 0 240C0 125.1 114.6 32 256 32s256 93.1 256 208z"/></symbol>
<symbol id="icon-asteroids" viewBox="0 0 512 512"><path d="M498.1 5.6c10.1 7 15.4 19.1 13.5 31.2l-64 416c-1.5 9.7-7.4 18.2-16 23s-18.9 5.4-28 1.6L284 427.7l-68.5 74.1c-8.9 9.7-22.9 12.9-35.2 8.1S160 493.2 160 480V396.4c0-4 1.5-7.8 4.2-10.7L331.8 202.8c5.8-6.3 5.6-16-.4-22s-15.7-6.4-22-.7L106 360.8 17.7 316.6C7.1 311.3 .3 300.7 0 288.9s5.9-22.8 16.1-28.7l448-256c10.7-6.1 23.9-5.5 34 1.4z"/></symbol>
<symbol id="icon-photo" viewBox="0 0 512 512"><path d="M220.6 121.2L271.1 96 448 96v96H333.2c-21.9-15.1-48.5-24-77.2-24s-55.2 8.9-77.2 24H64V128H192c9.9 0 19.7-2.3 28.6-6.8zM0 128V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H271.1c-9.9 0-19.7 2.3-28.6 6.8L192 64H160V48c0-8.8-7.2-16-16-16H80c-8.8 0-16 7.2-16 16l0 16C28.7 64 0 92.7 0 128zM168 304a88 88 0 1 1 176 0 88 88 0 1 1 -176 0z"/></symbol>
<symbol id="icon-info" viewBox="0 0 512 512"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/></symbol>
<symbol id="icon-quit" viewBox="0 0 384 512"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></symbol>
`;

function toInt(value: string | null): number {
  if (value === null) return NaN;
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
}

function pick<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[Math.floor(Math.random() * value.length)] : value;
}

function asLine(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

/**
 * 解析初始模型索引：
 * 1) OML2D 已持久化 → 沿用（校验范围）；
 * 2) 旧 waifu modelId / modelTexturesId → 迁移；
 * 3) 否则回落到 index 20 / 皮肤 0。
 */
type Live2DCatalog = {
  models: string[][];
  messages?: string[];
  default_model_index?: number;
  default_clothes_index?: number;
  asset_base?: string;
};

/**
 * 解析初始模型索引：
 * 1) OML2D 已持久化 → 沿用（校验范围）；
 * 2) 旧 waifu modelId / modelTexturesId → 迁移；
 * 3) 站点公开默认（catalog）；
 * 4) 否则回落到代码兜底 index 20 / 皮肤 0。
 */
function resolveInitialIndexes(
  models: Oml2dModel[],
  siteDefault?: { modelIndex?: number; clothesIndex?: number },
): { modelIndex: number; clothesIndex: number } {
  const modelCount = models.length;
  const fallbackModel =
    modelCount > 0 ? DEFAULT_MODEL_INDEX % modelCount : 0;
  const clampModel = (n: number) =>
    Number.isInteger(n) && n >= 0 && n < modelCount ? n : fallbackModel;
  const clampClothes = (modelIndex: number, n: number, fallback = DEFAULT_CLOTHES_INDEX) => {
    const len = models[modelIndex]?.path.length ?? 1;
    return Number.isInteger(n) && n >= 0 && n < len ? n : Math.min(fallback, Math.max(0, len - 1));
  };

  const storedModel = toInt(localStorage.getItem(OML2D_MODEL_INDEX_KEY));
  if (Number.isInteger(storedModel)) {
    const modelIndex = clampModel(storedModel);
    return {
      modelIndex,
      clothesIndex: clampClothes(modelIndex, toInt(localStorage.getItem(OML2D_MODEL_CLOTHES_INDEX_KEY))),
    };
  }

  const legacyModel = toInt(localStorage.getItem(LEGACY_MODEL_ID_KEY));
  if (Number.isInteger(legacyModel)) {
    const modelIndex = clampModel(legacyModel);
    return {
      modelIndex,
      clothesIndex: clampClothes(modelIndex, toInt(localStorage.getItem(LEGACY_MODEL_TEXTURES_ID_KEY))),
    };
  }

  const siteModel = siteDefault?.modelIndex;
  if (Number.isInteger(siteModel)) {
    const modelIndex = clampModel(siteModel as number);
    return {
      modelIndex,
      clothesIndex: clampClothes(modelIndex, siteDefault?.clothesIndex ?? NaN, DEFAULT_CLOTHES_INDEX),
    };
  }

  const modelIndex = fallbackModel;
  return { modelIndex, clothesIndex: DEFAULT_CLOTHES_INDEX };
}

async function loadLive2DCatalog(): Promise<Live2DCatalog | null> {
  try {
    const r = await fetch("/api/public/live2d/catalog", { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as Live2DCatalog;
  } catch {
    return null;
  }
}

function normalizeAssetBase(base: string | undefined): string {
  const b = (base || "/live2d/").trim() || "/live2d/";
  return b.endsWith("/") ? b : `${b}/`;
}

function cleanupOml2dDom(): void {
  for (const id of OML2D_ELEMENT_IDS) {
    document.getElementById(id)?.remove();
  }
}

function ensureExtraIcons(): void {
  if (document.getElementById("oml2d-extra-icons")) return;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = "oml2d-extra-icons";
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  svg.innerHTML = EXTRA_ICONS;
  document.body.prepend(svg);
}

/**
 * 把 Cubism2 非等比 layout 改回旧控件的等比缩放，并让模型落在 350px 方形舞台里。
 * 返回是否写进了当前模型选项（scale / position / stageStyle）。
 */
function fitModelToLegacyStage(model: Live2DModelLike, options: Oml2dModel | undefined): void {
  const internal = model.internalModel;
  if (!internal?.localTransform || !options) return;

  // 仅 Cubism2 有 getCanvasWidth。Cubism3/4 的 layout 语义不同，不要改。
  if (typeof internal.coreModel?.getCanvasWidth === "function") {
    const layout = internal.settings?.layout;
    if (layout && (typeof layout.width === "number" || typeof layout.height === "number")) {
      const mapped: Record<string, number> = {};
      for (const key of Object.keys(layout)) {
        const name = key === "center_x" ? "centerX" : key === "center_y" ? "centerY" : key;
        mapped[name] = layout[key];
      }
      // 与 Live2D Framework 一致：setWidth 再 setHeight，后者覆盖，两轴同一比例。
      const uniform = (typeof mapped.height === "number" ? mapped.height : mapped.width) / LOGICAL_SIZE;
      const box: Record<string, number> = { width: LOGICAL_SIZE, height: LOGICAL_SIZE, ...mapped };
      const width = internal.originalWidth * uniform;
      const height = internal.originalHeight * uniform;
      const offsetX =
        (box.x !== undefined && box.x - box.width / 2) ||
        (box.centerX !== undefined && box.centerX) ||
        (box.left !== undefined && box.left - box.width / 2) ||
        (box.right !== undefined && box.right + box.width / 2) ||
        0;
      const offsetY =
        (box.y !== undefined && box.y - box.height / 2) ||
        (box.centerY !== undefined && box.centerY) ||
        (box.top !== undefined && box.top - box.height / 2) ||
        (box.bottom !== undefined && box.bottom + box.height / 2) ||
        0;
      internal.localTransform.identity();
      internal.localTransform.scale(uniform, uniform);
      internal.localTransform.translate(width * offsetX, -height * offsetY);
      internal.width = width;
      internal.height = height;
    }
  }

  const ow = internal.originalWidth;
  const oh = internal.originalHeight;
  if (!ow || !oh) return;

  // 旧控件把逻辑宽度 2 映射到整块方形画布。layout 缩小后的模型居中，四周留白。
  const outer = Math.min(STAGE_SIZE / ow, STAGE_SIZE / oh);
  const displayW = internal.width * outer;
  const displayH = internal.height * outer;
  options.scale = outer;
  options.mobileScale = outer;
  options.position = [(STAGE_SIZE - displayW) / 2, (STAGE_SIZE - displayH) / 2];
  options.stageStyle = { width: STAGE_SIZE, height: STAGE_SIZE };
}

function installLayoutFix(oml2d: Oml2dApi): void {
  const models = oml2d.models;
  if (!models || models.__layoutHooked) return;
  models.__layoutHooked = true;

  const arm = (model: Live2DModelLike | undefined) => {
    if (!model || model.__layoutArmed) return;
    model.__layoutArmed = true;
    // 必须挂在库自己的 load 回调之后、settingModel 之前。load 在 await 之后才派发，这里来得及。
    model.on("load", () => fitModelToLegacyStage(model, models.currentModelOptions));
  };

  arm(models.model);
  const orig = models.create.bind(models);
  models.create = () => {
    const pending = orig();
    arm(models.model);
    return pending;
  };
}

function clampDrag(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** 从 localStorage 恢复旧 waifu 保存的 left/top（有则覆盖 OML2D 默认 dock）。 */
function applySavedWaifuPosition(stage: HTMLElement): boolean {
  const saved = localStorage.getItem(WAIFU_POS_KEY);
  if (!saved) return false;
  try {
    const { left, top } = JSON.parse(saved) as { left: number; top: number };
    if (!Number.isFinite(left) || !Number.isFinite(top)) return false;
    stage.style.transition = "none";
    stage.style.animation = "none";
    stage.style.transform = "none";
    // reloadStyle 会 Object.assign dock（right/bottom），仅写 left/top 会与旧值叠成双约束
    stage.style.removeProperty("right");
    stage.style.removeProperty("bottom");
    stage.style.left = `${left}px`;
    stage.style.top = `${top}px`;
    stage.style.right = "auto";
    stage.style.bottom = "auto";
    return true;
  } catch {
    return false;
  }
}

function syncSavedWaifuPosition(): void {
  const stage = document.getElementById("oml2d-stage");
  if (stage) applySavedWaifuPosition(stage);
}

/** 与旧 waifu-tips.js initDrag 对等的 #oml2d-stage 拖拽；菜单区域不触发拖。 */
function installStageDrag(oml2d: Oml2dApi): () => void {
  const stage = document.getElementById("oml2d-stage");
  if (!stage) return () => {};

  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let origLeft = 0;
  let origTop = 0;

  const getPos = () => {
    const r = stage.getBoundingClientRect();
    return { left: r.left, top: r.top };
  };

  const onStart = (e: MouseEvent | TouchEvent) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.closest("#oml2d-menus")) return;
    e.preventDefault();
    dragging = true;
    stage.style.transition = "none";
    stage.style.animation = "none";
    const ev = "touches" in e ? e.touches[0] : e;
    const pos = getPos();
    startX = ev.clientX;
    startY = ev.clientY;
    origLeft = pos.left;
    origTop = pos.top;
    moved = false;
  };

  const onMove = (e: MouseEvent | TouchEvent) => {
    if (!dragging) return;
    e.preventDefault();
    if (!moved) {
      moved = true;
      oml2d.tipsMessage(pick(DRAG_START_TIPS), 2000, 8);
    }
    const ev = "touches" in e ? e.touches[0] : e;
    const w = stage.offsetWidth;
    const h = stage.offsetHeight;
    const newLeft = clampDrag(origLeft + ev.clientX - startX, 0, window.innerWidth - w);
    const newTop = clampDrag(origTop + ev.clientY - startY, 0, window.innerHeight - h);
    stage.style.left = `${newLeft}px`;
    stage.style.top = `${newTop}px`;
    stage.style.right = "auto";
    stage.style.bottom = "auto";
    stage.style.transform = "none";
  };

  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    if (!moved) return;
    localStorage.setItem(
      WAIFU_POS_KEY,
      JSON.stringify({
        left: parseInt(stage.style.left, 10),
        top: parseInt(stage.style.top, 10),
      }),
    );
    const block = (ev: Event) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    stage.addEventListener("click", block, { capture: true, once: true });
    window.setTimeout(() => stage.removeEventListener("click", block, { capture: true }), 100);
    oml2d.tipsMessage(pick(DRAG_END_TIPS), 3000, 8);
  };

  stage.addEventListener("mousedown", onStart);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onEnd);
  stage.addEventListener("touchstart", onStart, { passive: false });
  window.addEventListener("touchmove", onMove, { passive: false });
  window.addEventListener("touchend", onEnd);

  return () => {
    stage.removeEventListener("mousedown", onStart);
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onEnd);
    stage.removeEventListener("touchstart", onStart);
    window.removeEventListener("touchmove", onMove);
    window.removeEventListener("touchend", onEnd);
  };
}

function installWaifuPositionPersistence(oml2d: Oml2dApi): void {
  const stageApi = oml2d.stage;
  if (stageApi && !stageApi.__waifuPosPatched) {
    stageApi.__waifuPosPatched = true;
    const origReloadStyle = stageApi.reloadStyle.bind(stageApi);
    // loadModel 成功后在 .then 里调用 reloadStyle(dock)，会盖掉 onLoad 里过早的回写
    stageApi.reloadStyle = (modelSize) => {
      origReloadStyle(modelSize);
      syncSavedWaifuPosition();
    };
  }

  // slideIn 动画结束后再贴一次（清掉 animation transform 与 dock 残留）
  oml2d.onStageSlideIn(() => {
    requestAnimationFrame(() => syncSavedWaifuPosition());
  });
  oml2d.onLoad((status) => {
    if (status === "success") {
      // success 早于同轮 loadModel().then 中的 reloadStyle，留给 patch 处理；此处兜底异步链
      setTimeout(() => syncSavedWaifuPosition(), 0);
    }
  });
}

function installMenuHoverFix(oml2d: Oml2dApi): void {
  const menus = oml2d.menus;
  if (!menus || menus.__hoverPatched) return;
  menus.__hoverPatched = true;
  const orig = menus.reload.bind(menus);
  menus.reload = (stage: HTMLElement) => {
    orig(stage);
    const menuEl = document.getElementById("oml2d-menus");
    if (!stage || !menuEl) return;
    menuEl.style.zIndex = MENU_Z_INDEX;
    // mouseout 会从 canvas 冒泡，移向按钮时把菜单 visibility 设成 hidden。
    stage.onmouseover = null;
    stage.onmouseout = null;
    stage.onmouseenter = () => {
      menuEl.style.opacity = "1";
      menuEl.style.visibility = "visible";
    };
    stage.onmouseleave = () => {
      menuEl.style.opacity = "0";
      menuEl.style.visibility = "hidden";
    };
  };
}

function welcomeFromTips(data: TipsData | null): Record<string, string> {
  const time = data?.time ?? [];
  const at = (hour: number) => asLine(time.find((rule) => {
    const [start, end] = rule.hour.split("-").map(Number);
    return hour >= start && hour <= end;
  })?.text);
  return {
    daybreak: at(6) ?? "早上好！一日之计在于晨，美好的一天就要开始了～",
    morning: at(9) ?? "上午好！工作顺利嘛，不要久坐，多起来走动走动哦！",
    noon: at(12) ?? "中午了，工作了一个上午，现在是午餐时间！",
    afternoon: at(15) ?? "午后很容易犯困呢，今天的运动目标完成了吗？",
    dusk: at(18) ?? "傍晚了！窗外夕阳的景色很美丽呢，最美不过夕阳红～",
    night: at(20) ?? "晚上好，今天过得怎么样？",
    lateNight: at(22) ?? "已经这么晚了呀，早点休息吧，晚安～",
    weeHours: at(1) ?? "你是夜猫子呀？这么晚还不睡觉，明天起的来嘛？",
  };
}

function idleLines(data: TipsData | null): string[] {
  const lines = [...(data?.message?.default ?? [])];
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  for (const season of data?.seasons ?? []) {
    const [start, end] = season.date.split("-");
    const [sm, sd] = start.split("/").map(Number);
    const [em, ed] = (end ?? start).split("/").map(Number);
    const afterStart = month > sm || (month === sm && day >= sd);
    const beforeEnd = month < em || (month === em && day <= ed);
    if (!afterStart || !beforeEnd) continue;
    const line = asLine(pick(season.text));
    if (line) lines.push(line.replaceAll("{year}", String(now.getFullYear())));
  }
  return lines;
}

function legacyGreeting(data: TipsData | null): string {
  let locationStr = "";
  try {
    const raw = sessionStorage.getItem("visitor_location");
    if (raw) {
      const loc = JSON.parse(raw) as { region?: string; city?: string };
      locationStr = [loc.region, loc.city].filter(Boolean).join("");
    }
  } catch {
    locationStr = "";
  }

  if (location.pathname === "/") {
    return locationStr
      ? `欢迎来自 <span>${locationStr}</span> 的朋友～<br>祝您在这里玩得开心！`
      : "欢迎来到这里～<br>祝您玩得开心！";
  }

  const title = `欢迎阅读<span>「${document.title.split(" - ")[0]}」</span>`;
  if (!data) return title;
  if (document.referrer !== "") {
    try {
      const ref = new URL(document.referrer);
      if (location.hostname === ref.hostname) return title;
      const site = ref.hostname.split(".")[1];
      const map: Record<string, string> = { baidu: "百度", so: "360搜索", google: "谷歌搜索" };
      const from = site in map ? map[site] : ref.hostname;
      return locationStr
        ? `Hello！来自 <span>${from}</span> 的 ${locationStr} 朋友<br>${title}`
        : `Hello！来自 <span>${from}</span> 的朋友<br>${title}`;
    } catch {
      return title;
    }
  }
  return locationStr ? `欢迎来自 <span>${locationStr}</span> 的朋友～<br>${title}` : title;
}

function bindLegacyTips(oml2d: Oml2dApi, data: TipsData | null): () => void {
  let hovered: Element | null = null;
  const match = (event: Event, rules: TipRule[] | undefined) => {
    const target = event.target;
    if (!(target instanceof Element) || !rules) return;
    for (const rule of rules) {
      const selector = rule.selector === "#live2d" ? "#oml2d-canvas" : rule.selector;
      const el = target.closest(selector);
      if (!el) continue;
      if (event.type === "mouseover") {
        if (hovered === el) return;
        hovered = el;
      }
      const msg = pick(rule.text).replaceAll("{text}", (el.textContent || "").trim());
      oml2d.tipsMessage(msg, 4000, 8);
      return;
    }
  };

  const onOver = (event: Event) => match(event, data?.mouseover);
  const onClick = (event: Event) => match(event, data?.click);
  const onVis = () => {
    if (!document.hidden && data?.message?.visibilitychange) {
      oml2d.tipsMessage(data.message.visibilitychange, 6000, 9);
    }
  };
  window.addEventListener("mouseover", onOver);
  window.addEventListener("click", onClick);
  document.addEventListener("visibilitychange", onVis);

  const greetingTimer = window.setTimeout(() => {
    oml2d.tipsMessage(legacyGreeting(data), 7000, 11);
  }, 1200);

  let locationTimer = 0;
  if (location.pathname === "/" && !sessionStorage.getItem("visitor_location")) {
    let retries = 0;
    locationTimer = window.setInterval(() => {
      retries += 1;
      try {
        const raw = sessionStorage.getItem("visitor_location");
        if (raw) {
          window.clearInterval(locationTimer);
          const loc = JSON.parse(raw) as { region?: string; city?: string };
          const where = [loc.region, loc.city].filter(Boolean).join("");
          if (where) {
            oml2d.tipsMessage(`欢迎来自 <span>${where}</span> 的朋友～<br>祝您在这里玩得开心！`, 7000, 12);
          }
        }
      } catch {
        window.clearInterval(locationTimer);
      }
      if (retries > 20) window.clearInterval(locationTimer);
    }, 300);
  }

  return () => {
    window.removeEventListener("mouseover", onOver);
    window.removeEventListener("click", onClick);
    document.removeEventListener("visibilitychange", onVis);
    window.clearTimeout(greetingTimer);
    if (locationTimer) window.clearInterval(locationTimer);
  };
}

function capturePhoto(oml2d: Oml2dApi): void {
  oml2d.tipsMessage("照好了嘛，是不是很可爱呢？", 6000, 9);
  try {
    const app = oml2d.pixiApp?.app;
    const canvas = app?.renderer?.plugins?.extract?.canvas(app.stage);
    if (!canvas) throw new Error("extract unavailable");
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "photo.png";
    link.click();
  } catch {
    oml2d.tipsMessage("拍照失败了，再试一次吧～", 4000, 9);
  }
}

function playAsteroids(oml2d: Oml2dApi): void {
  const w = window as Window & { Asteroids?: new () => unknown; ASTEROIDSPLAYERS?: unknown[] };
  if (w.Asteroids) {
    if (!w.ASTEROIDSPLAYERS) w.ASTEROIDSPLAYERS = [];
    w.ASTEROIDSPLAYERS.push(new w.Asteroids());
    return;
  }
  const script = document.createElement("script");
  script.src = "/live2d/asteroids.js";
  script.onerror = () => oml2d.tipsMessage("小游戏加载失败了……", 4000, 9);
  document.head.appendChild(script);
}

function buildMenus() {
  return () => ({
    // 停靠右侧时库会把菜单放到舞台左侧（left: 10px），这里只补垂直位置和层级。
    style: {
      top: "50px",
      bottom: "auto",
      zIndex: MENU_Z_INDEX,
      fontSize: "22px",
    },
    itemStyle: {
      backgroundColor: "transparent",
      boxShadow: "none",
      width: "28px",
      height: "40px",
      borderRadius: "0px",
    },
    items: [
      {
        id: "waifu-tool-hitokoto",
        icon: "icon-hitokoto",
        title: "一言",
        onClick(oml2d: Oml2dApi) {
          fetch(`https://v1.hitokoto.cn?${Date.now()}`)
            .then((r) => r.json())
            .then((d: { hitokoto?: string }) => {
              oml2d.tipsMessage(d.hitokoto || "……", 6000, 9);
            })
            .catch(() => oml2d.tipsMessage("一言没取到，稍后再试吧～", 4000, 9));
        },
      },
      {
        id: "waifu-tool-asteroids",
        icon: "icon-asteroids",
        title: "飞机大战",
        onClick(oml2d: Oml2dApi) {
          playAsteroids(oml2d);
        },
      },
      {
        id: "waifu-tool-switch-model",
        icon: "icon-switch",
        title: "切换看板娘",
        onClick(oml2d: Oml2dApi) {
          void oml2d.loadNextModel();
        },
      },
      {
        id: "waifu-tool-switch-texture",
        icon: "icon-skin",
        title: "切换衣服",
        onClick(oml2d: Oml2dApi) {
          void oml2d.loadNextModelClothes();
        },
      },
      {
        id: "waifu-tool-photo",
        icon: "icon-photo",
        title: "拍照",
        onClick(oml2d: Oml2dApi) {
          capturePhoto(oml2d);
        },
      },
      {
        id: "waifu-tool-info",
        icon: "icon-info",
        title: "关于",
        onClick() {
          window.open("https://hiromu.top/");
        },
      },
      {
        id: "waifu-tool-quit",
        icon: "icon-quit",
        title: "再见",
        onClick(oml2d: Oml2dApi) {
          oml2d.tipsMessage("愿你有一天能与重要的人重逢。", 2000, 11);
          oml2d.clearTips();
          oml2d.statusBarOpen("看板娘休息中");
          oml2d.setStatusBarClickEvent(() => {
            oml2d.statusBarClose();
            void oml2d.stageSlideIn();
            oml2d.statusBarClearEvents();
          });
          void oml2d.stageSlideOut();
        },
      },
    ],
  });
}

export default function Live2D() {
  useEffect(() => {
    // 回退方案：旧 autoload.js 内部自行判断宽度
    if (!USE_OML2D) return;

    // 宽 < 768 不加载（与现网 autoload 行为一致）
    if (window.innerWidth < MIN_WIDTH) return;

    let cancelled = false;
    let instance: Oml2dApi | null = null;
    let unbindTips: (() => void) | null = null;
    let unbindDrag: (() => void) | null = null;
    // OML2D 会覆盖 document.oncopy（复制提示），卸载时恢复
    const prevOnCopy = document.oncopy;

    (async () => {
            const [catalog, tipsData] = await Promise.all([
        loadLive2DCatalog(),
        fetch("/live2d/waifu-tips.json")
          .then((r) => (r.ok ? (r.json() as Promise<TipsData>) : null))
          .catch(() => null),
      ]);
      if (cancelled) return;

      let list: ModelList | null = catalog
        ? { models: catalog.models ?? [], messages: catalog.messages }
        : null;
      if (!list || !list.models?.length) {
        list = await fetch("/live2d/model_list.json").then((r) => {
          if (!r.ok) throw new Error(`model_list.json load failed: ${r.status}`);
          return r.json() as Promise<ModelList>;
        });
      }
      if (!list || !list.models.length) {
        throw new Error("Live2D model list empty");
      }

      const assetBase = normalizeAssetBase(catalog?.asset_base);
      const models: Oml2dModel[] = list.models.map((paths, i) => ({
        name: list.messages?.[i] ?? `model-${i}`,
        // Catalog Option A: each path already includes the entry file.
        // Legacy model_list.json fallback may still be dir-only → append index.json.
        path: paths.map((p) => {
          const rel = String(p || "")
            .replace(/\\/g, "/")
            .replace(/^\/+/, "")
            .replace(/\/+$/, "");
          if (/\.json$/i.test(rel)) {
            return `${assetBase}model/${rel}`;
          }
          return `${assetBase}model/${rel}/index.json`;
        }),
      }));

      const { modelIndex, clothesIndex } = resolveInitialIndexes(models, {
        modelIndex: catalog?.default_model_index,
        clothesIndex: catalog?.default_clothes_index,
      });
      localStorage.setItem(OML2D_MODEL_INDEX_KEY, String(modelIndex));
      localStorage.setItem(OML2D_MODEL_CLOTHES_INDEX_KEY, String(clothesIndex));

      ensureExtraIcons();

      const { loadOml2d } = await import("oh-my-live2d");
      if (cancelled) return;

      const welcome = welcomeFromTips(tipsData);
      const idle = idleLines(tipsData);
      const copyMessage = tipsData?.message?.copy;

      instance = loadOml2d({
        models,
        dockedPosition: "right",
        mobileDisplay: false,
        sayHello: false,
        // 状态条沿用旧 #waifu-toggle 的橙色；页面层级仍是 40 这一档
        primaryColor: "#fa0",
        // 只抬舞台本身。菜单的 z-index 在舞台内部，不能跟舞台一起写成 40。
        stageStyle: { zIndex: "40" },
        statusBar: { style: { zIndex: "41" } },
        tips: () => ({
          style: {
            width: 280,
            minHeight: "70px",
            top: "-70px",
            left: "20px",
            transform: "none",
            fontSize: "14px",
            lineHeight: "24px",
            padding: "5px 10px",
            borderRadius: "12px",
            backgroundColor: "rgba(236, 217, 188, 0.5)",
            border: "1px solid rgba(224, 186, 140, 0.62)",
            boxShadow: "0 3px 15px 2px rgba(191, 158, 118, 0.2)",
            color: "#5c4030",
            pointerEvents: "none",
          },
          ...(idle.length ? { idleTips: { message: idle, interval: 20000, duration: 6000 } } : {}),
          welcomeTips: { message: welcome, duration: 6000 },
          ...(copyMessage ? { copyTips: { message: [copyMessage], duration: 6000 } } : {}),
        }),
        menus: buildMenus(),
      }) as Oml2dApi;

      installLayoutFix(instance);
      installMenuHoverFix(instance);
      installWaifuPositionPersistence(instance);
      unbindDrag = installStageDrag(instance);
      unbindTips = bindLegacyTips(instance, tipsData);
    })().catch((err) => {
      console.error("[Live2D] OhMyLive2D 初始化失败：", err);
    });

    return () => {
      cancelled = true;
      unbindTips?.();
      unbindDrag?.();
      // OML2D 0.19.3 无公开 destroy；用「停止渲染循环 + 移除 DOM」兜底，避免路由切换泄漏
      const app = instance?.pixiApp?.app as { destroy?: (removeView?: boolean) => void } | undefined;
      app?.destroy?.(true);
      cleanupOml2dDom();
      document.oncopy = prevOnCopy;
    };
  }, []);

  // 回退方案：旧 waifu autoload（USE_OML2D=false）
  if (!USE_OML2D) {
    return (
      <Script
        src="/live2d/jsdelivr/random/autoload.js?v=4"
        strategy="lazyOnload"
      />
    );
  }

  return null;
}
