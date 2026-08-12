# Cloudflare 部署指南（训练/航班收藏）

将整个应用以**单个 Worker + 静态资源**的方式部署到 Cloudflare，数据放在 **D1**，
图片/logo/备份放在 **R2**，访问控制使用 **Cloudflare Access（Zero Trust 免费版）**。

> 本云版本与本地版的差异：
> - 移除了 **byAir 导入**，仅保留普通 CSV 导入。
> - 登录交给 Cloudflare Access（边缘侧保护站点），应用内校验其 JWT 提取用户邮箱。
> - **多用户数据隔离**：行程表带 `owner` 列，R2 上传/备份按 `uploads/<owner>/`、`backups/<owner>/` 分开，用户只能看到自己的数据。
> - 备份格式由 `.db`（SQLite）改为 `.json`（D1 导出的 trips + trip_images）。
> - 种子数据（站点/机场/运营商）不再由应用启动时写入，而是通过脚本一次性灌入 D1。

## 架构

```
Cloudflare Access (保护整个域名，注入 Cf-Access-Jwt-Assertion)
        │
        ▼
Worker (Hono)  ──assets──▶ 编译后的前端 (cloudflare/assets)
        ├─ auth: requireUser 校验 Access JWT → user.email
        ├── D1  train-air-db   (stations/airports/operators/trips/trip_images)
        └── R2  train-air      (logos/<CODE>.png, uploads/<owner>/<file>, backups/<owner>/<backup>.json)
```

- 前端与后端同域，`/api/*` 交给 Hono，其余路径由 `[assets]`（`single-page-application`）返回 `index.html`。
- 所有 `/api/*` 都经过 `requireUser` 中间件：校验 `Cf-Access-Jwt-Assertion`（issuer/audience/JWKS），把用户邮箱放到请求上下文；数据查询与 R2 读写全部按该邮箱（owner）隔离。
- 每日 03:17（UTC）Cron 触发：为每个 owner 把 `trips` + `trip_images` 备份为 JSON 写入 R2（`backups/<owner>/user-<时间戳>.json`），每个用户最多保留 10 份。

## 目录结构

```
cloudflare/
├── wrangler.toml          # D1 / R2 / assets / cron 绑定 + [vars]（TEAM_NAME / POLICY_AUD）
├── migrations/
│   ├── 0001_schema.sql
│   └── 0002_multi_user.sql  # trips 增加 owner 列
├── src/
│   ├── index.ts           # Hono 入口 + scheduled 定时备份
│   ├── auth.ts            # requireUser：校验 Access JWT（JWKS），dev 回退 DEV_USER
│   ├── env.ts             # 环境变量类型（TEAM_NAME / POLICY_AUD / DEV_USER）
│   ├── context.ts         # Hono Variables（user）
│   ├── routes/            # trips/images/stations/operators/backup/seed
│   ├── db/                # drizzle schema + 数据访问（D1）
│   ├── backup.ts          # JSON 备份/恢复、自动备份（按 owner）
│   └── r2.ts              # logo / uploads 读写（按 owner 前缀）
├── scripts/
│   ├── seed-d1.mjs        # 把 server/data/seed.db 灌入 D1
│   ├── migrate-user.mjs   # 把 server/data/user.db 灌入 D1
│   ├── assign-owner.mjs   # 把无 owner 的历史 trips 指派给某个邮箱（--email / --local|--remote）
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

Access 身份参数已在 `cloudflare/wrangler.toml` 的 `[vars]`（TEAM_NAME / POLICY_AUD），
本地开发在 `cloudflare/.dev.vars` 放 `DEV_USER = "你的邮箱"`（绕过 Access，仅限本地）。

## 二、灌入数据（一次性）

```bash
# 建表（远程）
npm run db:init:remote -w cloudflare

# 种子数据：站点/机场/运营商（约 1.2 万行，来自 server/data/seed.db）
npm run db:seed:remote -w cloudflare

# 用户数据：trips + trip_images（来自 server/data/user.db）
npm run db:migrate-user:remote -w cloudflare

# 把历史 trips 指派给主账号（升级自单用户版时必需，否则老数据所有人不可见）
npm run assign-owner -w cloudflare -- --email chopard2407@gmail.com --remote

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

登录方式有**邮箱验证码（OTP）**与 **Cloudflare 账号登录**两种，共用同一条 Allow 策略（命中任一即放行）。

1. **邮箱验证码（OTP）**：内置 IdP，零配置；用户输入任意邮箱收验证码即可登录。
2. **Cloudflare 账号登录**：Zero Trust → **Integrations → Identity providers** → **Add new** → **Cloudflare**，建议勾选 **Restrict to account members**（只允许你账号的受邀成员登录，安全；本应用已开启）。

**Allow 策略示例**（本应用当前配置）：
- Include `Emails` = `chopard2407@gmail.com`（主账号，走 OTP 或 CF 账号皆可）
- Include `Cloudflare Account Member` = 当前账号 ID（所有受邀成员都能用 CF 账号登录）

> JSON 字段：`"include": [ {"email": {"email": "..."}}, {"cloudflare_account_member": {"account_id": "..."}} ]`
> 免费的 Zero Trust 最多 50 名用户。

**邀请新用户两种方式**
- 走 **CF 账号登录**：把你账号 → **Manage Account → Members → Invite** 加对方邮箱，对方接受后用自己的 CF 账号登录；Allow 策略里的 `Cloudflare Account Member` 选择器自动覆盖他，无需改策略。
- 走 **OTP**：直接在 Allow 策略里加一条 `Emails` 等于对方邮箱即可——对方只要有任意邮箱就能收验证码，无需 CF 账号。
- 顺带注意成员角色：给家人/朋友建议用受限角色（如 Cloudflare Zero Trust 相关只读），避免 Administrator 级权限误操作账号资源。

> **数据隔离与只读性**：每个登录者都只能看到自己邮箱（owner）名下的行程数据，互相不可见；需要"共享同一份数据"是另一需求（如 owner 组），本方案不支持。
> 若不配置策略，Access 默认**拒绝所有请求**（含你自己），务必先加 Allow 策略再上线。


## 本地开发

```bash
# 在 cloudflare/ 目录下，用本地 D1/R2 跑 Worker（需先灌本地数据）
cd cloudflare
# .dev.vars 中设置 DEV_USER=你的邮箱（绕开 Access，否则本地 API 全部 401）
echo 'DEV_USER = "chopard2407@gmail.com"' > .dev.vars
npm run db:init          # 建表（本地）
npm run db:seed          # 种子数据（本地）
npm run db:migrate-user  # 用户数据（本地）
node scripts/assign-owner.mjs --email chopard2407@gmail.com --local
npm run assets           # 拷贝前端
npx wrangler dev
```

本地也可以触发定时备份：

```bash
curl "http://127.0.0.1:8787/cdn-cgi/local/scheduled"
```

## 备份与恢复

- **下载备份**：`GET /api/backup` 返回当前用户（owner）的 JSON（`trips` + `tripImages`）。
- **恢复**：上传该 JSON（base64）到 `POST /api/backup/restore`，或用服务端自动备份 `POST /api/backup/restore/:name`。
- **自动备份**：每日 Cron 为每个用户写入 `backups/<owner>/user-<时间戳>.json`，每人保留最近 10 份。

> 注意：备份是**按 owner 隔离**的，`GET /api/backup`、恢复、自动备份都只影响当前登录用户的邮箱。
> 云版本备份是 JSON 格式，与本地版的 `.db` 文件不兼容。
> 迁移时请使用 `npm run db:migrate-user:remote -w cloudflare`（读取本地 `user.db` 直接灌入 D1），
> 而不是上传旧的 `.db` 备份文件。

## 常见问题

- **站点打不开 / 403（Everyone is blocked）**：Access 策略为空或其 Allow 策略未包含你的邮箱，先在 Zero Trust 里加 Allow（Emails = 你的邮箱）。
- **登录页没有「Cloudflare 登录」按钮**：确认 Zero Trust → Integrations → Identity providers 里存在 `cloudflare` 类型 IdP，且开启 Restrict to account members。
- **朋友用 Cloudflare 账号登录后站点打开但列表是空的**：正常——数据按 owner（邮箱）隔离，新成员看不到别人的行程，自己名下没有数据。重新指派数据请用 `assign-owner.mjs`，或让他自己新建。
- **`/api/*` 返回 401**：说明 Access JWT 未能通过校验——确认 `[vars].TEAM_NAME`、`POLICY_AUD` 与实际 Access 应用一致，且 `assets` 之外的 `/api` 确实由 Worker 处理。
- **看不到历史数据**：升级自单用户版时忘了跑 `assign-owner.mjs`，trips 的 `owner` 为空，任何用户都查不到，先执行指派脚本。
- **D1 报 `too many SQL variables`**：D1 单条查询有变量数量上限，列表接口已按 90 个/批分块，无需处理。
- **`logo`/`upload` 404**：确认先执行了 `npm run r2:upload -w cloudflare`，且上传文件在 `uploads/<owner>/` 下（历史旧文件请复制到该前缀）。
- **`database_id = "00000000-..."`**：别忘把 `wrangler.toml` 里的 `database_id` 换成 `wrangler d1 create` 输出的真实值。
- **免费套餐资源限制**：Workers 免费档脚本体积上限约 3MB（压缩后）。本 Worker 不含种子数据，
  体积很小；种子数据在 D1 中，不占用脚本体积。