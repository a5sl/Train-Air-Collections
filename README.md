# Train-Air Collections

一个面向火车迷和航空迷的行程票据管理应用。记录火车和航班的乘坐信息，在地图上可视化移动轨迹，生成年度出行报告。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite 6 + Tailwind CSS |
| 路由 | react-router-dom 6 |
| 地图 | Leaflet + react-leaflet (OpenStreetMap) |
| 后端 | Express + TypeScript (tsx 热重载) |
| 存储 | SQLite (sql.js + Drizzle ORM)，seed.db 与 user.db 分离 |
| 时区 | tz-lookup（经纬度 → 时区自动推断） |
| 图标 | Lucide React |
| 包管理 | npm workspaces monorepo |

## 前置条件

- Node.js 18+（推荐 20+）
- npm 9+

## 快速开始

```bash
# 克隆仓库
git clone <repo-url> && cd Train-Air-Collections

# 安装所有工作区的依赖
npm install

# 同时启动前后端
npm run dev

# 或分别启动
npm run dev:server   # Express -> http://localhost:3001
npm run dev:client   # Vite    -> http://localhost:5173
```

仓库自带预构建的 `server/data/seed.db`（全球车站、机场、运营商种子数据），无需额外初始化。用户行程数据自动保存到 `server/data/user.db`，首次启动自动建表。

## 项目结构

```
Train-Air-Collections/
├── client/                       # React 前端
│   ├── src/
│   │   ├── pages/                # Dashboard, AddTrip, EditTrip, TripList, MapView, AnnualReport
│   │   ├── components/           # Layout, OperatorPicker, Ticket, ImageGallery, AirlineLogo ...
│   │   │   └── fx/              # 动效组件（SplitFlap, TrainLoader, ParallaxBackdrop, Toast ...）
│   │   ├── hooks/                # useStationSearch
│   │   └── lib/                  # API 客户端、主题、快捷键、时区、坐标、节气等工具
│   └── vite.config.ts            # 代理 /api -> localhost:3001
├── server/                       # Express 后端
│   ├── src/
│   │   ├── routes/               # trips, stations, images, backup
│   │   ├── db/                   # schema.ts, index.ts, store.ts, seed.ts
│   │   │   ├── seed-*.ts         # 模块化种子数据（中/国际铁路和航空）
│   │   │   ├── import-byair.ts   # byAir 专用 CSV 导入
│   │   │   ├── iata-codes.ts     # IATA 代码填充
│   │   │   ├── migrate.ts        # JSON -> SQLite 一次性迁移工具
│   │   │   ├── migrate-timezones.ts  # 时区数据迁移
│   │   │   └── push.ts           # 种子数据重载
│   │   ├── geo.ts                # 地理工具（Haversine 距离）
│   │   ├── timezone.ts           # 时区计算工具
│   │   └── index.ts              # 入口
│   └── data/
│       ├── seed.db               # 种子数据（站点 + 机场 + 运营商，随仓库分发）
│       ├── user.db               # 用户行程 + 图片元数据（gitignore，自动创建）
│       ├── airline-logos/        # 航空公司 Logo PNG（自托管）
│       ├── backups/              # 自动备份目录
│       └── uploads/              # 行程图片上传目录
├── shared/                       # 共享类型定义（Trip, Station, TripImage ...）
├── scripts/                      # 种子数据生成、航司 Logo 抓取、时区修复脚本
├── rail_airport_stat/            # 原始车站/机场统计数据（gitignore）
├── package.json                  # Monorepo 根
└── translation_map.json          # 翻译对照
```

## 功能亮点

- **行程管理**：创建、编辑、删除火车/航班行程，支持跨日跨时区
- **地图可视化**：Leaflet 地图展示所有行程轨迹（火车蓝色实线 / 航班绿色虚线）
- **年度报告**：按年生成出行统计报告（`/report/:year`）
- **行程图片**：为每条行程上传多张图片（jpeg/png/webp/gif，单张 ≤ 8MB）
- **数据备份**：一键导出 user.db / 从备份恢复，服务端自动备份
- **航司 Logo**：自托管航空公司 Logo，按 IATA 代码加载
- **CSV 批量导入**：标准格式 + byAir 格式两种导入方式
- **暗色主题**：支持亮/暗主题切换
- **丰富动效**：翻牌动画、列车加载、视差背景、彩蛋列车等

## 数据模型

### Trip（行程）— 存储在 user.db

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| type | train / flight | ✓ | 交通工具类型 |
| departureDate | YYYY-MM-DD | ✓ | 出发日期 |
| arrivalDate | YYYY-MM-DD | ✓ | 到达日期（支持跨日） |
| departureTime | HH:mm | ✓ | 出发时间 |
| arrivalTime | HH:mm | ✓ | 到达时间 |
| departureTimezone | string | ✓ | 出发时区（如 Asia/Shanghai） |
| arrivalTimezone | string | ✓ | 到达时区（如 Asia/Tokyo） |
| departureStationId | number | ✓ | 出发站点 ID |
| arrivalStationId | number | ✓ | 到达站点 ID |
| operator | string | ✓ | 运营方/航空公司 |
| trainFlightNumber | string | ✓ | 车次/航班号 |
| trainName | string | | 列车名（如 复兴号） |
| vehicleType | string | | 车型/机型（如 CR400AF-B） |
| vehicleNumber | string | | 车辆号码/注册号 |
| carriageNumber | string | | 车厢号 |
| durationMinutes | number | | 总用时（自动计算） |
| distanceKm | number | | 总里程（自动计算） |
| cost | number | | 花费 |
| currency | string | | 货币代码（CNY, JPY 等） |
| seatNumber | string | | 座位号 |
| seatClass | string | | 席位等级 |
| notes | string | | 备注 |
| createdAt | ISO datetime | | 创建时间（自动） |
| updatedAt | ISO datetime | | 更新时间（自动） |

### TripImage（行程图片）— 存储在 user.db

| 字段 | 类型 | 说明 |
|---|---|---|
| tripId | number | 所属行程 ID |
| filename | string | 服务器文件名 |
| originalName | string | 原始文件名 |
| mime | string | MIME 类型（image/jpeg, image/png, image/webp, image/gif） |
| size | number | 文件大小（字节） |
| sortOrder | number | 排序序号 |
| createdAt | ISO datetime | 上传时间 |

### Station（站点）— 存储在 seed.db

| 字段 | 类型 | 说明 |
|---|---|---|
| name | string | 站名/机场名 |
| code | string | IATA 代码 / 站码 |
| city | string | 城市 |
| country | string | 国家 |
| latitude | number | 纬度 |
| longitude | number | 经度 |
| type | train_station / airport | 类型 |
| timezone | string | 时区 |

### Operator（运营商）— 存储在 seed.db

| 字段 | 类型 | 说明 |
|---|---|---|
| name | string | 运营商名称 |
| code | string | IATA 代码（航司）或缩写 |
| type | railway / airline / other | 类型 |

## API 端点

### 行程
- `GET /api/trips` — 列表（含关联站点和图片信息，按出发日期降序）
- `GET /api/trips/:id` — 详情
- `POST /api/trips` — 创建（自动计算 durationMinutes 和 distanceKm）
- `PUT /api/trips/:id` — 更新（自动重算耗时和距离）
- `DELETE /api/trips/:id` — 删除
- `POST /api/trips/import-csv` — CSV 批量导入
- `POST /api/trips/import-byair` — byAir 格式 CSV 导入

### 行程图片
- `GET /api/trips/:tripId/images` — 获取行程的所有图片
- `POST /api/trips/:tripId/images` — 上传图片（body: { dataBase64, mime, originalName }）
- `DELETE /api/trips/:tripId/images/:imageId` — 删除图片
- `GET /api/uploads/:filename` — 静态图片文件服务

### 站点
- `GET /api/stations?q=` — 搜索
- `GET /api/stations/:id` — 详情
- `POST /api/stations` — 创建

### 运营商
- `GET /api/operators?q=&type=` — 搜索（支持按类型过滤：railway / airline）
- `GET /api/operators/by-code/:code` — 按 IATA 代码精确查找
- `POST /api/operators` — 创建

### 航司 Logo
- `GET /api/airlines/logo/:code` — 获取航空公司 Logo（2-3 位 IATA 代码）

### 备份与恢复
- `GET /api/backup` — 下载当前 user.db
- `GET /api/backup/list` — 列出服务端自动备份
- `POST /api/backup/restore` — 从 base64 数据恢复（body: { dataBase64 }）
- `POST /api/backup/restore/:name` — 从服务端备份文件恢复

### 系统
- `GET /api/health` — 健康检查
- `POST /api/seed` — 初始化种子数据

## 自动计算

创建或更新行程时，服务器会自动计算两项数据：

- **durationMinutes**：基于出发/到达日期、时间和各自时区，精确计算实际耗时（支持跨日、跨时区行程）
- **distanceKm**：基于出发站和到达站的经纬度，使用 Haversine 公式计算大圆距离

如果手动指定了 `durationMinutes` 或 `distanceKm`，服务器以手动值为准（创建时）；更新时服务器始终以自动计算覆盖 `durationMinutes`。

## CSV 批量导入

支持从 CSV 文件批量导入行程。提供两种导入方式：

### 标准格式 `POST /api/trips/import-csv`

CSV 模板（首行为列名）：

```csv
type,departureDate,arrivalDate,departureTime,arrivalTime,departureStationName,arrivalStationName,operator,trainFlightNumber,trainName,vehicleType,vehicleNumber,carriageNumber,durationMinutes,distanceKm,cost,currency,seatNumber,seatClass,notes
train,2026-07-18,2026-07-18,08:00,12:30,北京南站,上海虹桥站,中国国家铁路集团有限公司,G1,复兴号,CR400AF-B,,,270,1318,553,CNY,12A,二等座,京沪高铁体验
```

必填列：`type, departureDate, arrivalDate, departureTime, arrivalTime, departureStationName, arrivalStationName, operator, trainFlightNumber`

**导入特性**：
- 模糊站名匹配：自动处理「站」「駅」后缀差异
- 自动创建未知站点：如果站名不在种子数据中，自动在 seed.db 创建
- 自动计算耗时和里程（未手动指定时）

### byAir 格式 `POST /api/trips/import-byair`

专用于从 byAir 导出的航班 CSV 格式，接受 `csvPath` 参数指定文件路径。

## 地图说明

- 火车路线：蓝色实线
- 航班路线：绿色虚线
- 站点标记：按交通工具类型着色
- 自动适配视野范围
- 点击路线/标记可查看详情

## 种子数据覆盖

种子数据预构建在 `server/data/seed.db` 中，随仓库分发：

- 中国铁路车站：覆盖全国主要城市
- 中国机场：覆盖国内主要航空枢纽
- 国际机场：日本、韩国、东南亚、中东、欧洲、北美、大洋洲
- 国际铁路车站：日韩等国家主要车站
- 铁路运营商：~75 个（中国各铁路局 + 日韩欧美）
- 航空公司：覆盖中国及国际主流航司（含 IATA 代码）

种子数据可在系统内随时搜索、修改和扩展，手工添加的站点和运营商会持久化保存到 `seed.db`。

## 数据库架构

采用双数据库分离设计：

- **seed.db**：站点（stations）+ 机场（airports）+ 运营商（operators），可跨部署共享，通过 Drizzle ORM 管理
- **user.db**：用户行程（trips）+ 行程图片（trip_images），个人数据不入版本控制（已加入 .gitignore）

两个数据库之间的站点引用通过整数 ID 完成，不使用数据库级外键约束。迁移工具 `server/src/db/migrate.ts` 可将旧版 JSON 数据导入 SQLite。

## 前端页面

| 路由 | 页面 | 说明 |
|---|---|---|
| `/` | Dashboard | 总览仪表盘 |
| `/add` | AddTrip | 新增行程 |
| `/edit/:id` | EditTrip | 编辑行程 |
| `/trips` | TripList | 行程列表 |
| `/map` | MapView | 地图轨迹 |
| `/report/:year?` | AnnualReport | 年度出行报告 |
