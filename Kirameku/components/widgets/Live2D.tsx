"use client";

import { useEffect } from "react";
import Script from "next/script";

/**
 * 看板娘引擎：OhMyLive2D（默认）或旧 waifu/autoload（回退）。
 *
 * 回退开关：NEXT_PUBLIC_USE_OML2D=false 时恢复旧 `autoload.js` 方案。
 * 注意 NEXT_PUBLIC_* 在构建时内联，仅在构建/部署层切换，勿在运行时动态改。
 */
const USE_OML2D = process.env.NEXT_PUBLIC_USE_OML2D !== "false";

const MIN_WIDTH = 768;

// 与现网 autoload.js 对齐：默认角色 index 20（za/zastavam21_2104/normal）、皮肤 0
const DEFAULT_MODEL_INDEX = 20;
const DEFAULT_CLOTHES_INDEX = 0;

// OML2D 自带的持久化 key
const OML2D_MODEL_INDEX_KEY = "OML2D_MODEL_INDEX";
const OML2D_MODEL_CLOTHES_INDEX_KEY = "OML2D_MODEL_CLOTHES_INDEX";

// 旧 waifu autoload.js 的持久化 key（用于迁移）
const LEGACY_MODEL_ID_KEY = "modelId";
const LEGACY_MODEL_TEXTURES_ID_KEY = "modelTexturesId";

// OML2D 挂载到 body 的元素 id（卸载时清理，避免 /garden 等路由切换残留）
const OML2D_ELEMENT_IDS = [
  "oml2d-stage",
  "oml2d-statusBar",
  "oml2d-tips",
  "oml2d-menus",
  "oml2d-global-style",
];

type ModelList = { models: string[][]; messages?: string[] };

type Oml2dModel = { name?: string; path: string[] };

type Oml2dInstance = {
  stageSlideOut: () => Promise<void>;
  // OML2D 0.19.3 未公开销毁 API，这里访问内部 Pixi Application 用于停止渲染循环
  pixiApp?: { app?: { destroy?: (removeView?: boolean) => void } };
};

function toInt(value: string | null): number {
  if (value === null) return NaN;
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
}

/**
 * 解析初始模型索引：
 * 1) OML2D 已持久化 → 沿用（校验范围）；
 * 2) 旧 waifu modelId / modelTexturesId → 迁移；
 * 3) 否则回落到 index 20 / 皮肤 0。
 */
function resolveInitialIndexes(models: Oml2dModel[]): { modelIndex: number; clothesIndex: number } {
  const modelCount = models.length;
  const clampModel = (n: number) => (Number.isInteger(n) && n >= 0 && n < modelCount ? n : DEFAULT_MODEL_INDEX % modelCount);
  const clampClothes = (modelIndex: number, n: number) => {
    const len = models[modelIndex]?.path.length ?? 1;
    return Number.isInteger(n) && n >= 0 && n < len ? n : DEFAULT_CLOTHES_INDEX;
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

  const modelIndex = DEFAULT_MODEL_INDEX % modelCount;
  return { modelIndex, clothesIndex: DEFAULT_CLOTHES_INDEX };
}

function cleanupOml2dDom(): void {
  for (const id of OML2D_ELEMENT_IDS) {
    document.getElementById(id)?.remove();
  }
}

export default function Live2D() {
  useEffect(() => {
    // 回退方案：旧 autoload.js 内部自行判断宽度
    if (!USE_OML2D) return;

    // 宽 < 768 不加载（与现网 autoload 行为一致）
    if (window.innerWidth < MIN_WIDTH) return;

    let cancelled = false;
    let instance: Oml2dInstance | null = null;
    // OML2D 会覆盖 document.oncopy（复制提示），卸载时恢复
    const prevOnCopy = document.oncopy;

    (async () => {
      const list: ModelList = await fetch("/live2d/model_list.json").then((r) => {
        if (!r.ok) throw new Error(`model_list.json 加载失败: ${r.status}`);
        return r.json();
      });
      if (cancelled) return;

      const models: Oml2dModel[] = (list.models ?? []).map((paths, i) => ({
        name: list.messages?.[i] ?? `model-${i}`,
        path: paths.map((p) => `/live2d/model/${p}/index.json`),
      }));

      const { modelIndex, clothesIndex } = resolveInitialIndexes(models);
      localStorage.setItem(OML2D_MODEL_INDEX_KEY, String(modelIndex));
      localStorage.setItem(OML2D_MODEL_CLOTHES_INDEX_KEY, String(clothesIndex));

      const { loadOml2d } = await import("oh-my-live2d");
      if (cancelled) return;

      instance = loadOml2d({
        models,
        dockedPosition: "right",
        mobileDisplay: false,
        sayHello: false,
        // 与现网 waifu 同量级（z-index 40），避免盖过 Toolbox / FloatingPlayer
        stageStyle: { zIndex: "40" },
        statusBar: { style: { zIndex: "40" } },
        menus: { style: { zIndex: "40" } },
      }) as Oml2dInstance;
    })().catch((err) => {
      console.error("[Live2D] OhMyLive2D 初始化失败：", err);
    });

    return () => {
      cancelled = true;
      // OML2D 0.19.3 无公开 destroy；用「停止渲染循环 + 移除 DOM」兜底，避免路由切换泄漏
      instance?.pixiApp?.app?.destroy?.(true);
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
