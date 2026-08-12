# Cloudflare 部署指南（训练/航班收藏）

将整个应用以**单个 Worker + 静态资源**的方式部署到 Cloudflare，数据放在 **D1**，
图片/logo/备份放在 **R2**，访问控制使用 **Cloudflare Access（Zero Trust 免费版）**。

> 本云版本与本地版的差异：
> - 移除了 **byAir 导入**，仅保留普通 CSV 导入。
> - 不做应用内登录，认证完全交给 Cloudflare Access（在边缘侧保护整个站点）。
> - 备份格式由 `.db`（SQLite）改为 `.json`（D1 导出的 trips + trip_images）。
> - 种子数据（站点/机场/运营商）不再由应用启动时写入，而是通过脚本一次性灌入 D1。

## 架构

```
Cloudflare Access (保护整个域名)
        │
        ▼
Worker (Hono)  ──assets──▶ 编译后的前端 (cloudflare/assets)
        │
        ├── D1  train-air-db   (stations/airports/operators/trips/trip_images)
        └── R2  train-air      (logos/<CODE>.png, uploads/<file>, backups/<backup>.json)
```

- 前端与后端同域，`/api/*` 交给 Hono，其余路径由 `[assets]`（`single-page-application`）返回 `index.html`。
- 每日 03:17（UTC）Cron 触发：把 `trips` + `trip_images` 备份为 JSON 写入 R2，最多保留 10 份。

## 目录结构

```
cloudflare/
├── wrangler.toml          # D1 / R2 / assets / cron 绑定
├── migrations/0001_schema.sql
├── src/
│   ├── index.ts           # Hono 入口 + scheduled 定时备份
│   ├── routes/            # trips/images/stations/operators/backup/seed
│   ├── db/                # drizzle schema + 数据访问（D1）
│   ├── backup.ts          # JSON 备份/恢复、自动备份
│   └── r2.ts              # logo / uploads 读写
├── scripts/
│   ├── seed-d1.mjs        # 把 server/data/seed.db 灌入 D1
│   ├── migrate-user.mjs   # 把 server/data/user.db 灌入 D1
│   ├── upload-r2.mjs      # 把航空 logo 与已有上传图灌入 R2
│   ├── copy-assets.mjs    # 把 client/dist 拷贝到 assets/
│   └── run-wrangler.mjs   # 本地定位 wrangler CLI
└── assets/                # 构建产物（gitignore，由 copy-assets 生成）
```

## 前置条件

- 一个 Cloudflare 账号（Zero Trust 免费档可用于 Access，最多 50 名用户）。
- Node.js 18+，本仓库已 `npm install`（含 `cloudflare` workspace）。

## 一、登录并创建资源

```bash
# 1) 登录 Cloudflare
wrangler login

# 2) 创建 D1 数据库，复制输出的 database_id
wrangler d1 create train-air-db

# 3) 创建 R2 存储桶
wrangler r2 bucket create train-air
```

把第 2 步得到的 `database_id` 填入 `cloudflare/wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "train-air-db"
database_id = "粘贴这里"
```

## 二、灌入数据（一次性）

```bash
# 建表（远程）
npm run db:init:remote -w cloudflare

# 种子数据：站点/机场/运营商（约 1.2 万行，来自 server/data/seed.db）
npm run db:seed:remote -w cloudflare

# 用户数据：trips + trip_images（来自 server/data/user.db）
npm run db:migrate-user:remote -w cloudflare

# 上传 logo 与已有图片到 R2
npm run r2:upload -w cloudflare
```

## 三、构建并部署

```bash
# 1) 构建前端
npm run build -w client

# 2) 拷贝到 assets/（Worker 静态资源）
npm run assets -w cloudflare

# 3) 部署
npm run deploy -w cloudflare
```

部署后 `wrangler deploy` 会给出 Worker 的 `workers.dev` 域名（或已配置的网关域名）。

## 四、配置 Cloudflare Access（访问控制）

1. 打开 Cloudflare Zero Trust 仪表盘 → **Access → Applications → Add an application**。
2. 选择 **Self-hosted**，填入你的域名（如 `your-app.example.com` 和 `workers.dev` 域名）。
3. **Policy**：添加一条允许规则，例如 `Emails` 等于你的邮箱（或 `Everyone` 限定到你的邮箱域名）。
4. 保存即可。之后所有访问（包括 `/api/*`）都会先经过 Access 登录页，未登录用户无法访问。

> Access 是免费的（Zero Trust 免费档 ≤ 50 用户）。若暂时不配置 Access，
> 站点将对外公开——上线前务必先配好 Access 或改用其他认证方案。

## 本地开发

```bash
# 在 cloudflare/ 目录下，用本地 D1/R2 跑 Worker（需先灌本地数据）
cd cloudflare
npm run db:init          # 建表（本地）
npm run db:seed          # 种子数据（本地）
npm run db:migrate-user  # 用户数据（本地）
npm run assets           # 拷贝前端
npx wrangler dev
```

本地也可以触发定时备份：

```bash
curl "http://127.0.0.1:8787/cdn-cgi/local/scheduled"
```

## 备份与恢复

- **下载备份**：`GET /api/backup` 返回 JSON（`trips` + `tripImages`）。
- **恢复**：上传该 JSON（base64）到 `POST /api/backup/restore`，或用服务端自动备份 `POST /api/backup/restore/:name`。
- **自动备份**：每日 Cron 写入 `backups/user-<时间戳>.json`，保留最近 10 份。

> 注意：云版本备份是 JSON 格式，与本地版的 `.db` 文件不兼容。
> 迁移时请使用 `npm run db:migrate-user:remote -w cloudflare`（读取本地 `user.db` 直接灌入 D1），
> 而不是上传旧的 `.db` 备份文件。

## 常见问题

- **D1 报 `too many SQL variables`**：D1 单条查询有变量数量上限，列表接口已按 90 个/批分块，无需处理。
- **`logo`/`upload` 404**：确认先执行了 `npm run r2:upload -w cloudflare`。
- **`database_id = "00000000-..."`**：别忘把 `wrangler.toml` 里的 `database_id` 换成 `wrangler d1 create` 输出的真实值。
- **免费套餐资源限制**：Workers 免费档脚本体积上限约 3MB（压缩后）。本 Worker 不含种子数据，
  体积很小；种子数据在 D1 中，不占用脚本体积。