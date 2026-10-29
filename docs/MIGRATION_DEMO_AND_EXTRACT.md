# Demo 案例 & URL 文章提取 — 迁移说明

本仓库自旧 monorepo `blog` 移植两项能力：**案例 Demo 管理**（zip → demos 子域 → 文章 iframe）与 **URL 识别/提取**（Readability + 可选 Jina，图片走现有 R2 上传）。

## 数据库

新表 **`demo_case`**（PostgreSQL，见 `Kirameku-backend/init_db.sql`）。已有库可执行：

```sql
CREATE TABLE IF NOT EXISTS demo_case (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    slug          VARCHAR(80)  UNIQUE NOT NULL,
    entry_path    VARCHAR(200) DEFAULT 'index.html',
    entry_query   VARCHAR(200) DEFAULT '',
    base_url      VARCHAR(300) DEFAULT '',
    status        INTEGER      DEFAULT 1,
    package_size  INTEGER      DEFAULT 0,
    file_count    INTEGER      DEFAULT 0,
    remark        VARCHAR(500) DEFAULT '',
    created_by    VARCHAR(50)  DEFAULT '',
    updated_by    VARCHAR(50)  DEFAULT '',
    created_at    TIMESTAMP    DEFAULT NOW(),
    updated_at    TIMESTAMP    DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_demo_case_slug ON demo_case(slug);
```

### 从旧 MySQL `blog_demo_case` 导入

字段一一对应（`status` 仍为 0/1）。示例：

```sql
INSERT INTO demo_case (
  name, slug, entry_path, entry_query, base_url, status,
  package_size, file_count, remark, created_by, updated_by, created_at, updated_at
)
SELECT
  name, slug, entry_path, entry_query, base_url, status,
  package_size, file_count, remark, created_by, updated_by, created_at, updated_at
FROM blog_demo_case;
```

静态文件仍在 R2/OSS 的 `demos/<slug>/` 前缀下时，**无需重新上传 zip**，只需导入元数据并保证 `DEMO_PUBLIC_BASE` 与 CDN 一致。

## 环境变量（`Kirameku-backend/.env`）

| 变量 | 说明 | 默认 |
|------|------|------|
| `DEMO_STORAGE` | `r2` 或 `local` | `r2` |
| `DEMO_PUBLIC_BASE` | iframe 公开 URL 前缀 | `https://demos.xiaoyu-hh.cn` |
| `DEMO_R2_PREFIX` | R2 对象前缀 | `demos/` |
| `DEMO_LOCAL_ROOT` | 本地调试目录 | `./uploads/demos` |
| `DEMO_MAX_ZIP_BYTES` | zip 大小上限 | 20MB |
| `DEMO_MAX_FILES` | 单包文件数上限 | 300 |
| `DEMO_UPLOAD_RATE_LIMIT` | 每管理员每小时上传次数 | 10 |
| `JINA_READER_BASE` | Jina Reader | `https://r.jina.ai` |

图片迁移复用现有 `UPLOADTYPE=cf`、`CLOUDFLARE_*`、`UPLOAD_PREFIX`（与文章封面上传相同）。

## API 摘要

- **Demo（需管理员 JWT）**
  - `GET/POST /api/demo-cases`
  - `GET/PUT/DELETE /api/demo-cases/{id}`
  - `POST /api/demo-cases/{id}/upload` — 仅 `.zip`，白名单扩展名，防路径穿越
  - `GET /api/demo-cases/{id}/iframe-snippet`
- **文章提取**
  - `POST /api/posts/extract` — body `{ "url": "...", "useJina": false }`

## 管理端

- 菜单 **案例 Demo**：创建 slug、上传 zip、复制 iframe HTML。
- **写文章 / 编辑文章**：顶部「从 URL 提取」+ 可选「Jina 增强」。

iframe 默认：`sandbox="allow-scripts allow-forms"`（不含 `allow-same-origin`）。

## 前台

文章 Markdown 中的 `<iframe …>` 在 `Kirameku/app/posts/[slug]/page.tsx` 中按玻璃拟态样式渲染。现有文章路径示例：

`https://demos.xiaoyu-hh.cn/css-has-form/index.html?embed=1`

## Ops：demos 子域（当前 525 / X-Frame-Options）

代码侧已按 `demos.xiaoyu-hh.cn/<slug>/…` 生成 URL；**恢复线上需运维**：

1. 修复 Cloudflare → 源站 **525**（源站/nginx 或 R2 公共访问策略）。
2. 对 **demos** 虚拟主机响应头（便于从 `blog.xiaoyu-hh.cn` 嵌入）：
   - 移除或覆盖 `X-Frame-Options: SAMEORIGIN`
   - 推荐：`Content-Security-Policy: frame-ancestors 'self' https://blog.xiaoyu-hh.cn https://*.xiaoyu-hh.cn`
   - 勿对 demos 整站设置阻止嵌入的 CSP。
3. R2 公共桶或 Worker 路由将 `demos/` 前缀映射到 `DEMO_PUBLIC_BASE` 域名。
4. 本地调试可设 `DEMO_STORAGE=local`，静态文件在 `DEMO_LOCAL_ROOT`；生产仍用 `r2`。

## 上传示例 zip 流程

1. 管理端 → 案例 Demo → 新增：`slug=hello-demo`，`entry_query=embed=1`。
2. 打包静态站点为 zip（根目录含 `index.html`），点击「上传 zip」。
3. 复制 iframe 片段到文章 Markdown 并发布。
