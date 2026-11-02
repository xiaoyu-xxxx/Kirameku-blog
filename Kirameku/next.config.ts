import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/api/:path*",
      },
      {
        source: "/uploads/:path*",
        destination: "http://127.0.0.1:8000/uploads/:path*",
      },
      {
        source: "/reader3/:path*",
        destination: `${process.env.NOVEL_API_URL || "http://localhost:8085"}/reader3/:path*`,
      },
    ];
  },

  experimental: {
    optimizePackageImports: [
      "framer-motion",
      "lucide-react",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
    ],
  },

  turbopack: {
    resolveAlias: {
      // oh-my-live2d 打包产物内 Cubism2 胶水代码存在 require("fs")/require("path")，
      // 浏览器端把 Node 内建模块别名到空模块，避免构建失败（服务端不受影响）。
      fs: { browser: "./empty.ts" },
      path: { browser: "./empty.ts" },
    },
  },

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "static.hiromu.top" },
      { protocol: "https", hostname: "hiromu520.oss-cn-beijing.aliyuncs.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "http", hostname: "wfqqreader-1252317822.image.myqcloud.com" },
      { protocol: "https", hostname: "img.xiaoyu-hh.cn" },
      { protocol: "http", hostname: "img.xiaoyu-hh.cn" },
      { protocol: "https", hostname: "xiaoyu-hh.cn" },
    ],
  },
};

export default nextConfig;
