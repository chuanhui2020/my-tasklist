# 技术栈详情

## 项目概述

个人任务管理系统 —— 全栈边缘部署 Web 应用，前后端均运行在 Cloudflare Workers。

---

## 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| TypeScript | 5.7+ | 编程语言 |
| Hono | 4.7+ | Web 框架 (Workers 生态首选) |
| Drizzle ORM | 0.39+ | ORM (D1 原生支持) |
| jose | 6.0+ | JWT 生成/验证 (Web Crypto API) |
| Web Crypto API | - | 密码哈希 (PBKDF2) + 加密 (AES-GCM) |

### 认证机制

- JWT (HS256)，通过 `jose` 库签发和验证
- Token 载荷：`{user_id, role}`
- 有效期：24 小时
- 路由保护：`authMiddleware` / `adminMiddleware` (Hono 中间件)

### 密码哈希

- PBKDF2-SHA256，100,000 次迭代（Workers 限制最大 100,000）
- 存储格式：`pbkdf2$salt_hex$hash_hex`

### 加密

- AES-256-GCM (Web Crypto API)
- Key derivation：PBKDF2-SHA256，100,000 次迭代

### 中间件

- CORS：通过 `CORS_ORIGINS` 环境变量配置，`maxAge: 86400` 缓存 preflight
- 全局错误处理：统一 `{"error": "..."}` 格式
- Auth 中间件：解析 JWT，查询用户，注入 `c.get('user')`

### AI 调用

- 使用 Workers 原生 `fetch` 调用外部 AI API
- 支持文本和 Vision (图片识别) 两种模式
- Workers I/O 等待不算 CPU 时间，无超时问题

---

## 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue | 3.5 | 前端框架 |
| Vue Router | 4.5 | 路由管理 |
| Vite | 6.3 | 构建工具 |
| Element Plus | 2.9 | UI 组件库 |
| Axios | 1.8 | HTTP 客户端 |
| Three.js | 0.175 | 3D 渲染引擎 |
| ECharts | 6.0 | 数据可视化图表 |

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

20 个 Three.js 3D 放松动画场景，每 10 秒自动轮播：

| 场景 | 组件 | 技术要点 |
|------|------|---------|
| 弹跳球 | BouncingBalls | 物理弹跳模拟、球体碰撞 |
| 呼吸圆环 | BreathingCircle | 缩放动画、节奏呼吸引导 |
| 电路脉冲 | CircuitPulse | 电路板风格、脉冲流动动画 |
| 宇宙尘埃 | CosmicDust | 粒子系统、深空漂浮效果 |
| 水晶矩阵 | CrystalMatrix | 几何晶体排列、折射光效 |
| 赛博网格 | CyberGrid | 网格地形、Synthwave 风格 |
| 数据流 | DataStream | Sprite + CanvasTexture 动态文字、Additive Blending |
| 引力井 | GravityWell | 粒子引力模拟、轨道运动 |
| 全息光环 | HologramRing | 环形全息投影、扫描线效果 |
| 万花筒 | Kaleidoscope | 对称镜像、HSL 色相循环 |
| 熔岩灯 | LavaLamp | 流体模拟、Metaball 效果 |
| 神经网络 | NeuralWeb | 节点动态连线、LineSegments、距离阈值检测 |
| 粒子烟花 | ParticleFireworks | 爆发粒子系统、重力衰减 |
| 钟摆波 | PendulumWave | 参数方程、相位差波动 |
| 等离子球 | PlasmaOrb | ShaderMaterial 自定义着色器、发光效果 |
| 雨滴 | RainDrops | 粒子下落、涟漪扩散 |
| 星空 | StarrySky | BufferGeometry 粒子、螺旋臂算法 |
| 涡旋场 | VortexField | 螺旋曲线、Line + Points 双层渲染 |
| 水波纹 | WaterRipple | PlaneGeometry + 顶点着色器波形变形 |
| 波函数 | WaveFunction | 数学波函数可视化、周期性颜色变化 |

---

## 数据库

| 技术 | 说明 |
|------|------|
| Cloudflare D1 | SQLite 边缘数据库 |
| Drizzle ORM | 类型安全的查询构建 |

- D1 基于 SQLite：无 ENUM（用 TEXT + CHECK）、日期存 TEXT (ISO 8601)、INTEGER PRIMARY KEY 自增
- Schema 定义：`backend/src/db/schema.ts`
- 迁移文件：`backend/drizzle/` 目录下 (0000_initial, 0001_task_images, 0002_last_login_at, 0002_secure_notes_description)

### 数据模型

| 表 | 字段 | 说明 |
|---|------|------|
| users | username, password_hash, role, created_at, last_login_at | 用户 |
| tasks | title, description, status, due_date, user_id | 任务 |
| task_images | task_id, user_id, r2_key, filename, mime_type, size, sort_order | 任务图片 (R2) |
| bmi_profiles | gender, age, height, weight (per user unique) | BMI 档案 |
| fortune_records | fortune_number, fortune_type, type_text, poem, interpretation, advice, work_fortune | 签文记录 |
| secure_notes | title, description, encrypted_content, salt, password_hash | 加密笔记 |
| weight_records | weight, date (user+date unique) | 体重记录 |
| countdowns | title, target_time, remind_before, remind_level, status | 倒计时 |
| weekly_menus | week_start, menu_json, uploaded_by | 每周菜单 |

### 免费额度

| 资源 | 免费额度 |
|------|----------|
| Workers 请求 | 10 万次/天 |
| Workers CPU | 10ms/请求 |
| D1 读取 | 500 万行/天 |
| D1 写入 | 10 万行/天 |
| D1 存储 | 5GB |

---

## 部署架构

```
用户 → Cloudflare Edge (最近节点)
       ├── Workers Static Assets (Vue 3 SPA)  ← tasklist.ch-tools.org
       └── Workers (Hono API)                 ← api-tasklist.ch-tools.org
           ├── D1 (SQLite 数据库)
           ├── R2 (图片存储)
           └── Container (Code Review 自动化)
```

| 组件 | 技术 | 说明 |
|------|------|------|
| 前端 | Cloudflare Workers | 静态资源，git push 自动部署 |
| 后端 | Cloudflare Workers | Hono + TypeScript，`wrangler deploy` |
| 数据库 | Cloudflare D1 | SQLite，APAC 区域 |
| 图片存储 | Cloudflare R2 | 任务图片存储 |
| Code Review | Cloudflare Container | GitHub Webhook + AI 自动审查 |
| SSL | Cloudflare | 自动 HTTPS |

### 请求链路

```
浏览器 → tasklist.ch-tools.org → Workers 边缘节点 → 返回 SPA
Vue 发起 API 请求 → api-tasklist.ch-tools.org → Workers 边缘节点
  → Hono 路由处理 → Drizzle ORM → D1 (SQLite) → JSON 响应返回
```

### 配置

**Workers Secrets (敏感)：**
- `SECRET_KEY`：JWT 签名密钥
- `AI_API_KEY`：AI 服务密钥
- `GITHUB_TOKEN`：GitHub API 访问令牌 (Code Review 自动化)
- `GITHUB_WEBHOOK_SECRET`：GitHub Webhook 签名验证密钥
- `OPENAI_API_KEY`：OpenAI API 密钥 (Code Review 用)

**Workers Vars (明文)：**
- `CORS_ORIGINS`：允许的前端域名
- `AI_BASE_URL`：AI 服务地址
- `AI_MODEL`：AI 模型名称

**前端构建变量：**
- `VITE_API_BASE_URL`：API 地址（`https://api-tasklist.ch-tools.org/api`）

---

## 功能模块

| 模块 | 后端路由 | 前端页面 | 说明 |
|------|---------|---------|------|
| 认证 | /api/auth/* | Login.vue | 登录、用户管理 |
| 任务 | /api/tasks/* | TaskList.vue | 任务 CRUD、筛选排序、图片上传 |
| 占卜 | /api/fortune/* | Fortune.vue | AI 灵签占卜、每日限制 |
| BMI | /api/bmi/* | BmiManager.vue | 体重记录、趋势图表、AI 分析 |
| 密钥盒子 | /api/secure-notes/* | SecureNotes.vue | 加密笔记存储 |
| 倒计时 | /api/countdowns/* | CrazyCountdown.vue | 倒计时提醒 |
| 菜单 | /api/menu/* | MenuManager.vue | AI Vision 菜单识别 |
| 用户管理 | /api/auth/users | AdminUsers.vue | 管理员专属 |
| Code Review | /api/webhooks/github | - | GitHub Webhook + AI 自动代码审查 |
| 体素花园 | - | TaskList.vue 侧边栏 | 20 个 3D 解压动画轮播 |
