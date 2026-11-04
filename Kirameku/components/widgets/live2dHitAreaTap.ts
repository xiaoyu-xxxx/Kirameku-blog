/**
 * HitArea 点触 → 短动作 / 随机表情（方案 2 · 路径 A）
 * 仅当运行时探测到 HitAreas 非空，且有 Expressions 或非 Idle Motions 时生效。
 * 禁止写死模型 slug；失败静默。
 */

type MatrixLike = {
  identity: () => void;
  scale: (x: number, y?: number) => void;
  translate: (x: number, y: number) => void;
};

type HitAreaRaw = {
  Id?: string;
  Name?: string;
  Motion?: string;
  id?: string;
  name?: string;
  motion?: string;
};

type MotionManagerLike = {
  motionGroups?: Record<string, unknown>;
  expressionManager?: {
    definitions?: unknown[];
    setRandomExpression?: () => Promise<boolean> | boolean;
  };
};

type InternalModelLike = {
  originalWidth?: number;
  originalHeight?: number;
  width?: number;
  height?: number;
  localTransform?: MatrixLike;
  settings?: {
    layout?: Record<string, number>;
    hitAreas?: HitAreaRaw[];
    expressions?: unknown[];
    motions?: Record<string, unknown>;
  };
  hitAreas?: Record<string, unknown>;
  motionManager?: MotionManagerLike;
  coreModel?: { getCanvasWidth?: () => number };
};

type Live2DModelLike = {
  __layoutArmed?: boolean;
  __hitTapArmed?: boolean;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  off?: (event: string, cb: (...args: unknown[]) => void) => void;
  expression?: (name?: string | number) => Promise<boolean> | boolean;
  motion?: (group: string, index?: number) => Promise<unknown> | unknown;
  internalModel?: InternalModelLike;
};

type ModelsApiLike = {
  model?: Live2DModelLike;
  playMotion: (motionGroupName: string, index?: number) => void;
  playRandomMotion: (areaName: string[]) => void;
};

type Oml2dApiLike = {
  onLoad: (fn: (status: "loading" | "success" | "fail") => void) => void;
  tipsMessage: (message: string, duration: number, priority: number) => void;
  models?: ModelsApiLike;
};

/** 与 installStageDrag 共享：拖拽移位后不点触。 */
export type StageDragState = { moved: boolean };

/**
 * 与 bindLegacyTips 共享：本次点击是否已经命中 HitArea。
 * 命中时老 waifu 点击台词要让位，否则它会用优先级 8 把短句盖掉。
 */
export type HitState = { fired: boolean };

const HEAD_MOTION_POOL = [
  "自拍简单",
  "吹泡泡",
  "开盖",
  "selfieQuick",
  "bubble",
  "openLid",
] as const;

const BODY_MOTION_POOL = [
  "喷水",
  "番茄酱",
  "重锤出击",
  "splash",
  "ketchup",
  "aidale",
] as const;

const HIT_TIPS = ["哼！", "嘿嘿～", "呀！", "唔……"] as const;

function isIdleGroup(name: string): boolean {
  return name.toLowerCase() === "idle";
}

function isTapGroup(name: string): boolean {
  return /^tap/i.test(name.trim());
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function isHeadHit(area: string): boolean {
  const k = norm(area);
  return k === "head" || k === "头" || k.includes("head") || k.includes("头");
}

function isBodyHit(area: string): boolean {
  const k = norm(area);
  return k === "body" || k === "身体" || k.includes("body") || k.includes("身体");
}

function pickOne<T>(items: T[]): T | undefined {
  if (!items.length) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

function listMotionGroups(model: Live2DModelLike | undefined): string[] {
  const fromMgr = model?.internalModel?.motionManager?.motionGroups;
  if (fromMgr && typeof fromMgr === "object") return Object.keys(fromMgr);
  const fromSettings = model?.internalModel?.settings?.motions;
  if (fromSettings && typeof fromSettings === "object") return Object.keys(fromSettings);
  return [];
}

function readHitAreas(model: Live2DModelLike | undefined): HitAreaRaw[] {
  const settings = model?.internalModel?.settings;
  const raw = settings?.hitAreas;
  if (Array.isArray(raw) && raw.length) return raw as HitAreaRaw[];
  const runtime = model?.internalModel?.hitAreas;
  if (runtime && typeof runtime === "object") {
    return Object.keys(runtime).map((name) => ({ Name: name, name }));
  }
  return [];
}

function expressionCount(model: Live2DModelLike | undefined): number {
  const defs = model?.internalModel?.motionManager?.expressionManager?.definitions;
  if (Array.isArray(defs)) return defs.length;
  const fromSettings = model?.internalModel?.settings?.expressions;
  return Array.isArray(fromSettings) ? fromSettings.length : 0;
}

type ProbeResult = {
  ok: boolean;
  mode: "A1" | "A2" | null;
  motionGroups: string[];
  expressionCount: number;
  hitAreaCount: number;
};

function probe(model: Live2DModelLike | undefined): ProbeResult {
  if (!model?.internalModel) {
    return { ok: false, mode: null, motionGroups: [], expressionCount: 0, hitAreaCount: 0 };
  }
  const hitAreas = readHitAreas(model);
  const motionGroups = listMotionGroups(model);
  const exprCount = expressionCount(model);
  const nonIdle = motionGroups.filter((g) => !isIdleGroup(g));
  const hitAreaCount = hitAreas.length;
  const ok = hitAreaCount > 0 && (exprCount > 0 || nonIdle.length > 0);

  if (!ok) {
    return { ok: false, mode: null, motionGroups, expressionCount: exprCount, hitAreaCount };
  }

  const hasTapGroups = motionGroups.some(isTapGroup);
  const hasMotionField = hitAreas.some((h) => {
    const m = (h.Motion || h.motion || "").trim();
    if (!m) return false;
    const group = m.split(":")[0];
    return motionGroups.includes(group);
  });

  return {
    ok: true,
    mode: hasTapGroups || hasMotionField ? "A1" : "A2",
    motionGroups,
    expressionCount: exprCount,
    hitAreaCount,
  };
}

function pickMappedMotion(areas: string[], groups: string[]): string | undefined {
  const available = new Set(groups);
  const nonIdle = groups.filter((g) => !isIdleGroup(g));
  const area = areas[0] || "";

  let pool: readonly string[] = [];
  if (isHeadHit(area)) pool = HEAD_MOTION_POOL;
  else if (isBodyHit(area)) pool = BODY_MOTION_POOL;

  const matched = pool.filter((n) => available.has(n));
  if (matched.length) return pickOne(matched);
  return pickOne(nonIdle);
}

function tryRandomExpression(model: Live2DModelLike | undefined): void {
  try {
    if (!model) return;
    if (typeof model.expression === "function") {
      void model.expression();
      return;
    }
    const em = model.internalModel?.motionManager?.expressionManager;
    if (em && typeof em.setRandomExpression === "function") {
      void em.setRandomExpression();
    }
  } catch {
    // 静默
  }
}

function maybeHitTip(oml2d: Oml2dApiLike): void {
  try {
    // 优先级 9：能盖住老 waifu 点击台词（8），但抢不过开场问候（11/12）。
    // 开场那 7 秒点模型没有台词，动作与表情照出。约半数触发以免刷屏。
    if (Math.random() > 0.45) return;
    const tip = pickOne([...HIT_TIPS]);
    if (tip) oml2d.tipsMessage(tip, 1600, 9);
  } catch {
    // 静默
  }
}

/**
 * 安装 HitArea 点触门闩。未满足生效条件时不改引擎行为。
 * 返回卸载函数。
 */
export function installHitAreaTap(
  oml2d: Oml2dApiLike,
  dragState: StageDragState,
  hitState?: HitState,
): () => void {
  const models = oml2d.models;
  if (!models) return () => {};

  let mode: "A1" | "A2" | null = null;
  let hitHandler: ((...args: unknown[]) => void) | null = null;
  let armedModel: Live2DModelLike | null = null;

  const origPlayRandom = models.playRandomMotion.bind(models);

  models.playRandomMotion = (areas: string[]) => {
    if (dragState.moved) return;
    if (mode !== "A2") {
      origPlayRandom(areas);
      return;
    }
    try {
      const model = models.model;
      const groups = listMotionGroups(model);
      const group = pickMappedMotion(areas || [], groups);
      if (group) models.playMotion(group);
      tryRandomExpression(model);
      if (hitState) hitState.fired = true;
      maybeHitTip(oml2d);
    } catch {
      // 静默
    }
  };

  const detachHit = () => {
    if (armedModel && hitHandler && typeof armedModel.off === "function") {
      try {
        armedModel.off("hit", hitHandler);
      } catch {
        // ignore
      }
    }
    hitHandler = null;
    armedModel = null;
  };

  const arm = () => {
    detachHit();
    mode = null;
    const model = models.model;
    const result = probe(model);
    if (!result.ok || !result.mode || !model) return;

    mode = result.mode;

    if (result.mode === "A1") {
      // 信任引擎内置 hit→Tap* motion；仅补随机表情
      hitHandler = () => {
        if (dragState.moved) return;
        tryRandomExpression(models.model);
        if (hitState) hitState.fired = true;
        maybeHitTip(oml2d);
      };
      model.on("hit", hitHandler);
      armedModel = model;
    }
    // A2：由上面 patched playRandomMotion 处理（引擎 hit 仍会调用它）
  };

  oml2d.onLoad((status) => {
    if (status === "success") {
      setTimeout(arm, 0);
    } else if (status === "fail") {
      detachHit();
      mode = null;
    }
  });

  // 当前模型若已加载（晚装）也试一次
  setTimeout(arm, 0);

  return () => {
    detachHit();
    mode = null;
    models.playRandomMotion = origPlayRandom;
  };
}
