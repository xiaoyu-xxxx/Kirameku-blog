import type { ExternalApiConfig } from "@/components/providers/AppConfigProvider";

// 未配置 / 未加载时回退的默认地址，与改造前硬编码保持一致。
// 注意：这里的值属于"公网直连地址"，严禁放置任何密钥/token。
// 音乐歌词已改由 /api/music 薄 BFF 转发自建 Meting（type=lrc），故不再保留 meting_lrc 站外地址。
export const DEFAULT_EXTERNAL_APIS: Record<string, string> = {
  hitokoto: "https://v1.hitokoto.cn",
  uapis_weather: "https://uapis.cn/api/v1/misc/weather",
  uapis_random_image: "https://uapis.cn/api/v1/random/image",
  xxapi_bilibilihot: "https://v2.xxapi.cn/api/bilibilihot",
  xxapi_dog: "https://v2.xxapi.cn/api/dog",
  xxapi_dujitang: "https://v2.xxapi.cn/api/dujitang",
  xxapi_history: "https://v2.xxapi.cn/api/history",
  xxapi_bmi: "https://v2.xxapi.cn/api/bmi",
  xxapi_goldprice: "https://v2.xxapi.cn/api/goldprice",
  xxapi_jiakao: "https://v2.xxapi.cn/api/jiakao",
  xxapi_horoscope: "https://v2.xxapi.cn/api/horoscope",
  xxapi_genshin: "https://v2.xxapi.cn/api/ys?return=json",
  xxapi_random4k: "https://v2.xxapi.cn/api/random4kPic",
  xxapi_guanyin: "https://v2.xxapi.cn/api/guanyinrandom",
};

function parseParams(
  params: Record<string, any> | string
): Record<string, string> {
  if (params && typeof params === "object" && !Array.isArray(params)) {
    return Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    );
  }
  if (typeof params === "string" && params.trim()) {
    try {
      const parsed = JSON.parse(params);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return Object.fromEntries(
          Object.entries(parsed).map(([k, v]) => [k, String(v)])
        );
      }
    } catch {
      return {};
    }
  }
  return {};
}

// 返回可用于浏览器直连的地址：base_url + path，并合并配置中的 params。
// 由于 DEFAULT 与种子 base_url 字符串一致，配置加载前后返回值相同字符串，
// 依赖 [base] 的组件不会因配置异步到达而重复请求；仅当管理端真正改了地址才会重拉。
export function resolveExternalBase(
  apis: ExternalApiConfig[] | undefined,
  key: string
): string {
  const list = Array.isArray(apis) ? apis : [];
  const api = list.find(a => a.key === key && a.enabled);
  const base = api?.base_url || DEFAULT_EXTERNAL_APIS[key] || "";
  const path = api?.path ?? "";
  let url = `${base}${path}`;

  if (api) {
    const params = parseParams(api.params);
    const qs = new URLSearchParams(params).toString();
    if (qs) {
      url += (url.includes("?") ? "&" : "?") + qs;
    }
  }
  return url;
}
