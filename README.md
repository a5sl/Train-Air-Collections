# Train-Air Collections

一个面向火车迷和航空迷的行程票据管理应用。记录火车和航班的乘坐信息，在地图上可视化移动轨迹。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS |
| 地图 | Leaflet + react-leaflet (OpenStreetMap) |
| 后端 | Express + TypeScript |
| 存储 | JSON 文件（可随时升级为 PostgreSQL） |
| 图标 | Lucide React |

## 快速开始

```bash
# 安装依赖
npm install

# 同时启动前后端
npm run dev

# 或分别启动
npm run dev:server   # Express → http://localhost:3001
npm run dev:client   # Vite → http://localhost:5173
```

首次启动会自动导入种子数据（全球车站、机场、运营商、航空公司）。

## 项目结构

```
Train-Air-Collections/
├── client/                  # React 前端
│   ├── src/
│   │   ├── pages/           # Dashboard, AddTrip, TripList, MapView
│   │   ├── components/      # Layout, OperatorPicker
│   │   ├── hooks/           # useStationSearch
│   │   └── lib/             # API 客户端
│   └── vite.config.ts       # 代理 /api → localhost:3001
├── server/                  # Express 后端
│   ├── src/
│   │   ├── routes/          # trips, stations
│   │   ├── db/              # store.ts (JSON 存储), seed.ts (种子数据)
│   │   └── index.ts         # 入口
│   └── data/                # 运行时 JSON 数据文件
├── shared/                  # 共享类型定义
└── package.json             # Monorepo 根
```

## 数据模型

### Trip（行程）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| type | train / flight | ✓ | 交通工具类型 |
| date | YYYY-MM-DD | ✓ | 出发日期 |
| departureTime | HH:mm | ✓ | 出发时间 |
| arrivalTime | HH:mm | ✓ | 到达时间 |
| timezone | string | ✓ | 时区（如 Asia/Shanghai） |
| departureStationId | number | ✓ | 出发站点 ID |
| arrivalStationId | number | ✓ | 到达站点 ID |
| operator | string | ✓ | 运营方/航空公司 |
| trainFlightNumber | string | ✓ | 车次/航班号 |
| trainName | string | | 列车名（如 和谐号） |
| vehicleType | string | | 车型/机型（如 CRH2A） |
| vehicleNumber | string | | 车辆号码/注册号 |
| durationMinutes | number | | 总用时（可自动计算） |
| distanceKm | number | | 总里程 |
| cost | number | | 花费 |
| currency | string | | 货币代码 |
| seatNumber | string | | 座位号 |
| seatClass | string | | 席位等级 |
| notes | string | | 备注 |

### Station（站点）

| 字段 | 类型 | 说明 |
|---|---|---|
| name | string | 站名/机场名 |
| code | string | IATA 代码 / 站码 |
| city | string | 城市 |
| country | string | 国家 |
| latitude | number | 纬度 |
| longitude | number | 经度 |
| type | train_station / airport | 类型 |

## API 端点

### 行程
- `GET /api/trips` — 列表（含关联站点信息）
- `GET /api/trips/:id` — 详情
- `POST /api/trips` — 创建
- `PUT /api/trips/:id` — 更新
- `DELETE /api/trips/:id` — 删除
- `POST /api/trips/import-csv` — CSV 批量导入

### 站点
- `GET /api/stations?q=` — 搜索
- `GET /api/stations/:id` — 详情
- `POST /api/stations` — 创建

### 运营商
- `GET /api/operators?q=` — 搜索
- `POST /api/operators` — 创建

### 系统
- `GET /api/health` — 健康检查
- `POST /api/seed` — 初始化种子数据

## CSV 批量导入

支持从 CSV 文件批量导入行程。CSV 模板（首行为列名）：

```csv
type,date,departureTime,arrivalTime,timezone,departureStationName,arrivalStationName,operator,trainFlightNumber,trainName,vehicleType,vehicleNumber,durationMinutes,distanceKm,cost,currency,seatNumber,seatClass,notes
train,2026-07-18,08:00,12:30,Asia/Shanghai,北京南站,上海虹桥站,中国国家铁路集团有限公司,G1,复兴号,CR400AF-B,,270,1318,553,CNY,12A,二等座,京沪高铁体验
```

必填列：`type, date, departureTime, arrivalTime, timezone, departureStationName, arrivalStationName, operator, trainFlightNumber`

站点名称必须与系统中已录入的完全一致（可先在系统中录入或通过种子数据初始化）。

## 地图说明

- 火车路线：蓝色实线
- 航班路线：绿色虚线
- 站点标记：按交通工具类型着色
- 自动适配视野范围
- 点击路线/标记可查看详情

## 为迁移预留

- **React Native 迁移**：React 组件结构 + 独立 API 后端，天然适配 React Native
- **地图替换**：地图组件封装在 MapView.tsx，一次性替换 Leaflet → Google Maps/Mapbox
- **铁路精度升级**：数据模型已预留路径字段，可从直线升级为真实铁路走向（OpenRailwayMap）
- **数据库升级**：JSON 存储可随时替换为 PostgreSQL/MySQL，store.ts 接口稳定

## 种子数据覆盖

- 中国铁路车站：76 个（覆盖主要城市）
- 中国机场：32 个
- 国际机场：35 个（日本、韩国、东南亚、中东、欧洲、北美、大洋洲）
- 国际铁路车站：19 个
- 铁路运营商：37 个（中国各铁路局 + 日韩欧美）
- 航空公司：35 个（中国 + 国际主流航司）

种子数据可在系统内随时修改、扩展，手工添加的站点和运营商会持久化保存。
