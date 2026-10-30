import { photowallUrl } from "@/lib/cdn";

// siteConfig.ts - 全站配置中心

export const siteConfig = {
  // 网站标题与博主信息
  title: "白居易",
  url: "https://blog.xiaoyu-hh.cn",
  authorName: "小雨",
  bio: "个人前端与博客向小站，记录学习、折腾与日常。",

  // 头像设置
  avatarUrl: photowallUrl("hong.jpg"),

  // 背景设置
  useGradient: false,
  themeColors: ["#a18cd1", "#fbc2eb", "#a1c4fd", "#c2e9fb"],
  bgImages: [
    photowallUrl("1.webp"),
    photowallUrl("42.webp"),
    photowallUrl("20.webp"),
    photowallUrl("36.webp"),
    photowallUrl("39.webp"),
    photowallUrl("41.webp"),
  ],

  // 默认封面图
  defaultPostCover: photowallUrl("default-cover.jpg"),

  // 照片墙预览图（R2 无 photo-wall.jpg，沿用运维 10.jpg 占位）
  photoWallImage: photowallUrl("10.jpg"),

  // 云音乐配置（网易云音乐）
  // 填歌单 ID 则自动拉取整个歌单，填歌曲 ID 列表则只播放指定歌曲
  cloudMusicPlaylistId: "17943739323",  // 歌单 ID（优先）
  cloudMusicIds: [],                     // 歌曲 ID 列表（歌单为空时使用）

  // 后端 API 地址（留空，开发通过 next.config.ts rewrites 代理，生产通过 Nginx 反代）
  apiBaseUrl: "",

  // 社交链接（仅保留已知真实账号；其余留空，勿伪造）
  social: {
    github: "https://github.com/xiaoyu-xxxx",
    gitee: "",
    google: "",
    email: "",
    qq: "",
    wechat: "",
  },

  // 站点信息
  buildDate: "2026-05-07T12:00:00",
  footerBadges: [
    { name: "Next.js 15", color: "text-sky-500" },
    { name: "React 19", color: "text-cyan-400" },
    { name: "Tailwind 4", color: "text-teal-400" },
  ],
  // 备案号：上游他人 ICP 已清空；有正式备案后再填
  icpConfig: {
    name: "",
    link: "https://beian.miit.gov.cn/",
  },
  moeIcpConfig: {
    name: "",
    link: "https://icp.gov.moe/",
  },

  // 分类标题
  chatterTitle: "留言",
  chatterDescription: "生活、技术、随想的碎片记录",
};
