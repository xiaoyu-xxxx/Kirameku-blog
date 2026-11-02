/**
 * Cubism2 one-frame assembled preview capture for Live2D admin.
 * Single instance, destroy after use. Loads Cubism2 runtime + PIXI via CDN
 * (admin-only; never bundled into the public site).
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
      // Cubism2 core used by pixi-live2d-display/cubism2
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
      // Register ticker once
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
  // Internal model size varies; prefer bounds when available.
  const mw = model.width || model.internalModel?.width || 512;
  const mh = model.height || model.internalModel?.height || 512;
  const scale = Math.min(width / mw, height / mh) * 0.92;
  model.scale?.set?.(scale);
  if (model.anchor?.set) model.anchor.set(0.5, 0.5);
  model.x = width / 2;
  model.y = height / 2;
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

    // Ensure at least one rendered frame after layout.
    await waitFrames(app, 4, signal);
    await abortableDelay(80, signal);

    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const blob = await new Promise<Blob>((resolve, reject) => {
      try {
        view.toBlob(
          b => (b ? resolve(b) : reject(new Error("canvas toBlob returned empty"))),
          "image/png"
        );
      } catch (err) {
        reject(err);
      }
    });

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
 * Serialize captures (concurrency 1). Later callers wait their turn.
 */
export function captureAssembledPreview(options: CaptureOptions): Promise<Blob> {
  const run = chain.then(() => captureOnce(options), () => captureOnce(options));
  // Keep queue alive even if a job fails.
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
