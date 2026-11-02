// Turbopack 浏览器端空模块别名目标。
// oh-my-live2d 打包产物中 Emscripten/Cubism2 胶水代码包含 require("fs")/require("path")，
// 这些分支仅在 Node 环境才会执行。next.config.ts 的 turbopack.resolveAlias 将浏览器端的
// fs/path 解析到这里，避免 "Can't resolve 'fs'" 构建错误；服务端 fs/path 不受影响。
export {};
