/**
 * Live2D admin preview helpers (OhMyLive2D, aligned with frontend 0.19.x).
 * - LivePreviewController: single on-screen instance for the right panel
 * - captureAssembledPreview: offscreen one-shot (batch / fallback), concurrency 1
 * Cubism Core is bundled inside oh-my-live2d (Cubism2 + Cubism5); no separate
 * cubism2-only pixi-live2d-display CDN path.
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

type Oml2dInstance = {
  pixiApp?: { app?: PixiAppLike };
  onLoad: (fn: (status: "loading" | "success" | "fail") => void | Promise<void>) => void;
  stageSlideIn?: () => Promise<void>;
  clearTips?: () => void;
  stopTipsIdle?: () => void;
};

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
        scale: 0.18,
        position: [0, 40],
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

  await waitOml2dLoad(instance, timeoutMs, signal);
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
 * Single on-screen OhMyLive2D instance for the admin right panel.
 * Destroy/rebuild on skin change; snapshot via pixi extract (same as frontend capturePhoto).
 */
export class LivePreviewController {
  private container: HTMLElement | null = null;
  private hostEl: HTMLElement | null = null;
  private instance: Oml2dInstance | null = null;
  private loadSeq = 0;
  private resizeObserver: ResizeObserver | null = null;
  private currentUrl = "";
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
      /* OML2D stage size is set at load; remount on next load if needed */
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
    const height = Math.max(160, this.container.clientHeight || 380);

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
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.teardownInstance();
    this.hostEl = null;
    this.container = null;
  }
}
