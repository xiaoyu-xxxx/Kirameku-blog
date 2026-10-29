/** Site static images CDN (R2 public domain). */
export const IMG_CDN_ORIGIN = "https://img.xiaoyu-hh.cn";

/** Prefix for former frontend/public/images/** assets. Admin uploads use kirameku/; do not mix. */
export const PHOTOWALL_PREFIX = "photowall";

/**
 * Map a former /images/... path (or bare relative path under images/) to the photowall CDN URL.
 * Examples:
 *   photowallUrl("/images/hong.jpg") -> https://img.xiaoyu-hh.cn/photowall/hong.jpg
 *   photowallUrl("projects/x.png")   -> https://img.xiaoyu-hh.cn/photowall/projects/x.png
 */
export function photowallUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return pathOrUrl;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const cleaned = pathOrUrl.replace(/^\/images\//, "").replace(/^\//, "");
  return `${IMG_CDN_ORIGIN}/${PHOTOWALL_PREFIX}/${cleaned}`;
}
