# 技术栈详情

## 项目概述

个人任务管理系统 —— 全栈 Web 应用，采用前后端分离架构，Docker Compose 一键部署。

---

## 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| Python | 3.10 | 运行环境 |
| FastAPI | 0.115.0 | Web 框架 |
| Uvicorn | 0.30.6 | ASGI 服务器 |
| SQLAlchemy | 2.0.35 | ORM |
| PyMySQL | 1.1.0 | MySQL 驱动 |
| Pydantic Settings | 2.5.2 | 配置管理 |
| itsdangerous | 2.2.0 | Token 认证（URLSafeTimedSerializer） |
| werkzeug | 3.0.4 | 密码哈希 |
| python-dotenv | 1.0.0 | 环境变量加载 |
| cryptography | - | 加密支持 |
| requests | 2.31.0 | HTTP 客户端（AI 服务调用） |

### 认证机制

- 使用 `itsdangerous.URLSafeTimedSerializer` 生成无状态 Token
- Token 载荷：`{user_id, role}`
- 有效期：24 小时（86400 秒）
- 路由保护：`Depends(get_current_user)` / `Depends(require_admin)`

### 中间件

- CORS：通过 `CORS_ORIGINS` 环境变量配置允许的前端域名
- 自定义异常处理器：统一 `{"error": "..."}` 格式
- 请求验证错误返回 400 + `{"error": "参数格式错误"}`

### 数据库迁移

- 启动时通过 `sqlalchemy.inspect()` 检查表结构
- 使用原生 SQL `ALTER TABLE` 执行内联迁移
- 不依赖 Alembic

---

## 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue | 3.5.13 | 前端框架 |
| Vue Router | 4.5.0 | 路由管理 |
| Vite | 6.3.5 | 构建工具 |
| Element Plus | 2.9.7 | UI 组件库 |
| @element-plus/icons-vue | 2.3.1 | 图标库 |
| Axios | 1.8.4 | HTTP 客户端 |
| Three.js | 0.175.0 | 3D 渲染引擎 |
| ECharts | 6.0 | 数据可视化图表 |
| @vitejs/plugin-vue | 5.2.3 | Vite Vue 插件 |

### 前端架构

- 组合式 API（`<script setup>`）与 Options API 混用
- Axios 拦截器：请求自动注入 Token，401 响应自动跳转登录
- 路由守卫：`beforeEach` 检查认证状态和管理员权限
- 本地存储：`tasklist_token`（Token）、`tasklist_user`（用户 JSON）

### 设计风格

- 赛博朋克 / Glassmorphism 暗色主题
- CSS 变量体系：`--bg-glass`、`--glass-border`、`--primary-color`（#06B6D4）等
- `backdrop-filter: blur(12px)` 毛玻璃效果
- Three.js Additive Blending + GLSL Shader 实现 3D 发光特效

### 3D 动画模块（体素花园）

10 个 Three.js 3D 场景，每 10 秒自动轮播：

| 场景 | 技术要点 |
|------|---------|
| 奶龙 | InstancedMesh 体素渲染、粒子系统（樱花）、OrbitControls |
| 极光 | ShaderMaterial 自定义顶点/片元着色器、三角带网格 |
| 数字雨 | Sprite + CanvasTexture 动态文字、Additive Blending |
| 粒子星系 | 8000 粒子 BufferGeometry、螺旋臂算法、径向渐变色 |
| 几何隧道 | RingGeometry 多边形环、HSL 色相循环、脉冲缩放 |
| 粒子网络 | 120 节点动态连线、LineSegments、距离阈值检测 |
| 流光线条 | 参数方程螺旋曲线、Line + Points 双层渲染 |
| 分形生长 | 递归分形树生成、生长动画插值、周期性颜色变化 |
| 波形山脉 | PlaneGeometry + 顶点着色器波形变形、Synthwave 风格 |
| DNA 螺旋 | CatmullRomCurve3 + TubeGeometry 骨架、MeshPhongMaterial 光照 |

---

## 数据库

| 技术 | 版本 | 用途 |
|------|------|------|
| MySQL | 8.4 | 主数据库 |

- 字符集：utf8mb4
- 连接串：`mysql+pymysql://user:password@db:3306/tasklist_db?charset=utf8mb4`
- 数据持久化：Docker Volume `tasklist_mysql_data`

### 数据模型

- `User`：username、password_hash、role（admin/user）
- `Task`：title、description、status（pending/done）、due_date、user_id（FK）
- BMI 相关表：体重记录、BMI 档案
- 占卜相关表：签文记录
- 密钥盒子：加密笔记

---

## 部署架构

```
┌──────────────────────────┐     ┌─────────────────────────────────────┐
│   Cloudflare Workers     │     │   1C2G 新加坡服务器                  │
│                          │     │                                     │
│  Vue 3 SPA 静态文件       │────│  Caddy (反向代理)                    │
│  tasklist.ch-tools.org   │ API │  ├── api-tasklist.ch-tools.org      │
│                          │────│  │   → 127.0.0.1:9000               │
│  自动构建 & 部署          │     │  │                                   │
│  (git push 触发)         │     │  ┌──────────┐  ┌──────────┐        │
└──────────────────────────┘     │  │ FastAPI  │──│  MySQL   │        │
                                 │  │ (后端)   │  │ (数据库) │        │
                                 │  │ :8000    │  │ :3306    │        │
                                 │  └──────────┘  └──────────┘        │
                                 │  tasklist_network (bridge)          │
                                 └─────────────────────────────────────┘
```

### 生产环境

| 组件 | 技术 | 说明 |
|------|------|------|
| 前端托管 | Cloudflare Workers | 静态资源全球 CDN，git push 自动部署 |
| 反向代理 | Caddy | 自动 HTTPS，反代后端 API |
| 后端 | FastAPI + Uvicorn | Docker 容器，内存限制 384MB |
| 数据库 | MySQL 8.4 | Docker 容器，内存限制 512MB |
| SSL | Cloudflare Proxy | 前端和 API 均通过 Cloudflare 代理 |

### 请求链路

**前端页面加载：**

```
浏览器 → DNS(tasklist.ch-tools.org)
  → Cloudflare Workers 边缘节点（全球 CDN 就近响应）
  → 返回 index.html + JS/CSS
  → 浏览器渲染 Vue SPA
```

**API 请求：**

```
Vue 应用发起请求（如 POST /api/auth/login）
  → DNS(api-tasklist.ch-tools.org) → Cloudflare Proxy（自动 HTTPS）
  → Caddy（匹配域名，reverse_proxy 127.0.0.1:9000）
  → Docker 端口映射（9000 → 容器内 8000）
  → FastAPI 处理业务逻辑
  → SQLAlchemy → MySQL（容器内 3306）
  → JSON 响应原路返回
```

**跨域处理：**

```
前端域: tasklist.ch-tools.org
后端域: api-tasklist.ch-tools.org
  → 浏览器检测跨域，先发 OPTIONS preflight
  → FastAPI CORSMiddleware 校验 Origin 是否在 CORS_ORIGINS 白名单
  → 返回 Access-Control-Allow-Origin
  → 正式请求携带 Authorization: Bearer <token>
```

两条链路完全独立：前端挂了不影响 API，后端挂了前端页面仍可加载。

### 本地开发

| 服务 | 镜像 | CPU 限制 | 内存限制 | 健康检查 |
|------|------|---------|---------|---------|
| db | mysql:8.4 | 0.5 | 512MB | mysqladmin ping / 10s |
| backend | python:3.10-slim | 0.3 | 384MB | HTTP GET /docs / 30s |
| frontend | nginx:alpine | 0.2 | 128MB | wget /health / 30s |

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|-------|
| MYSQL_ROOT_PASSWORD | 数据库 root 密码 | - |
| MYSQL_PASSWORD | 应用数据库密码 | - |
| SECRET_KEY | Token 签名密钥 | dev-secret-key-change-in-production |
| CORS_ORIGINS | 允许的前端域名（逗号分隔） | https://tasklist.ch-tools.org,http://localhost:3000 |
| DATABASE_URL | 数据库连接串 | Docker Compose 自动设置 |
| AI_API_KEY | AI 服务密钥 | - |
| AI_BASE_URL | AI 服务地址 | https://api.deepseek.com |
| AI_MODEL | AI 模型名称 | deepseek-chat |
| VITE_API_BASE_URL | 前端 API 地址（构建时） | /api |

---

## 功能模块

| 模块 | 后端路由 | 前端页面 | 说明 |
|------|---------|---------|------|
| 认证 | /api/auth/* | Login.vue | 登录、用户管理 |
| 任务 | /api/tasks/* | TaskList.vue | 任务 CRUD、筛选排序 |
| 占卜 | /api/fortune/* | Fortune.vue | AI 灵签占卜、每日限制 |
| BMI | /api/bmi/* | BmiManager.vue | 体重记录、趋势图表、AI 分析 |
| 密钥盒子 | /api/secure-notes/* | SecureNotes.vue | 加密笔记存储 |
| 用户管理 | /api/auth/users | AdminUsers.vue | 管理员专属 |
| 体素花园 | - | TaskList.vue 侧边栏 | 10 个 3D 解压动画轮播 |
