# 安全热修：Live2D 遗留脚本清理 + 管理接口鉴权（v1）

**状态：** ready-for-dev → implemented  
**日期：** 2026-11-21（Asia/Shanghai）  
**仓库：** xiaoyu-xxxx/Kirameku-blog  
**分支：** `feat/security-live2d-admin-auth`  
**范围：** 删除可远程拉 JS 的 Live2D 遗留入口；访客删除/清空与仪表盘统计接入管理端登录校验。  
**不做：** Cloud Agent；合 main / 部署；Demo 写 R2；文章 HTML 消毒；管理端 mock 开关；改公开访客上报。

## 0. 背景（审计）

- `Kirameku/public/live2d/jsdelivr/sequential/autoload.js` 若被直接请求，会从 `cdn.jsdelivr.net/gh/nova1751/live2d-api@latest/` 再拉可执行脚本。默认前台走 npm `oh-my-live2d`；回退用本地 `/live2d/jsdelivr/random/autoload.js`（`live2d_path = '/live2d/'`）。`sequential/` 未被组件引用，但仍是公开静态文件。
- `Kirameku-backend/app/api/visitors.py` 的删除单条、清空全部，以及 `dashboard.py` 的 `/stats`，未见 `get_current_user`。管理数据不应公开可改/可读。

## 1. 范围 A · Live2D

- **删除** 整目录 `Kirameku/public/live2d/jsdelivr/sequential/`（含 `autoload.js`、`waifu-tips.js`）。
- **保留** `jsdelivr/random/autoload.js` 与站内 `/live2d/` 模型、本地 `asteroids.js`；回退路径不指向 jsDelivr `@latest`。
- 不改默认 oml2d 组件路径；不新增远程 `@latest` 脚本引用。
- 下次前端 `public` rsync（含目录内 `--delete`）后，线上残留的 `sequential/` 会被清掉。

## 2. 范围 B · 接口鉴权

对齐仓内其它管理 API：`Depends(get_current_user)`（HTTP Bearer JWT）。

| 方法 | 路径 | 变更 |
|---|---|---|
| DELETE | `/api/visitors/{id}` | 加鉴权 |
| DELETE | `/api/visitors` | 加鉴权 |
| GET | `/api/visitors` | 加鉴权（列表含 IP，仅管理端用） |
| GET | `/api/visitors/count` | 加鉴权（仅管理端用；前台无调用） |
| GET | `/api/dashboard/stats` | 加鉴权 |
| POST | `/api/visitors/record` | **保持公开** |
| GET | `/api/visitors/location` | **保持公开** |

管理端 `admin/src/utils/http` 已对非白名单请求自动挂 `Authorization: Bearer …`，`visitor.ts` / `dashboard.ts` 无需改调用方。

## 3. 验收

1. 仓内不再有会从 jsDelivr `@latest` 拉 Live2D 可执行脚本的公开入口；默认看板娘 / 本地 random 回退仍可用。
2. 未登录 `DELETE /api/visitors/{id}`、`DELETE /api/visitors` → 401。
3. 未登录 `GET /api/dashboard/stats` → 401。
4. 已登录管理端访客页、仪表盘仍可正常使用。
5. 前台 `POST /api/visitors/record`、`GET /api/visitors/location` 仍公开。
6. PR open；不合不部署。

## 4. 触及文件

- 删除 `Kirameku/public/live2d/jsdelivr/sequential/**`
- `Kirameku-backend/app/api/visitors.py`
- `Kirameku-backend/app/api/dashboard.py`
- `docs/prompts/security-live2d-admin-auth.md`
