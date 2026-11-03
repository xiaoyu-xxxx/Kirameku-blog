/**
 * Live2D admin preview helpers (OhMyLive2D, aligned with frontend 0.19.x).
 * - LivePreviewController: single on-screen instance for the fixed preview band
 * - captureAssembledPreview: offscreen one-shot (batch / fallback), concurrency 1
 * Cubism Core is bundled inside oh-my-live2d (Cubism2 + Cubism5); no separate
 * cubism2-only pixi-live2d-display CDN path.
 *
 * Live + offscreen capture share the same contain-fit helper (no hardcoded
 * scale:0.18 / position:[0,40]). Cubism2 may apply the frontend layout uniform
 * fix; Cubism3/4 only get bounds-based contain centering.
 *
 * Note: OML2D uses fixed DOM ids (oml2d-stage, …), so only one instance may exist
 * per document. Offscreen capture pauses the live controller first.
 */
import { loadOml2d } from "oh-my-live2d";

export type CaptureOptions = {
  /** Absolute or root-relative model entry JSON URL (index.json / *.model3.json) */
  modelJsonUrl: string;
  width?: number;
  height?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
};

type PixiAppLike = {
  renderer?: {
    plugins?: {
      extract?: {
        canvas?: (stage: unknown) => HTMLCanvasElement;
      };
    };
  };
  stage?: unknown;
  destroy?: (removeView?: boolean) => void;
  ticker?: { addOnce?: (fn: () => void) => void };
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
  width?: number;
  height?: number;
};

type ModelOptionsLike = {
  scale?: number;
  mobileScale?: number;
  position?: [number, number];
  stageStyle?: Record<string, unknown>;
};

type ModelsApi = {
  __layoutHooked?: boolean;
  model?: Live2DModelLike;
  currentModelOptions?: ModelOptionsLike;
  create: () => Promise<unknown>;
  setScale?: (value?: number) => void;
  setPosition?: (x?: number, y?: number) => void;
};

type Oml2dInstance = {
  pixiApp?: { app?: PixiAppLike };
  models?: ModelsApi;
  onLoad: (fn: (status: "loading" | "success" | "fail") => void | Promise<void>) => void;
  stageSlideIn?: () => Promise<void>;
  clearTips?: () => void;
  stopTipsIdle?: () => void;
  setModelScale?: (scale: number) => void;
  setModelPosition?: (position: { x?: number; y?: number }) => void;
};

/** Cubism2 ModelMatrix logical size (-1..1 span). */
const LOGICAL_SIZE = 2;
/** Leave a little inset so hair/shadows are not clipped by the stage edge. */
const FIT_PADDING = 0.92;

const OML2D_ELEMENT_IDS = [
  "oml2d-stage",
  "oml2d-canvas",
  "oml2d-statusBar",
  "oml2d-tips",
  "oml2d-menus",
  "oml2d-global-style"
];

let chain: Promise<unknown> = Promise.resolve();
let livePauseHandler: (() => Promise<() => Promise<void>>) | null = null;

export function registerLivePreviewPauseHandler(
  handler: (() => Promise<() => Promise<void>>) | null
) {
  livePauseHandler = handler;
}

function cleanupOml2dDom(root?: ParentNode | null) {
  for (const id of OML2D_ELEMENT_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (root && !root.contains(el) && el.id !== "oml2d-global-style") continue;
    try {
      el.remove();
    } catch {
      /* ignore */
    }
  }
}

function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = window.setTimeout(() => resolve(), ms);
    const onAbort = () => {
      window.clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function canvasToPngBlob(view: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      view.toBlob(
        b => (b ? resolve(b) : reject(new Error("canvas toBlob returned empty"))),
        "image/png"
      );
    } catch (err) {
      reject(err);
    }
  });
}

async function extractPngBlob(instance: Oml2dInstance): Promise<Blob> {
  const app = instance.pixiApp?.app;
  const extract = app?.renderer?.plugins?.extract;
  const canvas = extract?.canvas?.(app?.stage);
  if (!canvas) {
    throw new Error("OML2D extract unavailable");
  }
  const blob = await canvasToPngBlob(canvas);
  if (blob.size < 64) {
    throw new Error("Captured preview looks empty");
  }
  return blob;
}

function destroyOml2d(instance: Oml2dInstance | null, host?: HTMLElement | null) {
  if (!instance) {
    cleanupOml2dDom(host);
    return;
  }
  try {
    instance.stopTipsIdle?.();
    instance.clearTips?.();
  } catch {
    /* ignore */
  }
  try {
    instance.pixiApp?.app?.destroy?.(true);
  } catch {
    /* ignore */
  }
  cleanupOml2dDom(host);
  if (host) {
    while (host.firstChild) host.removeChild(host.firstChild);
  }
}

function waitOml2dLoad(
  instance: Oml2dInstance,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      if (err) reject(err);
      else resolve();
    };
    const onAbort = () => finish(new DOMException("Aborted", "AbortError"));
    signal?.addEventListener("abort", onAbort, { once: true });
    const timer = window.setTimeout(() => {
      finish(new Error("Live2D preview timed out"));
    }, timeoutMs);
    instance.onLoad(status => {
      if (status === "success") finish();
      else if (status === "fail") finish(new Error("Live2D model load failed"));
    });
  });
}

/**
 * Cubism2-only: many model jsons only set layout.width; pixi-live2d then treats
 * missing height as 2 and stretches Y. Match frontend fitModelToLegacyStage —
 * setWidth then setHeight with one uniform so both axes share a ratio.
 * Cubism3/4 must not run this path (different layout semantics).
 */
function applyCubism2LayoutUniform(internal: InternalModelLike): void {
  if (typeof internal.coreModel?.getCanvasWidth !== "function") return;
  const layout = internal.settings?.layout;
  if (!layout || (typeof layout.width !== "number" && typeof layout.height !== "number")) {
    return;
  }
  const mapped: Record<string, number> = {};
  for (const key of Object.keys(layout)) {
    const name = key === "center_x" ? "centerX" : key === "center_y" ? "centerY" : key;
    mapped[name] = layout[key];
  }
  const uniform =
    (typeof mapped.height === "number" ? mapped.height : mapped.width) / LOGICAL_SIZE;
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

/**
 * Contain-fit the loaded model into the stage (shared by Live + offscreen capture).
 */
export function fitModelToStage(
  model: Live2DModelLike,
  options: ModelOptionsLike | undefined,
  stageW: number,
  stageH: number
): { scale: number; position: [number, number] } | null {
  const internal = model.internalModel;
  if (!internal || !options) return null;

  // Cubism2 layout hack only — Cubism3/4 skip this branch.
  applyCubism2LayoutUniform(internal);

  const ow = internal.originalWidth || model.width || 0;
  const oh = internal.originalHeight || model.height || 0;
  if (!ow || !oh) return null;

  const availW = Math.max(1, stageW) * FIT_PADDING;
  const availH = Math.max(1, stageH) * FIT_PADDING;
  const outer = Math.min(availW / ow, availH / oh);
  const layoutW = internal.width || ow;
  const layoutH = internal.height || oh;
  const displayW = layoutW * outer;
  const displayH = layoutH * outer;
  const position: [number, number] = [
    (stageW - displayW) / 2,
    (stageH - displayH) / 2
  ];
  options.scale = outer;
  options.mobileScale = outer;
  options.position = position;
  return { scale: outer, position };
}

function applyFitToInstance(
  instance: Oml2dInstance,
  stageW: number,
  stageH: number
): void {
  const models = instance.models;
  const model = models?.model;
  const options = models?.currentModelOptions;
  if (!model || !options) return;
  const fitted = fitModelToStage(model, options, stageW, stageH);
  if (!fitted) return;
  try {
    models?.setScale?.(fitted.scale);
    models?.setPosition?.(fitted.position[0], fitted.position[1]);
  } catch {
    /* ignore */
  }
  try {
    instance.setModelScale?.(fitted.scale);
    instance.setModelPosition?.({ x: fitted.position[0], y: fitted.position[1] });
  } catch {
    /* ignore */
  }
}

/**
 * Arm the model "load" hook so fit runs before OML2D settingModel applies scale.
 * stageSize is a mutable box so ResizeObserver remounts can reuse the same hook
 * shape with fresh dimensions via a new instance.
 */
function installFitHook(
  instance: Oml2dInstance,
  stageSize: { w: number; h: number }
): void {
  const models = instance.models;
  if (!models || models.__layoutHooked) return;
  models.__layoutHooked = true;

  const arm = (model: Live2DModelLike | undefined) => {
    if (!model || model.__layoutArmed) return;
    model.__layoutArmed = true;
    model.on("load", () => {
      fitModelToStage(model, models.currentModelOptions, stageSize.w, stageSize.h);
    });
  };

  arm(models.model);
  const orig = models.create.bind(models);
  models.create = () => {
    const pending = orig();
    arm(models.model);
    return pending;
  };
}

async function createOml2d(
  parent: HTMLElement,
  modelJsonUrl: string,
  width: number,
  height: number,
  signal?: AbortSignal,
  timeoutMs = 15000
): Promise<Oml2dInstance> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  cleanupOml2dDom();
  while (parent.firstChild) parent.removeChild(parent.firstChild);

  const stageSize = { w: width, h: height };

  const instance = loadOml2d({
    parentElement: parent,
    sayHello: false,
    mobileDisplay: false,
    transitionTime: 0,
    initialStatus: "active",
    menus: { disable: true },
    statusBar: { disable: true },
    tips: {
      messageLine: 1,
      idleTips: { message: [], interval: 600000, duration: 0 },
      welcomeTips: { message: {}, duration: 0 },
      copyTips: { message: [], duration: 0 }
    } as any,
    models: [
      {
        name: "admin-preview",
        path: modelJsonUrl,
        // scale / position filled by fitModelToStage (load hook + post-load apply)
        stageStyle: {
          width: `${width}px`,
          height: `${height}px`,
          position: "relative",
          left: "0",
          bottom: "0",
          margin: "0 auto",
          background: "transparent",
          pointerEvents: "none"
        }
      }
    ]
  }) as unknown as Oml2dInstance;

  installFitHook(instance, stageSize);
  await waitOml2dLoad(instance, timeoutMs, signal);
  // Belt-and-suspenders: re-apply if the load hook raced settingModel.
  applyFitToInstance(instance, width, height);
  try {
    await instance.stageSlideIn?.();
  } catch {
    /* ignore slide animation */
  }
  await abortableDelay(120, signal);
  return instance;
}

async function captureOnce(options: CaptureOptions): Promise<Blob> {
  const width = options.width ?? 512;
  const height = options.height ?? 512;
  const timeoutMs = options.timeoutMs ?? 12000;
  const signal = options.signal;
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const resume = livePauseHandler ? await livePauseHandler() : async () => undefined;

  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;width:" +
    width +
    "px;height:" +
    height +
    "px;opacity:0;pointer-events:none;overflow:hidden;";
  document.body.appendChild(host);

  let instance: Oml2dInstance | null = null;
  try {
    instance = await createOml2d(
      host,
      options.modelJsonUrl,
      width,
      height,
      signal,
      timeoutMs
    );
    return await extractPngBlob(instance);
  } finally {
    destroyOml2d(instance, host);
    try {
      host.remove();
    } catch {
      /* ignore */
    }
    try {
      await resume();
    } catch {
      /* ignore resume errors */
    }
  }
}

/**
 * Serialize offscreen captures (concurrency 1). Later callers wait their turn.
 */
export function captureAssembledPreview(options: CaptureOptions): Promise<Blob> {
  const run = chain.then(() => captureOnce(options), () => captureOnce(options));
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export function skinModelJsonUrl(
  relPath: string,
  entryJson = "index.json",
  assetBase = "/live2d/"
): string {
  const base = assetBase.endsWith("/") ? assetBase : `${assetBase}/`;
  const rel = (relPath || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  const entry = (entryJson || "index.json").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!rel) return `${base}model/${entry}`;
  return `${base}model/${rel}/${entry}`;
}

export type LivePreviewLoadOptions = {
  modelJsonUrl: string;
  timeoutMs?: number;
  signal?: AbortSignal;
};

/**
 * Single on-screen OhMyLive2D instance for the admin fixed preview band.
 * Destroy/rebuild on skin change; snapshot via pixi extract (same as frontend capturePhoto).
 * ResizeObserver remounts with the same contain-fit when the stage size changes.
 */
export class LivePreviewController {
  private container: HTMLElement | null = null;
  private hostEl: HTMLElement | null = null;
  private instance: Oml2dInstance | null = null;
  private loadSeq = 0;
  private resizeObserver: ResizeObserver | null = null;
  private currentUrl = "";
  private lastW = 0;
  private lastH = 0;
  private resizeTimer: number | null = null;
  private resumeAfterPause: (() => Promise<void>) | null = null;

  constructor() {
    registerLivePreviewPauseHandler(async () => {
      const url = this.currentUrl;
      const shouldResume = Boolean(url && this.container);
      this.teardownInstance();
      return async () => {
        if (shouldResume && this.container && url) {
          await this.load({ modelJsonUrl: url, timeoutMs: 15000 });
        }
      };
    });
  }

  get ready(): boolean {
    return Boolean(this.instance && this.currentUrl);
  }

  get modelJsonUrl(): string {
    return this.currentUrl;
  }

  mount(container: HTMLElement) {
    if (this.container === container && this.hostEl) return;
    this.destroy();
    this.container = container;
    while (container.firstChild) container.removeChild(container.firstChild);
    const host = document.createElement("div");
    host.style.cssText =
      "width:100%;height:100%;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;";
    container.appendChild(host);
    this.hostEl = host;
    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.container || !this.currentUrl) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      if (!w || !h) return;
      if (Math.abs(w - this.lastW) < 8 && Math.abs(h - this.lastH) < 8) return;
      this.lastW = w;
      this.lastH = h;
      if (this.resizeTimer != null) window.clearTimeout(this.resizeTimer);
      const url = this.currentUrl;
      this.resizeTimer = window.setTimeout(() => {
        this.resizeTimer = null;
        if (!this.container || !url || this.currentUrl !== url) return;
        void this.load({ modelJsonUrl: url, timeoutMs: 15000 });
      }, 160);
    });
    this.resizeObserver.observe(container);
  }

  private teardownInstance() {
    destroyOml2d(this.instance, this.hostEl);
    this.instance = null;
    this.currentUrl = "";
  }

  async load(options: LivePreviewLoadOptions): Promise<void> {
    const timeoutMs = options.timeoutMs ?? 15000;
    const signal = options.signal;
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (!this.container || !this.hostEl) throw new Error("Live preview host not mounted");

    const seq = ++this.loadSeq;
    this.teardownInstance();

    const width = Math.max(160, this.container.clientWidth || 512);
    const height = Math.max(160, this.container.clientHeight || 360);
    this.lastW = width;
    this.lastH = height;

    const instance = await createOml2d(
      this.hostEl,
      options.modelJsonUrl,
      width,
      height,
      signal,
      timeoutMs
    );

    if (seq !== this.loadSeq || signal?.aborted) {
      destroyOml2d(instance, this.hostEl);
      throw new DOMException("Aborted", "AbortError");
    }

    this.instance = instance;
    this.currentUrl = options.modelJsonUrl;
  }

  async snapshot(signal?: AbortSignal): Promise<Blob> {
    if (!this.instance) {
      throw new Error("Live preview is not ready");
    }
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    await abortableDelay(50, signal);
    return extractPngBlob(this.instance);
  }

  /** Abort in-flight load and tear down WebGL / OML2D DOM. */
  destroy() {
    this.loadSeq += 1;
    if (this.resizeTimer != null) {
      window.clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.teardownInstance();
    this.hostEl = null;
    this.container = null;
    this.lastW = 0;
    this.lastH = 0;
  }
}
