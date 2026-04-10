# 个人任务管理系统

<div align="center">

一个基于 **Cloudflare Workers + Vue 3 + D1** 的全栈边缘部署任务管理应用

🌍 **全球边缘部署** | 🔐 **用户认证** | 📱 **响应式设计** | 💰 **零服务器成本**

</div>

---

## 功能特性

- **任务管理** — 创建、编辑、删除、状态切换、截止日期、分页排序
- **用户系统** — JWT 认证、角色权限（管理员/普通用户）、密码修改
- **AI 运势签文** — 每日一签，AI 生成签诗与解读
- **BMI 健康管理** — 体重记录、趋势分析、AI 健康建议
- **加密笔记** — AES-GCM 加密，密码保护
- **倒计时提醒** — 自定义提醒时间和级别
- **菜单识别** — AI Vision 识别菜单图片
- **3D 动画** — 10 个 Three.js 放松动画场景

---

## 架构

```
用户 → Cloudflare Edge (最近节点)
       ├── Workers Static Assets (Vue 3 SPA)  ← tasklist.ch-tools.org
       └── Workers (Hono API)                 ← api-tasklist.ch-tools.org
           └── D1 (SQLite 数据库)
```

全栈运行在 Cloudflare 边缘，零服务器，免费额度内。

## 技术栈

| 层 | 技术 |
|---|---|
| 后端框架 | Hono (TypeScript) |
| 数据库 | Cloudflare D1 (SQLite) |
| ORM | Drizzle ORM |
| 认证 | JWT (jose, Web Crypto API) |
| 前端框架 | Vue 3 + Vue Router 4 |
| UI 组件 | Element Plus |
| 构建工具 | Vite 6 |
| 3D 动画 | Three.js |
| 部署 | Cloudflare Workers |

---

## 项目结构

```
my-tasklist/
├── workers-backend/            # 后端 (Cloudflare Workers)
│   ├── wrangler.jsonc          # Workers + D1 配置
│   ├── src/
│   │   ├── index.ts            # Hono 入口，路由注册，CORS
│   │   ├── types.ts            # 类型定义
│   │   ├── db/schema.ts        # Drizzle 表定义
│   │   ├── middleware/auth.ts  # JWT 认证中间件
│   │   ├── routes/             # API 路由 (auth/tasks/fortune/bmi/...)
│   │   └── lib/                # 工具库 (crypto/token/ai)
│   └── drizzle/                # D1 SQL 迁移
│
├── frontend/                   # 前端 (Vue 3 SPA)
│   ├── wrangler.jsonc          # Workers 静态部署配置
│   ├── src/
│   │   ├── api/index.js        # Axios API 客户端
│   │   ├── views/              # 页面组件
│   │   ├── components/         # 通用组件 + Three.js 动画
│   │   └── router.js           # 路由配置
│   └── vite.config.js
│
├── CLAUDE.md                   # 开发者指南
└── README.md
```

---

## 部署

### 后端部署

```bash
cd workers-backend
npm install
npx wrangler deploy
```

Secrets 配置：
```bash
echo "your-secret" | npx wrangler secret put SECRET_KEY
echo "your-api-key" | npx wrangler secret put AI_API_KEY
```

### 前端部署

每次 `git push` 到 master 自动触发 Cloudflare Workers 构建部署。

### 本地开发

```bash
# 后端
cd workers-backend && npm install && npx wrangler dev

# 前端
cd frontend && npm install && npm run dev
```

### D1 数据库

```bash
# 初始化 schema
npx wrangler d1 execute tasklist_db --remote --file=drizzle/0000_initial.sql

# 查询数据
npx wrangler d1 execute tasklist_db --remote --command="SELECT * FROM users"
```

---

## API 接口

| 模块 | 方法 | 路径 | 说明 |
|------|------|------|------|
| Auth | POST | /api/auth/login | 登录 |
| Auth | GET | /api/auth/me | 当前用户 |
| Auth | GET | /api/auth/users | 用户列表 (admin) |
| Auth | POST | /api/auth/users | 创建用户 (admin) |
| Auth | POST | /api/auth/change-password | 修改密码 |
| Tasks | GET | /api/tasks | 任务列表 (分页) |
| Tasks | POST | /api/tasks | 创建任务 |
| Tasks | PUT | /api/tasks/:id | 更新任务 |
| Tasks | PATCH | /api/tasks/:id/status | 切换状态 |
| Tasks | DELETE | /api/tasks/:id | 删除任务 |
| Fortune | POST | /api/fortune/generate | 生成运势 |
| Fortune | GET | /api/fortune/today | 今日运势 |
| Fortune | GET | /api/fortune/history | 历史记录 |
| BMI | POST | /api/bmi/advice | AI 健康建议 |
| BMI | GET/PUT | /api/bmi/profile | 档案管理 |
| BMI | POST | /api/bmi/weight | 记录体重 |
| BMI | POST | /api/bmi/weight/analysis | AI 体重分析 |
| Notes | GET/POST | /api/secure-notes | 笔记列表/创建 |
| Notes | POST | /api/secure-notes/:id/unlock | 解锁笔记 |
| Countdown | GET/POST | /api/countdowns | 倒计时列表/创建 |
| Menu | GET | /api/menu/today | 今日菜单 |
| Menu | POST | /api/menu/upload | 上传菜单图片 (admin) |

---

## 默认账号

- 用户名: `admin`
- 密码: `123456`
- 首次使用请修改密码

---

## 更新日志

### v3.0.0 (2026-04-10)
- 全栈边缘部署：Cloudflare Workers (Hono) + D1 (SQLite)
- 零服务器成本，全球就近响应
