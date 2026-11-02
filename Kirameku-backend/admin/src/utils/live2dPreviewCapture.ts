/**
 * Cubism2 Live2D admin preview helpers.
 * - LivePreviewController: single on-screen instance for the right panel
 * - captureAssembledPreview: offscreen one-shot (batch / fallback), concurrency 1
 * CDN pixi + cubism2 + /live2d/live2d.min.js (admin-only; not for public site).
 */
export type CaptureOptions = {
  /** Model index.json absolute or root-relative URL */
  modelJsonUrl: string;
  width?: number;
  height?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
};

type ScriptWindow = Window &
  typeof globalThis & {
    PIXI?: any;
    Live2D?: any;
  };

let scriptsPromise: Promise<void> | null = null;
let chain: Promise<unknown> = Promise.resolve();

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-l2d-preview="${src}"]`
    );
    if (existing) {
      if (existing.dataset.loaded === "1") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`Failed to load ${src}`)),
        { once: true }
      );
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.dataset.l2dPreview = src;
    s.onload = () => {
      s.dataset.loaded = "1";
      resolve();
    };
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function ensureCaptureRuntime(): Promise<any> {
  if (!scriptsPromise) {
    scriptsPromise = (async () => {
      const w = window as ScriptWindow;
      if (!w.Live2D) {
        await loadScript("/live2d/live2d.min.js");
      }
      if (!w.PIXI) {
        await loadScript(
          "https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js"
        );
      }
      if (!w.PIXI?.live2d?.Live2DModel) {
        await loadScript(
          "https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism2.min.js"
        );
      }
      if (!w.PIXI?.live2d?.Live2DModel) {
        throw new Error("pixi-live2d-display Cubism2 runtime unavailable");
      }
      try {
        w.PIXI.live2d.Live2DModel.registerTicker?.(w.PIXI.Ticker);
      } catch {
        /* ignore */
      }
    })().catch(err => {
      scriptsPromise = null;
      throw err;
    });
  }
  await scriptsPromise;
  return (window as ScriptWindow).PIXI;
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

async function waitFrames(
  app: any,
  frames: number,
  signal?: AbortSignal
): Promise<void> {
  for (let i = 0; i < frames; i++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    await new Promise<void>(resolve => {
      app.ticker.addOnce(() => resolve());
    });
  }
}

function fitModel(model: any, width: number, height: number) {
  const mw = model.width || model.internalModel?.width || 512;
  const mh = model.height || model.internalModel?.height || 512;
  const scale = Math.min(width / mw, height / mh) * 0.92;
  model.scale?.set?.(scale);
  if (model.anchor?.set) model.anchor.set(0.5, 0.5);
  model.x = width / 2;
  model.y = height / 2;
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

async function captureOnce(options: CaptureOptions): Promise<Blob> {
  const width = options.width ?? 512;
  const height = options.height ?? 512;
  const timeoutMs = options.timeoutMs ?? 12000;
  const signal = options.signal;

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const PIXI = await ensureCaptureRuntime();
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const app = new PIXI.Application({
    width,
    height,
    backgroundAlpha: 0,
    antialias: true,
    preserveDrawingBuffer: true,
    autoStart: true
  });

  const view = app.view as HTMLCanvasElement;
  view.style.cssText =
    "position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;";
  document.body.appendChild(view);

  let model: any = null;
  const timeout = window.setTimeout(() => {
    try {
      signal?.throwIfAborted?.();
    } catch {
      /* handled below via race */
    }
  }, timeoutMs);

  try {
    const loadPromise = PIXI.live2d.Live2DModel.from(options.modelJsonUrl, {
      autoInteract: false,
      idleMotionGroup: "idle"
    });

    const raced = await Promise.race([
      loadPromise,
      abortableDelay(timeoutMs, signal).then(() => {
        throw new Error("Live2D preview capture timed out");
      })
    ]);
    model = raced;
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    fitModel(model, width, height);
    app.stage.addChild(model);

    await waitFrames(app, 4, signal);
    await abortableDelay(80, signal);

    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const blob = await canvasToPngBlob(view);
    if (blob.size < 64) {
      throw new Error("Captured preview looks empty");
    }
    return blob;
  } finally {
    window.clearTimeout(timeout);
    try {
      model?.destroy?.({ children: true, texture: true, baseTexture: true });
    } catch {
      /* ignore */
    }
    try {
      app.destroy(true, { children: true, texture: true, baseTexture: true });
    } catch {
      try {
        app.destroy(true);
      } catch {
        /* ignore */
      }
    }
    try {
      view.remove();
    } catch {
      /* ignore */
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

export function skinModelJsonUrl(relPath: string, assetBase = "/live2d/"): string {
  const base = assetBase.endsWith("/") ? assetBase : `${assetBase}/`;
  const rel = (relPath || "").replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
  return `${base}model/${rel}/index.json`;
}

export type LivePreviewLoadOptions = {
  modelJsonUrl: string;
  timeoutMs?: number;
  signal?: AbortSignal;
};

/**
 * Single on-screen Cubism2 instance for the admin right panel.
 * Destroy/rebuild model on skin change; snapshot via the same canvas.
 */
export class LivePreviewController {
  private container: HTMLElement | null = null;
  private app: any = null;
  private model: any = null;
  private loadSeq = 0;
  private resizeObserver: ResizeObserver | null = null;
  private currentUrl = "";

  get ready(): boolean {
    return Boolean(this.app && this.model && this.currentUrl);
  }

  get modelJsonUrl(): string {
    return this.currentUrl;
  }

  mount(container: HTMLElement) {
    if (this.container === container && this.app) return;
    this.destroyAppOnly();
    this.container = container;
    while (container.firstChild) container.removeChild(container.firstChild);

    const width = Math.max(160, container.clientWidth || 512);
    const height = Math.max(160, container.clientHeight || 380);

    // Application is created lazily in load() after runtime scripts are ready,
    // so mount only stores the host and size observer.
    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => {
      void this.resizeToContainer();
    });
    this.resizeObserver.observe(container);
    void width;
    void height;
  }

  private async ensureApp(): Promise<any> {
    if (!this.container) throw new Error("Live preview host not mounted");
    const PIXI = await ensureCaptureRuntime();
    if (this.app) return PIXI;

    const width = Math.max(160, this.container.clientWidth || 512);
    const height = Math.max(160, this.container.clientHeight || 380);
    const app = new PIXI.Application({
      width,
      height,
      backgroundAlpha: 0,
      antialias: true,
      preserveDrawingBuffer: true,
      autoStart: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true
    });
    const view = app.view as HTMLCanvasElement;
    view.style.cssText = "display:block;max-width:100%;max-height:100%;margin:0 auto;";
    this.container.appendChild(view);
    this.app = app;
    return PIXI;
  }

  private async resizeToContainer() {
    if (!this.app || !this.container) return;
    const width = Math.max(160, this.container.clientWidth || 512);
    const height = Math.max(160, this.container.clientHeight || 380);
    try {
      this.app.renderer.resize(width, height);
    } catch {
      /* ignore */
    }
    if (this.model) {
      fitModel(this.model, width, height);
    }
  }

  private destroyModelOnly() {
    if (!this.model) return;
    try {
      this.app?.stage?.removeChild?.(this.model);
    } catch {
      /* ignore */
    }
    try {
      this.model.destroy?.({ children: true, texture: true, baseTexture: true });
    } catch {
      /* ignore */
    }
    this.model = null;
    this.currentUrl = "";
  }

  private destroyAppOnly() {
    this.destroyModelOnly();
    if (this.app) {
      const view = this.app.view as HTMLCanvasElement | undefined;
      try {
        this.app.destroy(true, { children: true, texture: true, baseTexture: true });
      } catch {
        try {
          this.app.destroy(true);
        } catch {
          /* ignore */
        }
      }
      try {
        view?.remove?.();
      } catch {
        /* ignore */
      }
      this.app = null;
    }
  }

  async load(options: LivePreviewLoadOptions): Promise<void> {
    const timeoutMs = options.timeoutMs ?? 15000;
    const signal = options.signal;
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (!this.container) throw new Error("Live preview host not mounted");

    const seq = ++this.loadSeq;
    this.destroyModelOnly();

    const PIXI = await this.ensureApp();
    if (seq !== this.loadSeq) throw new DOMException("Aborted", "AbortError");
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    await this.resizeToContainer();

    const loadPromise = PIXI.live2d.Live2DModel.from(options.modelJsonUrl, {
      autoInteract: false,
      idleMotionGroup: "idle"
    });

    const model = await Promise.race([
      loadPromise,
      abortableDelay(timeoutMs, signal).then(() => {
        throw new Error("Live2D live preview timed out");
      })
    ]);

    if (seq !== this.loadSeq || signal?.aborted) {
      try {
        model?.destroy?.({ children: true, texture: true, baseTexture: true });
      } catch {
        /* ignore */
      }
      throw new DOMException("Aborted", "AbortError");
    }

    const width = this.app.screen.width;
    const height = this.app.screen.height;
    fitModel(model, width, height);
    this.app.stage.addChild(model);
    this.model = model;
    this.currentUrl = options.modelJsonUrl;

    await waitFrames(this.app, 3, signal);
    if (seq !== this.loadSeq) throw new DOMException("Aborted", "AbortError");
  }

  async snapshot(signal?: AbortSignal): Promise<Blob> {
    if (!this.app || !this.model) {
      throw new Error("Live preview is not ready");
    }
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    await waitFrames(this.app, 2, signal);
    const view = this.app.view as HTMLCanvasElement;
    const blob = await canvasToPngBlob(view);
    if (blob.size < 64) {
      throw new Error("Live snapshot looks empty");
    }
    return blob;
  }

  /** Abort in-flight load and tear down WebGL. */
  destroy() {
    this.loadSeq += 1;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.destroyAppOnly();
    this.container = null;
  }
}
