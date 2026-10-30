import { NextRequest, NextResponse } from "next/server";

// 自建 Meting-API 基址：默认同机 127.0.0.1:3002。
// 生产/容器可用环境变量覆盖为 https://music.xiaoyu-hh.cn 或 https://origin-music.xiaoyu-hh.cn。
const METING_API_BASE = (process.env.METING_API_BASE || "http://127.0.0.1:3002").replace(/\/+$/, "");
const METING_TIMEOUT_MS = 5000;

interface MetingTrack {
  id?: string | number;
  title?: string;
  name?: string;
  author?: string;
  artist?: string | string[];
  url?: string;
  src?: string;
  pic?: string;
  cover?: string;
  lrc?: string;
  lrcUrl?: string;
}

interface SongData {
  id: string;
  title: string;
  artist: string;
  cover: string;
  src: string;
  lrcUrl: string;
}

// 上游歌单/歌曲项通常不含顶层 id，从签名 URL 的 id= 参数回退。
function extractTrackId(track: MetingTrack, index: number): string {
  const raw = track.id;
  if (raw !== undefined && raw !== null && raw !== "") {
    return String(raw);
  }
  for (const candidate of [track.url, track.src, track.lrc, track.pic]) {
    if (!candidate) continue;
    try {
      const id = new URL(candidate).searchParams.get("id");
      if (id) return id;
    } catch {
      // 忽略非法 URL
    }
  }
  return String(index);
}

function mapTrack(track: MetingTrack, index: number): SongData {
  const artist = Array.isArray(track.artist)
    ? track.artist.join(", ")
    : String(track.artist || track.author || "未知歌手");

  return {
    id: extractTrackId(track, index),
    title: String(track.title || track.name || "未知歌曲"),
    artist,
    cover: String(track.pic || track.cover || ""),
    src: String(track.url || track.src || ""),
    lrcUrl: String(track.lrc || track.lrcUrl || ""),
  };
}

async function fetchMeting(params: Record<string, string>): Promise<MetingTrack[]> {
  const qs = new URLSearchParams({ server: "netease", ...params });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), METING_TIMEOUT_MS);
  try {
    const res = await fetch(`${METING_API_BASE}/api?${qs}`, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Meting upstream responded ${res.status}`);
    }
    const data: unknown = await res.json();
    if (!Array.isArray(data)) {
      throw new Error("Meting upstream returned unexpected payload");
    }
    return data as MetingTrack[];
  } finally {
    clearTimeout(timer);
  }
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const playlistId = searchParams.get("id");
  const songIds = searchParams.get("ids");

  if (!playlistId && !songIds) {
    return NextResponse.json(
      { error: "需要提供 id (歌单ID) 或 ids (歌曲ID,逗号分隔)" },
      { status: 400 }
    );
  }

  try {
    let tracks: MetingTrack[] = [];

    if (playlistId) {
      tracks = await fetchMeting({ type: "playlist", id: playlistId });
    } else if (songIds) {
      const ids = songIds.split(",").map((s) => s.trim()).filter(Boolean);
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            return await fetchMeting({ type: "song", id });
          } catch {
            return [];
          }
        })
      );
      tracks = results.flat();
    }

    const songs = tracks.map(mapTrack).filter((s) => s.src);
    return NextResponse.json(songs);
  } catch (err) {
    console.error("Meting proxy error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "获取音乐数据失败" }, { status: 500 });
  }
}
