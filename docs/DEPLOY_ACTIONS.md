# Kirameku GitHub Actions 部署

生产站点：**https://kirameku.xiaoyu-hh.cn**

工作流：`.github/workflows/deploy-kirameku.yml`（推送到 `main` 且路径命中时，或手动 `workflow_dispatch`）。

构建在 **GitHub-hosted runner** 完成；服务器（约 1.7GB RAM）只接收 rsync 产物并执行重启脚本，**不在服务器上执行 `pnpm build`（Next 与 admin 均在 CI 构建）**。

### 前端 rsync 注意

- 同步目录时用 **无尾斜杠** 的源路径（例如 `.next`、`public`），目标为 `…/frontend/`，这样远程保留 `frontend/.next/` 与 `frontend/public/`，不会把 `.next` 内容摊平到 `frontend` 根目录。
- **不要**对 `frontend/` 根目录使用 `--delete`（会删掉远程 `node_modules`、日志等 CI 未上传的文件）。
- 仅对 **`.next/`**、**`public/`**、**`node_modules/`** 子树使用 `--delete`（各自 rsync 命令内 scoped，不是 frontend 根）；`package.json`、`pnpm-lock.yaml`、`next.config.ts` 单独 rsync，不带 `--delete`。

## 仓库 Secrets

与 blog 的 `deploy-blog.yml` 相同命名：

| Secret | 说明 |
|--------|------|
| `SSH_HOST` | 服务器主机名或 IP |
| `SSH_PORT` | SSH 端口（字符串，如 `22`） |
| `SSH_USER` | SSH 用户（如 `blog-deploy`） |
| `SSH_PRIVATE_KEY` | 部署用私钥全文（PEM，`-----BEGIN ... KEY-----`），对应公钥已写入服务器 `authorized_keys` |

## 远端目录与端口

| 组件 | 路径 | 监听 |
|------|------|------|
| Next.js 前端 | `/home/blog-deploy/apps/kirameku/frontend` | `127.0.0.1:3200` |
| FastAPI + admin 静态 | `/home/blog-deploy/apps/kirameku/backend` | `127.0.0.1:8200` |

服务器需预先放置 **`backend/.env`**（工作流不会同步 `.env`），至少包含 `DATABASE_URL`、`SECRET_KEY`、OSS 等（见 `Kirameku-backend/.env.example`）。

重启脚本（由工作流 rsync 后执行）：

- `deploy/restart-frontend.sh` → 远端 `frontend/restart-frontend.sh`
- `deploy/restart-backend.sh` → 远端 `backend/restart-backend.sh`

## OpenResty / Nginx 期望

对外只暴露 443/80；应用只绑 `127.0.0.1`。

建议（与现有 Next `rewrites` 并存时）：

- **`/`** → `http://127.0.0.1:3200`（Next）
- **`/api/`、`/uploads/`** → `http://127.0.0.1:8200`（FastAPI，避免经 Next 代理）
- **`/api/music`** → 例外：必须走 Next（`http://127.0.0.1:3200`），由 `app/api/music/route.ts` 薄 BFF 服务端转发自建 Meting（基址见 `METING_API_BASE`，默认 `http://127.0.0.1:3002`）；不要反代到 FastAPI。
- 若需经 Next SSR 走 rewrite：仓库内 `next.config.ts` 仍将 `/api` 指到 `127.0.0.1:8000`（未改）；可在本机用额外监听或反代对齐，或依赖 OpenResty 直连 8200 处理浏览器/API 流量。

HTML 建议禁用不当缓存（参考仓库根目录 `nginx-cache-debug.md`）：

```nginx
location / {
  proxy_pass http://127.0.0.1:3200;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_no_cache 1;
  proxy_cache_bypass 1;
  add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

`/api/`、`/uploads/`、`/admin/` 等按需反代到 `8200`。

## 回滚（单行）

在 Actions 里对**上一次绿色**的 workflow run 点 **Re-run jobs** 最快。

SSH 手动（将 `HOST`/`PORT`/`USER` 换成实际值）：

```bash
# 前端：恢复上一版 .next（部署前若 tar 过备份）
ssh -p "$PORT" "$USER@$HOST" 'cd /home/blog-deploy/apps/kirameku/frontend && rm -rf .next && tar xzf .next.prev.tgz && bash restart-frontend.sh'

# 后端：恢复上一版代码目录（示例备份名 releases/prev）
ssh -p "$PORT" "$USER@$HOST" 'rsync -a --delete /home/blog-deploy/apps/kirameku/backend/releases/prev/ /home/blog-deploy/apps/kirameku/backend/ && bash /home/blog-deploy/apps/kirameku/backend/restart-backend.sh'
```

首次部署前可在服务器各目录执行一次 `tar czf .next.prev.tgz .next` 或 `cp -a backend backend.releases/prev` 以便回滚。
