export type PublicSiteSettings = Record<string, unknown>;

export function getBackendBaseUrl(): string {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:8000"
  );
}

export async function fetchPublicSiteSettings(): Promise<PublicSiteSettings> {
  try {
    const res = await fetch(`${getBackendBaseUrl()}/api/public/config`, {
      cache: "no-store",
    });
    if (!res.ok) return {};
    const data = (await res.json()) as { site_settings?: PublicSiteSettings };
    return data.site_settings ?? {};
  } catch {
    return {};
  }
}

/** Non-empty string from site_settings, else fallback. */
export function siteSettingString(
  settings: PublicSiteSettings,
  key: string,
  fallback: string
): string {
  const value = settings[key];
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && !Number.isNaN(value)) return String(value);
  return fallback;
}
