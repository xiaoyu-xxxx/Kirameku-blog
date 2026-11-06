import { siteConfig } from "@/siteConfig";

const BASE_URL = siteConfig.apiBaseUrl;

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** 解析 FastAPI `detail`（string | {msg} | validation[]）为可读中文 */
function formatDetail(detail: unknown): string | null {
  if (detail == null) return null;
  if (typeof detail === "string") {
    const s = detail.trim();
    return s || null;
  }
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const o = item as { msg?: unknown; message?: unknown };
          if (typeof o.msg === "string") return o.msg;
          if (typeof o.message === "string") return o.message;
        }
        return null;
      })
      .filter((m): m is string => !!m && m.trim().length > 0);
    return msgs.length ? msgs.join("；") : null;
  }
  if (typeof detail === "object") {
    const o = detail as { msg?: unknown; message?: unknown };
    if (typeof o.msg === "string" && o.msg.trim()) return o.msg.trim();
    if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
  }
  return null;
}

async function readErrorMessage(res: Response): Promise<string> {
  const fallback = res.status === 403
    ? "没有权限执行此操作"
    : res.status === 401
      ? "请先登录"
      : `请求失败（${res.status}）`;
  try {
    const data = await res.json();
    const fromDetail = formatDetail(data?.detail);
    if (fromDetail) return fromDetail;
    if (typeof data?.message === "string" && data.message.trim()) {
      return data.message.trim();
    }
  } catch {
    // 非 JSON 体：走 fallback
  }
  return fallback;
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const message = await readErrorMessage(res);
    throw new ApiError(message, res.status);
  }
  return res.json();
}

function qs(params?: Record<string, string | number | undefined>): string {
  if (!params) return "";
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== ""
  );
  if (!entries.length) return "";
  return "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

export { request, qs, ApiError, BASE_URL };
